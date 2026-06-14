import { NextResponse } from 'next/server';

import { env } from '@/env';
import { auditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPayment } from '@/lib/yookassa/client';
import { isValidWebhookSecret, parseWebhookEvent } from '@/lib/yookassa/verify';
import { fulfillYookassaPayment } from '@/server/payments/fulfillment';

/**
 * POST /api/webhooks/yookassa/[secret] — уведомления ЮKassa.
 *
 * Защита (ЮKassa НЕ подписывает вебхуки HMAC):
 *   1) неугадываемый путь-секрет (constant-time сравнение)
 *   2) авторитетный перезапрос платежа через getPayment() — статус/сумма
 *      берутся оттуда, а НЕ из тела вебхука
 *   3) идемпотентность: webhook_events (provider, event:payment_id)
 *   4) выдача доступа идемпотентна (claim по status='pending')
 *
 * Возвращаем 2xx когда обработали/проигнорировали; 5xx — чтобы ЮKassa
 * повторила (транзиентная ошибка getPayment).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { secret: string } },
): Promise<Response> {
  // 1. Путь-секрет
  if (!isValidWebhookSecret(params.secret, env.YOOKASSA_WEBHOOK_PATH_SECRET)) {
    await auditLog({ userId: null, action: 'webhook.auth_failed', entityType: 'yookassa' });
    return NextResponse.json({ ok: false }, { status: 404 }); // 404 не палит существование роута
  }

  // 2. Тело
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const event = parseWebhookEvent(raw);
  if (!event) return NextResponse.json({ ok: false }, { status: 400 });

  // Обрабатываем только платёжные события. refund.* и прочие подтверждаем без
  // действий (их object — не платёж; возвраты инициируются из админки).
  if (!event.event.startsWith('payment.')) {
    return NextResponse.json({ ok: true, info: 'ignored_event' });
  }

  const providerPaymentId = event.object.id;
  const dedupKey = `${event.event}:${providerPaymentId}`;
  const admin = createAdminClient();

  // 3. Идемпотентность: одно и то же событие обрабатываем один раз.
  const { error: dupErr } = await admin.from('webhook_events').insert({
    provider: 'yookassa',
    external_id: dedupKey,
    event_type: event.event,
    payload: raw as never,
  });
  if (dupErr?.code === '23505') {
    return NextResponse.json({ ok: true, info: 'duplicate' });
  }

  // 4. Авторитетный статус/сумма — перезапрос у ЮKassa.
  let payment: Awaited<ReturnType<typeof getPayment>>;
  try {
    payment = await getPayment(providerPaymentId);
  } catch (err) {
    logger.error({ err, providerPaymentId }, 'yookassa webhook: getPayment failed');
    return NextResponse.json({ ok: false }, { status: 500 }); // → ЮKassa повторит
  }

  const metadata = (payment.metadata ?? undefined) as Record<string, string> | undefined;
  const ourPaymentId = metadata?.paymentId;
  if (!ourPaymentId) {
    logger.error({ providerPaymentId }, 'yookassa webhook: no paymentId in metadata');
    return NextResponse.json({ ok: true, info: 'no_metadata' });
  }

  const result = await fulfillYookassaPayment({
    ourPaymentId,
    yookassaStatus: payment.status,
    yookassaAmount: payment.amount,
    metadata,
  });

  await admin
    .from('webhook_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('provider', 'yookassa')
    .eq('external_id', dedupKey);

  logger.info({ providerPaymentId, ourPaymentId, info: result.info }, 'yookassa webhook processed');
  return NextResponse.json({ ok: true, info: result.info });
}
