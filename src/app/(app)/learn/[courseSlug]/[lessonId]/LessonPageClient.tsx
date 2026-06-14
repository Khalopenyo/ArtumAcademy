'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LessonPlayer } from '@/components/artum/LessonPlayer';
import { formatDuration, getCategory } from '@/lib/mock/courses';
import {
  markLessonCompleteAction,
  recordWatchProgressAction,
  unmarkLessonAction,
} from '@/server/actions/commerce';
import { cn } from '@/lib/utils';

import type { LessonContext } from './page';

interface LessonPageClientProps {
  ctx: LessonContext;
  completedLessonIds: string[];
  startPositionSec: number;
  /** Email зрителя — водяной знак поверх Kinescope-видео (анти-пиратство). */
  watermarkText?: string;
}

export function LessonPageClient({
  ctx,
  completedLessonIds,
  startPositionSec,
  watermarkText,
}: LessonPageClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Local optimistic copy — мгновенный отклик в UI; реальный source of truth — server
  const [completedLocal, setCompletedLocal] = useState<Set<string>>(
    () => new Set(completedLessonIds),
  );
  // Throttle для recordWatchProgressAction: пишем не чаще раза в N секунд
  const lastRecordSecRef = useRef<number>(0);

  const category = getCategory(ctx.course.category);
  const completed = completedLocal.has(ctx.lesson.id);

  // Аггрегированный прогресс по курсу
  const { totalLessons, completedLessons, percent } = useMemo(() => {
    const all = ctx.course.modules.flatMap((m) => m.lessons);
    const done = all.filter((l) => completedLocal.has(l.id)).length;
    return {
      totalLessons: all.length,
      completedLessons: done,
      percent: all.length === 0 ? 0 : Math.round((done / all.length) * 100),
    };
  }, [ctx.course.modules, completedLocal]);

  function handleToggleComplete() {
    const wasCompleted = completed;
    // optimistic
    setCompletedLocal((prev) => {
      const next = new Set(prev);
      if (wasCompleted) next.delete(ctx.lesson.id);
      else next.add(ctx.lesson.id);
      return next;
    });
    startTransition(async () => {
      const res = wasCompleted
        ? await unmarkLessonAction(ctx.lesson.id)
        : await markLessonCompleteAction(ctx.lesson.id);
      if (!res.ok) {
        // откат
        setCompletedLocal((prev) => {
          const next = new Set(prev);
          if (wasCompleted) next.add(ctx.lesson.id);
          else next.delete(ctx.lesson.id);
          return next;
        });
        toast.error(res.error);
        return;
      }
      if (wasCompleted) {
        toast.info('Отметка пройденного снята');
      } else {
        // Проверяем — это был последний урок? (по локальному состоянию + 1)
        const wouldBeCompleted = completedLessons + 1;
        if (wouldBeCompleted >= totalLessons) {
          toast.success('🎉 Курс пройден! Сертификат добавлен в личный кабинет', {
            action: {
              label: 'Открыть',
              onClick: () => router.push('/certificates'),
            },
          });
        } else {
          toast.success('Урок отмечен пройденным');
        }
      }
      // Дотащим server state в кэш — но без блокирующего refresh, чтобы
      // не перерисовывать всю страницу. Тут refresh минимально полезен,
      // т.к. в текущей навигации completedLocal уже актуальный.
      router.refresh();
    });
  }

  function handleVideoProgress(positionSec: number, durationSec: number) {
    // Throttle: один write раз в ~10 сек, чтобы не задрочить БД.
    const nowSec = Math.floor(positionSec);
    if (Math.abs(nowSec - lastRecordSecRef.current) < 10) return;
    lastRecordSecRef.current = nowSec;

    // Fire and forget — успех/ошибку молча игнорируем; критично только UX
    // не тормозит. При >=95% сервер сам отметит lesson_progress (auto-complete).
    void recordWatchProgressAction(ctx.lesson.id, positionSec, durationSec).then(
      (res) => {
        if (res.ok && !completedLocal.has(ctx.lesson.id) && durationSec > 0 &&
            positionSec / durationSec >= 0.95) {
          // Сервер мог авто-отметить — обновим local
          setCompletedLocal((prev) => {
            const next = new Set(prev);
            next.add(ctx.lesson.id);
            return next;
          });
        }
      },
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <Link
        href={`/courses/${ctx.course.slug}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        К курсу «{ctx.course.title}»
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Левая колонка — видео + контролы */}
        <div className="space-y-4 lg:col-span-2">
          {ctx.lesson.videoUrl || !ctx.lesson.content?.trim() ? (
            <LessonPlayer
              videoUrl={ctx.lesson.videoUrl}
              startPositionSec={startPositionSec}
              fallbackGradient={ctx.course.coverGradient}
              watermarkText={watermarkText}
              onProgress={handleVideoProgress}
            />
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium',
                  category.tagBgClass,
                  category.tagTextClass,
                )}
              >
                <span aria-hidden>{category.emoji}</span>
                {category.label}
              </span>
              <span>
                Урок {ctx.absoluteIndex + 1} из {ctx.total}
              </span>
              <span>·</span>
              <span>{formatDuration(ctx.lesson.durationSec)}</span>
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              {ctx.lesson.title}
            </h1>
            <p className="text-sm text-muted-foreground">Модуль {ctx.module.title}</p>
          </div>

          {ctx.lesson.content?.trim() ? (
            <article
              className="prose prose-invert max-w-none rounded-xl border border-border/60 bg-card/40 p-5 prose-img:rounded-xl"
              // Контент уже санитизирован на сервере при сохранении (sanitize-html,
              // строгий allowlist) — все записи идут только через updateLessonAction.
              dangerouslySetInnerHTML={{ __html: ctx.lesson.content }}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              {ctx.prev ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/learn/${ctx.prev.courseSlug}/${ctx.prev.lessonId}`}>
                    <ChevronLeft className="mr-1 size-4" aria-hidden />
                    Предыдущий
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  <ChevronLeft className="mr-1 size-4" aria-hidden />
                  Предыдущий
                </Button>
              )}
              {ctx.next ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/learn/${ctx.next.courseSlug}/${ctx.next.lessonId}`}>
                    Следующий
                    <ChevronRight className="ml-1 size-4" aria-hidden />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Следующий
                  <ChevronRight className="ml-1 size-4" aria-hidden />
                </Button>
              )}
            </div>
            <Button
              size="sm"
              variant={completed ? 'secondary' : 'default'}
              onClick={handleToggleComplete}
            >
              {completed ? (
                <>
                  <Check className="mr-1 size-4" aria-hidden />
                  Пройден · отменить
                </>
              ) : (
                'Отметить как пройденный'
              )}
            </Button>
          </div>
        </div>

        {/* Правая колонка — список уроков */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
            <div className="border-b border-border/50 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Программа курса
              </div>
              <h2 className="mt-1 truncate text-base font-semibold">{ctx.course.title}</h2>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {completedLessons} из {totalLessons} пройдено
                </span>
                <span className="font-medium text-primary">{percent}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${percent}%` }}
                  aria-hidden
                />
              </div>
            </div>
            <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto text-sm">
              {ctx.course.modules.map((m, mIdx) =>
                m.lessons.map((l, lIdx) => {
                  const active = l.id === ctx.lesson.id;
                  const isDone = completedLocal.has(l.id);
                  return (
                    <li key={l.id}>
                      <Link
                        href={`/learn/${ctx.course.slug}/${l.id}`}
                        className={cn(
                          'flex items-center gap-3 p-3 transition-colors',
                          active ? 'bg-primary/10 text-foreground' : 'hover:bg-secondary',
                        )}
                      >
                        <span className="shrink-0">
                          {isDone ? (
                            <Check className="size-4 text-primary" aria-hidden />
                          ) : active ? (
                            <Play className="size-4 text-primary" fill="currentColor" aria-hidden />
                          ) : (
                            <span className="inline-flex size-4 items-center justify-center text-xs text-muted-foreground">
                              ·
                            </span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{l.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {mIdx + 1}.{lIdx + 1} · {formatDuration(l.durationSec)}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                }),
              )}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
