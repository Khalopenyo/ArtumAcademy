'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { decideLessonAccess } from '@/lib/access/lesson-access';
import { auditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { notify } from '@/server/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPayment, yookassaConfigured } from '@/lib/yookassa/client';
import { getCurrentUser } from '@/server/queries/auth';
import { getMyActiveSubscription } from '@/server/queries/commerce';

/**
 * Commerce Server Actions — мутации для покупок, прогресса, wishlist,
 * подписок. Все пишут под service_role (createAdminClient) — RLS обходим,
 * но проверки доступа делаем явно через assertUser() / лог-логику.
 *
 * Возвращают { ok: true, data? } | { ok: false, error: string } —
 * не throw, чтобы клиент мог показать ошибку через sonner.
 */

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function getOrFail(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Сначала войдите в аккаунт' };
  return { ok: true, userId: user.id };
}

/**
 * Проверяет доступ пользователя к курсу, которому принадлежит урок.
 * Гейт для прогресса/сертификата: Server Action — открытый эндпоинт, и без
 * этой проверки залогиненный юзер мог отметить уроки неоплаченного курса
 * и получить сертификат без покупки. Доступ = preview | admin | подписка | покупка.
 */
async function assertLessonAccess(userId: string, lessonId: string): Promise<ActionResult> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('lessons')
    .select('preview, modules:module_id ( course_id )')
    .eq('id', lessonId)
    .maybeSingle();

  const row = data as
    | { preview: boolean; modules: { course_id: string }[] | { course_id: string } | null }
    | null;
  const courseId = !row
    ? undefined
    : Array.isArray(row.modules)
      ? row.modules[0]?.course_id
      : row.modules?.course_id;

  if (!row || !courseId) return { ok: false, error: 'Урок не найден' };

  // preview открыт всем — не делаем лишних запросов
  if (row.preview === true) return { ok: true };

  const [{ data: profile }, { data: sub }, { data: purchase }] = await Promise.all([
    admin.from('profiles').select('is_admin').eq('id', userId).maybeSingle(),
    admin
      .from('subscriptions')
      .select('id, is_all_courses')
      .eq('user_id', userId)
      .eq('cancelled', false)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle(),
    admin
      .from('purchases')
      .select('user_id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle(),
  ]);

  // Покрывает ли подписка ИМЕННО этот курс (план «всё» → да; иначе курс в наборе)
  let subscriptionCoversCourse = false;
  const subRow = sub as { id: string; is_all_courses: boolean } | null;
  if (subRow) {
    if (subRow.is_all_courses) {
      subscriptionCoversCourse = true;
    } else {
      const { data: covered } = await admin
        .from('subscription_courses')
        .select('course_id')
        .eq('subscription_id', subRow.id)
        .eq('course_id', courseId)
        .maybeSingle();
      subscriptionCoversCourse = !!covered;
    }
  }

  const decision = decideLessonAccess({
    lessonExists: true,
    isPreview: false,
    isAdmin: (profile as { is_admin?: boolean } | null)?.is_admin === true,
    subscriptionCoversCourse,
    hasPurchase: !!purchase,
  });
  return decision.allowed ? { ok: true } : { ok: false, error: 'Нет доступа к этому курсу' };
}

// ────────────────────────────────────────────────────────────────────
// BUY COURSE
// ────────────────────────────────────────────────────────────────────

interface CheckoutResult {
  /** URL ЮKassa для редиректа (или нашей return-страницы при 100%-промокоде). */
  confirmationUrl: string;
}

/** База сайта для return_url (резолвится по окружению). */
function siteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://artumacademy.ru';
}

/**
 * Создаёт pending-payment и платёж в ЮKassa; возвращает confirmation_url
 * для редиректа. Доступ НЕ выдаётся здесь — только вебхуком после оплаты.
 */
