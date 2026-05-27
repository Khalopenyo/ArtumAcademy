import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { createServerSupabase } from '@/lib/supabase/server';

/**
 * DEBUG endpoint — показывает что сервер видит про текущего пользователя.
 *
 * Открой http://localhost:3000/api/whoami в браузере (или новой вкладке)
 * после логина. JSON ответ скажет:
 *   - cookies: все cookie которые пришли с запросом
 *   - supabaseUser: что говорит supabase.auth.getUser()
 *   - profile: соответствующая строка из public.profiles
 *
 * Удалить перед production деплоем.
 */
export async function GET() {
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  const cookieNames = allCookies.map((c) => c.name);

  const supabase = createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  let profile = null;
  let profileError = null;
  if (user) {
    const { data, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data;
    profileError = pErr?.message ?? null;
  }

  return NextResponse.json(
    {
      cookies: {
        count: allCookies.length,
        names: cookieNames,
        hasSupabaseCookie: cookieNames.some((n) => n.startsWith('sb-')),
      },
      supabaseUser: user
        ? {
            id: user.id,
            email: user.email,
            metadata: user.user_metadata,
            confirmed_at: user.confirmed_at,
            email_confirmed_at: user.email_confirmed_at,
          }
        : null,
      supabaseError: error?.message ?? null,
      profile,
      profileError,
    },
    { status: 200 },
  );
}
