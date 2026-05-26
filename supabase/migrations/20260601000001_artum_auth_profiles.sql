-- =====================================================================
-- Artum Academy: auth profiles
-- Расширяет auth.users (которая управляется Supabase Auth)
-- таблицей profiles с прикладными полями (name, initials, is_admin).
--
-- Apply: Supabase Dashboard -> SQL Editor -> Run
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  initials      TEXT NOT NULL DEFAULT '??',
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  registered_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_is_admin_idx ON public.profiles (is_admin) WHERE is_admin = TRUE;

-- updated_at автообновление (если функция уже создана — переиспользуем)
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: пользователь видит свой профиль; админ видит все (для admin/users page)
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = TRUE)
  );

-- UPDATE: пользователь обновляет свой профиль (имя). is_admin менять нельзя — только service_role.
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT: только через trigger при signup. Direct INSERT блокируется (no policy).

-- service_role: полный доступ (для админ-операций)
DROP POLICY IF EXISTS profiles_service_all ON public.profiles;
CREATE POLICY profiles_service_all ON public.profiles FOR ALL
  TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ─── TRIGGER: автосоздание profile при signup ───────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name TEXT;
  v_initials TEXT;
BEGIN
  -- name из user_metadata (передаётся при signup), фолбэк — часть email до @
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  -- инициалы: первые буквы двух слов (или одна, если 1 слово)
  v_initials := UPPER(LEFT(v_name, 1));
  IF position(' ' IN v_name) > 0 THEN
    v_initials := v_initials || UPPER(SUBSTRING(v_name FROM position(' ' IN v_name) + 1 FOR 1));
  ELSE
    v_initials := v_initials || UPPER(SUBSTRING(v_name FROM 2 FOR 1));
  END IF;

  INSERT INTO public.profiles (id, name, initials)
  VALUES (NEW.id, v_name, v_initials)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
