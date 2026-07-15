-- =====================================================================
-- Artum Academy: тесты (quiz) в уроках.
--
-- «Урок-тест» = урок с заполненным quiz (jsonb), обычно без видео.
-- Прохождение теста (>= порога) отмечает урок пройденным (lesson_progress),
-- поэтому существующая логика сертификата (100% уроков → maybe_issue_certificate)
-- работает БЕЗ изменений — тест-урок просто ещё один урок, который надо пройти.
--
-- Аддитивно: nullable-колонка + новая таблица, ничего не ломает.
-- =====================================================================

-- Определение теста: { passPercent, questions:[{ id, text, type, options:[{id,text,correct}] }] }
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS quiz jsonb;

-- Попытки студентов (для оценки, повторов и защиты от накрутки)
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  score int NOT NULL,
  max_score int NOT NULL,
  passed boolean NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_attempts_user_lesson_idx
  ON public.quiz_attempts (user_id, lesson_id, submitted_at DESC);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Студент видит только свои попытки. Запись — только через Server Action под
-- service_role (обходит RLS): проверка верных ответов и подсчёт баллов идут
-- строго на сервере, поэтому INSERT-политики для authenticated намеренно нет.
DROP POLICY IF EXISTS quiz_attempts_select_own ON public.quiz_attempts;
CREATE POLICY quiz_attempts_select_own ON public.quiz_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
