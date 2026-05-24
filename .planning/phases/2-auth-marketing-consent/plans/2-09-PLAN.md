---
plan: 09-forgot-reset-password
phase: 2
wave: 4
type: execute
maps_to: [AUTH-06, AUTH-09, AUTH-10]
depends_on: [01-shadcn-and-design-system, 06-rate-limit-and-captcha-infra, 07-register-consent-email-confirm]
autonomous: true
mode: mvp
estimated_tasks: 3
files_modified:
  - src/lib/schemas/auth.ts
  - src/server/actions/auth.ts
  - src/app/(marketing)/forgot-password/page.tsx
  - src/app/(marketing)/forgot-password/components/ForgotPasswordForm.tsx
  - src/app/(marketing)/reset-password/page.tsx
  - src/app/(marketing)/reset-password/components/ResetPasswordForm.tsx
  - tests/integration/auth/recovery.test.ts
requirements: [AUTH-06, AUTH-09, AUTH-10]
must_haves:
  truths:
    - "POST forgotPasswordAction with valid email + valid captcha + rate-limit OK → calls supabase.auth.resetPasswordForEmail → returns ok=true with neutral message"
    - "Forgot page success state: form replaced by neutral message «Если email зарегистрирован, мы отправили ссылку...» (OWASP — no enumeration)"
    - "Confirmation email link points to /auth/confirm?type=recovery&next=/reset-password (Supabase appends token_hash)"
    - "/auth/confirm Route Handler from plan-07 handles type=recovery by routing to /reset-password (session set + safe redirect)"
    - "POST resetPasswordAction with valid new password + matching confirm + active session from recovery flow → calls supabase.auth.updateUser({ password }) → returns ok=true; redirect to /login?reset=1"
    - "/reset-password without active recovery session → shows error state with link to /forgot-password"
    - "SmartCaptcha visible on /forgot-password (AUTH-09 second site); not on /reset-password (one-time token bound to recovery session is sufficient)"
    - "Rate-limit: 3/hr/email on auth.forgot_password"
    - "Audit log: auth.password_reset_requested, auth.password_reset_completed"
  artifacts:
    - path: src/lib/schemas/auth.ts (extended)
      provides: "forgotPasswordSchema + resetPasswordSchema added"
    - path: src/server/actions/auth.ts (extended)
      provides: "forgotPasswordAction + resetPasswordAction added"
    - path: src/app/(marketing)/forgot-password/page.tsx
      provides: "GET /forgot-password — SC shell"
    - path: src/app/(marketing)/forgot-password/components/ForgotPasswordForm.tsx
      provides: "Client Component form with captcha + neutral success state"
    - path: src/app/(marketing)/reset-password/page.tsx
      provides: "GET /reset-password — SC shell"
    - path: src/app/(marketing)/reset-password/components/ResetPasswordForm.tsx
      provides: "Client Component form: new password + confirm; gated on supabase session"
  key_links:
    - from: src/server/actions/auth.ts (forgotPasswordAction)
      to: supabase.auth.resetPasswordForEmail
      via: redirectTo = /auth/confirm?type=recovery&next=/reset-password
      pattern: "resetPasswordForEmail"
    - from: src/server/actions/auth.ts (resetPasswordAction)
      to: supabase.auth.updateUser({ password })
      via: requires active session (recovery flow set it)
      pattern: "updateUser.*password"
    - from: src/app/(marketing)/reset-password/components/ResetPasswordForm.tsx
      to: getUser() check
      via: supabase.auth.getUser (server side check / pass user via prop)
      pattern: "auth\\.getUser"
---

<objective>
Ship the password recovery slice: user clicks «Забыли пароль?» → enters email → solves captcha → receives email with link → clicks → lands on `/reset-password` with a Supabase-issued recovery session → sets new password → logs in normally with the new password.

