-- =====================================================================
-- Artum Academy: commerce + progress tables
--
-- Переносим из Zustand mock store в БД:
--   - purchases       (один курс куплен один раз)
--   - payments        (история транзакций; ref для отчётов / 54-ФЗ чеков)
--   - lesson_progress (пройдено да/нет)
--   - lesson_watch_position (позиция видео для resume)
--   - certificates    (выдаются автоматом при 100% прохождении)
--   - wishlist        (избранное)
--   - subscriptions   (подписка "все курсы")
--   - promocodes      (купоны: percent / fixed)
--
-- RLS: пользователь видит/пишет только свои строки; service_role —
-- полный доступ (для Server Actions, которые обходят RLS под admin).
--
-- Apply: Supabase Dashboard -> SQL Editor -> Run
-- =====================================================================

-- ─── PAYMENTS ────────────────────────────────────────────────────────
-- История платежей. course_id nullable: подписка не привязана к курсу.
CREATE TABLE IF NOT EXISTS public.payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id     UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  amount_minor  INTEGER NOT NULL CHECK (amount_minor >= 0),
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method        TEXT NOT NULL CHECK (method IN ('card', 'sbp', 'subscription')),
  status        TEXT NOT NULL CHECK (status IN ('succeeded', 'refunded')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments (user_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS payments_course_id_idx ON public.payments (course_id) WHERE course_id IS NOT NULL;

-- ─── PURCHASES ───────────────────────────────────────────────────────
-- Один курс — одна покупка (PK user_id+course_id). При повторной покупке
-- не создаётся новая запись, но создаётся новый payment (refund flow).
CREATE TABLE IF NOT EXISTS public.purchases (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  bought_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_minor    INTEGER NOT NULL CHECK (amount_minor >= 0),
  discount_minor  INTEGER NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  payment_id      UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS purchases_user_id_idx ON public.purchases (user_id);

-- ─── LESSON PROGRESS ─────────────────────────────────────────────────
-- Пройдено да/нет. Запись = lesson completed by this user.
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id     UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS lesson_progress_user_id_idx ON public.lesson_progress (user_id);

-- ─── LESSON WATCH POSITION ───────────────────────────────────────────
-- Сохранение позиции видео для resume. Обновляется через каждые N сек.
CREATE TABLE IF NOT EXISTS public.lesson_watch_position (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id      UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  position_sec   INTEGER NOT NULL DEFAULT 0 CHECK (position_sec >= 0),
  duration_sec   INTEGER NOT NULL DEFAULT 0 CHECK (duration_sec >= 0),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, lesson_id)
);

-- ─── CERTIFICATES ────────────────────────────────────────────────────
-- Один сертификат на пользователя+курс. Выдаётся автоматом сервером
-- при 100% прохождении (через RPC public.maybe_issue_certificate).
CREATE TABLE IF NOT EXISTS public.certificates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id            UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  verification_number  TEXT NOT NULL UNIQUE,
  student_name         TEXT NOT NULL,
  issued_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS certificates_user_id_idx ON public.certificates (user_id, issued_at DESC);

-- ─── WISHLIST ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wishlist (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS wishlist_user_id_idx ON public.wishlist (user_id);

-- ─── SUBSCRIPTIONS ───────────────────────────────────────────────────
-- Один пользователь может иметь несколько записей (history),
-- но активная в любой момент только одна: expires_at > now() AND NOT cancelled.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier          TEXT NOT NULL DEFAULT 'all_courses' CHECK (tier IN ('all_courses')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  amount_minor  INTEGER NOT NULL CHECK (amount_minor >= 0),
  period        TEXT NOT NULL CHECK (period IN ('monthly', 'yearly')),
  cancelled     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_active_idx
  ON public.subscriptions (user_id, expires_at DESC)
  WHERE cancelled = FALSE;

-- ─── PROMOCODES ──────────────────────────────────────────────────────
-- Глобальный пул промокодов. Управляется админом.
CREATE TABLE IF NOT EXISTS public.promocodes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,
  type         TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value        INTEGER NOT NULL CHECK (value > 0),
  valid_until  TIMESTAMPTZ,
  uses_left    INTEGER CHECK (uses_left IS NULL OR uses_left >= 0),
  note         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_watch_position ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promocodes            ENABLE ROW LEVEL SECURITY;

-- Базовое правило: пользователь видит/пишет только свои строки.
-- INSERT через Server Actions делается под service_role (обход RLS).

-- payments
DROP POLICY IF EXISTS payments_self_select ON public.payments;
CREATE POLICY payments_self_select ON public.payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS payments_service_all ON public.payments;
CREATE POLICY payments_service_all ON public.payments FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- purchases
DROP POLICY IF EXISTS purchases_self_select ON public.purchases;
CREATE POLICY purchases_self_select ON public.purchases FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS purchases_service_all ON public.purchases;
CREATE POLICY purchases_service_all ON public.purchases FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- lesson_progress: пользователь сам отмечает прохождение
DROP POLICY IF EXISTS lp_self_select ON public.lesson_progress;
CREATE POLICY lp_self_select ON public.lesson_progress FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS lp_self_insert ON public.lesson_progress;
CREATE POLICY lp_self_insert ON public.lesson_progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS lp_self_delete ON public.lesson_progress;
CREATE POLICY lp_self_delete ON public.lesson_progress FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS lp_service_all ON public.lesson_progress;
CREATE POLICY lp_service_all ON public.lesson_progress FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- lesson_watch_position: сам пишет позицию
DROP POLICY IF EXISTS lwp_self_select ON public.lesson_watch_position;
CREATE POLICY lwp_self_select ON public.lesson_watch_position FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS lwp_self_upsert ON public.lesson_watch_position;
CREATE POLICY lwp_self_upsert ON public.lesson_watch_position FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS lwp_self_update ON public.lesson_watch_position;
CREATE POLICY lwp_self_update ON public.lesson_watch_position FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS lwp_service_all ON public.lesson_watch_position;
CREATE POLICY lwp_service_all ON public.lesson_watch_position FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- certificates: только select (выдаются через service_role)
DROP POLICY IF EXISTS cert_self_select ON public.certificates;
CREATE POLICY cert_self_select ON public.certificates FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS cert_service_all ON public.certificates;
CREATE POLICY cert_service_all ON public.certificates FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- wishlist: пользователь сам управляет
DROP POLICY IF EXISTS wl_self_select ON public.wishlist;
CREATE POLICY wl_self_select ON public.wishlist FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS wl_self_insert ON public.wishlist;
CREATE POLICY wl_self_insert ON public.wishlist FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS wl_self_delete ON public.wishlist;
CREATE POLICY wl_self_delete ON public.wishlist FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS wl_service_all ON public.wishlist;
CREATE POLICY wl_service_all ON public.wishlist FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- subscriptions: только select (создаются service_role)
DROP POLICY IF EXISTS sub_self_select ON public.subscriptions;
CREATE POLICY sub_self_select ON public.subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS sub_service_all ON public.subscriptions;
CREATE POLICY sub_service_all ON public.subscriptions FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- promocodes: anon-чтение для валидации при покупке; только service_role пишет
DROP POLICY IF EXISTS promo_public_select ON public.promocodes;
CREATE POLICY promo_public_select ON public.promocodes FOR SELECT
  TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS promo_service_all ON public.promocodes;
CREATE POLICY promo_service_all ON public.promocodes FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ─── HELPER RPC: атомарная выдача сертификата ────────────────────────
-- Вызывается после markLessonComplete. Проверяет: пройдены ли все уроки
-- курса, и если да — создаёт сертификат (ON CONFLICT DO NOTHING).
-- SECURITY DEFINER: запускается с правами owner (postgres), обходит RLS.
CREATE OR REPLACE FUNCTION public.maybe_issue_certificate(
  p_user_id UUID,
  p_lesson_id UUID
)
RETURNS UUID  -- id выданного сертификата или NULL если ещё не время
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id   UUID;
  v_total       INTEGER;
  v_completed   INTEGER;
  v_student     TEXT;
  v_cert_id     UUID;
  v_cert_num    TEXT;
BEGIN
  -- Найти курс, к которому принадлежит lesson
  SELECT m.course_id INTO v_course_id
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE l.id = p_lesson_id;

  IF v_course_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Уже выдан?
  SELECT id INTO v_cert_id
  FROM public.certificates
  WHERE user_id = p_user_id AND course_id = v_course_id;

  IF v_cert_id IS NOT NULL THEN
    RETURN v_cert_id;
  END IF;

  -- Подсчитать total/completed
  SELECT COUNT(*) INTO v_total
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.course_id = v_course_id;

  SELECT COUNT(*) INTO v_completed
  FROM public.lesson_progress lp
  JOIN public.lessons l ON l.id = lp.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.course_id = v_course_id AND lp.user_id = p_user_id;

  IF v_total = 0 OR v_completed < v_total THEN
    RETURN NULL;
  END IF;

  -- Имя студента из profiles
  SELECT name INTO v_student FROM public.profiles WHERE id = p_user_id;
  IF v_student IS NULL THEN v_student := 'Студент'; END IF;

  -- Сгенерировать verification number ART-YYYY-NNNNNN
  v_cert_num := 'ART-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  INSERT INTO public.certificates (user_id, course_id, verification_number, student_name)
  VALUES (p_user_id, v_course_id, v_cert_num, v_student)
  ON CONFLICT (user_id, course_id) DO NOTHING
  RETURNING id INTO v_cert_id;

  RETURN v_cert_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maybe_issue_certificate(UUID, UUID) TO authenticated, service_role;

-- ─── SEED PROMOCODES ─────────────────────────────────────────────────
INSERT INTO public.promocodes (code, type, value, valid_until, uses_left, note)
VALUES
  ('WELCOME10',   'percent', 10, NULL,                          NULL, 'Скидка 10% на первый курс'),
  ('BLACKFRIDAY', 'percent', 30, '2026-12-01T23:59:59+03:00',   100,  'Чёрная пятница — скидка 30%')
ON CONFLICT (code) DO NOTHING;
