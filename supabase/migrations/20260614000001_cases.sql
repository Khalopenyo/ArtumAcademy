-- =====================================================================
-- Artum Academy: кейсы (истории студентов / проекты для /cases)
--
-- Карточка кейса: фото-обложка, заголовок, описание, имя студента,
-- результат, привязка к направлению (category). Управляется из админки.
--
-- RLS: публичное чтение только published=true; service_role — полный
-- доступ (admin Server Actions пишут под service_role).
--
-- Apply: Supabase Dashboard -> SQL Editor -> Run
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.cases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  student_name TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  result       TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL
                 CHECK (category IN ('ai','photo','video','editing','design','visual','copy')),
  cover_url    TEXT,
  published    BOOLEAN NOT NULL DEFAULT TRUE,
  order_index  INTEGER NOT NULL DEFAULT 100,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cases_published_idx
  ON public.cases (published, order_index);

-- Автообновление updated_at (как у courses)
DROP TRIGGER IF EXISTS cases_set_updated_at ON public.cases;
CREATE TRIGGER cases_set_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Публичное чтение — только опубликованные кейсы
DROP POLICY IF EXISTS cases_public_select ON public.cases;
CREATE POLICY cases_public_select ON public.cases FOR SELECT
  TO anon, authenticated USING (published = TRUE);

-- Admin Server Actions пишут под service_role (мимо RLS)
DROP POLICY IF EXISTS cases_service_all ON public.cases;
CREATE POLICY cases_service_all ON public.cases FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);
