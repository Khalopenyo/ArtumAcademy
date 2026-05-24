---
plan: 08-login-logout-middleware-authgate
phase: 2
wave: 4
type: execute
maps_to: [AUTH-05, AUTH-07, AUTH-08, AUTH-10]
depends_on: [01-shadcn-and-design-system, 06-rate-limit-and-captcha-infra, 07-register-consent-email-confirm]
autonomous: true
mode: mvp
estimated_tasks: 3
files_modified:
  - src/lib/schemas/auth.ts
  - src/server/actions/auth.ts
  - src/server/actions/auth.test.ts
  - src/components/auth/LogoutButton.tsx
  - src/app/(marketing)/login/page.tsx
  - src/app/(marketing)/login/components/LoginForm.tsx
  - src/app/(app)/layout.tsx
  - tests/integration/auth/login.test.ts
  - tests/integration/auth/logout.test.ts
  - tests/e2e/auth-login.spec.ts
  - tests/e2e/auth-gate.spec.ts
requirements: [AUTH-05, AUTH-07, AUTH-08, AUTH-10]
must_haves:
  truths:
    - "POST loginAction with valid credentials → session cookie set → returns ok=true; client redirects to ?next= or /dashboard"
    - "POST loginAction with invalid credentials → returns generic «Неверный email или пароль» (no user-existence leak)"
    - "POST loginAction over rate-limit (5 attempts / 15 min / IP+email) → returns ok=false 429-equivalent"
    - "POST loginAction with unverified email → returns specific error allowing resend"
    - "POST logoutAction calls supabase.auth.signOut({ scope: 'global' }) → refresh tokens revoked"
    - "(app)/layout.tsx with no user → redirect('/login?next=<encoded current path>')"
    - "(app)/layout.tsx with authenticated user → render {children}"
    - "/login page renders LoginForm wrapped in <Suspense> to satisfy Pitfall #20 mitigation (useSearchParams)"
    - "Session persists across browser close — relies on Supabase default 30d refresh + cookie (NOT touched)"
    - "Audit log entries: auth.login_success, auth.login_failed, auth.logout"
  artifacts:
    - path: src/lib/schemas/auth.ts (extended)
      provides: "loginSchema added; passwordSchema reused from plan-07"
    - path: src/server/actions/auth.ts (extended)
      provides: "loginAction, logoutAction added"
    - path: src/components/auth/LogoutButton.tsx
      provides: "Client Component button that calls logoutAction + redirects to /"
    - path: src/app/(marketing)/login/page.tsx
      provides: "GET /login — SC shell with <Suspense fallback={<Skeleton/>}> wrapping LoginForm (Pitfall #20)"
    - path: src/app/(marketing)/login/components/LoginForm.tsx
      provides: "Client Component — reads ?next= via useSearchParams (safely under Suspense), submits to loginAction, redirects on success"
    - path: src/app/(app)/layout.tsx (extended from plan-01 stub)
      provides: "Real auth gate: requireUser() → redirect('/login?next=<path>') if no user; renders {children} for authed users"
  key_links:
    - from: src/app/(app)/layout.tsx
      to: src/lib/supabase/server.ts + next/navigation redirect
      via: createServerSupabase().auth.getUser()
      pattern: "auth\\.getUser|redirect.*login"
    - from: src/app/(marketing)/login/components/LoginForm.tsx
      to: useSearchParams (next/navigation)
      via: useSearchParams() inside <Suspense> boundary
      pattern: "useSearchParams"
    - from: src/server/actions/auth.ts (logoutAction)
      to: supabase.auth.signOut({ scope: 'global' })
      via: scope=global parameter (Pitfall #18)
      pattern: "scope.*global"
---

<objective>
Ship the login + logout + auth-gate slice. After this plan, a registered user can log in, hit `/dashboard` (still empty until plan-10), get redirected to `/login?next=/dashboard` if they log out and try to come back, and log in successfully to return where they came from.

Purpose: AUTH-05 + AUTH-07 + AUTH-08 + the login half of AUTH-10. The login flow is simpler than register (no captcha per AUTH-09 — rate-limit suffices) but the `(app)/layout.tsx` auth gate is the security-critical piece protecting every page in `/dashboard/*` (including plan-10's empty state and later P3-P6 dashboards).

**Pitfall #20 mitigation is HARDWIRED here** — `/login?next=/dashboard&registered=1&error=...` reads multiple search params via `useSearchParams()` from a Client Component nested in a Suspense boundary.

Output:
- `loginSchema` added to `src/lib/schemas/auth.ts`
- `loginAction` + `logoutAction` added to `src/server/actions/auth.ts`
- `LogoutButton` Client Component (used by plan-10's AppHeader)
- `/login` page (Server Component) + `LoginForm` (Client Component with `useSearchParams`)
- `(app)/layout.tsx` upgraded from plan-01 stub to real auth gate
- 2 integration tests (login flow + logout invalidation)
- 2 Playwright E2E specs (auth-login + auth-gate)
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
@.claude/skills/api-conventions/SKILL.md
@.claude/skills/security/SKILL.md
@src/lib/schemas/auth.ts
@src/server/actions/auth.ts
@src/lib/auth/require.ts
@src/middleware.ts
@src/lib/supabase/server.ts
</context>

<interfaces>
From plan-07 (extends what plan-08 extends further):
```typescript
// src/lib/schemas/auth.ts — already exports passwordSchema, emailSchema, registerSchema, RegisterInput
// src/server/actions/auth.ts — already exports registerAction, resendConfirmationAction, hashEmail (private)
// Plan-08 ADDS loginSchema + loginAction + logoutAction; does NOT modify register pieces.
```

From plan-06:
```typescript
// rateLimit() helper available
// captcha verify NOT used in login per AUTH-09 spec (rate-limit handles brute force)
```

From P1:
```typescript
// src/lib/auth/require.ts — requireUser() throws UnauthorizedError if no user; reusable in (app)/layout.tsx
// src/lib/supabase/middleware.ts — updateSession() refreshes cookies on every request (already wired in src/middleware.ts)
// src/middleware.ts — P2 DOES NOT MODIFY per Pitfall #22
```

From @supabase/supabase-js:
```typescript
supabase.auth.signInWithPassword({ email, password }):
  Promise<{ data: { user, session }, error: AuthError | null }>;
// Sets sb-* cookies via SSR cookie bridge.

supabase.auth.signOut({ scope: 'global' }):
  Promise<{ error: AuthError | null }>;
// Invalidates refresh tokens on ALL devices (Pitfall #18 mitigation).
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: loginSchema + loginAction + logoutAction + unit tests</name>
  <files>src/lib/schemas/auth.ts, src/server/actions/auth.ts, src/server/actions/auth.test.ts</files>
  <behavior>
    - loginSchema: email (zod), password (z.string().min(1, 'Введите пароль')) — no captcha per AUTH-09
    - loginAction valid: rate-limit ok + signInWithPassword ok → returns ok=true, userId
    - loginAction rate-limited: returns ok=false with «Слишком много попыток...» message; key='ip:email' composite
    - loginAction invalid credentials: returns generic «Неверный email или пароль» (no leak)
    - loginAction unverified email: signInWithPassword returns specific error code/message → loginAction returns ok=false with specific «Подтвердите email...» error AND a field hint enabling the UI to offer «Отправить заново»
    - logoutAction: calls signOut({ scope: 'global' }) → returns ok=true; auditLog entry
    - All paths auditLog: auth.login_success or auth.login_failed; auth.logout
  </behavior>
  <action>
1. **Extend `src/lib/schemas/auth.ts`** — APPEND (do NOT replace existing exports):
```typescript
// ... existing exports (passwordSchema, emailSchema, registerSchema, RegisterInput)

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Введите пароль'),
  // No captcha on login per AUTH-09 — rate-limit catches brute force; captcha only on /register + /forgot-password
});

export type LoginInput = z.infer<typeof loginSchema>;
```

2. **Extend `src/server/actions/auth.ts`** — APPEND (do NOT modify registerAction). Per RESEARCH §Pattern 2 conventions:
```typescript
// ... existing imports already include rateLimit, verifyCaptcha (unused here), getClientIp, auditLog, logger, createServerSupabase, etc.

import { loginSchema, type LoginInput } from '@/lib/schemas/auth';
import { redirect } from 'next/navigation';

type LoginResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; field?: 'email' | 'password'; needsConfirm?: boolean };

