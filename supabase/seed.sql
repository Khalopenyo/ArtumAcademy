-- ==================================================================
-- Тестовые данные для локальной разработки.
-- Запускается командой: npm run db:reset
-- ==================================================================

INSERT INTO courses (slug, title, description, order_index, published) VALUES
  ('basics', 'Основы монтажа видео', 'Базовый курс для начинающих. DaVinci Resolve с нуля.', 0, true),
  ('color-grading', 'Цветокоррекция', 'Профессиональная работа с цветом и LUT.', 1, true),
  ('motion-graphics', 'Графика и эффекты', 'Анимация и моушн-дизайн.', 2, false);

-- Модули для первого курса
WITH c AS (SELECT id FROM courses WHERE slug = 'basics')
INSERT INTO modules (course_id, title, order_index)
SELECT c.id, m.title, m.idx
FROM c, (VALUES
  ('Введение в DaVinci Resolve', 0),
  ('Базовый монтаж', 1),
  ('Звук и аудио', 2)
) AS m(title, idx);

-- Уроки в первом модуле
WITH m AS (
  SELECT id FROM modules
  WHERE title = 'Введение в DaVinci Resolve'
  LIMIT 1
)
INSERT INTO lessons (module_id, title, duration_sec, order_index, is_preview, published)
SELECT m.id, l.title, l.dur, l.idx, l.preview, true
FROM m, (VALUES
  ('Установка и первый запуск', 600, 0, true),
  ('Интерфейс программы', 900, 1, false),
  ('Создание первого проекта', 1200, 2, false)
) AS l(title, dur, idx, preview);