Purpose: AUTH-06 (full forgot/reset flow with 1-hour token TTL — that's a Supabase Auth default) + AUTH-09 second site (captcha on `/forgot-password`) + AUTH-10 third bucket (rate-limit on `auth.forgot_password` — 3/hr/email). Reuses `/auth/confirm` Route Handler from plan-07 (which handles `type='recovery'` exactly the same way as `type='signup'` — call `verifyOtp` + redirect). The only NEW Route Handler concern is making sure the recovery redirect lands on `/reset-password` instead of `/dashboard`.

Output:
- 2 schemas (`forgotPasswordSchema`, `resetPasswordSchema`) appended to `src/lib/schemas/auth.ts`
- 2 Server Actions (`forgotPasswordAction`, `resetPasswordAction`) appended to `src/server/actions/auth.ts`
- 4 route/component files (2 pages + 2 client forms)
- 1 integration test (full recovery flow)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/2-auth-marketing-consent/PLAN.md
@.planning/phases/2-auth-marketing-consent/UI-SPEC.md
@.planning/phases/2-auth-marketing-consent/RESEARCH.md
@.planning/REQUIREMENTS.md
@src/lib/schemas/auth.ts
@src/server/actions/auth.ts
@src/components/auth/SmartCaptchaWidget.tsx
@src/app/auth/confirm/route.ts
</context>

<interfaces>
From plan-07 (must be merged):
```typescript
// src/lib/schemas/auth.ts — has passwordSchema, emailSchema; plan-09 reuses both
// src/server/actions/auth.ts — has rateLimit, verifyCaptcha, getClientIp, auditLog, createServerSupabase, hashEmail (private), LEGAL_POLICY_VERSION
// src/components/auth/SmartCaptchaWidget.tsx — reusable client widget
// src/app/auth/confirm/route.ts — already handles type='recovery' correctly per pattern (calls verifyOtp, redirects to safeNext)
```

From plan-08 (Wave 4 sibling):
```typescript
// loginSchema + loginAction + logoutAction added; /login + /reset-password share schema/auth.ts file
// MERGE NOTE: plans 08 and 09 both append to schemas/auth.ts and server/actions/auth.ts.
//   Sequential execution: 08 first, then 09 rebases. Parallel execution requires post-merge fixup of the two files.
//   The solo-dev linear recommendation in the master PLAN.md runs 08 → 09 to avoid this.
```

From @supabase/supabase-js:
```typescript
supabase.auth.resetPasswordForEmail(email, { redirectTo }):
  Promise<{ data, error }>;
// Sends a recovery email with link → redirectTo URL + Supabase-appended token_hash + type=recovery params.
// Default token TTL = 1 hour (matches AUTH-06).

supabase.auth.updateUser({ password: newPassword }):
  Promise<{ data, error }>;
// Requires active session (the recovery flow sets it via verifyOtp).
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: forgotPasswordSchema + resetPasswordSchema + forgotPasswordAction + resetPasswordAction + unit tests</name>
  <files>src/lib/schemas/auth.ts, src/server/actions/auth.ts, src/server/actions/auth.test.ts</files>
  <behavior>
    - forgotPasswordSchema: email + captchaToken (z.string().min(1))
    - resetPasswordSchema: password (reused passwordSchema) + passwordConfirm (z.string()); refine pwd===confirm with message «Пароли не совпадают»
    - forgotPasswordAction: rate-limit 3/hr/email + captcha verify + supabase.auth.resetPasswordForEmail with redirectTo=/auth/confirm?type=recovery&next=/reset-password → ALWAYS returns ok=true with neutral message (OWASP: don't enumerate)
    - forgotPasswordAction: invalid captcha → returns ok=false with field='captcha'
    - forgotPasswordAction: rate-limit blocked → returns ok=false 429-equivalent
    - resetPasswordAction: requires active session (call getUser, if null return ok=false 'no recovery session'); calls supabase.auth.updateUser({ password }); audit log entry
    - resetPasswordAction: refresh-token rotated by Supabase on password update (built-in)
  </behavior>
  <action>
1. **Extend `src/lib/schemas/auth.ts`**:
```typescript
// ... existing: passwordSchema, emailSchema, registerSchema, loginSchema

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  captchaToken: z.string().min(1, 'Подтвердите, что вы не робот'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Пароли не совпадают',
    path: ['passwordConfirm'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

2. **Extend `src/server/actions/auth.ts`**:
```typescript
// ... existing imports include zod, rateLimit, verifyCaptcha, getClientIp, auditLog, createServerSupabase, hashEmail, env

import { forgotPasswordSchema, resetPasswordSchema, type ResetPasswordInput } from '@/lib/schemas/auth';

type ForgotPasswordResult = { ok: true } | { ok: false; error: string; field?: 'captcha' };

export async function forgotPasswordAction(input: unknown): Promise<ForgotPasswordResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]!.message };
  }
  const { email, captchaToken } = parsed.data;
  const ip = getClientIp();

  const rl = await rateLimit({
    key: `email:${email}`,
    action: 'auth.forgot_password',
    windowSec: 3600,
    maxAttempts: 3,
  });
  if (!rl.ok) {
    return { ok: false, error: 'Слишком много попыток. Попробуйте через час.' };
  }

  const captcha = await verifyCaptcha(captchaToken, ip);
  if (!captcha.ok) {
    return { ok: false, error: 'Капча не пройдена. Обновите страницу и попробуйте снова.', field: 'captcha' };
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm?type=recovery&next=/reset-password`,
  });

  // Audit (always — even on Supabase error, the attempt should be recorded)
  await auditLog({
    action: 'auth.password_reset_requested',
    meta: { email_hash: hashEmail(email), success: !error },
  });

  if (error) {
    // Log internally but return neutral message (OWASP — no enumeration)
    logger.warn({ err: error.message, email_hash: hashEmail(email) }, 'resetPasswordForEmail failed');
  }

  // ALWAYS return ok=true with same neutral message — never tell user whether email exists
  return { ok: true };
}