export async function loginAction(input: unknown): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]!.message };
  }
  const { email, password } = parsed.data;
  const ip = getClientIp();

  // Rate-limit BEFORE password attempt (Pitfall: don't help attackers learn timing)
  // Per AUTH-10: 5 attempts / 15 min / IP+email composite
  const rl = await rateLimit({
    key: `${ip ?? 'unknown'}:${email}`,
    action: 'auth.login',
    windowSec: 900,
    maxAttempts: 5,
  });
  if (!rl.ok) {
    await auditLog({ action: 'auth.login_failed', meta: { reason: 'rate_limited', email_hash: hashEmail(email) } });
    return { ok: false, error: 'Слишком много попыток. Попробуйте через 15 минут.' };
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    logger.warn({ err: error.message, code: error.code, email_hash: hashEmail(email) }, 'login failed');

    // Detect unverified email — Supabase returns code 'email_not_confirmed' (current docs)
    if (error.code === 'email_not_confirmed' || error.message.includes('Email not confirmed')) {
      await auditLog({ action: 'auth.login_failed', meta: { reason: 'email_not_confirmed', email_hash: hashEmail(email) } });
      return {
        ok: false,
        error: 'Подтвердите email — мы отправили ссылку при регистрации.',
        needsConfirm: true,
      };
    }

    await auditLog({ action: 'auth.login_failed', meta: { reason: 'invalid_credentials', email_hash: hashEmail(email) } });
    // Generic message — do NOT leak whether email exists (security/SKILL.md §3 + UI-SPEC §4.4)
    return { ok: false, error: 'Неверный email или пароль' };
  }

  const userId = data.user?.id;
  if (!userId) {
    logger.error({ email_hash: hashEmail(email) }, 'login: signIn returned no user');
    return { ok: false, error: 'Ошибка авторизации. Попробуйте ещё раз.' };
  }

  await auditLog({
    userId,
    action: 'auth.login_success',
    entityType: 'user',
    entityId: userId,
    meta: { email_hash: hashEmail(email) },
  });

  return { ok: true, userId };
}

