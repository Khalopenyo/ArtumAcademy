'use server';

import { revalidatePath } from 'next/cache';

import { auditLog } from '@/lib/audit-log';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/server/queries/auth';

/**
 * 152-ФЗ: право на доступ к данным (экспорт) и право на удаление аккаунта.
 */

/** Собирает все ПДн пользователя в один JSON (право на доступ к данным). */
export async function exportMyDataAction(): Promise<
  { ok: true; data: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Не авторизован' };

  const admin = createAdminClient();
  const uid = user.id;
  const [profile, purchases, payments, certs, progress, watch, wishlist, subs, notifs, consents] =
    await Promise.all([
      admin.from('profiles').select('*').eq('id', uid).maybeSingle(),
      admin.from('purchases').select('*').eq('user_id', uid),
      admin.from('payments').select('*').eq('user_id', uid),
      admin.from('certificates').select('*').eq('user_id', uid),
      admin.from('lesson_progress').select('*').eq('user_id', uid),
      admin.from('lesson_watch_position').select('*').eq('user_id', uid),
      admin.from('wishlist').select('*').eq('user_id', uid),
      admin.from('subscriptions').select('*').eq('user_id', uid),
      admin.from('notifications').select('*').eq('user_id', uid),
      admin.from('user_consents').select('*').eq('user_id', uid),
    ]);

  const payload = {
    exported_at: new Date().toISOString(),
    account: { id: uid, email: user.email, name: user.name, registered_at: user.registeredAt },
    profile: profile.data ?? null,
    purchases: purchases.data ?? [],
    payments: payments.data ?? [],
    certificates: certs.data ?? [],
    lesson_progress: progress.data ?? [],
    lesson_watch_position: watch.data ?? [],
    wishlist: wishlist.data ?? [],
    subscriptions: subs.data ?? [],
    notifications: notifs.data ?? [],
    consents: consents.data ?? [],
  };

  return { ok: true, data: JSON.stringify(payload, null, 2) };
}

/**
 * Удаляет аккаунт и все связанные данные (право на удаление).
 * Hard-delete через admin API → каскадом удаляет profiles/purchases/payments/
 * certificates/progress/wishlist/subscriptions/notifications/consents
 * (FK ON DELETE CASCADE). audit_log сохраняется (user_id → NULL).
 */
export async function deleteAccountAction(): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Не авторизован' };

  // Лог ДО удаления (потом user_id обнулится по FK SET NULL).
  await auditLog({
    userId: user.id,
    action: 'account.deleted',
    entityType: 'user',
    entityId: user.id,
    meta: { email: user.email },
  });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: error.message };

  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  return { ok: true };
}
