'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { auditLog } from '@/lib/audit-log';
import { notify } from '@/server/notifications';
import { getClientIp } from '@/lib/headers/client-ip';
import { rateLimit } from '@/lib/rate-limit';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/server/queries/auth';

type ActionResult = { ok: true } | { ok: false; error: string };

function ipOrUnknown(): string {
  return getClientIp() ?? 'unknown';
}

function rateLimitError(retryAfterSec: number): { ok: false; error: string } {
  const min = Math.ceil(retryAfterSec / 60);
  return {
    ok: false,
    error: `Слишком много попыток. Попробуйте через ${min} мин.`,
  };
}

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
}): Promise<{ ok: true; needsConfirmation: boolean } | { ok: false; error: string }> {
  const parsed = SignUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' };
  }
  // Rate limit: 3 регистрации в час с одного IP (анти-спам)
  const ip = ipOrUnknown();
  const rl = await rateLimit({
    key: ip,
    action: 'auth.register',
    windowSec: 3600,
    maxAttempts: 3,
  });
  if (!rl.ok) return rateLimitError(rl.retryAfterSec ?? 3600);

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };

  // Audit: успешная регистрация. user может быть null если включено email
  // confirmation (тогда юзер есть, но сессии нет до подтверждения).
  if (data.user) {
    await auditLog({
      userId: data.user.id,
      action: 'auth.register',
      entityType: 'user',
      entityId: data.user.id,
      meta: { email: parsed.data.email },
    });
    await notify(data.user.id, {
      type: 'welcome',
      title: 'Добро пожаловать в Artum Academy 🎉',
      body: 'Загляните в каталог и начните первый курс.',
    });
  }

  // Если включён "Confirm email" — сессии нет до подтверждения почты
  // (Supabase уже отправил письмо с кодом по шаблону "Confirm signup").
  const needsConfirmation = !data.session;

  // 'layout' тип чтобы инвалидировать ВЕСЬ дерево layout'ов (Header),
  // если вход произошёл сразу (Confirm email выключен).
  revalidatePath('/', 'layout');
  return { ok: true, needsConfirmation };
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
  // Rate limit: 5 попыток за 15 минут на пару (IP + email) — анти-брутфорс
  const ip = ipOrUnknown();
  const rl = await rateLimit({
    key: `${ip}:${parsed.data.email.toLowerCase()}`,
    action: 'auth.login',
    windowSec: 900,
    maxAttempts: 5,
  });
  if (!rl.ok) return rateLimitError(rl.retryAfterSec ?? 900);

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };

  if (data.user) {
    await auditLog({
      userId: data.user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: data.user.id,
    });
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = createServerSupabase();
  const user = await getCurrentUser();
  await supabase.auth.signOut();
  if (user) {
    await auditLog({
      userId: user.id,
      action: 'auth.logout',
      entityType: 'user',
      entityId: user.id,
    });
  }
  revalidatePath('/', 'layout');
  redirect('/login');
}

// ─── PASSWORD RESET ─────────────────────────────────────────────────

export async function requestPasswordResetAction(email: string): Promise<ActionResult> {
  const validation = z.string().email().safeParse(email);
  if (!validation.success) return { ok: false, error: 'Некорректный email' };

  // Rate limit: 3 запроса в час на email — анти-email-бомба
  const rl = await rateLimit({
    key: `email:${email.toLowerCase()}`,
    action: 'auth.forgot_password',
    windowSec: 3600,
    maxAttempts: 3,
  });
  if (!rl.ok) return rateLimitError(rl.retryAfterSec ?? 3600);

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

// ─── EMAIL CODE (OTP — passwordless вход для существующих аккаунтов) ──

/**
 * Шаг 1: отправляет 6-значный код на email (Supabase signInWithOtp).
 * `shouldCreateUser: false` — вход только для существующих аккаунтов;
 * регистрация остаётся через форму (имя + согласие 152-ФЗ).
 * Анти-enumeration: всегда возвращаем ok, не раскрывая существование email.
 */
export async function requestEmailCodeAction(email: string): Promise<ActionResult> {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return { ok: false, error: 'Некорректный email' };

  const ip = ipOrUnknown();
  const rl = await rateLimit({
    key: `${ip}:${parsed.data.toLowerCase()}`,
    action: 'auth.email_code',
    windowSec: 3600,
    maxAttempts: 5,
  });
  if (!rl.ok) return rateLimitError(rl.retryAfterSec ?? 3600);

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: false },
  });
  if (error) console.error('[auth.requestEmailCode]', error.message);
  return { ok: true };
}