type LogoutResult = { ok: true } | { ok: false; error: string };

export async function logoutAction(): Promise<LogoutResult> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) {
    logger.error({ err: error.message, userId: user?.id }, 'logout failed');
    return { ok: false, error: 'Не удалось выйти. Попробуйте ещё раз.' };
  }

  if (user) {
    await auditLog({
      userId: user.id,
      action: 'auth.logout',
      entityType: 'user',
      entityId: user.id,
    });
  }

  return { ok: true };
}
```

3. **Extend `src/server/actions/auth.test.ts`** — APPEND test cases for the 6 paths in `<behavior>`. Mock the same external deps as plan-07's test setup.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run test:ci -- src/lib/schemas/auth src/server/actions/auth && grep -q "loginSchema" src/lib/schemas/auth.ts && grep -q "loginAction" src/server/actions/auth.ts && grep -q "logoutAction" src/server/actions/auth.ts && grep -q "scope: 'global'" src/server/actions/auth.ts</automated>
  </verify>
  <done>schemas/auth.ts has loginSchema + LoginInput; server/actions/auth.ts has loginAction + logoutAction with proper rate-limit + audit; signOut uses scope:'global' (Pitfall #18); unit tests cover all 6 paths; lint + typecheck clean.</done>
</task>

<task type="auto">
  <name>Task 2: /login page (Suspense-safe) + LoginForm (CC) + LogoutButton + (app)/layout.tsx auth gate</name>
  <files>src/app/(marketing)/login/page.tsx, src/app/(marketing)/login/components/LoginForm.tsx, src/components/auth/LogoutButton.tsx, src/app/(app)/layout.tsx</files>
  <action>
1. **`src/app/(marketing)/login/page.tsx`** — Server Component. Wraps form in `<Suspense>` (Pitfall #20 mitigation — LoginForm reads `?next=`, `?registered=1`, `?error=...`):
```tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoginForm } from './components/LoginForm';

