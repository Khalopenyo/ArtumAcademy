import 'server-only'; // секреты YooKassa — только на сервере, никогда в клиенте.

import { YooCheckout } from '@a2seven/yoo-checkout';

import type { CreatePaymentInput, CreatedPayment } from './types';
import { minorToYookassaValue } from './verify';

/**
 * Обёртка над единственным поддерживаемым YooKassa Node SDK (@a2seven/yoo-checkout).
 * Создание платежа + повторный запрос статуса (для верификации вебхука).
 */

const SHOP_ID = process.env.YOOKASSA_SHOP_ID ?? '';
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY ?? '';

/**
 * Настроен ли реальный шоп. Ключи-заглушки (`stub-…`) на dev/прод НЕ считаются
 * настроенными — чтобы система НЕ выдавала доступ без реальной оплаты.
 */
export function yookassaConfigured(): boolean {
  return (
    SHOP_ID.length > 0 &&
    SECRET_KEY.length > 0 &&
    !SHOP_ID.startsWith('stub') &&
    !SECRET_KEY.startsWith('stub')
  );
}

let _client: YooCheckout | null = null;
function client(): YooCheckout {
  if (!yookassaConfigured()) {
    // Явная ошибка вместо тихого мока — действие вернёт { ok:false } пользователю.
    throw new Error('YOOKASSA_NOT_CONFIGURED');
  }
  if (!_client) _client = new YooCheckout({ shopId: SHOP_ID, secretKey: SECRET_KEY });
  return _client;
}

/** Создаёт платёж в YooKassa, возвращает id + confirmation_url для редиректа. */
export async function createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
  const value = minorToYookassaValue(input.amountMinor);
  const payment = await client().createPayment(
    {
      amount: { value, currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: input.returnUrl },
      description: input.description,
      metadata: input.metadata,
      // Чек 54-ФЗ: самозанятый/НПД → vat_code 1 (без НДС), услуга, полный расчёт.
      ...(input.receipt
        ? {
            receipt: {
              customer: { email: input.receipt.customerEmail },
              items: [
                {
                  description: input.receipt.itemDescription.slice(0, 128),
                  quantity: '1.00',
                  amount: { value, currency: 'RUB' },
                  vat_code: 1,
                  payment_subject: 'service',
                  payment_mode: 'full_payment',
                },
              ],
            },
          }
        : {}),
    },
    input.idempotenceKey,
  );
  return {
    id: payment.id,
    status: payment.status,
    confirmationUrl:
      payment.confirmation && 'confirmation_url' in payment.confirmation
        ? (payment.confirmation.confirmation_url ?? null)
        : null,
  };
}

/** Повторно запрашивает платёж у YooKassa — авторитетная проверка статуса в вебхуке. */
export async function getPayment(paymentId: string) {
  return client().getPayment(paymentId);
}

/**
 * Полный возврат платежа. idempotenceKey = id платежа → повторный вызов
 * не создаёт второй возврат. Возвращает статус возврата.
 */
export async function refundPayment(input: {
  providerPaymentId: string;
  amountMinor: number;
  description?: string;
}): Promise<{ id: string; status: string }> {
  const refund = await client().createRefund(
    {
      payment_id: input.providerPaymentId,
      amount: { value: minorToYookassaValue(input.amountMinor), currency: 'RUB' },
      ...(input.description ? { description: input.description } : {}),
    },
    input.providerPaymentId,
  );
  return { id: refund.id, status: refund.status };
}
