import Link from 'next/link';
import { ArrowRight, Clock, Play, Users, Video } from 'lucide-react';

import { CategoryIcon } from '@/components/artum/CategoryIcon';
import { CourseCover } from '@/components/artum/CourseCover';
import { WishlistButton } from '@/components/artum/WishlistButton';
import {
  type CategoryId,
  type Course,
  formatDuration,
  formatLessonsCount,
  formatStudentsCount,
  getCategory,
  getCourseLessonsCount,
  getCourseTotalDuration,
} from '@/lib/mock/courses';
import { cn } from '@/lib/utils';

/** Mini-теги для card-bottom — по 2 ключевых слова на каждую категорию */
const CATEGORY_MINI_TAGS: Record<CategoryId, [string, string]> = {
  ai: ['Промптинг', 'Нейросети'],
  photo: ['Композиция', 'Lightroom'],
  video: ['Reels', 'Сценарий'],
  editing: ['Premiere', 'Цветокор'],
  design: ['Figma', 'UI/UX'],
  visual: ['Брендинг', 'SMM'],
  copy: ['Тексты', 'AI'],
};

interface CourseCardProps {
  course: Course;
  /** Куплен ли курс текущим пользователем (передаётся снаружи) */
  purchased?: boolean;
  /** Прогресс прохождения 0-100 */
  progressPercent?: number;
  /** В избранном? Server-fetched. */
  inWishlist?: boolean;
  /** Не залогинен — wishlist click редиректит на /login */
  isGuest?: boolean;
  className?: string;
}

/**
 * Карточка курса по дизайну artum_academy_homepage_cosmic.
 * Серверная (без 'use client'), статусы передаются props.
 */
export function CourseCard({
  course,
  purchased = false,
  progressPercent = 0,
  inWishlist = false,
  isGuest = false,
  className,
}: CourseCardProps) {
  const category = getCategory(course.category);
  const lessonsCount = getCourseLessonsCount(course);
  const totalDuration = getCourseTotalDuration(course);
  const isStarted = progressPercent > 0;
  const isNew = !purchased && !isStarted;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className={cn(
        'group relative block overflow-hidden rounded-2xl border border-border/70 bg-card/70 backdrop-blur transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-primary/50',
        className,
      )}
      aria-label={`Открыть курс «${course.title}»`}
    >
      {/* Thumbnail */}
      <div className="relative h-32 overflow-hidden sm:h-36">
        <CourseCover coverUrl={course.coverUrl} gradient={course.coverGradient} />
        {/* Тёмный градиент снизу для читаемости тегов */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40"
        />

        {/* Category tag — слева сверху */}
        <span
          className={cn(
            'absolute left-3 top-3 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur',
            category.tagBgClass,
            category.tagTextClass,
            'border-white/10',
          )}
        >
          <CategoryIcon categoryId={course.category} className="size-3" />
          {category.label}
        </span>

        {/* Покупка/wishlist — справа сверху */}
        {purchased ? (
          <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-primary/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground backdrop-blur">
            Куплено
          </span>
        ) : (
          <div className="absolute right-3 top-3">
            <WishlistButton
              courseSlug={course.slug}
              courseTitle={course.title}
              initialInList={inWishlist}
              isGuest={isGuest}
              stopParentLink
            />
          </div>
        )}

        {/* Play button — центр */}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 inline-flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary/85 ring-1 ring-white/15 backdrop-blur transition-transform duration-200 group-hover:scale-110"
        >
          <Play className="size-4 text-white" fill="currentColor" />
        </span>
      </div>

      {/* Body */}
      <div className="space-y-3 p-4 sm:p-5">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary sm:text-base">
            {course.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {course.shortDescription}
          </p>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Video className="size-3" aria-hidden />
            {formatLessonsCount(lessonsCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden />
            {formatDuration(totalDuration)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" aria-hidden />
            {formatStudentsCount(course.studentsCount)}
          </span>
        </div>

        {/* Progress bar — всегда виден */}
        <div className="flex items-center gap-2.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-border/60">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isStarted
                  ? 'bg-gradient-to-r from-primary to-primary-light'
                  : 'bg-transparent',
              )}
              style={{ width: `${progressPercent}%` }}
              aria-hidden
            />
          </div>
          <span
            className={cn(
              'min-w-[36px] text-right text-[11px] font-semibold',
              isStarted ? 'text-primary-light' : 'text-muted-foreground/70',
            )}
          >
            {isNew ? 'Новый' : `${progressPercent}%`}
          </span>
        </div>

        {/* Card-bottom: мини-теги + arrow */}
        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <div className="flex gap-1.5">
            {CATEGORY_MINI_TAGS[course.category].map((tag) => (
              <span
                key={tag}
                className="rounded bg-secondary/60 px-2 py-0.5 text-[9px] text-muted-foreground/80"
              >
                {tag}
              </span>
            ))}
          </div>
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary transition-colors group-hover:bg-primary/30">
            <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
