-- =====================================================================
-- Artum Academy: отзывы + рейтинг курсов (соц.доказательство / конверсия)
--
-- Один отзыв на пользователя на курс (UNIQUE). Оставлять может ТОЛЬКО тот,
-- у кого есть доступ к курсу (покупка или подписка, покрывающая курс) —
-- это проверяется в Server Action под service_role (RLS на запись закрыт).
-- author_name — снимок имени на момент отзыва (чтобы не светить profiles).
--
-- RLS: публичное чтение всех отзывов; запись — только service_role.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT '',
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS reviews_course_idx
  ON public.reviews (course_id, created_at DESC);

DROP TRIGGER IF EXISTS reviews_set_updated_at ON public.reviews;
CREATE TRIGGER reviews_set_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Публичное чтение — отзывы видны всем
DROP POLICY IF EXISTS reviews_public_select ON public.reviews;
CREATE POLICY reviews_public_select ON public.reviews FOR SELECT
  TO anon, authenticated USING (TRUE);

-- Запись — только service_role (через гейтнутый Server Action с проверкой доступа)
DROP POLICY IF EXISTS reviews_service_all ON public.reviews;
CREATE POLICY reviews_service_all ON public.reviews FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);
