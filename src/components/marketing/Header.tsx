import { getCurrentUser } from '@/server/queries/auth';
import { getMyNotifications } from '@/server/queries/notifications';

import { HeaderClient } from './HeaderClient';

/**
 * Header — Server Component. Берёт текущего пользователя из cookies
 * (через @supabase/ssr getUser) и его уведомления, передаёт в HeaderClient
 * как props, чтобы first paint сразу был корректным.
 *
 * Используется во всех layouts: (marketing), (app), (admin).
 */
export async function Header({ className }: { className?: string }) {
  const user = await getCurrentUser();
  const notifications = user ? await getMyNotifications() : [];
  return <HeaderClient className={className} user={user} notifications={notifications} />;
}
