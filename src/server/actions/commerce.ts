'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { decideLessonAccess } from '@/lib/access/lesson-access';
import { auditLog } from '@/lib/audit-log';
import { notify } from '@/server/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
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
      .select('id')
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

  const decision = decideLessonAccess({
    lessonExists: true,
    isPreview: false,
    isAdmin: (profile as { is_admin?: boolean } | null)?.is_admin === true,
    hasActiveSubscription: !!sub,
    hasPurchase: !!purchase,
  });
  return decision.allowed ? { ok: true } : { ok: false, error: 'Нет доступа к этому курсу' };
}

/** Цены подписки (копейки) — синхронизировано со store SUBSCRIPTION_PRICES */
const SUBSCRIPTION_PRICES = {
  monthly: 99_000, // 990 ₽/мес
  yearly: 990_000, // 9 900 ₽/год
} as const;

// ────────────────────────────────────────────────────────────────────
// BUY COURSE
// ────────────────────────────────────────────────────────────────────

interface BuyCourseResult {
  discountMinor: number;
  amountMinor: number;
}

/**
 * Создаёт purchase + payment атомарно (без транзакции — purchase write
 * после payment.id ready; FK NULL-safe). Применяет промокод если задан.
 *
 * Mock-режим: всегда mark succeeded. Реальный ЮKassa flow — позже (отдельный action).
 */
export async function buyCourseAction(
  courseSlug: string,
  promocode?: string,
): Promise<ActionResult<BuyCourseResult>> {
  const auth = await getOrFail();
  if (!auth.ok) return auth;

  const admin = createAdminClient();

  // 1. Найти курс
  const { data: course, error: courseError } = await admin
    .from('courses')
    .select('id, price_minor')
    .eq('slug', courseSlug)
    .single();
  if (courseError || !course) return { ok: false, error: 'Курс не найден' };

  // 2. Проверить — не куплен ли уже
  const { data: existing } = await admin
    .from('purchases')
    .select('user_id')
    .eq('user_id', auth.userId)
    .eq('course_id', course.id)
    .maybeSingle();
  if (existing) return { ok: false, error: 'Курс уже куплен' };

  // 3. Применить промокод если есть
  let discountMinor = 0;
  let promoIdToDecrement: string | null = null;
  if (promocode) {
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
    promoIdToDecrement = promo.id;
  }
  const amountMinor = Math.max(0, course.price_minor - discountMinor);

  // 4. Создать payment
  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .insert({
      user_id: auth.userId,
      course_id: course.id,
      amount_minor: amountMinor,
      method: 'card',
      status: 'succeeded',
    })
    .select('id')
    .single();
  if (paymentError || !payment) {
    return { ok: false, error: paymentError?.message ?? 'Ошибка создания платежа' };
  }

  // 5. Создать purchase
  const { error: purchaseError } = await admin.from('purchases').insert({
    user_id: auth.userId,
    course_id: course.id,
    amount_minor: amountMinor,
    discount_minor: discountMinor,
    payment_id: payment.id,
  });
  if (purchaseError) {
    // Откатить payment вручную — атомарность через 2 insert'а
    await admin.from('payments').delete().eq('id', payment.id);
    return { ok: false, error: purchaseError.message };
  }

  // 6. Декрементировать uses_left промокода
  if (promoIdToDecrement) {
    const { data: promoNow } = await admin
      .from('promocodes')
      .select('uses_left')
      .eq('id', promoIdToDecrement)
      .single();
    if (promoNow?.uses_left !== null && promoNow?.uses_left !== undefined) {
      await admin
        .from('promocodes')
        .update({ uses_left: Math.max(0, promoNow.uses_left - 1) })
        .eq('id', promoIdToDecrement);
    }
  }

  // Audit — компла-критично: log платежа для отчётов + 54-ФЗ трейл
  await auditLog({
    userId: auth.userId,
    action: 'payment.succeeded',
    entityType: 'payment',
    entityId: payment.id,
    meta: {
      course_slug: courseSlug,
      amount_minor: amountMinor,
      discount_minor: discountMinor,
      promocode: promocode ?? null,
      method: 'card',
    },
  });

  await notify(auth.userId, {
    type: 'purchase',
    title: 'Курс куплен',
    body: 'Доступ открыт — начните обучение в личном кабинете.',
  });

  revalidatePath('/');
  revalidatePath('/profile');
  revalidatePath(`/courses/${courseSlug}`);
  return { ok: true, data: { discountMinor, amountMinor } };
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

export async function buySubscriptionAction(
  period: 'monthly' | 'yearly',
): Promise<ActionResult> {
  const auth = await getOrFail();
  if (!auth.ok) return auth;

  if (period !== 'monthly' && period !== 'yearly') {
    return { ok: false, error: 'Невалидный период подписки' };
  }

  const active = await getMyActiveSubscription();
  if (active) return { ok: false, error: 'У вас уже есть активная подписка' };

  const admin = createAdminClient();
  const now = new Date();
  const days = period === 'monthly' ? 30 : 365;
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const amountMinor = SUBSCRIPTION_PRICES[period];

  // 1. payment
  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .insert({
      user_id: auth.userId,
      course_id: null,
      amount_minor: amountMinor,
      method: 'subscription',
      status: 'succeeded',
    })
    .select('id')
    .single();
  if (paymentError || !payment) {
    return { ok: false, error: paymentError?.message ?? 'Ошибка создания платежа' };
  }

  // 2. subscription
  const { error: subError } = await admin.from('subscriptions').insert({
    user_id: auth.userId,
    tier: 'all_courses',
    started_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    amount_minor: amountMinor,
    period,
    cancelled: false,
  });
  if (subError) {
    await admin.from('payments').delete().eq('id', payment.id);
    return { ok: false, error: subError.message };
  }

  await auditLog({
    userId: auth.userId,
    action: 'subscription.purchased',
    entityType: 'payment',
    entityId: payment.id,
    meta: {
      amount_minor: amountMinor,
      period,
      expires_at: expiresAt.toISOString(),
    },
  });

  await notify(auth.userId, {
    type: 'subscription',
    title: 'Подписка оформлена',
    body: 'Доступ ко всем курсам открыт.',
  });

  revalidatePath('/');
  revalidatePath('/profile');
  return { ok: true };
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
