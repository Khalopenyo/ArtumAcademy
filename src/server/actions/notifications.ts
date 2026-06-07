'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/queries/auth';

/** Помечает все непрочитанные уведомления пользователя как прочитанные (при открытии колокольчика). */
export async function markNotificationsReadAction(): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const admin = createAdminClient();
  const { error } = await admin
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false);

  if (error) {
    console.error('[markNotificationsRead]', error.message);
    return { ok: false };
  }
  return { ok: true };
}
