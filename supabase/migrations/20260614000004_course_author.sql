-- =====================================================================
-- Artum Academy: автор курса + «Чему вы научитесь» (доверие/конверсия)
--
-- По дизайн-аудиту: на странице курса не хватает блока автора и списка
-- результатов — ключевых для доверия и конверсии. Поля курса, аддитивно.
--
-- author_*           — преподаватель (имя, регалии, био, фото)
-- learning_outcomes  — массив буллетов «чему научитесь»
-- =====================================================================

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS author_title TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS author_bio TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS author_avatar_url TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS learning_outcomes TEXT[] NOT NULL DEFAULT '{}';
