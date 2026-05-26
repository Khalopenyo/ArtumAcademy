-- =====================================================================
-- Migration: 20260530000001_artum_init
-- Artum Academy — начальная схема каталога.
--
-- Шаг 1: только публичный каталог (categories + courses + modules + lessons).
-- Auth, purchases, progress, certificates — следующие миграции.
--
-- Применить через Supabase Dashboard:
--   1. Откройте https://supabase.com/dashboard/project/bcidlpwrlclmdzupxazh/sql/new
--   2. Скопируйте весь файл сюда
--   3. Нажмите Run
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- ENUM: 7 категорий курсов (ТЗ §6)
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'course_category') THEN
    CREATE TYPE course_category AS ENUM (
      'ai',       -- Нейросети / AI
      'photo',    -- Фотография
      'video',    -- Видеосъёмка
      'editing',  -- Монтаж
      'design',   -- Дизайн
      'visual',   -- Визуал
      'copy'      -- Копирайтинг
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- TABLE: courses
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT NOT NULL UNIQUE,
  title              TEXT NOT NULL,
  short_description  TEXT NOT NULL DEFAULT '',
  long_description   TEXT NOT NULL DEFAULT '',
  category           course_category NOT NULL,
  students_count     INT NOT NULL DEFAULT 0,
  price_minor        INT NOT NULL DEFAULT 0,
  cover_gradient     TEXT NOT NULL DEFAULT 'from-purple-600 via-fuchsia-500 to-pink-500',
  published          BOOLEAN NOT NULL DEFAULT TRUE,
  order_index        INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS courses_category_idx ON public.courses (category);
CREATE INDEX IF NOT EXISTS courses_published_idx ON public.courses (published, order_index);

-- ─────────────────────────────────────────────────────────────────────
-- TABLE: modules
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.modules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  order_index  INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS modules_course_idx ON public.modules (course_id, order_index);

-- ─────────────────────────────────────────────────────────────────────
-- TABLE: lessons
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lessons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  duration_sec  INT NOT NULL DEFAULT 600,
  video_url     TEXT,
  preview       BOOLEAN NOT NULL DEFAULT FALSE,
  order_index   INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lessons_module_idx ON public.lessons (module_id, order_index);

-- ─────────────────────────────────────────────────────────────────────
-- TRIGGER: updated_at автообновление для courses
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS courses_set_updated_at ON public.courses;
CREATE TRIGGER courses_set_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- RLS: публичное чтение опубликованных курсов, write — только service_role
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- COURSES: публичное чтение опубликованных, service_role полный доступ
DROP POLICY IF EXISTS courses_public_select ON public.courses;
CREATE POLICY courses_public_select
  ON public.courses FOR SELECT
  TO anon, authenticated
  USING (published = TRUE);

DROP POLICY IF EXISTS courses_service_all ON public.courses;
CREATE POLICY courses_service_all
  ON public.courses FOR ALL
  TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- MODULES: чтение всех модулей опубликованных курсов
DROP POLICY IF EXISTS modules_public_select ON public.modules;
CREATE POLICY modules_public_select
  ON public.modules FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = modules.course_id
        AND courses.published = TRUE
    )
  );

DROP POLICY IF EXISTS modules_service_all ON public.modules;
CREATE POLICY modules_service_all
  ON public.modules FOR ALL
  TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- LESSONS: чтение всех уроков опубликованных курсов (на скелете полный доступ;
-- ограничение по покупке добавим в следующей миграции с purchases)
DROP POLICY IF EXISTS lessons_public_select ON public.lessons;
CREATE POLICY lessons_public_select
  ON public.lessons FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.modules
      JOIN public.courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id
        AND courses.published = TRUE
    )
  );

DROP POLICY IF EXISTS lessons_service_all ON public.lessons;
CREATE POLICY lessons_service_all
  ON public.lessons FOR ALL
  TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ─────────────────────────────────────────────────────────────────────
-- SEED: 9 курсов из mock-каталога (src/lib/mock/courses.ts)
-- ─────────────────────────────────────────────────────────────────────