/**
 * Шаг 2: проверяет код и логинит. Rate-limit обязателен — 6 цифр брутфорсятся.
 */
export async function verifyEmailCodeAction(input: {
  email: string;
  code: string;
}): Promise<ActionResult> {
  const schema = z.object({
    email: z.string().email('Некорректный email'),
    code: z
      .string()
      .trim()
      .regex(/^\d{6,10}$/, 'Код состоит из 6–10 цифр'),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' };
  }

  const ip = ipOrUnknown();
  const rl = await rateLimit({
    key: `${ip}:${parsed.data.email.toLowerCase()}`,
    action: 'auth.email_code_verify',
    windowSec: 900,
    maxAttempts: 5,
  });
  if (!rl.ok) return rateLimitError(rl.retryAfterSec ?? 900);

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: 'email',
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };

  if (data.user) {
    await auditLog({
      userId: data.user.id,
      action: 'auth.login_otp',
      entityType: 'user',
      entityId: data.user.id,
    });
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

// ─── ПОДТВЕРЖДЕНИЕ EMAIL ПРИ РЕГИСТРАЦИИ ─────────────────────────────

/**
 * Проверяет код подтверждения регистрации (verifyOtp type:'signup').
 * При успехе email подтверждён и устанавливается сессия. Rate-limit
 * обязателен — 6-значный код брутфорсится.
 */
export async function verifySignupCodeAction(input: {
  email: string;
  code: string;
}): Promise<ActionResult> {
  const schema = z.object({
    email: z.string().email('Некорректный email'),
    code: z
      .string()
      .trim()
      .regex(/^\d{6,10}$/, 'Код состоит из 6–10 цифр'),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' };
  }

  const ip = ipOrUnknown();
  const rl = await rateLimit({
    key: `${ip}:${parsed.data.email.toLowerCase()}`,
    action: 'auth.signup_verify',
    windowSec: 900,
    maxAttempts: 6,
  });
  if (!rl.ok) return rateLimitError(rl.retryAfterSec ?? 900);

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: 'signup',
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };

  if (data.user) {
    await auditLog({
      userId: data.user.id,
      action: 'auth.register_confirmed',
      entityType: 'user',
      entityId: data.user.id,
    });
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Повторно отправляет письмо с кодом подтверждения регистрации. */
export async function resendSignupCodeAction(email: string): Promise<ActionResult> {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return { ok: false, error: 'Некорректный email' };

  const ip = ipOrUnknown();
  const rl = await rateLimit({
    key: `${ip}:${parsed.data.toLowerCase()}`,
    action: 'auth.signup_resend',
    windowSec: 3600,
    maxAttempts: 5,
  });
  if (!rl.ok) return rateLimitError(rl.retryAfterSec ?? 3600);

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.resend({ type: 'signup', email: parsed.data });
  if (error) console.error('[auth.resendSignupCode]', error.message);
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

  // 'layout' — чтобы Header перечитал имя/инициалы для аватара
  revalidatePath('/', 'layout');
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
    'Token has expired or is invalid': 'Код неверный или истёк — запросите новый',
    'Otp has expired': 'Код истёк — запросите новый',
    'Signups not allowed for otp': 'Аккаунт не найден. Сначала зарегистрируйтесь.',
    'User already registered': 'Пользователь с таким email уже зарегистрирован',
    'Email not confirmed': 'Email ещё не подтверждён. Проверьте почту.',
    'Email rate limit exceeded': 'Слишком много попыток. Попробуйте через минуту.',
    'New password should be different from the old password.':
      'Новый пароль должен отличаться от текущего',
    'Password should be at least 8 characters.': 'Пароль минимум 8 символов',
  };
  return map[message] ?? message;
}
