'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, CircleHelp, X } from 'lucide-react';

import type { PublicQuiz } from '@/lib/quiz';
import { submitQuizAction } from '@/server/actions/commerce';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuizResult {
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  perQuestion: { questionId: string; correct: boolean }[];
}

export interface QuizRunnerProps {
  lessonId: string;
  quiz: PublicQuiz;
  alreadyPassed?: boolean;
  className?: string;
}

/**
 * Прохождение теста студентом. Ответы проверяются строго на сервере
 * (submitQuizAction) — верные варианты клиенту не отдаются. Попытки безлимитны.
 */
export function QuizRunner({ lessonId, quiz, alreadyPassed = false, className }: QuizRunnerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const resultByQuestion = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const r of result?.perQuestion ?? []) map[r.questionId] = r.correct;
    return map;
  }, [result]);

  const answeredCount = useMemo(
    () => Object.values(selected).filter((ids) => ids.length > 0).length,
    [selected],
  );
  const locked = result !== null;

  function toggle(questionId: string, optionId: string, multi: boolean) {
    if (locked) return;
    setSelected((prev) => {
      const current = prev[questionId] ?? [];
      if (multi) {
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: [optionId] };
    });
  }

  function handleSubmit() {
    if (answeredCount === 0 || pending) return;
    startTransition(async () => {
      const res = await submitQuizAction(lessonId, selected);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const data = res.data as QuizResult;
      setResult(data);
      if (data.passed) {
        toast.success(`Тест пройден — ${data.percent}%`);
        router.refresh();
      } else {
        toast.error(`${data.percent}% — нужно ${quiz.passPercent}%`);
      }
    });
  }

  function handleRetry() {
    setResult(null);
    setSelected({});
  }

  return (
    <section className={cn('space-y-4', className)}>
      {alreadyPassed && !result && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
          <Check className="size-4 shrink-0" />
          <span>Тест уже пройден</span>
        </div>
      )}

      {result && (
        <div
          role="status"
          className={cn(
            'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium',
            result.passed
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
              : 'border-destructive/40 bg-destructive/10 text-destructive',
          )}
        >
          {result.passed ? (
            <Check className="size-5 shrink-0" />
          ) : (
            <X className="size-5 shrink-0" />
          )}
          <span>
            {result.passed
              ? `Тест пройден — ${result.percent}%`
              : `${result.percent}% — нужно ${quiz.passPercent}%`}
          </span>
        </div>
      )}

      <ol className="space-y-4">
        {quiz.questions.map((q, qi) => {
          const multi = q.type === 'multi';
          const chosen = selected[q.id] ?? [];
          const graded = locked ? resultByQuestion[q.id] : undefined;
          return (
            <li
              key={q.id}
              className={cn(
                'rounded-xl border bg-card p-4 transition-colors',
                graded === true && 'border-emerald-500/50',
                graded === false && 'border-destructive/50',
                graded === undefined && 'border-border',
              )}
            >
              <div className="mb-3 flex items-start gap-2">
                {graded === true ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                ) : graded === false ? (
                  <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                ) : (
                  <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <p className="text-sm font-medium text-foreground">
                  <span className="text-muted-foreground">{qi + 1}. </span>
                  {q.text}
                </p>
              </div>

              <div className="space-y-1.5 pl-6">
                {q.options.map((opt) => {
                  const isChosen = chosen.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-md border border-transparent px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50',
                        isChosen && 'border-primary/40 bg-primary/10 text-foreground',
                        locked && 'cursor-default hover:bg-transparent',
                      )}
                    >
                      <input
                        type={multi ? 'checkbox' : 'radio'}
                        name={`q-${q.id}`}
                        checked={isChosen}
                        disabled={locked}
                        onChange={() => toggle(q.id, opt.id, multi)}
                        className={cn(
                          'size-4 shrink-0 accent-primary',
                          multi ? 'rounded-sm' : 'rounded-full',
                        )}
                      />
                      <span>{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-3">
        {result ? (
          <Button variant="outline" onClick={handleRetry}>
            Пройти заново
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={pending || answeredCount === 0}>
            {pending ? 'Проверяем…' : 'Проверить'}
          </Button>
        )}
      </div>
    </section>
  );
}
