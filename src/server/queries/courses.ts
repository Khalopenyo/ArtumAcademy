import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Course preview projection — what `/courses/[slug]` and other public preview
 * surfaces consume. Camel-cased domain shape; the DB row stays snake_case.
 *
 * Lesson access (per-lesson video URL, watch progress) is intentionally
 * absent — that surface belongs to authenticated post-purchase routes
 * shipped in P3+.
 */
export interface CoursePreview {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    order_index: number;
    lessons: Array<{
      id: string;
      title: string;
      order_index: number;
      durationSeconds: number | null;
      isPreview: boolean;
    }>;
  }>;
  totalLessons: number;
  totalDurationSeconds: number;
}

/**
 * Public preview — anyone (anon or authed) can call.
 * Filters to `published = true` on courses (matches RLS policy at
 * supabase/migrations/20260522000001_init_base_tables.sql §courses).
 *
 * Lessons returned are gated by P1 RLS on `lessons`:
 *   `is_preview = true AND published = true`
 * The plan-04 seed sets BOTH flags TRUE on every lesson in the MVP course
 * so the preview tree renders titles even for anonymous viewers.
 *
 * Single nested query — no N+1 (per `.claude/skills/database/SKILL.md` §Запросы).
 * Returns `null` if slug not found or course not published.
 */
export async function getCourseBySlug(slug: string): Promise<CoursePreview | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('courses')
    .select(
      `
      id, slug, title, description, cover_url, published,
      modules (
        id, title, description, order_index,
        lessons (
          id, title, order_index, duration_sec, is_preview
        )
      )
    `,
    )
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (error || !data) return null;

  // Supabase nested selects don't guarantee ordering — sort client-side by order_index.
  const modules = (data.modules ?? [])
    .map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      order_index: m.order_index,
      lessons: (m.lessons ?? [])
        .map((l) => ({
          id: l.id,
          title: l.title,
          order_index: l.order_index,
          durationSeconds: l.duration_sec,
          isPreview: l.is_preview,
        }))
        .sort((a, b) => a.order_index - b.order_index),
    }))
    .sort((a, b) => a.order_index - b.order_index);

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalDurationSeconds = modules.reduce(
    (sum, m) =>
      sum + m.lessons.reduce((s, l) => s + (l.durationSeconds ?? 0), 0),
    0,
  );

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    description: data.description,
    coverUrl: data.cover_url,
    modules,
    totalLessons,
    totalDurationSeconds,
  };
}
