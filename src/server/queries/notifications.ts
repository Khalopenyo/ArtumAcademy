import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';

export interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

/**
 * Уведомления текущего пользователя (под RLS self_select). Если таблицы ещё
 * нет (миграция не применена) — graceful: пустой список, без падения.
 */
export async function getMyNotifications(limit = 15): Promise<NotificationRecord[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, read, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[notifications.getMyNotifications]', error.message);
    return [];
  }

  return (
    data as Array<{
      id: string;
      type: string;
      title: string;
      body: string;
      read: boolean;
      created_at: string;
    }>
  ).map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    read: r.read,
    createdAt: r.created_at,
  }));
}
