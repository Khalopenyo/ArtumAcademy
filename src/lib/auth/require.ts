import { createServerSupabase } from '@/lib/supabase/server';

export class UnauthorizedError extends Error {
  constructor() {
    super('UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/**
 * Гарантирует, что в Server Action или query есть авторизованный пользователь.
 * Бросает UnauthorizedError если сессии нет.
 */
export async function requireUser() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Гарантирует, что у пользователя есть одна из указанных ролей.
 * Список ролей — из таблицы user_roles.
 */
export async function requireRole(...roles: Array<'admin' | 'curator' | 'content_manager'>) {
  const user = await requireUser();
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (error || !data?.some((r) => roles.includes(r.role as never))) {
    throw new ForbiddenError();
  }

  return user;
}
