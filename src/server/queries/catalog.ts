import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';
import type { CategoryId, Course, Module, Lesson } from '@/lib/mock/courses';

/**
 * Server queries для каталога курсов из Supabase.
 *
 * Чтение идёт под RLS-политикой `courses_public_select` —
 * анонимный доступ только к published=true.
 */

// ────────────────────────────────────────────────────────────────────
// ROW TYPES (snake_case как в БД)
// ────────────────────────────────────────────────────────────────────

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  long_description: string;
  category: CategoryId;
  students_count: number;
  price_minor: number;
  cover_gradient: string;
  published: boolean;
  order_index: number;
}

interface ModuleRow {
  id: string;
  course_id: string;
  title: string;
  description: string;
  order_index: number;
}

interface LessonRow {
  id: string;
  module_id: string;
  title: string;
  duration_sec: number;
  video_url: string | null;
  preview: boolean;
  order_index: number;
}

// ────────────────────────────────────────────────────────────────────
// MAPPERS row → camelCase domain object
// ────────────────────────────────────────────────────────────────────

function rowToCourse(row: CourseRow, modules: Module[] = []): Course {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    category: row.category,
    studentsCount: row.students_count,
    priceMinor: row.price_minor,
    coverGradient: row.cover_gradient,
    modules,
    // Legacy mock-fields — больше не используются для real auth,
    // но интерфейс Course требует их (определены в mock/courses.ts).
    purchased: false,
    purchasedAt: null,
    certificateIssued: false,
  };
}

function rowToLesson(row: LessonRow): Lesson {
  return {
    id: row.id,
    title: row.title,
    durationSec: row.duration_sec,
    completed: false, // вычисляется отдельно из user-specific state
    preview: row.preview,
    videoUrl: row.video_url,
  };
}

function rowToModule(row: ModuleRow, lessons: Lesson[]): Module {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    lessons,
  };
}

// ────────────────────────────────────────────────────────────────────
// QUERIES
// ────────────────────────────────────────────────────────────────────

/**
 * Возвращает все опубликованные курсы — для каталога / дашборда.
 * БЕЗ nested modules/lessons (для производительности).
 */
export async function getPublishedCourses(): Promise<Course[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('published', true)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('[catalog.getPublishedCourses] error:', error);
    return [];
  }
  return (data as CourseRow[]).map((r) => rowToCourse(r));
}

/**
 * Возвращает курсы той же категории (для блока «похожие»).
 * Исключает текущий курс по slug.
 */
export async function getRelatedCourses(
  category: CategoryId,
  excludeSlug: string,
  limit: number = 3,
): Promise<Course[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('published', true)
    .eq('category', category)
    .neq('slug', excludeSlug)
    .order('order_index', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[catalog.getRelatedCourses] error:', error);
    return [];
  }
  return (data as CourseRow[]).map((r) => rowToCourse(r));
}

/**
 * Возвращает курс по slug — для страницы курса.
 * С nested modules → lessons (одним nested-select запросом).
 */
export async function getCourseBySlugFromDb(slug: string): Promise<Course | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('courses')
    .select(
      `
      *,
      modules:modules (
        *,
        lessons:lessons ( * )
      )
      `,
    )
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (error || !data) {
    if (error && error.code !== 'PGRST116') {
      console.error('[catalog.getCourseBySlugFromDb] error:', error);
    }
    return null;
  }

  type CourseWithNested = CourseRow & {
    modules: Array<ModuleRow & { lessons: LessonRow[] }>;
  };
  const row = data as CourseWithNested;

  const modules: Module[] = row.modules
    .sort((a, b) => a.order_index - b.order_index)
    .map((m) =>
      rowToModule(
        m,
        m.lessons
          .sort((a, b) => a.order_index - b.order_index)
          .map(rowToLesson),
      ),
    );

  return rowToCourse(row, modules);
}
