import Link from 'next/link';
import { Play, Users } from 'lucide-react';

import {
  type Course,
  formatDuration,
  formatLessonsCount,
  formatStudentsCount,
  getCategory,
  getCourseLessonsCount,
  getCourseTotalDuration,
} from '@/lib/mock/courses';
import { cn } from '@/lib/utils';

interface CourseCardProps {
  course: Course;
  /** Куплен ли курс текущим пользователем (передаётся снаружи) */
  purchased?: boolean;
  /** Прогресс прохождения 0-100 (только если куплен) */
  progressPercent?: number;
  className?: string;
}

/**
 * Карточка курса (ТЗ §4.2).
 * Server-friendly: статусы передаются props.
 */
export function CourseCard({
  course,
  purchased = false,
  progressPercent = 0,
  className,
}: CourseCardProps) {
  const category = getCategory(course.category);
  const lessonsCount = getCourseLessonsCount(course);
  const totalDuration = getCourseTotalDuration(course);

  return (
    <Link
      href={`/courses/${course.slug}`}
      className={cn(
        'group block overflow-hidden rounded-2xl border border-border bg-card course-card-hover',
        className,
      )}
      aria-label={`Открыть курс «${course.title}»`}
    >
      <div className="relative aspect-video overflow-hidden">
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 bg-gradient-to-br opacity-90',
            course.coverGradient,
          )}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            aria-hidden
            className="flex size-14 items-center justify-center rounded-full bg-black/40 backdrop-blur transition-transform group-hover:scale-110"
          >
            <Play className="size-6 text-white" fill="currentColor" />
          </span>
        </div>
        <span
          className={cn(
            'absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium backdrop-blur',
            category.tagBgClass,
            category.tagTextClass,
          )}
        >
          <span aria-hidden>{category.emoji}</span>
          <span>{category.label}</span>
        </span>
        {purchased ? (
          <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-primary/90 px-2.5 py-1 text-xs font-medium text-primary-foreground backdrop-blur">
            Куплено
          </span>
        ) : null}
      </div>

      <div className="space-y-3 p-5">
        <h3 className="line-clamp-2 text-base font-semibold text-foreground transition-colors group-hover:text-primary">
          {course.title}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {course.shortDescription}
        </p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{formatLessonsCount(lessonsCount)}</span>
          <span aria-hidden>·</span>
          <span>{formatDuration(totalDuration)}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" aria-hidden />
            {formatStudentsCount(course.studentsCount)}
          </span>
        </div>

        {purchased && progressPercent > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Прогресс</span>
              <span className="font-medium text-primary">{progressPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
                aria-hidden
              />
            </div>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