export const metadata: Metadata = {
  title: 'Войти',
  description: 'Войдите в личный кабинет VideoEdit Academy',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="container mx-auto max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle>Войти</CardTitle>
          <CardDescription>Введите email и пароль</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-56 w-full" />}>
            <LoginForm />
          </Suspense>
        </CardContent>
        <CardFooter className="flex justify-between text-sm">
          <span className="text-muted-foreground">Нет аккаунта?</span>
          <Link href="/register" className="font-medium underline-offset-4 hover:underline">Регистрация</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
```

2. **`src/app/(marketing)/login/components/LoginForm.tsx`** — Client Component. Per UI-SPEC §4.4 + RESEARCH §Pattern 9 (lines 771-798). Reads `?next`, `?registered=1`, `?error=...` query params:
```tsx
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { Loader2, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

import { loginSchema, type LoginInput } from '@/lib/schemas/auth';
import { loginAction, resendConfirmationAction } from '@/server/actions/auth';

function safeNextPath(raw: string | null): string {
  // Open-redirect safety per security/SKILL.md §3
  if (!raw) return '/dashboard';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const next = safeNextPath(params.get('next'));
  const errorParam = params.get('error');

  // Initialise from URL once — useEffect below will fire ONCE on mount (not every render).
  // Using a useRef-guarded effect would also work; the useState pattern is cleaner because
  // it auto-resets when the param goes away (StrictMode double-invoke handled by the ref).
  const [showRegisteredToast, setShowRegisteredToast] = useState(
    params.get('registered') === '1',
  );

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  // Show success banner ONCE if just registered (not on every re-render). Toast id keeps
  // sonner from stacking duplicates if React strict-mode double-invokes the effect.
  const firedRef = useRef(false);
  useEffect(() => {
    if (showRegisteredToast && !firedRef.current) {
      firedRef.current = true;
      toast.success('Письмо отправлено. Подтвердите email и войдите.', { id: 'registered-toast' });
      setShowRegisteredToast(false);
    }
  }, [showRegisteredToast]);

  const onSubmit = (values: LoginInput) => {
    startTransition(async () => {
      const result = await loginAction(values);
      if (!result.ok) {
        toast.error(result.error);
        if (result.needsConfirm) setNeedsConfirm(true);
        return;
      }
      router.push(next);
      router.refresh();
    });
  };

  const handleResend = async () => {
    const email = form.getValues('email');
    const result = await resendConfirmationAction(email);
    if (result.ok) toast.success('Письмо отправлено. Проверьте почту.');
    else toast.error(result.error);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {errorParam === 'expired_link' && (
          <Alert variant="destructive">
            <AlertDescription>Ссылка подтверждения истекла. Запросите новую при входе.</AlertDescription>
          </Alert>
        )}
        {errorParam === 'invalid_link' && (
          <Alert variant="destructive">
            <AlertDescription>Ссылка некорректна. Попробуйте войти заново.</AlertDescription>
          </Alert>
        )}
        {needsConfirm && (
          <Alert>
            <AlertDescription>
              Подтвердите email — мы отправили ссылку при регистрации.{' '}
              <button type="button" onClick={handleResend} className="font-medium underline">
                Отправить заново
              </button>
            </AlertDescription>
          </Alert>
        )}

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

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Пароль</FormLabel>
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                  Забыли пароль?
                </Link>
              </div>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...field}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={pending} className="w-full" aria-busy={pending}>
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {pending ? 'Входим…' : 'Войти'}
        </Button>
      </form>
    </Form>
  );
}
```

3. **`src/components/auth/LogoutButton.tsx`** — used by plan-10's AppHeader (and the bare auth-gate UX while plan-10 is unmerged):
```tsx
'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/server/actions/auth';
import { toast } from 'sonner';

interface LogoutButtonProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function LogoutButton({ variant = 'ghost', size = 'sm', className }: LogoutButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handle = () => {
    startTransition(async () => {
      const r = await logoutAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      router.push('/');
      router.refresh();
    });
  };

  return (
    <Button variant={variant} size={size} onClick={handle} disabled={pending} className={className}>
      <LogOut className="size-4" />
      <span className="ml-2 hidden sm:inline">Выйти</span>
    </Button>
  );
}
```

4. **`src/app/(app)/layout.tsx`** — UPGRADE from plan-01 stub to real auth gate. Per UI-SPEC §3.1 + RESEARCH §Pattern 8 (lines 753-769) + security/SKILL.md §2:
```tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Capture current path so we can return after login.
    // Next.js doesn't reliably expose the original path in headers().
    // Pragmatic approach: use referer if present, fallback to dashboard root.
    // (Strictly correct in P2 — the auth gate is the FIRST chance to capture, and most users
    //  hit /dashboard as the explicit target.)
    const refOrPath = headers().get('referer');
    let next = '/dashboard';
    if (refOrPath) {
      try {
        const url = new URL(refOrPath);
        if (url.pathname.startsWith('/')) next = url.pathname;
      } catch { /* keep /dashboard */ }
    }
    redirect(`/login?next=${encodeURIComponent(next)}`);
    // `redirect()` from next/navigation throws — TypeScript control-flow analysis
    // does NOT know this, so without an explicit `return null` the layout would
    // continue to the JSX below and tsc complains about Promise<ReactNode | null>
    // being assignable to ReactNode. Returning null here satisfies the strict-mode
    // ReactNode contract while never actually executing (redirect already threw).
    return null;
  }

  // Email-verification banner + AppHeader will be added by plan-10.
  return <>{children}</>;
}
```

> Note on `headers().get('referer')`: this is a pragmatic capture — works for in-app navigation. For direct deep-link entry (user types `/dashboard/orders/abc` in address bar), referer is null → falls back to `/dashboard`. Acceptable in P2; plan-10 + Phase 4 may refine via cookie-stashed path if deep-link UX becomes important.

> Plan-10 will WRAP this layout with `<AppHeader>` + `<EmailVerificationBanner>`. Plan-08's contract is ONLY the gate logic.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run build && grep -q "Suspense" src/app/\\\(marketing\\\)/login/page.tsx && grep -q "useSearchParams" src/app/\\\(marketing\\\)/login/components/LoginForm.tsx && grep -q "auth\\.getUser" src/app/\\\(app\\\)/layout.tsx && grep -q "redirect.*login" src/app/\\\(app\\\)/layout.tsx</automated>
  </verify>
  <done>4 files exist; /login page wraps LoginForm in Suspense (Pitfall #20); LoginForm reads ?next=, ?registered=1, ?error=, calls loginAction, redirects via router.push(safeNext); LogoutButton calls logoutAction + redirects /; (app)/layout.tsx calls getUser + redirects with safe next param; `npm run build` succeeds (this validates the Suspense boundary).</done>
</task>

<task type="auto">
  <name>Task 3: Integration tests (login + logout) + Playwright E2E (auth-login + auth-gate)</name>
  <files>tests/integration/auth/login.test.ts, tests/integration/auth/logout.test.ts, tests/e2e/auth-login.spec.ts, tests/e2e/auth-gate.spec.ts</files>
  <action>
1. **`tests/integration/auth/login.test.ts`** — uses local Supabase + helpers. AUTH-05 + AUTH-10 verification:
   - Setup: `createTestUser('login-test')` with `email_confirm: true` (helper from P1)
   - **Test 1:** valid credentials → loginAction returns ok=true, userId matches
   - **Test 2:** invalid password → loginAction returns ok=false with generic message
   - **Test 3:** invalid email (non-existent user) → loginAction returns the SAME generic message (no enumeration)
   - **Test 4:** unverified email (create user with `email_confirm: false`) → loginAction returns ok=false with `needsConfirm=true`
   - **Test 5 (rate limit):** call loginAction 6 times in a row with wrong password from the same simulated IP+email → 6th returns rate-limit error

2. **`tests/integration/auth/logout.test.ts`** — AUTH-07 + Pitfall #18:
   - Setup: create test user + log in (mint access token via `helpers/test-users.ts createTestUser`)
   - **Test 1:** logoutAction returns ok=true
   - **Test 2 (Pitfall #18):** after logout, the same refresh token (saved before logout) refused on `supabase.auth.refreshSession` — proves `scope: 'global'` invalidated it
   - **Test 3:** audit_log has an `auth.logout` entry with the user_id

> Both integration tests require Docker; skip per P1 pattern if absent.

3. **`tests/e2e/auth-login.spec.ts`** — Playwright. AUTH-05:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Login flow (AUTH-05)', () => {
  test('user with confirmed email can log in and reaches /dashboard', async ({ page }) => {
    // Pre-condition: a confirmed test user exists. For Playwright we can either:
    //  (a) seed before the test via supabase admin API, OR
    //  (b) skip if no test user fixture available (document deferred)
    // For P2 we DOCUMENT the test as requiring a fixture; CI will own seeding.
    // ...
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel('Пароль').fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole('button', { name: /^войти$/i }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login preserves ?next= query param', async ({ page }) => {
    await page.goto('/login?next=/dashboard/orders');
    await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel('Пароль').fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole('button', { name: /^войти$/i }).click();
    await page.waitForURL(/\/dashboard\/orders/);
  });

  test('invalid credentials show generic error (no enumeration)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByLabel('Пароль').fill('wrong-password-123');
    await page.getByRole('button', { name: /^войти$/i }).click();
    await expect(page.getByText(/неверный email или пароль/i)).toBeVisible();
  });
});
```

