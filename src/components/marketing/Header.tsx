import { getCurrentUser } from '@/server/queries/auth';

import { HeaderClient } from './HeaderClient';

/**
 * Header — Server Component. Берёт текущего пользователя из cookies
 * (через @supabase/ssr getUser) и передаёт в HeaderClient как prop,
 * чтобы first paint сразу был корректным (без гость→user мигания).
 *
 * Используется во всех layouts: (marketing), (app), (admin).
 */
export async function Header({ className }: { className?: string }) {
  const user = await getCurrentUser();
  return <HeaderClient className={className} user={user} />;
}
