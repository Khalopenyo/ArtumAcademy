/**
 * Типы платёжного слоя YooKassa. Чистый модуль (без секретов/SDK) —
 * можно импортировать где угодно, включая клиентские типы и тесты.
 */

/** Нормализованный статус платежа в нашей БД (payments.status). */
export type PaymentStatus = 'pending' | 'succeeded' | 'canceled' | 'refunded';

export interface CreatePaymentInput {
  /** Сумма в копейках (целое). Берётся из БД, НЕ от клиента. */
  amountMinor: number;
  /** Описание для чека/ЛК YooKassa (видит пользователь). */
  description: string;
  /** Куда вернуть пользователя после оплаты. */
  returnUrl: string;
  /** Метаданные — кладём наш payment_id, чтобы связать вебхук с записью. */
  metadata: Record<string, string>;
  /** Ключ идемпотентности (= наш payment_id) — защита от двойного списания. */
  idempotenceKey: string;
  /**
   * Данные для чека 54-ФЗ. Если заданы — ЮKassa сформирует и отправит
   * покупателю фискальный чек (нужна включённая фискализация в ЛК ЮKassa).
   */
  receipt?: {
    /** Email покупателя — на него уйдёт чек. */
    customerEmail: string;
    /** Название позиции (курс), ≤128 символов. */
    itemDescription: string;
  };
}

export interface CreatedPayment {
  /** ID платежа на стороне YooKassa. */
  id: string;
  /** Статус на стороне YooKassa (сырой). */
  status: string;
  /** URL, куда редиректить пользователя для оплаты (confirmation.redirect). */
  confirmationUrl: string | null;
}