type ResetPasswordResult = { ok: true } | { ok: false; error: string };

export async function resetPasswordAction(input: unknown): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]!.message };
  }
  const { password } = parsed.data;

  const supabase = createServerSupabase();
  // Require active session (recovery flow set it via verifyOtp in /auth/confirm)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: 'Сессия восстановления истекла. Запросите новую ссылку.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    logger.warn({ err: error.message, userId: user.id }, 'updateUser password failed');
    // Pattern: surface generic — internal error logged
    return { ok: false, error: 'Не удалось обновить пароль. Попробуйте ещё раз.' };
  }

  await auditLog({
    userId: user.id,
    action: 'auth.password_reset_completed',
    entityType: 'user',
    entityId: user.id,
  });

  return { ok: true };
}
```

3. **Extend `src/server/actions/auth.test.ts`** — append cases for the 6 paths in `<behavior>`. Mock external deps as in plan-07/08.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run test:ci -- src/lib/schemas/auth src/server/actions/auth && grep -q "forgotPasswordSchema\|resetPasswordSchema" src/lib/schemas/auth.ts && grep -q "forgotPasswordAction\|resetPasswordAction" src/server/actions/auth.ts && grep -q "resetPasswordForEmail" src/server/actions/auth.ts && grep -q "updateUser.*password" src/server/actions/auth.ts</automated>
  </verify>
  <done>schemas/auth.ts has both forgot + reset schemas with proper validation; server/actions/auth.ts has both new actions with rate-limit + captcha + audit; resetPasswordAction requires active session (recovery flow); unit tests cover all 6 paths.</done>
</task>

<task type="auto">
  <name>Task 2: /forgot-password page + form (with captcha)</name>
  <files>src/app/(marketing)/forgot-password/page.tsx, src/app/(marketing)/forgot-password/components/ForgotPasswordForm.tsx</files>
  <action>
1. **`src/app/(marketing)/forgot-password/page.tsx`** — Server Component shell. Per UI-SPEC §4.5:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from '@/components/ui/card';
import { ForgotPasswordForm } from './components/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Восстановление пароля',
  description: 'Восстановите доступ к аккаунту VideoEdit Academy',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="container mx-auto max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle>Восстановление пароля</CardTitle>
          <CardDescription>Введите email — мы отправим ссылку для сброса</CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
        <CardFooter className="flex justify-between text-sm">
          <span className="text-muted-foreground">Вспомнили?</span>
          <Link href="/login" className="font-medium underline-offset-4 hover:underline">Войти</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
```
No `<Suspense>` needed here — no `useSearchParams` in the form (no `?next=` for forgot-password).

