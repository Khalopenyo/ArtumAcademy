import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';
import type { CourseReviews, Review } from '@/lib/reviews';

/**
 * Server queries для отзывов. Чтение — публичное (RLS reviews_public_select).
 * user_id наружу не отдаём (приватность) — отображаем author_name (снимок).
 */

interface ReviewRow {
  id: string;
  author_name: string;
  rating: number;
  body: string;
  created_at: string;
}

function rowToReview(r: ReviewRow): Review {
  return {
    id: r.id,
    authorName: r.author_name,
    rating: r.rating,
    body: r.body,
    createdAt: r.created_at,
  };
}

/** Отзывы курса + средняя оценка + количество. */
export async function getCourseReviews(courseId: string): Promise<CourseReviews> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('reviews')
    .select('id, author_name, rating, body, created_at')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false });
  if (error || !data) {
    if (error) console.error('[reviews.getCourseReviews]', error);
    return { list: [], count: 0, average: 0 };
  }
  const list = (data as ReviewRow[]).map(rowToReview);
  const count = list.length;
  const average =
    count === 0 ? 0 : Math.round((list.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
  return { list, count, average };
}

/** Отзыв текущего пользователя для курса (чтобы показать «ваш отзыв»/форму). */
export async function getMyReviewForCourse(courseId: string): Promise<Review | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('reviews')
    .select('id, author_name, rating, body, created_at')
    .eq('course_id', courseId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data) return null;
  return rowToReview(data as ReviewRow);
}

export interface AdminReviewRow extends Review {
  courseTitle: string;
  courseSlug: string;
}

/** Админ: все отзывы с названием курса — для модерации. service_role. */
export async function getAllReviewsForAdmin(): Promise<AdminReviewRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('reviews')
    .select('id, author_name, rating, body, created_at, courses:course_id ( title, slug )')
    .order('created_at', { ascending: false });
  if (error || !data) {
    if (error) console.error('[reviews.getAllReviewsForAdmin]', error);
    return [];
  }
  type Row = ReviewRow & { courses: { title: string; slug: string }[] | { title: string; slug: string } | null };
  function joined(c: Row['courses']): { title: string; slug: string } {
    if (!c) return { title: '—', slug: '' };
    return Array.isArray(c) ? (c[0] ?? { title: '—', slug: '' }) : c;
  }
  return (data as unknown as Row[]).map((r) => {
    const c = joined(r.courses);
    return { ...rowToReview(r), courseTitle: c.title, courseSlug: c.slug };
  });
}
