'use server';

import { revalidatePath } from 'next/cache';

import { auditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { refundPayment } from '@/lib/yookassa/client';
import { getCurrentUser } from '@/server/queries/auth';

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Полный возврат платежа через ЮKassa + отзыв доступа.
 * Только админ. Доступно для платежей в статусе 'succeeded' с id ЮKassa.
 */
export async function refundPaymentAction(paymentId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return { ok: false, error: 'Недостаточно прав' };

  const admin = createAdminClient();
  const { data: pay } = await admin
    .from('payments')
    .select('id, user_id, course_id, amount_minor, status, provider_payment_id')
    .eq('id', paymentId)
    .maybeSingle();

  if (!pay) return { ok: false, error: 'Платёж не найден' };
  if (pay.status !== 'succeeded') {
    return { ok: false, error: 'Вернуть можно только оплаченный платёж' };
  }
  if (!pay.provider_payment_id) {
    return { ok: false, error: 'Нет id ЮKassa — оформите возврат в кабинете ЮKassa вручную' };
  }

  // 1. Возврат в ЮKassa
  try {
    const refund = await refundPayment({
      providerPaymentId: pay.provider_payment_id,
      amountMinor: pay.amount_minor,
      description: 'Возврат через админку Artum Academy',
    });
    if (refund.status === 'canceled') {
      return { ok: false, error: 'ЮKassa отклонила возврат' };
    }
  } catch (err) {
    logger.error({ err, paymentId }, 'refundPaymentAction: ЮKassa refund failed');
    return { ok: false, error: `Ошибка возврата: ${(err as Error).message}` };
  }

  // 2. Отметить платёж возвращённым + отозвать доступ
  await admin.from('payments').update({ status: 'refunded' }).eq('id', pay.id);
  if (pay.course_id) {
    await admin.from('purchases').delete().eq('user_id', pay.user_id).eq('course_id', pay.course_id);
  } else {
    // Подписочный платёж → отменяем активную подписку.
    await admin
      .from('subscriptions')
      .update({ cancelled: true })
      .eq('user_id', pay.user_id)
      .eq('cancelled', false);
  }

  await auditLog({
    userId: me.id,
    action: 'payment.refunded',
    entityType: 'payment',
    entityId: pay.id,
    meta: { amount_minor: pay.amount_minor, target_user: pay.user_id, course_id: pay.course_id },
  });
  revalidatePath('/admin/payments');
  return { ok: true };
}