2. **`src/app/(marketing)/forgot-password/components/ForgotPasswordForm.tsx`** — Client Component. Per UI-SPEC §4.5:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/schemas/auth';
import { forgotPasswordAction } from '@/server/actions/auth';
import { SmartCaptchaWidget } from '@/components/auth/SmartCaptchaWidget';

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [captchaToken, setCaptchaToken] = useState('');
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '', captchaToken: '' },
    mode: 'onBlur',
  });

  const canSubmit = captchaToken.length > 0 && !pending;

  const onSubmit = (values: ForgotPasswordInput) => {
    startTransition(async () => {
      const result = await forgotPasswordAction({ ...values, captchaToken });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSent(true);
    });
  };

  // Per UI-SPEC §4.5 + OWASP: neutral success — never enumerate whether email exists
  if (sent) {
    return (
      <div className="space-y-3 text-sm">
        <p>
          Если такой email зарегистрирован, мы отправили на него ссылку для сброса пароля.
          Проверьте почту, в том числе папку «Спам».
        </p>
        <Button variant="outline" onClick={() => setSent(false)}>Попробовать другой email</Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" inputMode="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <SmartCaptchaWidget onToken={(token) => { setCaptchaToken(token); form.setValue('captchaToken', token); }} />

        <Button type="submit" disabled={!canSubmit} className="w-full" aria-busy={pending}>
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {pending ? 'Отправляем…' : 'Отправить ссылку'}
        </Button>
      </form>
    </Form>
  );
}
```
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && grep -q "SmartCaptchaWidget" src/app/\\\(marketing\\\)/forgot-password/components/ForgotPasswordForm.tsx && grep -q "Если такой email зарегистрирован" src/app/\\\(marketing\\\)/forgot-password/components/ForgotPasswordForm.tsx</automated>
  </verify>
  <done>/forgot-password page + form exist; SmartCaptcha widget present (AUTH-09 site 2); neutral success message replaces form (OWASP); rate-limit error surfaced via toast; lint + typecheck clean.</done>
</task>

<task type="auto">
  <name>Task 3: /reset-password page + form + integration test (full recovery flow)</name>
  <files>src/app/(marketing)/reset-password/page.tsx, src/app/(marketing)/reset-password/components/ResetPasswordForm.tsx, tests/integration/auth/recovery.test.ts</files>
  <action>
1. **`src/app/(marketing)/reset-password/page.tsx`** — Server Component. Gates on active session (recovery flow established it):
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createServerSupabase } from '@/lib/supabase/server';
import { ResetPasswordForm } from './components/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Новый пароль',
  description: 'Установите новый пароль для аккаунта VideoEdit Academy',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="container mx-auto max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle>Новый пароль</CardTitle>
          <CardDescription>
            {user ? 'Введите новый пароль' : 'Ссылка восстановления истекла или уже использована'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <ResetPasswordForm />
          ) : (
            <div className="space-y-4 text-sm">
              <p>Запросите новую ссылку для восстановления пароля.</p>
              <Button asChild className="w-full">
                <Link href="/forgot-password">Восстановить пароль</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```
Per UI-SPEC §4.6: «Invalid/expired token → карточка полностью заменяется на error state with CTA "Запросить новую ссылку"». Our implementation conditions on `user` being present — Supabase recovery flow sets a session via `/auth/confirm` → `verifyOtp` (handled in plan-07), so a `null` user here means session not present.

