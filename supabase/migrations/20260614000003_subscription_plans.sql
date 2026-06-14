-- =====================================================================
-- Artum Academy: настраиваемые планы подписки (кураторские наборы курсов)
--
-- Было: одна подписка «все курсы» (tier='all_courses'), цена в коде.
-- Стало: планы подписки настраиваются в админке — название, цена/мес и /год,
-- и НАБОР курсов (many-to-many). Подписка ссылается на план.
--
-- Доступ (выбор пользователя «сохраняется до конца срока»):
--   • план «Все курсы» (is_all_courses=true) — ЖИВОЙ доступ ко всему каталогу
--     (новые курсы тоже входят);
--   • кураторский план — при оформлении подписки набор курсов ЗАМОРАЖИВАЕТСЯ
--     в subscription_courses (правки плана потом не отнимают доступ у оплативших).
--
-- Legacy: колонку subscriptions.tier НЕ трогаем (CHECK только 'all_courses');
-- новые подписки по-прежнему пишут tier='all_courses', а доступ считается по
-- plan_id / is_all_courses / subscription_courses. tier становится legacy-полем.
--
-- Аддитивно + бэкфилл существующих подписчиков на дефолтный план «Все курсы».
-- Apply: Supabase Dashboard -> SQL Editor -> Run
-- =====================================================================

-- 1) Планы подписки (то, что настраивает админ) --------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  price_monthly_minor INTEGER NOT NULL DEFAULT 0 CHECK (price_monthly_minor >= 0),
  price_yearly_minor  INTEGER NOT NULL DEFAULT 0 CHECK (price_yearly_minor >= 0),
  -- true = «Все курсы»: живой доступ ко всему каталогу (набор курсов игнорируется)
  is_all_courses      BOOLEAN NOT NULL DEFAULT FALSE,
  published           BOOLEAN NOT NULL DEFAULT TRUE,
  order_index         INTEGER NOT NULL DEFAULT 100,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS subscription_plans_set_updated_at ON public.subscription_plans;
CREATE TRIGGER subscription_plans_set_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) Состав плана: какие курсы входят (редактируемый шаблон) --------------------
CREATE TABLE IF NOT EXISTS public.subscription_plan_courses (
  plan_id   UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, course_id)
);
CREATE INDEX IF NOT EXISTS subscription_plan_courses_course_idx
  ON public.subscription_plan_courses (course_id);

-- 3) Привязка подписки к плану + снимок «всё/набор» ----------------------------
-- plan_id: какой план оформлен (ON DELETE RESTRICT — нельзя удалить план с подписками).
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE RESTRICT;
-- is_all_courses: снимок на момент покупки. DEFAULT TRUE → существующие подписки
-- (это были «все курсы») сохраняют полный доступ.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS is_all_courses BOOLEAN NOT NULL DEFAULT TRUE;

-- 4) Замороженный набор курсов конкретной подписки (для кураторских планов) -----
CREATE TABLE IF NOT EXISTS public.subscription_courses (
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  PRIMARY KEY (subscription_id, course_id)
);
CREATE INDEX IF NOT EXISTS subscription_courses_course_idx
  ON public.subscription_courses (course_id);

-- 5) RLS -----------------------------------------------------------------------
ALTER TABLE public.subscription_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_courses      ENABLE ROW LEVEL SECURITY;

-- Планы: публичное чтение только опубликованных; запись — service_role.
DROP POLICY IF EXISTS sub_plans_public_select ON public.subscription_plans;
CREATE POLICY sub_plans_public_select ON public.subscription_plans FOR SELECT
  TO anon, authenticated USING (published = TRUE);
DROP POLICY IF EXISTS sub_plans_service_all ON public.subscription_plans;
CREATE POLICY sub_plans_service_all ON public.subscription_plans FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Состав планов: публичное чтение (какие курсы в плане — публично на /subscribe);
-- запись — service_role.
DROP POLICY IF EXISTS sub_plan_courses_public_select ON public.subscription_plan_courses;
CREATE POLICY sub_plan_courses_public_select ON public.subscription_plan_courses FOR SELECT
  TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS sub_plan_courses_service_all ON public.subscription_plan_courses;
CREATE POLICY sub_plan_courses_service_all ON public.subscription_plan_courses FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Снимок курсов подписки: пользователь видит только свои (через свою подписку);
-- запись — service_role.
DROP POLICY IF EXISTS sub_courses_self_select ON public.subscription_courses;
CREATE POLICY sub_courses_self_select ON public.subscription_courses FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_id AND s.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS sub_courses_service_all ON public.subscription_courses;
CREATE POLICY sub_courses_service_all ON public.subscription_courses FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- 6) Дефолтный план «Все курсы» + бэкфилл существующих подписок -----------------
-- Цены берём из текущих констант кода (990 ₽/мес, 9 900 ₽/год).
INSERT INTO public.subscription_plans
  (slug, name, description, price_monthly_minor, price_yearly_minor, is_all_courses, published, order_index)
VALUES
  ('all-courses', 'Все курсы', 'Доступ ко всему каталогу курсов', 99000, 990000, TRUE, TRUE, 0)
ON CONFLICT (slug) DO NOTHING;

-- Существующие подписки переезжают на план «Все курсы», доступ не теряют.
UPDATE public.subscriptions
SET plan_id = (SELECT id FROM public.subscription_plans WHERE slug = 'all-courses'),
    is_all_courses = TRUE
WHERE plan_id IS NULL;