async function startCheckout(opts: {
  userId: string;
  userEmail: string;
  amountMinor: number;
  discountMinor: number;
  promocode: string | null;
  method: 'card' | 'subscription';
  courseId: string | null;
  description: string;
  kind: 'course' | 'subscription';
  plan?: 'monthly' | 'yearly';
  subscriptionPlanId?: string;
}): Promise<ActionResult<CheckoutResult>> {
  const admin = createAdminClient();

  const { data: payment, error } = await admin
    .from('payments')
    .insert({
      user_id: opts.userId,
      course_id: opts.courseId,
      amount_minor: opts.amountMinor,
      method: opts.method,
      status: 'pending',
      provider: 'yookassa',
      discount_minor: opts.discountMinor,
      promocode: opts.promocode,
    })
    .select('id')
    .single();
  if (error || !payment) {
    return { ok: false, error: error?.message ?? 'Ошибка создания платежа' };
  }

  const returnUrl = `${siteBaseUrl()}/payment/return?p=${payment.id}`;
  try {
    const created = await createPayment({
      amountMinor: opts.amountMinor,
      description: opts.description,
      returnUrl,
      metadata: {
        paymentId: payment.id,
        userId: opts.userId,
        kind: opts.kind,
        ...(opts.courseId ? { courseId: opts.courseId } : {}),
        ...(opts.plan ? { plan: opts.plan } : {}),
        ...(opts.subscriptionPlanId ? { subscriptionPlanId: opts.subscriptionPlanId } : {}),
      },
      idempotenceKey: payment.id,
      receipt: { customerEmail: opts.userEmail, itemDescription: opts.description },
    });
    if (!created.confirmationUrl) {
      await admin.from('payments').update({ status: 'canceled' }).eq('id', payment.id);
      return { ok: false, error: 'ЮKassa не вернула ссылку на оплату' };
    }
    await admin
      .from('payments')
      .update({ provider_payment_id: created.id, confirmation_url: created.confirmationUrl })
      .eq('id', payment.id);
    return { ok: true, data: { confirmationUrl: created.confirmationUrl } };
  } catch (err) {
    await admin.from('payments').update({ status: 'canceled' }).eq('id', payment.id);
    logger.error({ err, paymentId: payment.id }, 'startCheckout: createPayment failed');
    return { ok: false, error: 'Не удалось создать платёж. Попробуйте позже.' };
  }
}

/**
 * Покупка курса через ЮKassa. Возвращает confirmation_url — клиент редиректит
 * на оплату. Доступ открывается вебхуком после успешной оплаты. Промокод
 * проверяется здесь, но списывается только при подтверждении (в fulfillment).
 */
export async function buyCourseAction(
  courseSlug: string,
  promocode?: string,
): Promise<ActionResult<CheckoutResult>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Сначала войдите в аккаунт' };
  if (!yookassaConfigured()) {
    return { ok: false, error: 'Приём оплаты временно недоступен. Попробуйте позже.' };
  }

  const admin = createAdminClient();

  const { data: course } = await admin
    .from('courses')
    .select('id, title, price_minor')
    .eq('slug', courseSlug)
    .single();
  if (!course) return { ok: false, error: 'Курс не найден' };

  const { data: existing } = await admin
    .from('purchases')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('course_id', course.id)
    .maybeSingle();
  if (existing) return { ok: false, error: 'Курс уже куплен' };

  // Промокод — только валидация + расчёт скидки (списываем при оплате).
  let discountMinor = 0;
  let appliedPromo: string | null = null;
  if (promocode?.trim()) {
    const code = promocode.trim().toUpperCase();
    const { data: promo } = await admin
      .from('promocodes')
      .select('id, type, value, valid_until, uses_left')
      .eq('code', code)
      .maybeSingle();
    if (!promo) return { ok: false, error: 'Промокод не найден' };
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
      return { ok: false, error: 'Срок действия промокода истёк' };
    }
    if (promo.uses_left !== null && promo.uses_left <= 0) {
      return { ok: false, error: 'Промокод закончился' };
    }
    discountMinor =
      promo.type === 'percent'
        ? Math.round((course.price_minor * promo.value) / 100)
        : Math.min(promo.value, course.price_minor);
    appliedPromo = code;
  }
  const amountMinor = Math.max(0, course.price_minor - discountMinor);

  // 100%-промокод (0 ₽) — ЮKassa не принимает нулевой платёж, выдаём напрямую.
  if (amountMinor === 0) {
    const { data: payment } = await admin
      .from('payments')
      .insert({
        user_id: user.id,
        course_id: course.id,
        amount_minor: 0,
        method: 'card',
        status: 'succeeded',
        provider: 'promo',
        discount_minor: discountMinor,
        promocode: appliedPromo,
      })
      .select('id')
      .single();
    await admin.from('purchases').insert({
      user_id: user.id,
      course_id: course.id,
      amount_minor: 0,
      discount_minor: discountMinor,
      payment_id: payment?.id ?? null,
    });
    if (appliedPromo) {
      try {
        await admin.rpc('decrement_promocode' as never, { p_code: appliedPromo } as never);
      } catch {
        /* не критично */
      }
    }
    await auditLog({
      userId: user.id,
      action: 'payment.succeeded',
      entityType: 'payment',
      entityId: payment?.id,
      meta: { course_id: course.id, amount_minor: 0, discount_minor: discountMinor, promocode: appliedPromo, provider: 'promo' },
    });
    await notify(user.id, { type: 'purchase', title: 'Курс открыт', body: 'Промокод применён — доступ открыт.' });
    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath(`/courses/${courseSlug}`);
    return { ok: true, data: { confirmationUrl: `${siteBaseUrl()}/payment/return?p=${payment?.id}` } };
  }

  return startCheckout({
    userId: user.id,
    userEmail: user.email,
    amountMinor,
    discountMinor,
    promocode: appliedPromo,
    method: 'card',
    courseId: course.id,
    description: `Курс: ${course.title}`,
    kind: 'course',
  });
}

