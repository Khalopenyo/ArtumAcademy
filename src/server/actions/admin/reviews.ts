'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auditLog } from '@/lib/audit-log';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/queries/auth';

/** Админ-модерация отзывов: удаление неуместных. */

async function assertAdmin(): Promise<
  { ok: true; user: { id: string } } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Не авторизован' };
  if (!user.isAdmin) return { ok: false, error: 'Недостаточно прав' };
  return { ok: true, user: { id: user.id } };
}

type ActionResult = { ok: true } | { ok: false; error: string };

export async function deleteReviewAction(id: string): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Некорректный id' };
  const admin = createAdminClient();
  const { error } = await admin.from('reviews').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  await auditLog({
    userId: guard.user.id,
    action: 'review.deleted',
    entityType: 'review',
    entityId: id,
  });
  revalidatePath('/admin/reviews');
  return { ok: true };
}
