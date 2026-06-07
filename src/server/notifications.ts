import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Создаёт уведомление пользователю (под service_role). Не критично к флоу:
 * если таблицы ещё нет (миграция не применена) или ошибка — просто логируем,
 * не роняем основное действие (покупку/регистрацию).
 */
export async function notify(
  userId: string,
  input: { type?: string; title: string; body?: string },
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('notifications').insert({
      user_id: userId,
      type: input.type ?? 'info',
      title: input.title,
      body: input.body ?? '',
    });
    if (error) console.error('[notify]', error.message);
  } catch (e) {
    console.error('[notify]', e instanceof Error ? e.message : String(e));
  }
}
