'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Play, RefreshCw, Search, X } from 'lucide-react';

import { CategoryPill } from '@/components/artum/CategoryPill';
import { CourseCard } from '@/components/artum/CourseCard';
import { Hero } from '@/components/artum/Hero';
import { UserStatsBlock } from '@/components/artum/UserStatsBlock';
import { Button } from '@/components/ui/button';
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

type SortKey = 'default' | 'popular' | 'cheap' | 'expensive';

/** Русское склонение слова «курс» по числу. */
function coursesWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'курс';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'курса';
  return 'курсов';
}

interface DashboardClientProps {
  courses: Course[];
  userFirstName: string | null;
  purchasedSlugs: string[];
  wishlistSlugs: string[];
  completedLessonIds: string[];
  certificatesCount: number;
  subscribedSlugs: string[];
}

export function DashboardClient(props: DashboardClientProps) {
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
  subscribedSlugs,
}: DashboardClientProps) {
  const searchParams = useSearchParams();
  const [activeCategory, setActiveCategory] = useState(
    parseCategoryParam(searchParams.get('category')),
  );
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<SortKey>('default');

  const purchasedSet = useMemo(() => new Set(purchasedSlugs), [purchasedSlugs]);
  const subscribedSet = useMemo(() => new Set(subscribedSlugs), [subscribedSlugs]);
  const completedSet = useMemo(() => new Set(completedLessonIds), [completedLessonIds]);
  const wishlistSet = useMemo(() => new Set(wishlistSlugs), [wishlistSlugs]);
  const isGuest = !userFirstName;

  const hasAccess = (slug: string) => subscribedSet.has(slug) || purchasedSet.has(slug);

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

  const sortedCourses = useMemo(() => {
    const arr = [...filteredCourses];
    if (sort === 'popular') arr.sort((a, b) => b.studentsCount - a.studentsCount);
    else if (sort === 'cheap') arr.sort((a, b) => a.priceMinor - b.priceMinor);
    else if (sort === 'expensive') arr.sort((a, b) => b.priceMinor - a.priceMinor);
    return arr;
  }, [filteredCourses, sort]);

  const visibleCourses = sortedCourses.slice(0, visibleCount);
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
  }, [userFirstName, courses, purchasedSet, subscribedSet, completedSet, certificatesCount]);

  // «Продолжить» (вариант B, мобайл): доступные курсы в процессе прохождения.
  const continueCourses = userFirstName
    ? courses
        .filter((c) => hasAccess(c.slug))
        .map((c) => ({ course: c, progress: courseProgressPercent(c) }))
        .filter((x) => x.progress > 0 && x.progress < 100)
        .slice(0, 8)
    : [];

  return (
    <div className="container mx-auto px-4 py-8 sm:px-9 sm:py-10">
      {/* Hero: гость — большой везде; залогинен — большой на десктопе,
          компактное приветствие с «продолжить» на мобайле (вариант B) */}
      {userFirstName ? (
        <>
          <div className="hidden md:block">
            <Hero userFirstName={userFirstName} />
          </div>
          <div className="mb-5 md:hidden">
            <div className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-[#1E1235] via-[#2D1B52] to-[#15101F] p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary-light">
                ✦ Привет, {userFirstName}
              </div>
              <h2 className="mt-2 text-lg font-semibold leading-tight">
                {continueCourses.length > 0 ? 'Продолжим обучение?' : 'С чего начнём сегодня?'}
              </h2>
              {continueCourses.length > 0 ? (
                <div className="mt-3.5 flex flex-col gap-2.5">
                  {continueCourses.slice(0, 3).map(({ course, progress }) => (
                    <Link
                      key={course.id}
                      href={`/courses/${course.slug}`}
                      className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-2.5 transition-colors hover:border-primary/50"
                    >
                      <span
                        aria-hidden
                        className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/50 to-[#2D1B52] text-white/90"
                      >
                        <Play className="size-4" fill="currentColor" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 text-sm font-semibold">{course.title}</div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-border/60">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light"
                              style={{ width: `${progress}%` }}
                              aria-hidden
                            />
                          </div>
                          <span className="text-xs font-semibold text-primary-light">{progress}%</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-primary-light/80">
                  Выберите курс ниже — и начнём 👇
                </p>
              )}
            </div>
          </div>
        </>
      ) : (
        <Hero userFirstName={userFirstName} />
      )}

      {/* Каталог: мобайл — «поиск-first» (вариант B), десктоп — единая панель */}
      <section id="catalog" className="mt-7 scroll-mt-20">
        {/* ===== Мобильный (вариант B) ===== */}
        <div className="md:hidden">
          {/* Липкая строка поиска + чипы категорий */}
          <div className="sticky top-16 z-20 -mx-4 border-b border-border/40 bg-[#0A0618]/85 px-4 py-3 backdrop-blur-xl sm:-mx-9 sm:px-9">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                placeholder="Поиск курсов"
                value={query}
                onChange={(e) => applyQuery(e.target.value)}
                className="h-11 border-border/60 bg-card/60 pl-9 pr-9 text-base"
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
            <nav
              aria-label="Категории курсов"
              className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5 [&>button]:shrink-0"
            >
              <CategoryPill
                categoryId="all"
                label="Все"
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
          </div>

          {/* Счётчик + сортировка */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {filteredCourses.length} {coursesWord(filteredCourses.length)}
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Сортировка курсов"
              className="h-9 rounded-md border border-border/60 bg-card/60 px-3 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="default">По умолчанию</option>
              <option value="popular">Сначала популярные</option>
              <option value="cheap">Сначала дешевле</option>
              <option value="expensive">Сначала дороже</option>
            </select>
          </div>
        </div>

        {/* ===== Десктоп (без изменений) ===== */}
        <div className="mb-6 hidden rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl md:block">
          {/* Поиск */}
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
              className="h-10 border-border/60 bg-background/40 pl-9 pr-9"
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

          {/* Категории + результат + сортировка */}
          <div className="mt-3 flex flex-col gap-3 border-t border-border/40 pt-3 lg:flex-row lg:items-center lg:justify-between">
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
            <div className="flex shrink-0 items-center justify-between gap-3 lg:justify-end">
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {filteredCourses.length} {coursesWord(filteredCourses.length)}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Сортировка курсов"
                className="h-9 rounded-md border border-border/60 bg-background/40 px-3 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="default">По умолчанию</option>
                <option value="popular">Сначала популярные</option>
                <option value="cheap">Сначала дешевле</option>
                <option value="expensive">Сначала дороже</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Сетка курсов — плотная 2 колонки на телефоне (вариант B), 3 на lg+ */}
      <section>
        {filteredCourses.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center backdrop-blur">
            <Search className="size-10 text-muted-foreground/60" aria-hidden />
            <h3 className="mt-4 text-base font-semibold">Ничего не найдено</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {normalizedQuery
                ? `По запросу «${query}» ничего нет. Попробуйте другие слова или сбросьте фильтры.`
                : 'В этой категории пока нет курсов. Загляните позже.'}
            </p>
            {normalizedQuery || activeCategory !== 'all' ? (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  applyQuery('');
                  selectCategory('all');
                }}
              >
                Сбросить фильтры
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
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
                  dense
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
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-transparent px-8 py-2.5 text-sm text-primary-light transition-all hover:border-primary hover:bg-primary/10 hover:text-foreground"
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