4. **`tests/e2e/auth-gate.spec.ts`** — AUTH-08:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Auth gate (AUTH-08)', () => {
  test('anonymous user hitting /dashboard is redirected to /login?next=...', async ({ page }) => {
    const res = await page.goto('/dashboard');
    // After redirect, URL must contain /login + next param
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/next=/);
  });

  test('/login renders without «Missing Suspense» error (Pitfall #20)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/login?next=/dashboard');
    await expect(page.getByRole('heading', { name: /войти/i })).toBeVisible();
    expect(errors.filter((e) => /suspense/i.test(e))).toHaveLength(0);
  });
});
```

If E2E user fixtures (E2E_USER_EMAIL/PASSWORD) aren't set, the first two login tests skip — document in SUMMARY.
  </action>
  <verify>
    <automated>npm run lint && ls tests/integration/auth/login.test.ts tests/integration/auth/logout.test.ts tests/e2e/auth-login.spec.ts tests/e2e/auth-gate.spec.ts</automated>
  </verify>
  <done>4 test files exist with the cases described; lint clean; runtime execution deferred per Docker / E2E-fixture availability (P1 pattern).</done>
</task>

</tasks>

<verification>
After all 3 tasks:
1. `npm run lint && npm run typecheck && npm run test:ci && npm run build` — must pass (`npm run build` is the CRITICAL gate that catches Pitfall #20 at compile time)
2. With Supabase + at least one confirmed test user:
   - `npm run dev`, open http://localhost:3000/login
   - Fill confirmed-user credentials → submit → redirect to /dashboard
   - From /dashboard, click logout (no UI yet — plan-10 ships AppHeader; test via DevTools console: `fetch('/api/...').then(...)` won't work; instead navigate to /login URL manually after triggering logout via the registered form's action — or wait for plan-10 to add the button visually)
3. Test the gate: go to http://localhost:3000/dashboard (anon) → should redirect to /login?next=/dashboard
4. Test Pitfall #20 specifically: visit http://localhost:3000/login?next=/dashboard&registered=1 with throttled network — page should NOT go blank; form renders within ≤ 1s
5. `npm run test:e2e -- tests/e2e/auth-login.spec.ts tests/e2e/auth-gate.spec.ts` (Playwright + E2E fixtures required)
</verification>

<success_criteria>
- AUTH-05: confirmed user logs in; session cookie set; survives browser reload (default Supabase 30d refresh — UNCHANGED per Pitfall #18)
- AUTH-07: logout calls signOut({ scope: 'global' }) — invalidates refresh tokens globally
- AUTH-08: anon → /dashboard returns to /login?next=/dashboard; auth gate runs in (app)/layout.tsx
- AUTH-10 (login half): 5/15min/IP+email composite rate-limit on login
- Pitfall #18 mitigation: signOut scope=global, default Auth TTLs left alone
- Pitfall #20 mitigation: /login page wraps LoginForm in Suspense — `npm run build` validates
- Pitfall #22 mitigation: src/middleware.ts UNTOUCHED
- All paths audited (login_success, login_failed, logout)
</success_criteria>

<out_of_scope>
- AppHeader with email + logout button — plan-10
- EmailVerificationBanner — plan-10
- Forgot password — plan-09
- /reset-password — plan-09
- CAPTCHA on login — explicitly out per AUTH-09 (rate-limit suffices)
- Session timeout warning UI — M2
- "Remember me" toggle — Supabase always uses long-lived refresh token in P2
- Profile editing — Phase 6
- Detection of admin/curator roles → routing — not in P2 (Phase 6 ADMIN-01)
- **Deep-link `next` capture from direct URL entry: DEFERRED.** P2 captures referer-based next for in-app navigation (e.g., user clicks dashboard link from /login footer); direct URL entry (typing /dashboard/orders/abc in address bar) falls back to /dashboard since `headers().get('referer')` returns null. Full deep-link capture via middleware-cookie pattern deferred to P3 or P6 alongside dashboard polish. Plan-08 SUMMARY must call this out so future devs do not assume deep-link round-trip works.
</out_of_scope>

<references>
- UI-SPEC.md §4.4 (login screen), §3.1 (route group layout split)
- RESEARCH.md §Pattern 8 (auth gate, lines 753-769), §Pattern 9 (login form + Suspense, lines 771-798)
- RESEARCH.md §Pitfall #18 (JWT TTL — leave alone), §Pitfall #20 (Suspense), §Pitfall #22 (middleware bloat — don't touch)
- REQUIREMENTS.md AUTH-05, AUTH-07, AUTH-08, AUTH-10
- security/SKILL.md §2 (Auth + middleware + helpers), §3 (Open Redirect)
- api-conventions/SKILL.md §Server Actions discriminated union
</references>

<output>
Create `.planning/phases/2-auth-marketing-consent/plans/2-08-SUMMARY.md` when done documenting:
- loginSchema added; loginAction + logoutAction added
- /login page (SC w/Suspense) + LoginForm (CC) + LogoutButton
- (app)/layout.tsx upgraded from stub to real auth gate
- 2 integration tests + 2 Playwright E2E specs
- Audit log entries: auth.login_success, auth.login_failed, auth.logout
- Confirms: src/middleware.ts UNTOUCHED (Pitfall #22)
- **Audit forensics note (call out explicitly in SUMMARY):** failed-login `audit_log` rows are written with `user_id IS NULL` (because the user does not authenticate, we have no user UUID to attach). Forensic queries that group failed logins by victim email must filter on `meta->>'email_hash'` (a 12-char SHA-256 prefix written by `hashEmail()`), NOT on `user_id`. No code change needed — this is a documentation/runbook reminder for future incident response.
- Deferred: AppHeader chrome (plan-10), EmailVerificationBanner (plan-10), forgot/reset (plan-09)
- Deferred: deep-link `next` capture from direct URL entry (see `<out_of_scope>` — referer-only capture in P2)
</output>
