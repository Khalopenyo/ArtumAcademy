'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RefreshCw, Search, X } from 'lucide-react';

import { CategoryPill } from '@/components/artum/CategoryPill';
import { CourseCard } from '@/components/artum/CourseCard';
import { Hero } from '@/components/artum/Hero';
import { UserStatsBlock } from '@/components/artum/UserStatsBlock';
import { Input } from '@/components/ui/input';
import {
  type CategoryId,
  CATEGORIES,
} from '@/lib/mock/courses';
import type { Course } from '@/lib/mock/courses';

const VALID_CATEGORY_IDS = new Set([...CATEGORIES.map((c) => c.id), 'all'] as const);
/** На сколько карточек инкрементируем «Загрузить ещё» (макет showcase'ит пагинацию) */
const PAGE_SIZE = 6;

function parseCategoryParam(raw: string | undefined | null): CategoryId | 'all' {
  if (raw && VALID_CATEGORY_IDS.has(raw as never)) {
    return raw as CategoryId | 'all';
  }
  return 'all';
}

interface DashboardClientProps {
  courses: Course[];
  userFirstName: string | null;
  purchasedSlugs: string[];
  wishlistSlugs: string[];
  completedLessonIds: string[];
  certificatesCount: number;
  hasActiveSubscription: boolean;
}

export default function DashboardClient(props: DashboardClientProps) {
  return (
    <Suspense fallback={null}>
      <DashboardInner {...props} />
    </Suspense>
  );
}

function DashboardInner({
  courses,
  userFirstName,
  purchasedSlugs,
  wishlistSlugs,
  completedLessonIds,
  certificatesCount,
  hasActiveSubscription,
}: DashboardClientProps) {
  const searchParams = useSearchParams();
  const [activeCategory, setActiveCategory] = useState(
    parseCategoryParam(searchParams.get('category')),
  );
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const purchasedSet = useMemo(() => new Set(purchasedSlugs), [purchasedSlugs]);
  const completedSet = useMemo(() => new Set(completedLessonIds), [completedLessonIds]);
  const wishlistSet = useMemo(() => new Set(wishlistSlugs), [wishlistSlugs]);
  const isGuest = !userFirstName;

  const hasAccess = (slug: string) => hasActiveSubscription || purchasedSet.has(slug);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCourses = useMemo(() => {
    const byCategory =
      activeCategory === 'all'
        ? courses
        : courses.filter((c) => c.category === activeCategory);
    if (!normalizedQuery) return byCategory;
    return byCategory.filter(
      (c) =>
        c.title.toLowerCase().includes(normalizedQuery) ||
        c.shortDescription.toLowerCase().includes(normalizedQuery) ||
        c.longDescription.toLowerCase().includes(normalizedQuery),
    );
  }, [courses, activeCategory, normalizedQuery]);

  const visibleCourses = filteredCourses.slice(0, visibleCount);
  const hasMore = filteredCourses.length > visibleCount;

  // Синхронизируем URL без навигации/перезапроса страницы — фильтр мгновенный,
  // а ссылка остаётся шарящейся (на свежей загрузке стейт берётся из searchParams).
  function syncUrl(category: CategoryId | 'all', q: string) {
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (q.trim()) params.set('q', q.trim());
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `/?${qs}` : '/');
  }

  function selectCategory(cat: CategoryId | 'all') {
    setActiveCategory(cat);
    setVisibleCount(PAGE_SIZE);
    syncUrl(cat, query);
  }

  function applyQuery(next: string) {
    setQuery(next);
    setVisibleCount(PAGE_SIZE); // сбрасываем пагинацию при новом поиске
    syncUrl(activeCategory, next);
  }

  function courseProgressPercent(course: Course): number {
    const lessons = course.modules.flatMap((m) => m.lessons);
    if (lessons.length === 0) return 0;
    const done = lessons.filter((l) => completedSet.has(l.id)).length;
    return Math.round((done / lessons.length) * 100);
  }

  const stats = useMemo(() => {
    if (!userFirstName) {
      return { activeCourses: 0, certificates: 0, studyHoursTotal: 0, overallProgressPercent: 0 };
    }
    const accessibleCourses = courses.filter((c) => hasAccess(c.slug));
    const active = accessibleCourses.filter((c) => {
      const p = courseProgressPercent(c);
      return p > 0 && p < 100;
    }).length;
    const studySeconds = accessibleCourses.reduce((sum, c) => {
      const p = courseProgressPercent(c);
      const totalDur = c.modules.flatMap((m) => m.lessons).reduce((s, l) => s + l.durationSec, 0);
      return sum + totalDur * (p / 100);
    }, 0);
    const overall =
      accessibleCourses.length === 0
        ? 0
        : Math.round(
            accessibleCourses.reduce((sum, c) => sum + courseProgressPercent(c), 0) /
              accessibleCourses.length,
          );
    return {
      activeCourses: active,
      certificates: certificatesCount,
      studyHoursTotal: Math.round(studySeconds / 3600),
      overallProgressPercent: overall,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFirstName, courses, purchasedSet, completedSet, certificatesCount, hasActiveSubscription]);

  return (
    <div className="container mx-auto px-4 py-8 sm:px-9 sm:py-10">
      {/* Hero */}
      <Hero userFirstName={userFirstName} />

      {/* Фильтры */}
      <section id="catalog" className="mb-5 mt-7 scroll-mt-20">
        <nav aria-label="Категории курсов" className="flex flex-wrap gap-2">
          <CategoryPill
            categoryId="all"
            label="Все курсы"
            active={activeCategory === 'all'}
            onSelect={selectCategory}
          />
          {CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat.id}
              categoryId={cat.id}
              label={cat.label}
              emoji={cat.emoji}
              active={activeCategory === cat.id}
              onSelect={selectCategory}
            />
          ))}
        </nav>
      </section>

      {/* Поиск (компактный, не в макете, но нужен для UX) */}
      <section className="mb-5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Поиск по названию или описанию"
            value={query}
            onChange={(e) => applyQuery(e.target.value)}
            className="h-10 border-border/60 bg-card/60 pl-9 pr-9 backdrop-blur"
          />
          {query ? (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => applyQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </section>

      {/* Сетка курсов — 2 колонки как в макете */}
      <section>
        {filteredCourses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground backdrop-blur">
            {normalizedQuery
              ? `По запросу «${query}» ничего не найдено. Попробуйте другие слова.`
              : 'В этой категории пока нет курсов. Загляните позже.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visibleCourses.map((course) => {
              const purchased = hasAccess(course.slug);
              const progress = purchased ? courseProgressPercent(course) : 0;
              return (
                <CourseCard
                  key={course.id}
                  course={course}
                  purchased={purchased}
                  progressPercent={progress}
                  inWishlist={wishlistSet.has(course.slug)}
                  isGuest={isGuest}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Загрузить ещё */}
      {hasMore ? (
        <div className="mt-7 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-transparent px-8 py-2.5 text-[13px] text-[#C4A8FF] transition-all hover:border-primary hover:bg-primary/10 hover:text-white"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Загрузить ещё
          </button>
        </div>
      ) : null}

      {/* Stats — только для залогиненных, внизу как в макете */}
      {userFirstName ? (
        <section className="mt-8">
          <UserStatsBlock stats={stats} />
        </section>
      ) : null}
    </div>
  );
}
