import 'server-only';

import { redirect } from 'next/navigation';

import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  isAdmin: boolean;
  registeredAt: string;
}

/**
 * Возвращает текущего пользователя (auth.users + profiles) или null,
 * если сессия не установлена / истекла.
 * Используется в Server Components и Server Actions.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  // profiles row создаётся триггером handle_new_user. На всякий случай —
  // fallback через admin client (обходит RLS на случай если триггер не отработал).
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, initials, is_admin, registered_at')
    .eq('id', user.id)
    .single();

  if (!profile) {
    // Триггер мог не сработать (старый user). Создаём через admin.
    const fallbackName = user.email?.split('@')[0] ?? 'Пользователь';
    const admin = createAdminClient();
    const { data: created } = await admin
      .from('profiles')
      .insert({
        id: user.id,
        name: fallbackName,
        initials: fallbackName.slice(0, 2).toUpperCase(),
      })
      .select('id, name, initials, is_admin, registered_at')
      .single();
    if (!created) return null;
    return {
      id: user.id,
      email: user.email ?? '',
      name: created.name,
      initials: created.initials,
      isAdmin: created.is_admin,
      registeredAt: created.registered_at,
    };
  }

  return {
    id: user.id,
    email: user.email ?? '',
    name: profile.name,
    initials: profile.initials,
    isAdmin: profile.is_admin,
    registeredAt: profile.registered_at,
  };
}

/**
 * Throw-redirect helper: вызывайте в Server Components / Server Actions,
 * которым нужен залогиненный пользователь.
 */
export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    const qs = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
    redirect(`/login${qs}`);
  }
  return user;
}

/**
 * Throw-redirect helper: требует isAdmin=true. Не-админов отправляет на «/».
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.isAdmin) redirect('/');
  return user;
}
