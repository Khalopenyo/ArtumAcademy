-- ==================================================================
-- Тестовые данные для локальной разработки.
-- Запускается командой: npm run db:reset
-- ==================================================================

-- ------------------------------------------------------------------
-- MVP-фаза один курс (plan-04 LAND-02). Slug совпадает с
-- src/lib/constants/course.ts MVP_COURSE_SLUG ('videoedit-mvp').
--
-- Цена для MVP — статичная в коде (PricingBlock + CoursePreviewCard);
-- commerce-колонки (price_minor, currency, kinescope_video_id) добавит
-- CRSE-01 в Phase 3.
--
-- КРИТИЧНО: каждый урок имеет is_preview = TRUE AND published = TRUE,
-- так как RLS на lessons:
--   USING (is_preview = true AND published = true)
-- иначе анонимный пользователь не увидит названия в /courses/[slug].
-- ------------------------------------------------------------------

INSERT INTO courses (id, slug, title, description, cover_url, published, order_index)
VALUES (
  '11111111-1111-4111-8111-000000000001',
  'videoedit-mvp',
  'Монтаж видео в DaVinci Resolve',
  'Авторский курс по монтажу видео. От первого реза до финального экспорта.',
  NULL,  -- обложка опциональна, рендерится placeholder gradient в CoursePreviewCard
  TRUE,
  0
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  cover_url = EXCLUDED.cover_url,
  published = EXCLUDED.published,
  order_index = EXCLUDED.order_index;

-- 2 модуля
INSERT INTO modules (id, course_id, title, description, order_index) VALUES
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 'Модуль 1 — Введение в DaVinci Resolve', 'Установка, интерфейс, импорт материалов, первый монтаж.', 0),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000001', 'Модуль 2 — Базовый монтаж', 'Резка, склейка, транзишены, синхронизация.', 1)
ON CONFLICT (id) DO NOTHING;

-- 6 уроков (3 на модуль). is_preview + published = TRUE — anon-RLS показывает названия в preview.
-- video_id = NULL пока (Phase 5 заполнит Kinescope IDs).
-- duration_sec в секундах (бывшие "минуты × 60" — соответствует колонке миграции 20260522000001).
INSERT INTO lessons (id, module_id, title, video_id, duration_sec, order_index, is_preview, published) VALUES
  ('33333333-3333-4333-8333-000000000001', '22222222-2222-4222-8222-000000000001', 'Установка и интерфейс',   NULL, 1080, 0, TRUE, TRUE),
  ('33333333-3333-4333-8333-000000000002', '22222222-2222-4222-8222-000000000001', 'Импорт материалов',       NULL, 1320, 1, TRUE, TRUE),
  ('33333333-3333-4333-8333-000000000003', '22222222-2222-4222-8222-000000000001', 'Первый монтаж',           NULL, 2100, 2, TRUE, TRUE),
  ('33333333-3333-4333-8333-000000000004', '22222222-2222-4222-8222-000000000002', 'Резка и склейка',         NULL, 1680, 0, TRUE, TRUE),
  ('33333333-3333-4333-8333-000000000005', '22222222-2222-4222-8222-000000000002', 'Транзишены',              NULL, 1440, 1, TRUE, TRUE),
  ('33333333-3333-4333-8333-000000000006', '22222222-2222-4222-8222-000000000002', 'Синхронизация со звуком', NULL, 1860, 2, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------
-- Legacy демо-курсы (pre-MVP fixtures). Сохранены для интеграционных
-- тестов, которые ссылаются на slug 'basics'.
-- ------------------------------------------------------------------

INSERT INTO courses (slug, title, description, order_index, published) VALUES
  ('basics', 'Основы монтажа видео', 'Базовый курс для начинающих. DaVinci Resolve с нуля.', 10, true),
  ('color-grading', 'Цветокоррекция', 'Профессиональная работа с цветом и LUT.', 11, true),
  ('motion-graphics', 'Графика и эффекты', 'Анимация и моушн-дизайн.', 12, false)
ON CONFLICT (slug) DO NOTHING;

-- Модули для первого legacy курса
WITH c AS (SELECT id FROM courses WHERE slug = 'basics')
INSERT INTO modules (course_id, title, order_index)
SELECT c.id, m.title, m.idx
FROM c, (VALUES
  ('Введение в DaVinci Resolve', 0),
  ('Базовый монтаж', 1),
  ('Звук и аудио', 2)
) AS m(title, idx)
ON CONFLICT DO NOTHING;

-- Уроки в первом модуле legacy курса
WITH m AS (
  SELECT id FROM modules
  WHERE title = 'Введение в DaVinci Resolve'
    AND course_id = (SELECT id FROM courses WHERE slug = 'basics')
  LIMIT 1
)
INSERT INTO lessons (module_id, title, duration_sec, order_index, is_preview, published)
SELECT m.id, l.title, l.dur, l.idx, l.preview, true
FROM m, (VALUES
  ('Установка и первый запуск', 600, 0, true),
  ('Интерфейс программы', 900, 1, false),
  ('Создание первого проекта', 1200, 2, false)
) AS l(title, dur, idx, preview)
ON CONFLICT DO NOTHING;
