---
plan: 10-dashboard-empty-and-verify-banner
phase: 2
wave: 5
type: execute
maps_to: []
depends_on: [01-shadcn-and-design-system, 07-register-consent-email-confirm, 08-login-logout-middleware-authgate]
autonomous: true
mode: mvp
estimated_tasks: 3
files_modified:
  - src/components/shared/AppHeader.tsx
  - src/components/shared/EmailVerificationBanner.tsx
  - src/app/(app)/layout.tsx
  - src/app/(app)/dashboard/page.tsx
  - tests/e2e/dashboard-empty.spec.ts
requirements: []
must_haves:
  truths:
    - "Authenticated user visiting /dashboard sees: AppHeader (logo + email + logout) + EmailVerificationBanner (only if email_confirmed_at IS NULL) + greeting H1 + empty-state message + CTA «Каталог» to /"
    - "User with email_confirmed_at IS NULL sees the banner above content; clicking «Отправить заново» calls resendConfirmationAction → toast feedback"
    - "User with verified email DOES NOT see the banner"
    - "Logout from AppHeader works → redirect to / + session cleared (already tested in plan-08)"
    - "E2E smoke: confirmed user navigates /dashboard → sees empty state; opens menu → clicks logout → lands on /"
    - "Page does NOT render real courses list (Pitfall #24 — that's DASH-01 in P4)"
  artifacts:
    - path: src/components/shared/AppHeader.tsx
      provides: "Authenticated chrome: logo + (truncated) email + LogoutButton; respects mobile (hamburger menu)"
    - path: src/components/shared/EmailVerificationBanner.tsx
      provides: "Soft-destructive horizontal banner with resend CTA; shown only if !user.email_confirmed_at"
    - path: src/app/(app)/layout.tsx (extended from plan-08)
      provides: "Now renders AppHeader + EmailVerificationBanner + minimal Footer wrapper around {children}"
    - path: src/app/(app)/dashboard/page.tsx
      provides: "Empty-state for /dashboard: greeting + empty body + CTA to /"
  key_links:
    - from: src/components/shared/EmailVerificationBanner.tsx
      to: src/server/actions/auth.ts (resendConfirmationAction from plan-07)
      via: import + useTransition
      pattern: "resendConfirmationAction"
    - from: src/components/shared/AppHeader.tsx
      to: src/components/auth/LogoutButton.tsx (plan-08)
      via: import
      pattern: "LogoutButton"
    - from: src/app/(app)/dashboard/page.tsx
      to: createServerSupabase().auth.getUser()
      via: SC — reads user for greeting
      pattern: "auth\\.getUser"
---

