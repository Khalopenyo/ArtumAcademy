import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Play, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  type Course,
  type Lesson,
  type Module,
  formatDuration,
  getCategory,
  getCourseBySlug,
  getCourseLessonsCount,
  getCourseProgress,
} from '@/lib/mock/courses';
import { cn } from '@/lib/utils';

interface LessonPageProps {
  params: { courseSlug: string; lessonId: string };
}

interface LessonContext {
  course: Course;
  module: Module;
  lesson: Lesson;
  absoluteIndex: number;
  total: number;
  prev: { slug: string; courseSlug: string } | null;
  next: { slug: string; courseSlug: string } | null;
}

function findLessonContext(
  courseSlug: string,
  lessonId: string,
): LessonContext | null {
  const course = getCourseBySlug(courseSlug);
  if (!course) return null;

  const flat: Array<{ module: Module; lesson: Lesson }> = [];
  for (const module of course.modules) {
    for (const lesson of module.lessons) {
      flat.push({ module, lesson });
    }
  }
  const total = flat.length;
  const idx = flat.findIndex((x) => x.lesson.id === lessonId);
  if (idx === -1) return null;

  const { module, lesson } = flat[idx]!;
  const prevFlat = idx > 0 ? flat[idx - 1] : null;
  const nextFlat = idx < total - 1 ? flat[idx + 1] : null;

  return {
    course,
    module,
    lesson,
    absoluteIndex: idx,
    total,
    prev: prevFlat ? { slug: prevFlat.lesson.id, courseSlug } : null,
    next: nextFlat ? { slug: nextFlat.lesson.id, courseSlug } : null,
  };
}

export function generateMetadata({ params }: LessonPageProps) {
  const ctx = findLessonContext(params.courseSlug, params.lessonId);
  if (!ctx) return { title: 'Урок не найден' };
  return {
    title: `${ctx.lesson.title} · ${ctx.course.title}`,
  };
}

/**
 * Страница урока (ТЗ §4.4):
 *   - Видеоплеер (placeholder + плейсхолдер controls)
 *   - Название урока и номер в курсе
 *   - Кнопки «Предыдущий» / «Следующий урок»
 *   - Кнопка «Отметить как пройденный»
 */
export default function LessonPage({ params }: LessonPageProps) {
  const ctx = findLessonContext(params.courseSlug, params.lessonId);
  if (!ctx) notFound();

  const { course, module, lesson, absoluteIndex, total, prev, next } = ctx;
  const category = getCategory(course.category);
  const progress = getCourseProgress(course);
  const lessonsCount = getCourseLessonsCount(course);

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      {/* Breadcrumb */}
      <Link
        href={`/courses/${course.slug}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        К курсу «{course.title}»
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Левая колонка — видео + контролы */}
        <div className="space-y-4 lg:col-span-2">
          {/* Видеоплеер placeholder */}
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
            <div
              aria-hidden
              className={cn('absolute inset-0 bg-gradient-to-br opacity-60', course.coverGradient)}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <button
                type="button"
                aria-label="Воспроизвести"
                className="flex size-20 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-transform hover:scale-110"
              >
                <Play className="size-10 text-white" fill="currentColor" />
              </button>
              <p className="text-sm text-white/70">
                Видеоплеер появится на этапе 3 ТЗ §9
              </p>
            </div>
            {/* Player controls placeholder */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
              <div className="flex items-center gap-3 text-white">
                <button type="button" aria-label="Play / Pause" className="hover:opacity-80">
                  <Play className="size-5" fill="currentColor" />
                </button>
                <span className="text-xs tabular-nums">00:00 / {formatDuration(lesson.durationSec)}</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <button type="button" className="text-xs hover:text-white">1x</button>
                <button type="button" className="text-xs hover:text-white">HD</button>
                <button type="button" aria-label="Настройки" className="hover:text-white">
                  <Settings className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          </div>

          {/* Заголовок урока + meta */}
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
                Урок {absoluteIndex + 1} из {total}
              </span>
              <span>·</span>
              <span>{formatDuration(lesson.durationSec)}</span>
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              {lesson.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Модуль {module.title}
            </p>
          </div>

          {/* Действия */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              {prev ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/learn/${prev.courseSlug}/${prev.slug}`}>
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
              {next ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/learn/${next.courseSlug}/${next.slug}`}>
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
              variant={lesson.completed ? 'secondary' : 'default'}
              disabled={lesson.completed}
              className={lesson.completed ? 'cursor-default' : ''}
            >
              {lesson.completed ? (
                <>
                  <Check className="mr-1 size-4" aria-hidden />
                  Пройден
                </>
              ) : (
                'Отметить как пройденный'
              )}
            </Button>
          </div>
        </div>

        {/* Правая колонка — список уроков в курсе */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Программа курса
              </div>
              <h2 className="mt-1 truncate text-base font-semibold">{course.title}</h2>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {progress.completedLessons} из {lessonsCount} пройдено
                </span>
                <span className="font-medium text-primary">{progress.percent}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress.percent}%` }}
                  aria-hidden
                />
              </div>
            </div>
            <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto text-sm">
              {course.modules.map((m, mIdx) =>
                m.lessons.map((l, lIdx) => {
                  const active = l.id === lesson.id;
                  return (
                    <li key={l.id}>
                      <Link
                        href={`/learn/${course.slug}/${l.id}`}
                        className={cn(
                          'flex items-center gap-3 p-3 transition-colors',
                          active ? 'bg-primary/10 text-foreground' : 'hover:bg-secondary',
                        )}
                      >
                        <span className="shrink-0">
                          {l.completed ? (
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
