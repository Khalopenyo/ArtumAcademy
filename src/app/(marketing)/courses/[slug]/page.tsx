'use client';

import { useMemo, useTransition } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, ChevronLeft, Lock, Play, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CourseCard } from '@/components/artum/CourseCard';
import { WishlistButton } from '@/components/artum/WishlistButton';
import {
  formatDuration,
  formatLessonsCount,
  formatPrice,
  formatStudentsCount,
  getCategory,
  getCourseLessonsCount,
  getCourseTotalDuration,
} from '@/lib/mock/courses';
import {
  getAllCoursesEffective,
  getCourseProgressFromStore,
  isCoursePurchased,
  isLessonComplete,
  useArtumStore,
} from '@/lib/store';
import type { Course } from '@/lib/mock/courses';
import { useCurrentUser, useHydrated } from '@/lib/store/hooks';
import { cn } from '@/lib/utils';

export default function CoursePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const state = useArtumStore();
  const buyCourse = useArtumStore((s) => s.buyCourse);
  const [pending, startTransition] = useTransition();

  const allCourses = useMemo(() => getAllCoursesEffective(state), [state]);
  const course = useMemo(
    () => allCourses.find((c) => c.slug === params.slug) ?? null,
    [allCourses, params.slug],
  );

  if (!hydrated) {
    return null; // SSR-pass: пусто на гидрейте
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        Курс не найден.{' '}
        <Link href="/" className="text-primary hover:underline">
          Вернуться в каталог
        </Link>
      </div>
    );
  }

  const category = getCategory(course.category);
  const lessonsCount = getCourseLessonsCount(course);
  const totalDuration = getCourseTotalDuration(course);

  const purchased = user ? isCoursePurchased(state, user.id, course.slug) : false;
  const progress = user
    ? getCourseProgressFromStore(state, user.id, course)
    : { percent: 0, completedLessons: 0, totalLessons: lessonsCount };

  // Сертификат выдан?
  const hasCertificate = user
    ? state.certificates.some(
        (c) => c.userId === user.id && c.courseSlug === course.slug,
      )
    : false;

  // Похожие курсы — другие из той же категории, до 3 штук
  const similar: Course[] = allCourses
    .filter((c) => c.slug !== course.slug && c.category === course.category)
    .slice(0, 3);

  // Find next not-completed lesson (для CTA «Продолжить»)
  function findNextLesson() {
    if (!user) return null;
    for (const m of course!.modules) {
      for (const l of m.lessons) {
        if (!isLessonComplete(state, user.id, l.id)) return l;
      }
    }
    return null;
  }
  const nextLesson = findNextLesson();

  // CTA logic
  let ctaLabel: string;
  let ctaHref: string | null = null;
  let ctaOnClick: (() => void) | null = null;

  if (!user) {
    ctaLabel = 'Войти и купить';
    ctaHref = `/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`;
  } else if (!purchased) {
    ctaLabel = pending ? 'Покупаем…' : 'Купить курс';
    ctaOnClick = () => {
      startTransition(() => {
        const res = buyCourse(course!.slug);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(`Курс «${course!.title}» куплен. Удачного обучения!`);
        // refresh routes
        router.refresh();
      });
    };
  } else if (nextLesson) {
    ctaLabel = progress.percent > 0 ? 'Продолжить' : 'Начать обучение';
    ctaHref = `/learn/${course.slug}/${nextLesson.id}`;
  } else {
    ctaLabel = 'Курс пройден';
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        К каталогу курсов
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Левая колонка — описание + уроки */}
        <div className="space-y-8 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-border">
            <div
              aria-hidden
              className={cn(
                'h-44 w-full bg-gradient-to-br opacity-90 sm:h-56',
                course.coverGradient,
              )}
            />
            <div className="space-y-4 bg-card p-6 sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
                    category.tagBgClass,
                    category.tagTextClass,
                  )}
                >
                  <span aria-hidden>{category.emoji}</span>
                  {category.label}
                </span>
                {!purchased ? (
                  <WishlistButton
                    courseSlug={course.slug}
                    courseTitle={course.title}
                    size="md"
                  />
                ) : null}
              </div>
              <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                {course.title}
              </h1>
              <p className="text-base text-muted-foreground">{course.longDescription}</p>

              <div className="flex flex-wrap items-center gap-4 pt-2 text-sm text-muted-foreground">
                <span>{formatLessonsCount(lessonsCount)}</span>
                <span aria-hidden>·</span>
                <span>{formatDuration(totalDuration)}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-4" aria-hidden />
                  {formatStudentsCount(course.studentsCount)}
                </span>
              </div>
            </div>
          </div>

          {/* Программа */}
          <section aria-labelledby="programme-heading" className="space-y-4">
            <div className="flex items-end justify-between">
              <h2 id="programme-heading" className="text-xl font-semibold sm:text-2xl">
                Программа
              </h2>
              {purchased && progress.percent > 0 ? (
                <span className="text-sm text-muted-foreground">
                  Прошли {progress.completedLessons} из {progress.totalLessons} уроков
                </span>
              ) : null}
            </div>

            <div className="space-y-3">
              {course.modules.map((module, moduleIdx) => (
                <div
                  key={module.id}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <div className="border-b border-border bg-card/50 p-4 sm:p-5">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Модуль {moduleIdx + 1}
                    </div>
                    <h3 className="mt-1 text-base font-semibold sm:text-lg">{module.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                  </div>
                  <ul className="divide-y divide-border">
                    {module.lessons.map((lesson, lessonIdx) => {
                      const canOpen = purchased || lesson.preview;
                      const completed = user
                        ? isLessonComplete(state, user.id, lesson.id)
                        : false;
                      const lessonNumber = `${moduleIdx + 1}.${lessonIdx + 1}`;
                      const rowClasses = cn(
                        'flex items-center gap-4 p-4 transition-colors',
                        canOpen ? 'hover:bg-secondary' : 'cursor-not-allowed opacity-60',
                      );
                      const Inner = (
                        <>
                          <span className="shrink-0">
                            {completed ? (
                              <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/20 text-primary">
                                <Check className="size-4" aria-hidden />
                              </span>
                            ) : canOpen ? (
                              <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                                <Play className="size-3.5" aria-hidden fill="currentColor" />
                              </span>
                            ) : (
                              <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                                <Lock className="size-3.5" aria-hidden />
                              </span>
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-mono text-xs text-muted-foreground">
                                {lessonNumber}
                              </span>
                              <span className="truncate font-medium text-foreground">
                                {lesson.title}
                              </span>
                              {lesson.preview && !purchased ? (
                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                                  Превью
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDuration(lesson.durationSec)}
                          </span>
                        </>
                      );
                      return (
                        <li key={lesson.id}>
                          {canOpen ? (
                            <Link
                              href={`/learn/${course.slug}/${lesson.id}`}
                              className={rowClasses}
                            >
                              {Inner}
                            </Link>
                          ) : (
                            <div className={rowClasses} aria-disabled="true">
                              {Inner}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Похожие курсы */}
          {similar.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-end justify-between">
                <h2 className="text-xl font-semibold sm:text-2xl">Похожие курсы</h2>
                <span className="text-sm text-muted-foreground">
                  По категории «{category.label}»
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {similar.map((s) => {
                  const sPurchased = user
                    ? isCoursePurchased(state, user.id, s.slug)
                    : false;
                  const sProgress = user
                    ? getCourseProgressFromStore(state, user.id, s)
                    : null;
                  return (
                    <CourseCard
                      key={s.id}
                      course={s}
                      purchased={sPurchased}
                      progressPercent={sProgress?.percent ?? 0}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        {/* Правая колонка — sticky CTA card */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {purchased ? 'Доступ' : 'Стоимость'}
              </div>
              <div className="text-3xl font-bold">
                {purchased ? 'Бессрочный' : formatPrice(course.priceMinor)}
              </div>
              {!purchased ? (
                <p className="text-xs text-muted-foreground">
                  Разовая оплата · доступ навсегда
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Доступ ко всем урокам открыт</p>
              )}
            </div>

            {purchased && progress.percent > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Прогресс</span>
                  <span className="font-medium text-primary">{progress.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress.percent}%` }}
                    aria-hidden
                  />
                </div>
              </div>
            ) : null}

            {ctaHref ? (
              <Button asChild size="lg" className="w-full">
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
            ) : ctaOnClick ? (
              <Button size="lg" className="w-full" onClick={ctaOnClick} disabled={pending}>
                {ctaLabel}
              </Button>
            ) : (
              <Button size="lg" className="w-full" disabled>
                {ctaLabel}
              </Button>
            )}

            {!purchased ? (
              <Link
                href="/subscribe"
                className="block rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 text-center text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
              >
                Или оформите подписку — доступ ко всем курсам от <span className="font-semibold text-foreground">990 ₽/мес</span>
              </Link>
            ) : null}

            {/* Course meta summary */}
            <div className="space-y-2 border-t border-border pt-4 text-sm">
              <Meta label="Уроков" value={formatLessonsCount(lessonsCount)} />
              <Meta label="Длительность" value={formatDuration(totalDuration)} />
              <Meta label="Студентов" value={formatStudentsCount(course.studentsCount)} />
              <Meta label="Категория" value={category.label} />
              <Meta
                label="Сертификат"
                value={hasCertificate ? 'Получен' : 'После 100% прохождения'}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