<objective>
Close out Phase 2 with the final user-facing polish: an authenticated dashboard shell that proves the auth gate works, displays a greeting, and tells the user they don't own courses yet. Email-verification banner shown when applicable. Critically, this plan DOES NOT pre-build the courses list — that's DASH-01 in P4 (Pitfall #24 — over-build prevention).

Purpose: Closes the loop. After plan-07 (register) → plan-08 (login) → plan-09 (recovery) → plan-10 (dashboard), the user can complete the full P2 flow end-to-end and SEE something meaningful at the end: a greeting, an empty state, and a path back to the catalog.

Output:
- `AppHeader` (Client Component — logout button needs `useTransition`)
- `EmailVerificationBanner` (Client Component — calls resendConfirmationAction)
- `(app)/layout.tsx` extended to render AppHeader + EmailVerificationBanner + minimal Footer
- `(app)/dashboard/page.tsx` with greeting + empty state + CTA
- Playwright E2E for the empty dashboard
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
@.claude/skills/ui-conventions/SKILL.md
@src/components/shared/Logo.tsx
@src/components/auth/LogoutButton.tsx
@src/components/marketing/Footer.tsx
@src/server/actions/auth.ts
@src/app/(app)/layout.tsx
</context>

<interfaces>
From plan-01:
```typescript
// src/components/shared/Logo.tsx — wordmark Server Component
// src/components/marketing/Footer.tsx — full footer; we'll reuse the minimal version inside (app) layout
```

From plan-07:
```typescript
// src/server/actions/auth.ts — resendConfirmationAction(email) returns { ok: true } | { ok: false; error }
// Rate-limited 1/min/email (plan-07 built this).
```

From plan-08:
```typescript
// src/components/auth/LogoutButton.tsx — Client Component button
// src/app/(app)/layout.tsx — currently does the auth gate; plan-10 EXTENDS it to ALSO render chrome
```

From @supabase/supabase-js:
```typescript
// user.email_confirmed_at: string | null  — present when confirmed; null when not
// user.email: string
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: AppHeader + EmailVerificationBanner components</name>
  <files>src/components/shared/AppHeader.tsx, src/components/shared/EmailVerificationBanner.tsx</files>
  <action>
1. **`src/components/shared/AppHeader.tsx`** — Client Component (because mobile dropdown menu + LogoutButton are interactive). Per UI-SPEC §3.2 «App Header»:
```tsx
'use client';

import { Logo } from '@/components/shared/Logo';
import { LogoutButton } from '@/components/auth/LogoutButton';

interface AppHeaderProps {
  userEmail: string;
}

export function AppHeader({ userEmail }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <nav className="container mx-auto flex h-14 items-center justify-between md:h-16">
        <Logo />
        <div className="flex items-center gap-2">
          <span
            className="hidden text-sm text-muted-foreground sm:inline-block max-w-[180px] truncate"
            title={userEmail}
          >
            {userEmail}
          </span>
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}
```
- Email is truncated on mobile (`hidden` below `sm`) per UI-SPEC §3.2 «App Header»
- `title` attr ensures full email accessible on hover
- LogoutButton already handles its own toast + redirect

2. **`src/components/shared/EmailVerificationBanner.tsx`** — Client Component (resend button needs `useTransition`). Per UI-SPEC §4.11:
```tsx
'use client';

import { useTransition } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { resendConfirmationAction } from '@/server/actions/auth';

interface EmailVerificationBannerProps {
  email: string;
}

export function EmailVerificationBanner({ email }: EmailVerificationBannerProps) {
  const [pending, startTransition] = useTransition();

  const handleResend = () => {
    startTransition(async () => {
      const r = await resendConfirmationAction(email);
      if (r.ok) {
        toast.success('Письмо отправлено. Проверьте почту.');
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <div
      role="alert"
      className="border-l-4 border-destructive bg-destructive/10 text-destructive-foreground"
    >
      <div className="container mx-auto flex items-start justify-between gap-3 py-3 px-4 md:px-6">
        <div className="flex items-start gap-2 text-sm">
          <AlertCircle className="size-4 shrink-0 mt-0.5 text-destructive" aria-hidden="true" />
          <div className="text-foreground">
            <strong>Подтвердите email для покупки курса.</strong>{' '}
            Мы отправили ссылку на <span className="font-mono text-xs">{email}</span>.
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResend}
          disabled={pending}
          aria-busy={pending}
          className="shrink-0"
        >
          {pending ? 'Отправляем…' : 'Отправить заново'}
        </Button>
      </div>
    </div>
  );
}
```
Per UI-SPEC §4.11 styling: «`bg-destructive/10 border-l-4 border-destructive` — soft destructive (не bright red, иначе слишком агрессивно)». Banner NOT dismissable in P2 — we want to keep nagging until email confirmed.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && grep -q "'use client'" src/components/shared/AppHeader.tsx && grep -q "'use client'" src/components/shared/EmailVerificationBanner.tsx && grep -q "resendConfirmationAction" src/components/shared/EmailVerificationBanner.tsx && grep -q "LogoutButton" src/components/shared/AppHeader.tsx</automated>
  </verify>
  <done>Both CC files exist; AppHeader has Logo + truncated email + LogoutButton; EmailVerificationBanner uses Alert-style soft-destructive, has resend button calling resendConfirmationAction; lint + typecheck clean.</done>
</task>

<task type="auto">
  <name>Task 2: (app)/layout.tsx full chrome + (app)/dashboard/page.tsx empty state</name>
  <files>src/app/(app)/layout.tsx, src/app/(app)/dashboard/page.tsx</files>
  <action>
1. **EXTEND `src/app/(app)/layout.tsx`** — plan-08 added the gate; plan-10 wraps it with chrome. After the auth gate (which calls `redirect()` and returns `never` if no user), we have a confirmed `user` object. Pass it to AppHeader + EmailVerificationBanner:
```tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { AppHeader } from '@/components/shared/AppHeader';
import { EmailVerificationBanner } from '@/components/shared/EmailVerificationBanner';
import { Footer } from '@/components/marketing/Footer';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const refOrPath = headers().get('referer');
    let next = '/dashboard';
    if (refOrPath) {
      try {
        const url = new URL(refOrPath);
        if (url.pathname.startsWith('/')) next = url.pathname;
      } catch { /* fallback */ }
    }
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const emailConfirmed = !!user.email_confirmed_at;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader userEmail={user.email ?? ''} />
      {!emailConfirmed && user.email && <EmailVerificationBanner email={user.email} />}
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
```

> Note: We reuse the marketing `Footer` component for the (app) zone to keep legal links + copyright accessible everywhere. UI-SPEC §3.1 originally proposed a separate "minimal footer" — we standardize on the full Footer because plan-10's reuse is simpler and the rendered output is identical to marketing pages (no separate component drift risk).

2. **`src/app/(app)/dashboard/page.tsx`** — empty-state for P2. Per UI-SPEC §4.10:
```tsx
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata = {
  title: 'Личный кабинет',
  description: 'Ваши курсы и прогресс обучения',
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  // user is guaranteed by (app)/layout.tsx auth gate; defensive `?? ''` for greeting

  // Greeting derivation per UI-SPEC §4.10: `email.split('@')[0]` fallback when no display_name (P6)
  const greetingName = (user?.email ?? '').split('@')[0] || 'друг';

  return (
    <div className="container mx-auto max-w-2xl py-16 md:py-24">
      <div className="flex flex-col items-center text-center">
        <BookOpen className="size-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight md:text-3xl">
          Привет, {greetingName}!
        </h1>
        <p className="mt-2 text-muted-foreground">У вас пока нет купленных курсов.</p>
        <Button asChild className="mt-6">
          <Link href="/">Каталог</Link>
        </Button>
      </div>
    </div>
  );
}
```

> Important per Pitfall #24: do NOT render a list of "my courses" here. That's DASH-01 in P4. P2's contract is: empty-state + CTA only.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run build && grep -q "AppHeader" src/app/\\\(app\\\)/layout.tsx && grep -q "EmailVerificationBanner" src/app/\\\(app\\\)/layout.tsx && grep -q "У вас пока нет купленных курсов" src/app/\\\(app\\\)/dashboard/page.tsx && grep -q "BookOpen" src/app/\\\(app\\\)/dashboard/page.tsx</automated>
  </verify>
  <done>(app)/layout.tsx renders AppHeader + EmailVerificationBanner (conditional) + Footer + content; dashboard/page.tsx renders empty state with greeting derived from user.email; no courses list; `npm run build` succeeds.</done>
</task>

<task type="auto">
  <name>Task 3: Playwright E2E for empty dashboard + email-verification banner conditional rendering</name>
  <files>tests/e2e/dashboard-empty.spec.ts</files>
  <action>
```typescript
import { test, expect } from '@playwright/test';

test.describe('Empty dashboard + verification banner (plan-10)', () => {
  // Pre-condition: E2E_USER_EMAIL + E2E_USER_PASSWORD env vars point to a CONFIRMED test user.
  // (Created by CI seed or manual setup. Same fixture as plan-08's auth-login.spec.ts.)
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel('Пароль').fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole('button', { name: /^войти$/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('confirmed user sees empty state + AppHeader + Footer + NO banner', async ({ page }) => {
    // Greeting
    await expect(page.getByRole('heading', { name: /привет/i })).toBeVisible();
    // Empty body
    await expect(page.getByText(/у вас пока нет купленных курсов/i)).toBeVisible();
    // CTA
    const catalog = page.getByRole('link', { name: /каталог/i });
    await expect(catalog).toBeVisible();
    await expect(catalog).toHaveAttribute('href', '/');
    // AppHeader has email truncated (visible on sm+) and Logout button
    await expect(page.getByText(process.env.E2E_USER_EMAIL!.slice(0, 5), { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: /выйти/i })).toBeVisible();
    // Footer present
    await expect(page.getByRole('link', { name: /политика конфиденциальности/i })).toBeVisible();
    // NO verification banner (this user is confirmed)
    await expect(page.getByText(/подтвердите email для покупки/i)).not.toBeVisible();
  });

  test('Logout from AppHeader returns to /', async ({ page }) => {
    await page.getByRole('button', { name: /выйти/i }).click();
    await page.waitForURL('/');
    // Confirm session gone — going to /dashboard now redirects to /login
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);
  });
});

// Verification banner conditional rendering — requires an UNCONFIRMED user fixture.
// Marked skipped in P2 unless the fixture is provided; manual smoke covers it.
test.skip('unconfirmed user sees verification banner with resend button', async ({ page }) => {
  // ... requires fixture: E2E_UNCONFIRMED_USER_EMAIL + E2E_UNCONFIRMED_USER_PASSWORD
});
```

Manual verification path documented in this plan's SUMMARY: solo dev's own newly-registered unconfirmed user → log in (will fail with «Подтвердите email...» from plan-08 OR succeed if Supabase Auth allows unconfirmed sign-in depending on dashboard config). If Supabase project has «email confirm required» (default), the user can't log in until confirmed — so the banner is only visible if Supabase config allows unverified sign-in, which is NOT the default. **Acceptable:** the banner code exists, is wired correctly, but won't render in practice with default Supabase config. Document this as a noted-but-acceptable property — banner becomes relevant if email is changed in profile (P6 PROF-01) and the new email is unverified.
  </action>
  <verify>
    <automated>npm run lint && ls tests/e2e/dashboard-empty.spec.ts</automated>
  </verify>
  <done>tests/e2e/dashboard-empty.spec.ts exists with 2 active cases + 1 skipped banner case; lint clean.</done>
</task>

</tasks>

<verification>
After all 3 tasks:
1. `npm run lint && npm run typecheck && npm run test:ci && npm run build` — must pass
2. Manual end-to-end (the P2 FINAL DEMO):
   - `npm run dev`, open http://localhost:3000
   - Click «Подробнее о курсе» on landing → /courses/videoedit-mvp renders
   - Click «Купить» → redirect to /register?next=...
   - Fill register form, solve captcha, tick both consents, submit
   - Toast «Письмо отправлено...» → redirect to /login?registered=1
   - Check email → click confirmation link → land on /dashboard
   - SEE: AppHeader with email + Logout button, NO banner (just confirmed), greeting «Привет, <name>!», empty body, CTA «Каталог»
   - Click «Каталог» → back to /
   - Click «Войти» from header → /login
   - Click «Забыли пароль?» → /forgot-password
   - Enter email + captcha → neutral success
   - Email arrives → click link → /reset-password renders form
   - Set new password → toast → redirect /login?reset=1
   - Log in with new password → /dashboard again
   - Click logout → returns to /
3. `npm run test:e2e -- tests/e2e/dashboard-empty.spec.ts` (requires E2E fixture)
4. Verify Pitfall #24 mitigation: open the /dashboard source — confirm NO courses list logic, just empty state + CTA
</verification>

<success_criteria>
- /dashboard renders for authed users with: AppHeader + (conditional banner) + greeting + empty body + CTA
- AppHeader shows email (truncated mobile) + LogoutButton
- EmailVerificationBanner renders ONLY when `!user.email_confirmed_at`, includes working resend button
- Pitfall #24 mitigated: no courses list logic in P2 dashboard
- Final P2 happy-path demonstrable in browser: register → confirm → login → dashboard → logout
</success_criteria>

<out_of_scope>
- Courses list rendering — DASH-01 in P4
- Orders history — DASH-03 in P4
- Profile page — PROF-01 in P6
- Account deletion — PROF-02 in P6
- Lesson progress aggregation — PROG-04 in P6
- Navigation tabs (Courses, Profile, Orders) — Phase 6 adds them
- Customizable display name (use email split) — Phase 6 PROF-01
- Push notifications / email digest — M2
</out_of_scope>

<references>
- UI-SPEC.md §4.10 (dashboard empty-state ASCII + copy), §4.11 (email-verification banner styling + behavior), §3.2 (AppHeader spec)
- RESEARCH.md §Pitfall #24 (no over-build — DO NOT prebuild dashboard list)
- REQUIREMENTS.md (plan-10 has no new REQ — it finalises UX for AUTH-04 + AUTH-08; reuses resendConfirmationAction from plan-07)
- ui-conventions/SKILL.md §Пустое состояние с действием (template)
</references>

<output>
Create `.planning/phases/2-auth-marketing-consent/plans/2-10-SUMMARY.md` when done documenting:
- AppHeader (CC) + EmailVerificationBanner (CC)
- (app)/layout.tsx full chrome (gate + AppHeader + conditional banner + Footer)
- (app)/dashboard/page.tsx empty-state (greeting + empty body + CTA)
- E2E smoke (2 active + 1 deferred)
- Final P2 manual happy-path demonstrable
- Confirmed Pitfall #24: no courses list logic
- Phase 2 — close READY: all 18 REQ-IDs delivered across 10 plans
</output>
