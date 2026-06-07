-- =====================================================================
-- Artum Academy: notifications (живые уведомления для колокольчика в шапке)
--
-- Заменяет мок MOCK_NOTIFICATIONS. Генерируются сервером на событиях
-- (регистрация, покупка курса; сертификат — позже в RPC).
--
-- RLS: пользователь видит/обновляет только свои; service_role — полный
-- доступ (Server Actions создают уведомления под admin).
--
-- Apply: Supabase Dashboard -> SQL Editor -> Run
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'info',
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Пользователь читает только свои уведомления
DROP POLICY IF EXISTS notif_self_select ON public.notifications;
CREATE POLICY notif_self_select ON public.notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Пользователь помечает свои как прочитанные
DROP POLICY IF EXISTS notif_self_update ON public.notifications;
CREATE POLICY notif_self_update ON public.notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Server Actions создают уведомления под service_role
DROP POLICY IF EXISTS notif_service_all ON public.notifications;
CREATE POLICY notif_service_all ON public.notifications FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);
