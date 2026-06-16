'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/queries/auth';

/**
 * Отзывы (публичные мутации). Оставлять отзыв может ТОЛЬКО пользователь с
 * доступом к курсу (покупка / подписка, покрывающая курс / админ). Проверка —
 * под service_role, т.к. RLS на запись reviews закрыт. Тело отзыва рендерится
 * как текст (React экранирует) — HTML-санитайзер не нужен.
 */

type ActionResult = { ok: true } | { ok: false; error: string };
type Admin = ReturnType<typeof createAdminClient>;

async function userHasCourseAccess(admin: Admin, userId: string, courseId: string): Promise<boolean> {
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  if ((profile as { is_admin?: boolean } | null)?.is_admin) return true;

  const { data: purchase } = await admin
    .from('purchases')
    .select('user_id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle();
  if (purchase) return true;

  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, is_all_courses')
    .eq('user_id', userId)
    .eq('cancelled', false)
    .gt('expires_at', new Date().toISOString())
    // Предпочитаем «всё»-подписку, затем самую свежую — чтобы не промахнуться
    // мимо покрывающей, если активных вдруг несколько (паритет с getMyActiveSubscription).
    .order('is_all_courses', { ascending: false })
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const s = sub as { id: string; is_all_courses: boolean } | null;
  if (s) {
    if (s.is_all_courses) return true;
    const { data: covered } = await admin
      .from('subscription_courses')
      .select('course_id')
      .eq('subscription_id', s.id)
      .eq('course_id', courseId)
      .maybeSingle();
    if (covered) return true;
  }
  return false;
}

const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).default(''),
});

export async function submitReviewAction(
  courseSlug: string,
  rating: number,
  body: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Сначала войдите в аккаунт' };
  const parsed = ReviewSchema.safeParse({ rating, body });
  if (!parsed.success) return { ok: false, error: 'Оценка должна быть от 1 до 5' };

  const admin = createAdminClient();
  const { data: course } = await admin
    .from('courses')
    .select('id')
    .eq('slug', courseSlug)
    .maybeSingle();
  if (!course) return { ok: false, error: 'Курс не найден' };
  const courseId = (course as { id: string }).id;

  const allowed = await userHasCourseAccess(admin, user.id, courseId);
  if (!allowed) {
    return { ok: false, error: 'Отзыв можно оставить только после покупки курса или по подписке' };
  }

  const authorName = (user.name ?? '').trim() || 'Студент';
  const { error } = await admin.from('reviews').upsert(
    {
      course_id: courseId,
      user_id: user.id,
      author_name: authorName,
      rating: parsed.data.rating,
      body: parsed.data.body.trim(),
    },
    { onConflict: 'course_id,user_id' },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${courseSlug}`);
  return { ok: true };
}

export async function deleteMyReviewAction(courseSlug: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Не авторизован' };
  const admin = createAdminClient();
  const { data: course } = await admin
    .from('courses')
    .select('id')
    .eq('slug', courseSlug)
    .maybeSingle();
  if (!course) return { ok: false, error: 'Курс не найден' };
  const { error } = await admin
    .from('reviews')
    .delete()
    .eq('course_id', (course as { id: string }).id)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${courseSlug}`);
  return { ok: true };
}
