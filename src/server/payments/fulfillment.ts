import 'server-only';

import { auditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { amountsMatch, mapYookassaStatus } from '@/lib/yookassa/verify';
import { notify } from '@/server/notifications';

/**
 * Исполнение платежа ЮKassa (выдача доступа). НЕ Server Action — модуль
 * `server-only`, вызывается из webhook-обработчика и из «бесплатного» пути
 * (100%-промокод). Идемпотентно: повторный вебхук не выдаст доступ дважды.
 *
 * Авторитетные данные (status, amount, metadata) берутся из getPayment()
 * самим вызывающим (вебхуком), а НЕ из тела вебхука — см. security §4.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

const SUBSCRIPTION_DAYS: Record<'monthly' | 'yearly', number> = { monthly: 30, yearly: 365 };

interface PaymentRow {
  id: string;
  user_id: string;
  course_id: string | null;
  amount_minor: number;
  discount_minor: number | null;
  promocode: string | null;
  status: string;
}

export interface FulfillInput {
  /** Наш payments.id (из metadata.paymentId платежа ЮKassa). */
  ourPaymentId: string;
  /** Авторитетный статус из getPayment() (НЕ из тела вебхука). */
  yookassaStatus: string;
  /** Авторитетная сумма из getPayment(). */
  yookassaAmount: { value: string } | undefined;
  /** Метаданные платежа (kind/plan) — из getPayment(). */
  metadata: Record<string, string> | undefined;
}

export type FulfillResult = { ok: boolean; info: string };

export async function fulfillYookassaPayment(input: FulfillInput): Promise<FulfillResult> {
  const admin = createAdminClient();

  const { data: pay } = await admin
    .from('payments')
    .select('id, user_id, course_id, amount_minor, discount_minor, promocode, status')
    .eq('id', input.ourPaymentId)
    .maybeSingle();

  if (!pay) return { ok: false, info: 'payment_not_found' };
  const row = pay as PaymentRow;
  if (row.status === 'succeeded') return { ok: true, info: 'already_fulfilled' };

  const status = mapYookassaStatus(input.yookassaStatus);

  if (status === 'canceled') {
    await admin.from('payments').update({ status: 'canceled' }).eq('id', row.id).eq('status', 'pending');
    return { ok: true, info: 'canceled' };
  }
  if (status !== 'succeeded') return { ok: true, info: `ignored_${status}` };

  // Сумма из ЮKassa должна совпасть с нашей записью (анти-подмена суммы).
  if (!amountsMatch(row.amount_minor, input.yookassaAmount)) {
    logger.error(
      { paymentId: row.id, expected: row.amount_minor, got: input.yookassaAmount?.value },
      'yookassa amount mismatch — доступ НЕ выдан',
    );
    await auditLog({
      userId: row.user_id,
      action: 'payment.amount_mismatch',
      entityType: 'payment',
      entityId: row.id,
      meta: { expected_minor: row.amount_minor, got_value: input.yookassaAmount?.value ?? null },
    });
    return { ok: false, info: 'amount_mismatch' };
  }

  // Идемпотентный замок: помечаем succeeded только если ещё pending.
  const { data: claimed } = await admin
    .from('payments')
    .update({ status: 'succeeded' })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (!claimed) return { ok: true, info: 'already_claimed' };

  if (row.course_id) {
    await grantCourse(admin, row);
  } else {
    const plan = input.metadata?.plan === 'yearly' ? 'yearly' : 'monthly';
    await grantSubscription(admin, row, plan);
  }
  return { ok: true, info: 'fulfilled' };
}

async function grantCourse(admin: AdminClient, pay: PaymentRow): Promise<void> {
  if (!pay.course_id) return;

  // PK (user_id, course_id) делает повторную вставку безопасной (23505 = уже есть).
  const { error } = await admin.from('purchases').insert({
    user_id: pay.user_id,
    course_id: pay.course_id,
    amount_minor: pay.amount_minor,
    discount_minor: pay.discount_minor ?? 0,
    payment_id: pay.id,
  });
  if (error && error.code !== '23505') {
    logger.error({ err: error, paymentId: pay.id }, 'grantCourse: purchase insert failed');
  }

  if (pay.promocode) {
    try {
      // Атомарный декремент (фикс гонки). Каст — RPC не в сгенерённых типах.
      await admin.rpc('decrement_promocode' as never, { p_code: pay.promocode } as never);
    } catch (err) {
      logger.error({ err, code: pay.promocode }, 'decrement_promocode failed (не критично)');
    }
  }

  await auditLog({
    userId: pay.user_id,
    action: 'payment.succeeded',
    entityType: 'payment',
    entityId: pay.id,
    meta: {
      course_id: pay.course_id,
      amount_minor: pay.amount_minor,
      discount_minor: pay.discount_minor ?? 0,
      promocode: pay.promocode,
      provider: 'yookassa',
    },
  });
  await notify(pay.user_id, {
    type: 'purchase',
    title: 'Курс куплен',
    body: 'Оплата прошла — доступ открыт. Начните обучение в личном кабинете.',
  });
}

async function grantSubscription(
  admin: AdminClient,
  pay: PaymentRow,
  plan: 'monthly' | 'yearly',
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SUBSCRIPTION_DAYS[plan] * 86_400_000);

  // Не плодим активные подписки: если уже есть активная — не вставляем вторую.
  const { data: active } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', pay.user_id)
    .eq('cancelled', false)
    .gt('expires_at', now.toISOString())
    .limit(1)
    .maybeSingle();

  if (!active) {
    await admin.from('subscriptions').insert({
      user_id: pay.user_id,
      tier: 'all_courses',
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      amount_minor: pay.amount_minor,
      period: plan,
      cancelled: false,
    });
  }

  await auditLog({
    userId: pay.user_id,
    action: 'subscription.purchased',
    entityType: 'payment',
    entityId: pay.id,
    meta: { amount_minor: pay.amount_minor, period: plan, expires_at: expiresAt.toISOString() },
  });
  await notify(pay.user_id, {
    type: 'subscription',
    title: 'Подписка оформлена',
    body: 'Оплата прошла — доступ ко всем курсам открыт.',
  });
}