-- ── AI ────────────────────────────────────────────────────────────────
WITH new_course AS (
  INSERT INTO public.courses (slug, title, short_description, long_description, category, students_count, price_minor, cover_gradient, order_index)
  VALUES (
    'midjourney-promptcraft',
    'Midjourney от нуля до промптинга',
    'Освойте генерацию изображений в Midjourney v7',
    'Полный курс по работе с Midjourney v7: от базовых команд до сложных prompt-инженерных приёмов. Научитесь генерировать качественные изображения для соцсетей, презентаций, моодбордов и коммерческих проектов.',
    'ai', 2847, 1990000, 'from-purple-600 via-fuchsia-500 to-pink-500', 1
  )
  ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title, short_description = EXCLUDED.short_description,
    long_description = EXCLUDED.long_description, students_count = EXCLUDED.students_count,
    price_minor = EXCLUDED.price_minor, cover_gradient = EXCLUDED.cover_gradient
  RETURNING id
),
mod1 AS (
  INSERT INTO public.modules (course_id, title, description, order_index)
  SELECT id, 'Введение в Midjourney', 'Установка, аккаунт Discord, первые команды', 0 FROM new_course
  RETURNING id
),
mod2 AS (
  INSERT INTO public.modules (course_id, title, description, order_index)
  SELECT id, 'Промпт-инжиниринг', 'Структура запросов, параметры, стили', 1 FROM new_course
  RETURNING id
)
INSERT INTO public.lessons (module_id, title, duration_sec, video_url, preview, order_index)
SELECT id, l.title, l.dur, l.url, l.preview, l.idx FROM mod1, (VALUES
  ('Что такое Midjourney и для чего он нужен', 720, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', TRUE, 0),
  ('Регистрация и подключение к Discord', 480, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', FALSE, 1),
  ('Первый промпт: команда /imagine', 900, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', FALSE, 2)
) AS l(title, dur, url, preview, idx)
UNION ALL
SELECT id, l.title, l.dur, l.url, l.preview, l.idx FROM mod2, (VALUES
  ('Анатомия эффективного промпта', 1080, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', FALSE, 0),
  ('Параметры --ar, --stylize, --chaos', 960, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', FALSE, 1),
  ('Стилизация: художники, фотореализм, аниме', 1320, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', FALSE, 2),
  ('Использование reference-изображений', 1140, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', FALSE, 3)
) AS l(title, dur, url, preview, idx);

-- ── ChatGPT ───────────────────────────────────────────────────────────
WITH new_course AS (
  INSERT INTO public.courses (slug, title, short_description, long_description, category, students_count, price_minor, cover_gradient, order_index)
  VALUES (
    'chatgpt-for-creators',
    'ChatGPT для авторов и креаторов',
    'Продвинутый промптинг для текстовых задач',
    'Как использовать ChatGPT в ежедневной работе: написание сценариев, идеация, исследование тем, форматирование контента и автоматизация рутины через Custom GPTs.',
    'ai', 1923, 1490000, 'from-violet-600 via-purple-500 to-indigo-500', 2
  )
  ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
  RETURNING id
),
mod1 AS (
  INSERT INTO public.modules (course_id, title, description, order_index)
  SELECT id, 'Основы работы с ChatGPT', 'Интерфейс, лимиты, базовые приёмы', 0 FROM new_course
  RETURNING id
)
INSERT INTO public.lessons (module_id, title, duration_sec, video_url, preview, order_index)
SELECT id, l.title, l.dur, l.url, l.preview, l.idx FROM mod1, (VALUES
  ('Введение и принципы LLM', 660, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', TRUE, 0),
  ('Структура хорошего промпта', 840, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', FALSE, 1),
  ('Custom Instructions и память', 540, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4', FALSE, 2)
) AS l(title, dur, url, preview, idx);

-- ── Photo (mobile) ────────────────────────────────────────────────────
WITH new_course AS (
  INSERT INTO public.courses (slug, title, short_description, long_description, category, students_count, price_minor, cover_gradient, order_index)
  VALUES (
    'mobile-photography-basics',
    'Мобильная фотография: композиция и свет',
    'Снимайте на телефон как профи',
    'Курс о том, как делать сильные фото на iPhone и Android. Работа со светом, композиция, цвет, базовая ретушь в Lightroom Mobile, портфолио в Instagram.',
    'photo', 4127, 990000, 'from-emerald-500 via-teal-500 to-cyan-500', 3
  )
  ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
  RETURNING id
),
mod1 AS (
  INSERT INTO public.modules (course_id, title, description, order_index)
  SELECT id, 'Основы композиции', 'Правило третей, направляющие линии, ритм', 0 FROM new_course
  RETURNING id
),
mod2 AS (
  INSERT INTO public.modules (course_id, title, description, order_index)
  SELECT id, 'Свет в кадре', 'Естественный свет, золотой час, силуэты', 1 FROM new_course
  RETURNING id
)
INSERT INTO public.lessons (module_id, title, duration_sec, video_url, preview, order_index)
SELECT id, l.title, l.dur, l.url, l.preview, l.idx FROM mod1, (VALUES
  ('Правило третей и золотое сечение', 780, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4', TRUE, 0),
  ('Направляющие линии и перспектива', 660, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', FALSE, 1),
  ('Симметрия и асимметрия', 540, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', FALSE, 2)
) AS l(title, dur, url, preview, idx)
UNION ALL
SELECT id, l.title, l.dur, l.url, l.preview, l.idx FROM mod2, (VALUES
  ('Жёсткий и мягкий свет', 720, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', FALSE, 0),
  ('Золотой час и синий час', 900, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', FALSE, 1),
  ('Контровой свет и силуэты', 600, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', FALSE, 2)
) AS l(title, dur, url, preview, idx);

-- ── Photo (lightroom) ─────────────────────────────────────────────────
WITH new_course AS (
  INSERT INTO public.courses (slug, title, short_description, long_description, category, students_count, price_minor, cover_gradient, order_index)
  VALUES (
    'lightroom-essentials',
    'Lightroom Mobile: ретушь и пресеты',
    'Цветокоррекция на телефоне',
    'Полный воркфлоу обработки фото в Lightroom Mobile: импорт, базовая коррекция, локальные правки, создание собственных пресетов и публикация.',
    'photo', 3216, 1290000, 'from-green-500 via-emerald-400 to-lime-500', 4
  )
  ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
  RETURNING id
),
mod1 AS (
  INSERT INTO public.modules (course_id, title, description, order_index)
  SELECT id, 'Интерфейс и базовая коррекция', 'Знакомство, экспозиция, баланс белого', 0 FROM new_course
  RETURNING id
)
INSERT INTO public.lessons (module_id, title, duration_sec, video_url, preview, order_index)
SELECT id, l.title, l.dur, l.url, l.preview, l.idx FROM mod1, (VALUES
  ('Установка и интерфейс', 600, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', TRUE, 0),
  ('Экспозиция и контраст', 720, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', FALSE, 1)
) AS l(title, dur, url, preview, idx);

-- ── Video ─────────────────────────────────────────────────────────────
WITH new_course AS (
  INSERT INTO public.courses (slug, title, short_description, long_description, category, students_count, price_minor, cover_gradient, order_index)
  VALUES (
    'mobile-video-storytelling',
    'Видеосъёмка на телефон: сторителлинг',
    'Снимайте сильные видео для соцсетей',
    'Полный курс по съёмке видео на смартфон: стабилизация, свет, звук, кадрирование, базовый монтаж, экспорт под Reels/Shorts/TikTok.',
    'video', 1849, 1790000, 'from-amber-500 via-yellow-500 to-orange-500', 5
  )
  ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
  RETURNING id
),
mod1 AS (
  INSERT INTO public.modules (course_id, title, description, order_index)
  SELECT id, 'Подготовка к съёмке', 'Сценарий, раскадровка, оборудование', 0 FROM new_course
  RETURNING id
)
INSERT INTO public.lessons (module_id, title, duration_sec, video_url, preview, order_index)
SELECT id, l.title, l.dur, l.url, l.preview, l.idx FROM mod1, (VALUES
  ('Идея и сценарий', 540, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', TRUE, 0),
  ('Раскадровка', 660, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', FALSE, 1),
  ('Оборудование на телефоне', 480, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', FALSE, 2)
) AS l(title, dur, url, preview, idx);

-- ── Editing (DaVinci) ─────────────────────────────────────────────────
WITH new_course AS (
  INSERT INTO public.courses (slug, title, short_description, long_description, category, students_count, price_minor, cover_gradient, order_index)
  VALUES (
    'davinci-resolve-fundamentals',
    'DaVinci Resolve: основы монтажа',
    'Бесплатный профессиональный монтаж',
    'Курс по DaVinci Resolve для начинающих: интерфейс, импорт, базовая склейка, транзишены, цветокор, экспорт. Альтернатива Premiere Pro без подписки.',
    'editing', 2384, 1990000, 'from-orange-500 via-red-500 to-pink-500', 6
  )
  ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
  RETURNING id
),
mod1 AS (
  INSERT INTO public.modules (course_id, title, description, order_index)
  SELECT id, 'Введение в DaVinci Resolve', 'Установка, интерфейс, первый проект', 0 FROM new_course
  RETURNING id
),
mod2 AS (
  INSERT INTO public.modules (course_id, title, description, order_index)
  SELECT id, 'Базовый монтаж', 'Резка, склейка, транзишены, синхронизация', 1 FROM new_course
  RETURNING id
)
INSERT INTO public.lessons (module_id, title, duration_sec, video_url, preview, order_index)
SELECT id, l.title, l.dur, l.url, l.preview, l.idx FROM mod1, (VALUES
  ('Установка и системные требования', 540, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4', TRUE, 0),
  ('Обзор интерфейса: Media / Edit / Color', 780, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4', FALSE, 1),
  ('Создание первого проекта', 660, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', FALSE, 2)
) AS l(title, dur, url, preview, idx)
UNION ALL
SELECT id, l.title, l.dur, l.url, l.preview, l.idx FROM mod2, (VALUES
  ('Резка и склейка клипов', 900, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', FALSE, 0),
  ('Базовые транзишены', 720, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', FALSE, 1),
  ('Синхронизация со звуком', 840, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', FALSE, 2)
) AS l(title, dur, url, preview, idx);

-- ── Design (Figma) ────────────────────────────────────────────────────
WITH new_course AS (
  INSERT INTO public.courses (slug, title, short_description, long_description, category, students_count, price_minor, cover_gradient, order_index)
  VALUES (
    'figma-essentials',
    'Figma: дизайн от макета до прототипа',
    'UX/UI-дизайн на современном инструменте',
    'Полный курс по Figma: фреймы, компоненты, варианты, авто-лейаут, прототипирование, design tokens, плагины, экспорт в Dev-mode.',
    'design', 5471, 2490000, 'from-blue-500 via-sky-500 to-cyan-500', 7
  )
  ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
  RETURNING id
),
mod1 AS (
  INSERT INTO public.modules (course_id, title, description, order_index)
  SELECT id, 'Введение в Figma', 'Установка, интерфейс, базовая навигация', 0 FROM new_course
  RETURNING id
)
INSERT INTO public.lessons (module_id, title, duration_sec, video_url, preview, order_index)
SELECT id, l.title, l.dur, l.url, l.preview, l.idx FROM mod1, (VALUES
  ('Зачем Figma и кому она нужна', 480, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', TRUE, 0),
  ('Установка и интерфейс', 600, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', FALSE, 1)
) AS l(title, dur, url, preview, idx);

-- ── Visual ────────────────────────────────────────────────────────────
WITH new_course AS (
  INSERT INTO public.courses (slug, title, short_description, long_description, category, students_count, price_minor, cover_gradient, order_index)
  VALUES (
    'instagram-visual-aesthetic',
    'Эстетика Instagram-ленты',
    'Визуальный язык для бренда',
    'Как создавать цельную визуальную ленту в Instagram: цветовая палитра, типографика, ритм, контент-планнинг, шаблоны.',
    'visual', 1267, 1190000, 'from-pink-500 via-rose-500 to-fuchsia-500', 8
  )
  ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
  RETURNING id
),
mod1 AS (
  INSERT INTO public.modules (course_id, title, description, order_index)
  SELECT id, 'Цвет и типографика', 'Палитра, шрифты, контраст', 0 FROM new_course
  RETURNING id
)
INSERT INTO public.lessons (module_id, title, duration_sec, video_url, preview, order_index)
SELECT id, 'Цветовая палитра бренда', 660,
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', TRUE, 0
FROM mod1;

-- ── Copy ──────────────────────────────────────────────────────────────
WITH new_course AS (
  INSERT INTO public.courses (slug, title, short_description, long_description, category, students_count, price_minor, cover_gradient, order_index)
  VALUES (
    'copywriting-for-social-media',
    'Копирайтинг для соцсетей',
    'Тексты, которые продают и удерживают',
    'Курс по написанию постов, рилсов, рекламы и сторителлинга для Instagram / Telegram / VK. Структуры, hooks, CTA, тестирование текстов.',
    'copy', 943, 990000, 'from-teal-500 via-cyan-500 to-emerald-500', 9
  )
  ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
  RETURNING id
),
mod1 AS (
  INSERT INTO public.modules (course_id, title, description, order_index)
  SELECT id, 'Основы', 'Структуры текстов, hooks, CTA', 0 FROM new_course
  RETURNING id
)
INSERT INTO public.lessons (module_id, title, duration_sec, video_url, preview, order_index)
SELECT id, 'Зачем структура и hooks', 480,
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', TRUE, 0
FROM mod1;
