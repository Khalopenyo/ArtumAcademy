import { CategoryPill } from '@/components/artum/CategoryPill';
import { CourseCard } from '@/components/artum/CourseCard';
import { UserStatsBlock } from '@/components/artum/UserStatsBlock';
import {
  type CategoryId,
  CATEGORIES,
  COURSES,
  getCoursesByCategory,
  getUserStats,
} from '@/lib/mock/courses';
import { MOCK_CURRENT_USER } from '@/lib/mock/user';

interface DashboardPageProps {
  searchParams: {
    category?: string;
  };
}

const VALID_CATEGORY_IDS = new Set([...CATEGORIES.map((c) => c.id), 'all'] as const);

function parseCategoryParam(raw: string | undefined): CategoryId | 'all' {
  if (raw && VALID_CATEGORY_IDS.has(raw as never)) {
    return raw as CategoryId | 'all';
  }
  return 'all';
}

/**
 * Главная страница (Дашборд) — ТЗ §4.1.
 *
 * Структура:
 *   1. Слоган-блок с приветствием
 *   2. Фильтры-пилюли по 8 категориям (Все + 7 направлений)
 *   3. Сетка карточек курсов (3 в ряд на десктопе, 1 на мобиле)
 *   4. Блок статистики пользователя (активные курсы / сертификаты / время / прогресс)
 *
 * Server Component (Categories + Courses + User Stats — статические mock-данные).
 */
export default function DashboardPage({ searchParams }: DashboardPageProps) {
  const activeCategory = parseCategoryParam(searchParams.category);
  const filteredCourses = getCoursesByCategory(activeCategory);
  const stats = getUserStats();

  // Подсчёт курсов на каждую категорию для пилюль (опционально, для визуала)
  const counts = new Map<CategoryId | 'all', number>();
  counts.set('all', COURSES.length);
  for (const cat of CATEGORIES) {
    counts.set(cat.id, getCoursesByCategory(cat.id).length);
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      {/* Слоган / приветствие */}
      <section className="mb-8 space-y-3 sm:mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Привет, {MOCK_CURRENT_USER.name.split(' ')[0]} 👋
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Образовательная платформа с курсами по нейросетям, фото, видео, монтажу, дизайну,
          визуалу и копирайтингу. Учитесь у профессионалов — в любом темпе.
        </p>
      </section>

      {/* Блок статистики */}
      <section className="mb-10">
        <UserStatsBlock stats={stats} />
      </section>

      {/* Фильтры-пилюли */}
      <section aria-labelledby="catalog-heading" className="mb-6">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="catalog-heading" className="text-xl font-semibold sm:text-2xl">
            Каталог курсов
          </h2>
          <span className="text-sm text-muted-foreground">
            {filteredCourses.length} из {COURSES.length}
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
            {filteredCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