// ────────────────────────────────────────────────────────────────────
// LESSON PROGRESS
// ────────────────────────────────────────────────────────────────────

/**
 * Отмечает урок пройденным. Вызывает RPC public.maybe_issue_certificate
 * — если это последний урок курса, сервер автоматом выдаст сертификат.
 */
export async function markLessonCompleteAction(lessonId: string): Promise<ActionResult> {
  const auth = await getOrFail();
  if (!auth.ok) return auth;

  if (!z.string().uuid().safeParse(lessonId).success) {
    return { ok: false, error: 'Невалидный lesson id' };
  }

  const access = await assertLessonAccess(auth.userId, lessonId);
  if (!access.ok) return access;

  const admin = createAdminClient();
  const { error } = await admin
    .from('lesson_progress')
    .upsert(
      { user_id: auth.userId, lesson_id: lessonId },
      { onConflict: 'user_id,lesson_id', ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: error.message };

  // Авто-сертификат если курс пройден целиком
  await admin.rpc('maybe_issue_certificate', {
    p_user_id: auth.userId,
    p_lesson_id: lessonId,
  });

  revalidatePath('/profile');
  revalidatePath('/certificates');
  return { ok: true };
}

export async function unmarkLessonAction(lessonId: string): Promise<ActionResult> {
  const auth = await getOrFail();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from('lesson_progress')
    .delete()
    .eq('user_id', auth.userId)
    .eq('lesson_id', lessonId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/profile');
  return { ok: true };
}

/**
 * Сохраняет позицию воспроизведения видео. Авто-mark complete при >= 95%.
 */
export async function recordWatchProgressAction(
  lessonId: string,
  positionSec: number,
  durationSec: number,
): Promise<ActionResult> {
  const auth = await getOrFail();
  if (!auth.ok) return auth;

  if (!z.string().uuid().safeParse(lessonId).success) {
    return { ok: false, error: 'Невалидный lesson id' };
  }

  const access = await assertLessonAccess(auth.userId, lessonId);
  if (!access.ok) return access;

  const pos = Math.max(0, Math.floor(positionSec));
  const dur = Math.max(0, Math.floor(durationSec));

  const admin = createAdminClient();
  const { error } = await admin.from('lesson_watch_position').upsert(
    {
      user_id: auth.userId,
      lesson_id: lessonId,
      position_sec: pos,
      duration_sec: dur,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lesson_id' },
  );
  if (error) return { ok: false, error: error.message };

  // >= 95% → авто-mark complete
  if (dur > 0 && pos / dur >= 0.95) {
    await admin.from('lesson_progress').upsert(
      { user_id: auth.userId, lesson_id: lessonId },
      { onConflict: 'user_id,lesson_id', ignoreDuplicates: true },
    );
    await admin.rpc('maybe_issue_certificate', {
      p_user_id: auth.userId,
      p_lesson_id: lessonId,
    });
  }
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────
// WISHLIST
// ────────────────────────────────────────────────────────────────────

/**
 * Добавляет/убирает курс из избранного (toggle).
 */
export async function toggleWishlistAction(courseSlug: string): Promise<ActionResult<{ added: boolean }>> {
  const auth = await getOrFail();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { data: course } = await admin
    .from('courses')
    .select('id')
    .eq('slug', courseSlug)
    .single();
  if (!course) return { ok: false, error: 'Курс не найден' };

  // Уже в wishlist?
  const { data: existing } = await admin
    .from('wishlist')
    .select('user_id')
    .eq('user_id', auth.userId)
    .eq('course_id', course.id)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from('wishlist')
      .delete()
      .eq('user_id', auth.userId)
      .eq('course_id', course.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath(`/courses/${courseSlug}`);
    return { ok: true, data: { added: false } };
  } else {
    const { error } = await admin.from('wishlist').insert({
      user_id: auth.userId,
      course_id: course.id,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath(`/courses/${courseSlug}`);
    return { ok: true, data: { added: true } };
  }
}

// ────────────────────────────────────────────────────────────────────
// SUBSCRIPTION
// ────────────────────────────────────────────────────────────────────

/**
 * Оформление подписки через ЮKassa. Возвращает confirmation_url для редиректа;
 * подписка активируется вебхуком после успешной оплаты.
 */
export async function buySubscriptionAction(
  planId: string,
  period: 'monthly' | 'yearly',
): Promise<ActionResult<CheckoutResult>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Сначала войдите в аккаунт' };

  if (period !== 'monthly' && period !== 'yearly') {
    return { ok: false, error: 'Невалидный период подписки' };
  }
  if (!z.string().uuid().safeParse(planId).success) {
    return { ok: false, error: 'Невалидный план' };
  }
  if (!yookassaConfigured()) {
    return { ok: false, error: 'Приём оплаты временно недоступен. Попробуйте позже.' };
  }

  const active = await getMyActiveSubscription();
  if (active) return { ok: false, error: 'У вас уже есть активная подписка' };

  // Цена и план — СТРОГО из БД (клиенту не доверяем). Сумма потом сверяется
  // вебхуком с тем, что вернёт ЮKassa (анти-подмена).
  const admin = createAdminClient();
  const { data: plan } = await admin
    .from('subscription_plans')
    .select('id, name, price_monthly_minor, price_yearly_minor, published')
    .eq('id', planId)
    .maybeSingle();
  if (!plan || plan.published !== true) {
    return { ok: false, error: 'План не найден или снят с публикации' };
  }
  const amountMinor = period === 'monthly' ? plan.price_monthly_minor : plan.price_yearly_minor;
  if (amountMinor <= 0) {
    return { ok: false, error: 'Этот период недоступен для выбранного плана' };
  }

  return startCheckout({
    userId: user.id,
    userEmail: user.email,
    amountMinor,
    discountMinor: 0,
    promocode: null,
    method: 'subscription',
    courseId: null,
    description: `Подписка «${plan.name}»: ${period === 'monthly' ? '1 месяц' : '1 год'}`,
    kind: 'subscription',
    plan: period,
    subscriptionPlanId: planId,
  });
}

export async function cancelSubscriptionAction(): Promise<ActionResult> {
  const auth = await getOrFail();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from('subscriptions')
    .update({ cancelled: true })
    .eq('user_id', auth.userId)
    .eq('cancelled', false);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/profile');
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────
// PROMOCODE VALIDATION (read-only — для preview скидки в UI до покупки)
// ────────────────────────────────────────────────────────────────────

export async function validatePromocodeAction(
  code: string,
  courseSlug: string,
): Promise<
  | { ok: true; data: { discountMinor: number; code: string } }
  | { ok: false; error: string }
> {
  if (!code.trim()) return { ok: false, error: 'Введите промокод' };

  const supabase = createAdminClient();
  const normalized = code.trim().toUpperCase();

  const { data: promo } = await supabase
    .from('promocodes')
    .select('type, value, valid_until, uses_left, code')
    .eq('code', normalized)
    .maybeSingle();
  if (!promo) return { ok: false, error: 'Промокод не найден' };
  if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
    return { ok: false, error: 'Срок действия промокода истёк' };
  }
  if (promo.uses_left !== null && promo.uses_left <= 0) {
    return { ok: false, error: 'Промокод закончился' };
  }

  const { data: course } = await supabase
    .from('courses')
    .select('price_minor')
    .eq('slug', courseSlug)
    .single();
  if (!course) return { ok: false, error: 'Курс не найден' };

  const discount =
    promo.type === 'percent'
      ? Math.round((course.price_minor * promo.value) / 100)
      : Math.min(promo.value, course.price_minor);

  return { ok: true, data: { discountMinor: discount, code: promo.code } };
}
