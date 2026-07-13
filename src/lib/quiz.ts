import { z } from 'zod';

/**
 * Тесты (quiz) уроков Artum. Определение теста хранится в lessons.quiz (jsonb).
 * ВАЖНО (безопасность): полный Quiz (с флагами correct) живёт только на сервере.
 * Клиенту отдаётся PublicQuiz через stripAnswers() — без правильных ответов.
 * Проверка ответов и баллы считаются строго на сервере через gradeQuiz().
 */

export type QuizQuestionType = 'single' | 'multi';

export interface QuizOption {
  id: string;
  text: string;
  correct: boolean;
}
export interface QuizQuestion {
  id: string;
  text: string;
  type: QuizQuestionType;
  options: QuizOption[];
}
export interface Quiz {
  passPercent: number;
  questions: QuizQuestion[];
}

/** Клиент-безопасные варианты — без флага correct. */
export interface PublicQuizOption {
  id: string;
  text: string;
}
export interface PublicQuizQuestion {
  id: string;
  text: string;
  type: QuizQuestionType;
  options: PublicQuizOption[];
}
export interface PublicQuiz {
  passPercent: number;
  questions: PublicQuizQuestion[];
}

/** Zod-схема сохранения теста из админки (переиспользуется в Server Action). */
export const quizOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1, 'Пустой вариант ответа'),
  correct: z.boolean(),
});
export const quizQuestionSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().trim().min(1, 'Пустой вопрос'),
    type: z.enum(['single', 'multi']),
    options: z.array(quizOptionSchema).min(2, 'Минимум 2 варианта в вопросе'),
  })
  .refine((q) => q.options.some((o) => o.correct), {
    message: 'Отметьте хотя бы один верный вариант',
  })
  .refine((q) => q.type !== 'single' || q.options.filter((o) => o.correct).length === 1, {
    message: 'В вопросе с одним ответом должен быть ровно один верный вариант',
  });
export const quizSchema = z.object({
  passPercent: z.number().int().min(1).max(100),
  questions: z.array(quizQuestionSchema).min(1, 'Добавьте хотя бы один вопрос'),
});

/** Убирает correct-флаги — это то, что безопасно уходит на клиент. */
export function stripAnswers(quiz: Quiz): PublicQuiz {
  return {
    passPercent: quiz.passPercent,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    })),
  };
}

export interface QuestionResult {
  questionId: string;
  correct: boolean;
}
export interface QuizGrade {
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  perQuestion: QuestionResult[];
}

/**
 * Серверная проверка. answers: questionId → массив выбранных optionId.
 * Вопрос засчитан, только если множество выбранных вариантов ПОЛНОСТЬЮ совпадает
 * с множеством верных (одинаково для single и multi).
 */
export function gradeQuiz(quiz: Quiz, answers: Record<string, string[]>): QuizGrade {
  const perQuestion: QuestionResult[] = quiz.questions.map((q) => {
    const correctIds = new Set(q.options.filter((o) => o.correct).map((o) => o.id));
    const chosen = new Set(answers[q.id] ?? []);
    const correct =
      chosen.size === correctIds.size && [...chosen].every((id) => correctIds.has(id));
    return { questionId: q.id, correct };
  });
  const score = perQuestion.filter((r) => r.correct).length;
  const maxScore = quiz.questions.length;
  const percent = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);
  return { score, maxScore, percent, passed: percent >= quiz.passPercent, perQuestion };
}
