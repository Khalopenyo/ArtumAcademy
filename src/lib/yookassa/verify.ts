/**
 * Чистые (без побочных эффектов) функции верификации/нормализации YooKassa.
 * Никаких секретов и сетевых вызовов — поэтому модуль безопасно юнит-тестить.
 *
 * См. .claude/skills/security/SKILL.md §4 «Платежи».
 */
import { z } from 'zod';

import type { PaymentStatus } from './types';

/** Форма webhook-уведомления YooKassa (только нужные нам поля). */
export const YooKassaEventSchema = z.object({
  event: z.string(),
  object: z.object({
    id: z.string().min(1),
    status: z.string().min(1),
    amount: z.object({ value: z.string(), currency: z.string() }).optional(),
    metadata: z.record(z.string()).optional(),
    paid: z.boolean().optional(),
  }),
});
export type YooKassaEvent = z.infer<typeof YooKassaEventSchema>;

/** Парсит тело вебхука; возвращает null если форма невалидна (→ 400). */
export function parseWebhookEvent(raw: unknown): YooKassaEvent | null {
  const parsed = YooKassaEventSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Маппинг статуса YooKassa → наш PaymentStatus. */
export function mapYookassaStatus(status: string): PaymentStatus {
  switch (status) {
    case 'succeeded':
      return 'succeeded';
    case 'canceled':
      return 'canceled';
    case 'pending':
    case 'waiting_for_capture':
      return 'pending';
    default:
      return 'pending';
  }
}

/**
 * Сравнение path-secret из URL вебхука в постоянное время (анти-timing).
 * YooKassa не подписывает вебхуки HMAC — поэтому защита = неугадываемый
 * путь + повторный запрос статуса платежа через API (см. client.getPayment).
 */
export function isValidWebhookSecret(
  provided: string | undefined | null,
  expected: string | undefined | null,
): boolean {
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** YooKassa amount { value: "990.00" } → копейки (99000). null если мусор. */
export function yookassaAmountToMinor(amount: { value: string } | undefined): number | null {
  if (!amount?.value) return null;
  const f = Number.parseFloat(amount.value);
  if (!Number.isFinite(f)) return null;
  return Math.round(f * 100);
}

/** Совпадает ли фактическая сумма платежа с ожидаемой (из нашей БД). */
export function amountsMatch(expectedMinor: number, amount: { value: string } | undefined): boolean {
  const got = yookassaAmountToMinor(amount);
  return got !== null && got === expectedMinor;
}

/** Копейки (99000) → строка для YooKassa ("990.00"). */
export function minorToYookassaValue(minor: number): string {
  return (minor / 100).toFixed(2);
}
