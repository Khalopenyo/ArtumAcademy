'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import { CategoryPill } from '@/components/artum/CategoryPill';
import { CourseCard } from '@/components/artum/CourseCard';
import { UserStatsBlock } from '@/components/artum/UserStatsBlock';
import {
  type CategoryId,
  CATEGORIES,
} from '@/lib/mock/courses';
import {
  getAllCoursesEffective,
  getCourseProgressFromStore,
  isCoursePurchased,
  useArtumStore,
} from '@/lib/store';
import { useCurrentUser, useHydrated } from '@/lib/store/hooks';

const VALID_CATEGORY_IDS = new Set([...CATEGORIES.map((c) => c.id), 'all'] as const);

function parseCategoryParam(raw: string | undefined | null): CategoryId | 'all' {
  if (raw && VALID_CATEGORY_IDS.has(raw as never)) {
    return raw as CategoryId | 'all';
  }
  return 'all';
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const searchParams = useSearchParams();
  const activeCategory = parseCategoryParam(searchParams.get('category'));
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const state = useArtumStore();
  const certificates = useArtumStore((s) => s.certificates);

  const allCourses = useMemo(() => getAllCoursesEffective(state), [state]);
  const filteredCourses = useMemo(
    () =>
      activeCategory === 'all'
        ? allCourses
        : allCourses.filter((c) => c.category === activeCategory),
    [allCourses, activeCategory],
  );

  const counts = useMemo(() => {
    const m = new Map<CategoryId | 'all', number>();
    m.set('all', allCourses.length);
    for (const cat of CATEGORIES) {
      m.set(cat.id, allCourses.filter((c) => c.category === cat.id).length);
    }
    return m;
  }, [allCourses]);

  const stats = useMemo(() => {
    if (!user) return { activeCourses: 0, certificates: 0, studyHoursTotal: 0, overallProgressPercent: 0 };
    const purchased = allCourses.filter((c) => isCoursePurchased(state, user.id, c.slug));
    const certs = certificates.filter((c) => c.userId === user.id).length;
    const active = purchased.filter((c) => {
      const p = getCourseProgressFromStore(state, user.id, c);
      return p.percent > 0 && p.percent < 100;
    }).length;
    const studySeconds = purchased.reduce((sum, c) => {
      const p = getCourseProgressFromStore(state, user.id, c);
      const totalDur = c.modules.flatMap((m) => m.lessons).reduce((s, l) => s + l.durationSec, 0);
      return sum + totalDur * (p.percent / 100);
    }, 0);
    const overall =
      purchased.length === 0
        ? 0
        : Math.round(
            purchased.reduce((sum, c) => sum + getCourseProgressFromStore(state, user.id, c).percent, 0) /
              purchased.length,
          );
    return {
      activeCourses: active,
      certificates: certs,
      studyHoursTotal: Math.round(studySeconds / 3600),
      overallProgressPercent: overall,
    };
  }, [user, allCourses, state, certificates]);

  const greetingName = hydrated && user ? user.name.split(' ')[0] : 'Гость';

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      {/* Слоган / приветствие */}
      <section className="mb-8 space-y-3 sm:mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {hydrated && user ? (
            <>Привет, {greetingName} 👋</>
          ) : (
            <>Учитесь у профессионалов</>
          )}
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Образовательная платформа с курсами по нейросетям, фото, видео, монтажу, дизайну,
          визуалу и копирайтингу. Учитесь у профессионалов — в любом темпе.
        </p>
      </section>

      {/* Stats — только для залогиненных */}
      {hydrated && user ? (
        <section className="mb-10">
          <UserStatsBlock stats={stats} />
        </section>
      ) : null}

      {/* Фильтры-пилюли */}
      <section aria-labelledby="catalog-heading" className="mb-6">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="catalog-heading" className="text-xl font-semibold sm:text-2xl">
            Каталог курсов
          </h2>
          <span className="text-sm text-muted-foreground">
            {filteredCourses.length} из {allCourses.length}
          </span>
        </div>
        <nav aria-label="Категории курсов" className="flex flex-wrap gap-2">
          <CategoryPill
            categoryId="all"
            label="Все курсы"
            active={activeCategory === 'all'}
            count={counts.get('all')}
          />
          {CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat.id}
              categoryId={cat.id}
              label={cat.label}
              emoji={cat.emoji}
              active={activeCategory === cat.id}
              count={counts.get(cat.id)}
            />
          ))}
        </nav>
      </section>

      {/* Сетка курсов */}
      <section>
        {filteredCourses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
            В этой категории пока нет курсов. Загляните позже.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course) => {
              const purchased = user ? isCoursePurchased(state, user.id, course.slug) : false;
              const progress = user ? getCourseProgressFromStore(state, user.id, course) : null;
              return (
                <CourseCard
                  key={course.id}
                  course={course}
                  purchased={purchased}
                  progressPercent={progress?.percent ?? 0}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
