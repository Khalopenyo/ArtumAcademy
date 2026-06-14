'use server';

import { revalidatePath } from 'next/cache';

import { auditLog } from '@/lib/audit-log';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/queries/auth';

/**
 * Admin Server Actions для управления пользователями:
 *   - роли (is_admin)
 *   - ручная выдача / отзыв доступа к курсу (комп для поддержки)
 *
 * SECURITY: каждый action проверяет, что вызывающий — админ. service_role
 * клиент обходит RLS, поэтому без проверки любой залогиненный мог бы дёрнуть.
 */

type ActionResult = { ok: true } | { ok: false; error: string };

async function currentAdmin(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Не авторизован' };
  if (!user.isAdmin) return { ok: false, error: 'Недостаточно прав' };
  return { ok: true, id: user.id };
}

/** Назначить / снять роль администратора. */
export async function setUserRoleAction(userId: string, makeAdmin: boolean): Promise<ActionResult> {
  const me = await currentAdmin();
  if (!me.ok) return me;
  // Защита от самоблокировки: нельзя снять админа с самого себя.
  if (userId === me.id && !makeAdmin) {
    return { ok: false, error: 'Нельзя снять роль администратора с самого себя' };
  }

  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ is_admin: makeAdmin }).eq('id', userId);
  if (error) return { ok: false, error: error.message };

  await auditLog({
    userId: me.id,
    action: makeAdmin ? 'user.role_granted' : 'user.role_revoked',
    entityType: 'user',
    entityId: userId,
  });
  revalidatePath('/admin/users');
  return { ok: true };
}

/** Выдать доступ к курсу вручную (комп — без оплаты). */
export async function grantCourseAccessAction(
  userId: string,
  courseSlug: string,
): Promise<ActionResult> {
  const me = await currentAdmin();
  if (!me.ok) return me;

  const admin = createAdminClient();
  const { data: course } = await admin
    .from('courses')
    .select('id')
    .eq('slug', courseSlug)
    .maybeSingle();
  if (!course) return { ok: false, error: 'Курс не найден' };

  const { error } = await admin.from('purchases').upsert(
    { user_id: userId, course_id: course.id, amount_minor: 0, discount_minor: 0, payment_id: null },
    { onConflict: 'user_id,course_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };

  await auditLog({
    userId: me.id,
    action: 'access.granted',
    entityType: 'purchase',
    entityId: course.id,
    meta: { target_user: userId, course_slug: courseSlug, comp: true },
  });
  revalidatePath('/admin/users');
  return { ok: true };
}

/** Отозвать доступ к курсу. */
export async function revokeCourseAccessAction(
  userId: string,
  courseSlug: string,
): Promise<ActionResult> {
  const me = await currentAdmin();
  if (!me.ok) return me;

  const admin = createAdminClient();
  const { data: course } = await admin
    .from('courses')
    .select('id')
    .eq('slug', courseSlug)
    .maybeSingle();
  if (!course) return { ok: false, error: 'Курс не найден' };

  const { error } = await admin
    .from('purchases')
    .delete()
    .eq('user_id', userId)
    .eq('course_id', course.id);
  if (error) return { ok: false, error: error.message };

  await auditLog({
    userId: me.id,
    action: 'access.revoked',
    entityType: 'purchase',
    entityId: course.id,
    meta: { target_user: userId, course_slug: courseSlug },
  });
  revalidatePath('/admin/users');
  return { ok: true };
}