> Critical: this page is **under `(marketing)/`, NOT `(app)/`**. The `(app)/` auth gate from plan-08 would redirect anon → `/login`, which is wrong for recovery (recovery users DO have a Supabase session but it's a "recovery" type — Supabase still returns a `user` object via `getUser()`).

2. **`src/app/(marketing)/reset-password/components/ResetPasswordForm.tsx`** — Client Component:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';

import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/schemas/auth';
import { resetPasswordAction } from '@/server/actions/auth';

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showPwd, setShowPwd] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', passwordConfirm: '' },
    mode: 'onBlur',
  });

  const onSubmit = (values: ResetPasswordInput) => {
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Пароль обновлён. Войдите с новым паролем.');
      router.push('/login?reset=1');
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Новый пароль</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type={showPwd ? 'text' : 'password'} autoComplete="new-password" {...field} />
                  <button
                    type="button"
                    aria-label={showPwd ? 'Скрыть пароль' : 'Показать пароль'}
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </FormControl>
              <FormDescription>Минимум 8 символов и хотя бы одна цифра</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="passwordConfirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Подтвердите новый пароль</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={pending} className="w-full" aria-busy={pending}>
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {pending ? 'Меняем пароль…' : 'Сбросить пароль'}
        </Button>
      </form>
    </Form>
  );
}
```

3. **`tests/integration/auth/recovery.test.ts`** — full flow integration. AUTH-06 verification:
   - **Test 1:** create a confirmed test user; call `forgotPasswordAction({ email, captchaToken })` with mocked captcha verify; assert ok=true; assert audit log entry written
   - **Test 2:** simulate the recovery confirm step: admin creates a recovery session for the user via `supabase.auth.admin.generateLink({ type: 'recovery', email })`; assert link includes `type=recovery` and `token_hash`
   - **Test 3:** mint a session for the user via the recovery token (`verifyOtp({ type: 'recovery', token_hash })`); call `resetPasswordAction({ password: 'NewPass1234', passwordConfirm: 'NewPass1234' })`; assert ok=true
   - **Test 4:** verify the new password works: call `loginAction({ email, password: 'NewPass1234' })` → returns ok=true
   - **Test 5:** verify the OLD password no longer works: call `loginAction({ email, password: '<old password>' })` → returns ok=false
   - **Test 6 (rate-limit):** call `forgotPasswordAction` 4 times in 1 hour for same email → 4th returns rate-limit error
   - **Test 7 (no session):** call `resetPasswordAction` without an active session → returns ok=false 'Сессия восстановления истекла'

Per AUTH-06 success criterion: 1-hour token TTL is a Supabase default — we don't test the TTL directly (would require waiting an hour or using time mocking against Supabase, which is overkill); we DO test that the link expires once consumed (`verifyOtp` returns error on second call). Add **Test 8:** verifyOtp same token_hash twice → first ok, second returns error.

Docker-deferred per P1 pattern if absent.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run build && ls src/app/\\\(marketing\\\)/reset-password/page.tsx src/app/\\\(marketing\\\)/reset-password/components/ResetPasswordForm.tsx tests/integration/auth/recovery.test.ts</automated>
  </verify>
  <done>/reset-password page (SC) gates on user presence; ResetPasswordForm (CC) validates both pwd fields; integration test file has 8 cases covering full recovery flow + edge cases; lint + typecheck + build all clean.</done>
</task>

</tasks>

<verification>
After all 3 tasks:
1. `npm run lint && npm run typecheck && npm run test:ci && npm run build` — must pass
2. With YANDEX_CAPTCHA env + Supabase running:
   - `npm run dev`, register a user (plan-07), confirm email
   - Open http://localhost:3000/forgot-password, enter email, solve captcha, submit → neutral success message
   - Check inbox → click recovery link → lands on http://localhost:3000/reset-password with active session → renders the form
   - Enter new password + confirm → submit → redirect to /login?reset=1
   - Log in with new password → success
3. Test failure paths:
   - Open /reset-password directly (without recovery session) → shows error state with CTA «Восстановить пароль»
   - Click recovery link, then click it AGAIN (already consumed) → /reset-password shows error state
   - Submit /forgot-password 4 times for same email → 4th rejected with rate-limit error
4. `npm run test:integration -- tests/integration/auth/recovery.test.ts` (Docker required)
</verification>

<success_criteria>
- AUTH-06 satisfied: full recovery flow works end-to-end; one-time token expires when consumed; Supabase 1-hour TTL is the default (NOT changed)
- AUTH-09 (site 2): SmartCaptcha on /forgot-password
- AUTH-10 (forgot bucket): 3/hr/email rate-limit on auth.forgot_password
- OWASP: /forgot-password success message identical regardless of whether email exists
- Audit log: auth.password_reset_requested + auth.password_reset_completed entries
</success_criteria>

<out_of_scope>
- Captcha on /reset-password — the one-time recovery token IS the gate; captcha there would double-friction with no security benefit
- Forced password rotation policy — not in P2
- Detection of "leaked passwords" via Have I Been Pwned API — M2+ if at all
- Two-factor 2FA — out of M1 (PROJECT.md Out of Scope OAuth)
- Account lockout after N failed forgot-password attempts (beyond rate-limit) — covered by rate-limit
</out_of_scope>

<references>
- UI-SPEC.md §4.5 (forgot-password layout + OWASP success message), §4.6 (reset-password layout + invalid-token state)
- RESEARCH.md §Pattern 4 (Zod schemas — forgotPasswordSchema + resetPasswordSchema, lines 514-526)
- RESEARCH.md §Open Q #3 (login captcha vs rate-limit decision — confirms captcha only on register + forgot)
- REQUIREMENTS.md AUTH-06, AUTH-09, AUTH-10
- security/SKILL.md §3 (rate limits per endpoint table)
</references>

<output>
Create `.planning/phases/2-auth-marketing-consent/plans/2-09-SUMMARY.md` when done documenting:
- forgotPasswordSchema + resetPasswordSchema added; forgotPasswordAction + resetPasswordAction added
- /forgot-password page + form with captcha
- /reset-password page (SC gates on session) + form
- Integration test for full recovery flow (8 cases) — Docker-deferred runtime
- Audit: auth.password_reset_requested, auth.password_reset_completed
- Confirmed: 1-hour Supabase token TTL (default, untouched), one-time consumption (verifyOtp built-in)
- OWASP-style neutral success on /forgot-password
- Deferred: 2FA, password rotation policy, leaked-password check (all M2+)
</output>
