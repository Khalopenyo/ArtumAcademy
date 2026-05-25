'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  Settings,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  type Course,
  type Lesson,
  type Module,
  formatDuration,
  getCategory,
} from '@/lib/mock/courses';
import {
  getAllCoursesEffective,
  getCourseProgressFromStore,
  isCoursePurchased,
  isLessonComplete,
  useArtumStore,
} from '@/lib/store';
import { useCurrentUser, useHydrated } from '@/lib/store/hooks';
import { cn } from '@/lib/utils';

interface LessonContext {
  course: Course;
  module: Module;
  lesson: Lesson;
  absoluteIndex: number;
  total: number;
  prev: { courseSlug: string; lessonId: string } | null;
  next: { courseSlug: string; lessonId: string } | null;
}

function findLessonContext(
  courses: Course[],
  courseSlug: string,
  lessonId: string,
): LessonContext | null {
  const course = courses.find((c) => c.slug === courseSlug);
  if (!course) return null;

  const flat: Array<{ module: Module; lesson: Lesson }> = [];
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      flat.push({ module: mod, lesson });
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
    prev: prevFlat ? { courseSlug, lessonId: prevFlat.lesson.id } : null,
    next: nextFlat ? { courseSlug, lessonId: nextFlat.lesson.id } : null,
  };
}

export default function LessonPage() {
  const params = useParams<{ courseSlug: string; lessonId: string }>();
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const state = useArtumStore();
  const markLessonComplete = useArtumStore((s) => s.markLessonComplete);
  const unmarkLesson = useArtumStore((s) => s.unmarkLesson);

  const courses = useMemo(() => getAllCoursesEffective(state), [state]);
  const ctx = useMemo(
    () => findLessonContext(courses, params.courseSlug, params.lessonId),
    [courses, params],
  );

  if (!hydrated || !user) {
    return <LoadingSplash />;
  }

  if (!ctx) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        Урок не найден.{' '}
        <Link href="/" className="text-primary hover:underline">
          Вернуться в каталог
        </Link>
      </div>
    );
  }

  const purchased = isCoursePurchased(state, user.id, ctx.course.slug);
  const lessonAccess = purchased || ctx.lesson.preview;
  const completed = isLessonComplete(state, user.id, ctx.lesson.id);
  const category = getCategory(ctx.course.category);
  const progress = getCourseProgressFromStore(state, user.id, ctx.course);

  function handleToggleComplete() {
    if (completed) {
      unmarkLesson(ctx!.lesson.id);
      toast.info('Отметка пройденного снята');
      return;
    }
    markLessonComplete(ctx!.lesson.id);
    // Если последний урок и сертификат выдан — toast
    const after = useArtumStore.getState();
    const newCertCount = after.certificates.filter(
      (c) => c.userId === user!.id && c.courseSlug === ctx!.course.slug,
    ).length;
    if (newCertCount > 0) {
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

  if (!lessonAccess) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Доступ закрыт</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Этот урок доступен после покупки курса. Откройте страницу курса
            и нажмите «Купить курс», чтобы получить доступ ко всем урокам.
          </p>
          <Button asChild className="mt-6">
            <Link href={`/courses/${ctx.course.slug}`}>К курсу</Link>
          </Button>
        </div>
      </div>
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
          {/* Видеоплеер placeholder */}
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
            <div
              aria-hidden
              className={cn(
                'absolute inset-0 bg-gradient-to-br opacity-60',
                ctx.course.coverGradient,
              )}
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
                Видеоплеер появится на стадии с реальной БД
              </p>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
              <div className="flex items-center gap-3 text-white">
                <button type="button" aria-label="Play / Pause" className="hover:opacity-80">
                  <Play className="size-5" fill="currentColor" />
                </button>
                <span className="text-xs tabular-nums">
                  00:00 / {formatDuration(ctx.lesson.durationSec)}
                </span>
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

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
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
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Программа курса
              </div>
              <h2 className="mt-1 truncate text-base font-semibold">{ctx.course.title}</h2>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {progress.completedLessons} из {progress.totalLessons} пройдено
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
              {ctx.course.modules.map((m, mIdx) =>
                m.lessons.map((l, lIdx) => {
                  const active = l.id === ctx.lesson.id;
                  const isDone = isLessonComplete(state, user!.id, l.id);
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

function LoadingSplash() {
  return (
    <div className="container mx-auto flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
    </div>
  );
}
