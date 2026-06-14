-- =====================================================================
-- Artum Academy: реальные платежи ЮKassa
--
-- Превращаем мок-оплату (мгновенный succeeded) в настоящий поток:
--   checkout → pending payment → редирект в ЮKassa → вебхук → доступ.
--
-- Изменения:
--   1) webhook_events       — идемпотентность вебхуков (security §4)
--   2) payments.status      — добавляем 'pending' / 'canceled'
--   3) payments.*           — связь с платежом провайдера + перенос
--                             промокода/скидки на момент подтверждения
--
-- Всё аддитивно и обратносовместимо: старые строки ('succeeded'/'refunded')
-- остаются валидными, новые колонки nullable / с дефолтом.
--
-- Apply: Supabase Dashboard -> SQL Editor (или Management API)
-- =====================================================================

-- ─── WEBHOOK EVENTS (идемпотентность) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL,
  external_id  TEXT NOT NULL,
  event_type   TEXT,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, external_id)
);

-- Только service_role (Server Actions / webhook handler под admin-клиентом).
-- RLS включён, политик нет → анон/пользовательские клиенты не имеют доступа.
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ─── PAYMENTS: статусы + связь с провайдером ─────────────────────────
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'succeeded', 'canceled', 'refunded'));

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS confirmation_url TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS discount_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS promocode TEXT;

-- Корреляция вебхук → наша строка платежа (по id платежа ЮKassa).
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_id_idx
  ON public.payments (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- ─── АТОМАРНОЕ СПИСАНИЕ ПРОМОКОДА (фикс TOCTOU-гонки) ─────────────────
-- Один UPDATE с условием uses_left > 0 — без read-then-write гонки.
-- NULL uses_left = безлимитный промокод, не трогаем.
CREATE OR REPLACE FUNCTION public.decrement_promocode(p_code TEXT)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE public.promocodes
  SET uses_left = uses_left - 1
  WHERE upper(code) = upper(p_code)
    AND uses_left IS NOT NULL
    AND uses_left > 0;
$$;
