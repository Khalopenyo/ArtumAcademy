import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, ChevronLeft, Lock, Play, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  COURSES,
  formatDuration,
  formatLessonsCount,
  formatPrice,
  formatStudentsCount,
  getCategory,
  getCourseBySlug,
  getCourseLessonsCount,
  getCourseProgress,
  getCourseTotalDuration,
  getNextLesson,
} from '@/lib/mock/courses';
import { cn } from '@/lib/utils';

interface CoursePageProps {
  params: { slug: string };
}

/** Pre-render все курсы (mock — статика, нет проблем с SSG) */
export function generateStaticParams() {
  return COURSES.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: CoursePageProps) {
  const course = getCourseBySlug(params.slug);
  if (!course) return { title: 'Курс не найден' };
  return {
    title: course.title,
    description: course.shortDescription,
  };
}

/**
 * Страница курса (ТЗ §4.3):
 *   - Обложка с описанием
 *   - Список уроков с номерами, длительностью, галочками пройденного
 *   - Общий прогресс
 *   - Кнопка «Начать» / «Продолжить» / «Купить»
 */
export default function CoursePage({ params }: CoursePageProps) {
  const course = getCourseBySlug(params.slug);
  if (!course) {
    notFound();
  }

  const category = getCategory(course.category);
  const progress = getCourseProgress(course);
  const lessonsCount = getCourseLessonsCount(course);
  const totalDuration = getCourseTotalDuration(course);
  const next = getNextLesson(course);

  // CTA logic
  let ctaLabel = 'Купить курс';
  let ctaHref: string | null = null;
  if (course.purchased) {
    if (next) {
      ctaLabel = progress.percent > 0 ? 'Продолжить' : 'Начать обучение';
      ctaHref = `/learn/${course.slug}/${next.lesson.id}`;
    } else {
      ctaLabel = 'Курс завершён';
      ctaHref = null;
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      {/* Breadcrumb */}
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
          {/* Header card with gradient cover */}
          <div className="overflow-hidden rounded-2xl border border-border">
            <div
              aria-hidden
              className={cn(
                'h-44 w-full bg-gradient-to-br opacity-90 sm:h-56',
                course.coverGradient,
              )}
            />
            <div className="space-y-4 bg-card p-6 sm:p-8">
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

          {/* Программа курса */}
          <section aria-labelledby="programme-heading" className="space-y-4">
            <div className="flex items-end justify-between">
              <h2 id="programme-heading" className="text-xl font-semibold sm:text-2xl">
                Программа
              </h2>
              {course.purchased && progress.percent > 0 ? (
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
                      const canOpen = course.purchased || lesson.preview;
                      const lessonNumber = `${moduleIdx + 1}.${lessonIdx + 1}`;
                      return (
                        <li key={lesson.id}>
                          <Link
                            href={canOpen ? `/learn/${course.slug}/${lesson.id}` : '#'}
                            aria-disabled={!canOpen}
                            onClick={(e) => !canOpen && e.preventDefault()}
                            className={cn(
                              'flex items-center gap-4 p-4 transition-colors',
                              canOpen
                                ? 'hover:bg-secondary'
                                : 'cursor-not-allowed opacity-60',
                            )}
                          >
                            {/* Status indicator */}
                            <span className="shrink-0">
                              {lesson.completed ? (
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
                            {/* Title + number */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {lessonNumber}
                                </span>
                                <span className="truncate font-medium text-foreground">
                                  {lesson.title}
                                </span>
                                {lesson.preview && !course.purchased ? (
                                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                                    Превью
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatDuration(lesson.durationSec)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Правая колонка — sticky CTA card */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-4 rounded-2xl border border-border bg-card p-6">
            {/* Price */}
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {course.purchased ? 'Доступ' : 'Стоимость'}
              </div>
              <div className="text-3xl font-bold">
                {course.purchased ? 'Бессрочный' : formatPrice(course.priceMinor)}
              </div>
              {!course.purchased ? (
                <p className="text-xs text-muted-foreground">
                  Разовая оплата · доступ навсегда
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Куплен {new Date(course.purchasedAt ?? '').toLocaleDateString('ru-RU')}
                </p>
              )}
            </div>

            {/* Progress bar */}
            {course.purchased && progress.percent > 0 ? (
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

            {/* CTA */}
            {ctaHref ? (
              <Button asChild size="lg" className="w-full">
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
            ) : (
              <Button size="lg" className="w-full" disabled>
                {ctaLabel}
              </Button>
            )}

            {/* Course meta summary */}
            <div className="space-y-2 border-t border-border pt-4 text-sm">
              <Meta label="Уроков" value={formatLessonsCount(lessonsCount)} />
              <Meta label="Длительность" value={formatDuration(totalDuration)} />
              <Meta label="Студентов" value={formatStudentsCount(course.studentsCount)} />
              <Meta label="Категория" value={category.label} />
              <Meta
                label="Сертификат"
                value={course.certificateIssued ? 'Получен' : 'После 100% прохождения'}
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
