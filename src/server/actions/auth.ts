'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/server/queries/auth';

type ActionResult = { ok: true } | { ok: false; error: string };

// ─── SIGN UP / SIGN IN / SIGN OUT ───────────────────────────────────

const SignUpSchema = z.object({
  name: z.string().min(1, 'Имя обязательно'),
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Пароль минимум 8 символов'),
});

export async function signUpAction(input: {
  name: string;
  email: string;
  password: string;
}): Promise<ActionResult> {
  const parsed = SignUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' };
  }
  const supabase = createServerSupabase();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  revalidatePath('/');
  return { ok: true };
}

const SignInSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(1, 'Пароль обязателен'),
});

export async function signInAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  const parsed = SignInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' };
  }
  const supabase = createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  revalidatePath('/');
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath('/');
  redirect('/login');
}

// ─── PASSWORD RESET ─────────────────────────────────────────────────

export async function requestPasswordResetAction(email: string): Promise<ActionResult> {
  const validation = z.string().email().safeParse(email);
  if (!validation.success) return { ok: false, error: 'Некорректный email' };
  const supabase = createServerSupabase();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  });
  if (error) console.error('[auth.requestPasswordReset]', error);
  // Намеренно НЕ раскрываем существует ли email (anti-enumeration).
  return { ok: true };
}

export async function updatePasswordAction(newPassword: string): Promise<ActionResult> {
  if (newPassword.length < 8) return { ok: false, error: 'Пароль минимум 8 символов' };
  const supabase = createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return { ok: true };
}

// ─── PROFILE ────────────────────────────────────────────────────────

export async function updateProfileAction(input: {
  name?: string;
  email?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Не авторизован' };

  const supabase = createServerSupabase();

  if (input.name && input.name.trim() && input.name.trim() !== user.name) {
    const name = input.name.trim();
    const initials = computeInitials(name);
    const { error } = await supabase
      .from('profiles')
      .update({ name, initials })
      .eq('id', user.id);
    if (error) return { ok: false, error: error.message };
  }

  if (input.email && input.email.trim() && input.email.trim() !== user.email) {
    const newEmail = input.email.trim().toLowerCase();
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) return { ok: false, error: translateAuthError(error.message) };
  }

  revalidatePath('/profile');
  return { ok: true };
}

// ─── HELPERS ────────────────────────────────────────────────────────

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Неверный email или пароль',
    'User already registered': 'Пользователь с таким email уже зарегистрирован',
    'Email not confirmed': 'Email ещё не подтверждён. Проверьте почту.',
    'Email rate limit exceeded': 'Слишком много попыток. Попробуйте через минуту.',
    'New password should be different from the old password.':
      'Новый пароль должен отличаться от текущего',
    'Password should be at least 8 characters.': 'Пароль минимум 8 символов',
  };
  return map[message] ?? message;
}
