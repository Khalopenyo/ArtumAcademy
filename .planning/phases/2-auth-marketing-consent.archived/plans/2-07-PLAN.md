---
plan: 07-register-consent-email-confirm
phase: 2
wave: 3
type: execute
maps_to: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-09]
depends_on: [01-shadcn-and-design-system, 02-legal-pages-and-security-headers, 06-rate-limit-and-captcha-infra]
autonomous: false
mode: mvp
estimated_tasks: 3
files_modified:
  - src/lib/schemas/auth.ts
  - src/lib/schemas/auth.test.ts
  - src/server/actions/auth.ts
  - src/server/actions/auth.test.ts
  - src/components/auth/SmartCaptchaWidget.tsx
  - src/components/auth/ConsentCheckboxes.tsx
  - src/app/(marketing)/register/page.tsx
  - src/app/(marketing)/register/components/RegisterForm.tsx
  - src/app/(marketing)/register/components/RegisterForm.test.tsx
  - src/app/auth/confirm/route.ts
  - tests/integration/auth/consent.test.ts
  - tests/integration/auth/confirm.test.ts
user_setup:
  - service: yandex-smartcaptcha
    why: "AUTH-09 — captcha widget required on /register and /forgot-password"
    env_vars:
      - name: YANDEX_CAPTCHA_SERVER_KEY
        source: "Yandex Cloud console → SmartCaptcha → resource → Server Key"
      - name: NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY
        source: "Yandex Cloud console → SmartCaptcha → resource → Client Key (sitekey)"
    dashboard_config:
      - task: "Create visible-type SmartCaptcha resource; whitelist localhost (dev) + any preview domain"
        location: "https://console.cloud.yandex.ru/folders/<folder>/smartcaptcha"
requirements: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-09]
must_haves:
  truths:
    - "POST to registerAction with valid email + password (≥8 chars + ≥1 digit) + both consents true + valid captcha token → creates auth.users row + 2 user_consents rows + sends confirmation email"
    - "POST to registerAction without both consents → rejected by zod"
    - "POST to registerAction with invalid captcha → rejected with field='captcha' (UI shows under captcha widget)"
    - "POST to registerAction over rate-limit (3/hr/IP) → 429-like error from action returns ok=false with retry-after message"
    - "GET /auth/confirm?token_hash=...&type=signup&next=/dashboard → calls supabase.auth.verifyOtp → redirects to /dashboard (or safe-next)"
    - "GET /auth/confirm with invalid/missing params → redirects to /login?error=invalid_link or ?error=expired_link"
    - "/register page renders RegisterForm wrapped in Suspense (defensive — register doesn't use useSearchParams but consistent with /login)"
    - "Submit button disabled until both consents ticked + captcha solved + form valid"
    - "Audit log entries for auth.register (success) and auth.register.failed"
    - "Integration test asserts 2 user_consents rows after register with correct purpose + policy_version + ip + user_agent"
    - "Sentry captureException wraps unexpected errors in registerAction (per RESEARCH §Open Q #5)"
  artifacts:
    - path: src/lib/schemas/auth.ts
      provides: "registerSchema + passwordSchema (shared client+server) + RegisterInput type"
    - path: src/server/actions/auth.ts
      provides: "registerAction(input) + resendConfirmationAction(email) Server Actions; discriminated-union returns"
    - path: src/components/auth/SmartCaptchaWidget.tsx
      provides: "Reusable client-side widget wrapper that exposes onSuccess(token) + handles reset"
    - path: src/components/auth/ConsentCheckboxes.tsx
      provides: "2-checkbox component used in RegisterForm; renders labels with external Link icons"
    - path: src/app/(marketing)/register/page.tsx
      provides: "GET /register — Server Component shell; wraps RegisterForm in Suspense"
    - path: src/app/(marketing)/register/components/RegisterForm.tsx
      provides: "Client Component form: RHF + zodResolver + useTransition + ConsentCheckboxes + SmartCaptchaWidget"
    - path: src/app/auth/confirm/route.ts
      provides: "Route Handler that calls verifyOtp + redirects safely"
  key_links:
    - from: src/server/actions/auth.ts
      to: src/lib/rate-limit/index.ts + src/lib/captcha/verify.ts + src/lib/headers/client-ip.ts + src/lib/audit-log.ts + src/lib/supabase/admin.ts + src/lib/legal/policy-version.ts
      via: import (all server-only)
      pattern: "rateLimit\\|verifyCaptcha\\|getClientIp\\|auditLog\\|createAdminClient\\|LEGAL_POLICY_VERSION"
    - from: src/server/actions/auth.ts
      to: user_consents table
      via: createAdminClient .from('user_consents').insert([...2 rows])
      pattern: "user_consents"
    - from: src/server/actions/auth.ts
      to: Supabase Auth signUp
      via: createServerSupabase + supabase.auth.signUp({ email, password, options.emailRedirectTo })
      pattern: "auth\\.signUp"
    - from: src/app/auth/confirm/route.ts
      to: Supabase Auth verifyOtp
      via: createServerSupabase + supabase.auth.verifyOtp({ type, token_hash })
      pattern: "verifyOtp"
---

<objective>
Ship the registration end-to-end slice: user fills `/register` → submits → captcha verified server-side → supabase signup creates auth.users → 2 consent rows inserted with full evidence → confirmation email sent via Supabase default SMTP → user clicks link → `/auth/confirm` verifies + redirects → lands on `/dashboard` (empty state from plan-10).

Purpose: BIGGEST plan in P2. Five REQ-IDs in one vertical slice because separating consent from register would split the legally-required atomic transaction (Pitfall #14). Captcha widget + verify already infrastructured by plan-06; this plan WIRES them into the form. Login + forgot-password are deliberately separate plans (08, 09) — they extend `auth.ts` and `schemas/auth.ts` but don't share the consent-insertion concern.

Output:
- 2 schemas (`registerSchema`, `passwordSchema` reusable building block) + unit tests
- `registerAction` Server Action (full pipeline: validate → rate-limit → captcha → signup → consents → audit) + `resendConfirmationAction` (used by plan-10's banner)
- 2 client components: `SmartCaptchaWidget`, `ConsentCheckboxes`
- `/register` Server Component page + `RegisterForm` Client Component
- `/auth/confirm` Route Handler
- 1 component test (RegisterForm), 2 integration tests (consent + confirm)
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
@.claude/skills/ui-conventions/SKILL.md
@.claude/skills/security/SKILL.md
@.claude/skills/testing/SKILL.md
@src/lib/legal/policy-version.ts
@src/lib/audit-log.ts
@src/lib/logger.ts
</context>

<interfaces>
From plan-06 (Wave 1 — MUST be merged before plan-07 starts):
```typescript
// src/lib/rate-limit/index.ts
export async function rateLimit(args: RateLimitArgs): Promise<RateLimitResult>;

// src/lib/captcha/verify.ts
export async function verifyCaptcha(token: string, ip: string | null): Promise<CaptchaResult>;

// src/lib/headers/client-ip.ts
export function getClientIp(): string | null;

// Migration: user_consents table (consent_purpose ENUM: 'pdn_processing' | 'oferta'; columns: id, user_id, purpose, policy_version, ip, user_agent, accepted_at; UNIQUE (user_id, purpose, policy_version); RLS: SELECT own; immutable trigger blocks UPDATE/DELETE)

// package.json: @yandex/smart-captcha@^2.9.1 installed
```

From plan-02:
```typescript
// src/lib/legal/policy-version.ts
export const LEGAL_POLICY_VERSION: '1.0-draft';
```

From P1:
```typescript
// src/lib/audit-log.ts
export async function auditLog(input: { userId?, action, entityType?, entityId?, meta?, ip? }): Promise<void>;
// Never throws.

// src/lib/logger.ts
export const logger: Logger;

// src/lib/supabase/admin.ts
export function createAdminClient(): SupabaseClient;  // server-only, ESLint-gated

// src/lib/supabase/server.ts
export function createServerSupabase(): SupabaseClient;  // RLS-aware, used in Server Actions

// src/env.ts
// server.YANDEX_CAPTCHA_SERVER_KEY: optional in env.ts (so dev can boot without it);
//   registerAction throws at runtime if missing — surfaces as { ok:false, error:'...' }
// client.NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY: optional (widget renders with empty key → calls Yandex with placeholder)
// client.NEXT_PUBLIC_SITE_URL: required, default http://localhost:3000
```

From @yandex/smart-captcha (NEW dep installed in plan-06):
```typescript
import { SmartCaptcha } from '@yandex/smart-captcha';
// Props: sitekey: string, onSuccess: (token: string) => void, onTokenExpired?, onChallengeHidden?, language?: 'ru'|'en'|..., test?: boolean
// Renders a visible widget; calls onSuccess with token when challenge passes.
```

From @supabase/supabase-js:
```typescript
supabase.auth.signUp({ email, password, options: { emailRedirectTo } }):
  Promise<{ data: { user, session }, error }>;
// On success, Supabase sends a confirmation email via configured SMTP (Supabase default in P2).
// emailRedirectTo URL is the destination of the link in the email — Supabase appends token_hash + type + next.
// For P2 emailRedirectTo = `${NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/dashboard`.

supabase.auth.verifyOtp({ type: EmailOtpType, token_hash: string }):
  Promise<{ data: { user, session }, error }>;
// Used in /auth/confirm Route Handler.
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Shared schemas + registerAction + audit hooks + resendConfirmationAction + unit tests</name>
  <files>src/lib/schemas/auth.ts, src/lib/schemas/auth.test.ts, src/server/actions/auth.ts, src/server/actions/auth.test.ts</files>
  <behavior>
    - registerSchema: validates email (z.string().email().max(254)), password (z.string().min(8, 'Минимум 8 символов').regex(/\d/, 'Должна быть хотя бы одна цифра')), captchaToken (z.string().min(1)), pdnAgreed (z.literal(true)), ofertaAgreed (z.literal(true))
    - passwordSchema export reusable by plan-09 reset-password
    - registerAction valid input: rate-limit ok + captcha ok + signUp ok + insert 2 consents → returns { ok: true, emailSentTo: email }
    - registerAction: rate-limit blocked → returns { ok: false, error: 'Слишком много попыток...', field: undefined }
    - registerAction: captcha invalid → returns { ok: false, error: 'Капча не пройдена...', field: 'captcha' }
    - registerAction: signUp returns error (e.g. user already exists) → returns generic { ok: false, error: 'Не удалось завершить регистрацию.' } (do NOT leak user-exists)
    - registerAction: consent insert fails → returns { ok: false, error: 'Не удалось сохранить согласие...' }
    - registerAction: auditLog called for both success and failed paths
    - resendConfirmationAction: rate-limit 1/min/user; calls supabase.auth.resend({ type: 'signup', email }); returns ok=true with neutral message
  </behavior>
  <action>
1. **`src/lib/schemas/auth.ts`** — shared schemas (client + server). Plain module, NO `'use server'`:
```typescript
import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Минимум 8 символов')
  .max(72, 'Не больше 72 символов')  // bcrypt max
  .regex(/\d/, 'Должна быть хотя бы одна цифра');

export const emailSchema = z.string().trim().toLowerCase().email('Введите корректный email').max(254);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  captchaToken: z.string().min(1, 'Подтвердите, что вы не робот'),
  pdnAgreed: z.boolean().refine((v) => v === true, {
    message: 'Необходимо согласие на обработку персональных данных',
  }),
  ofertaAgreed: z.boolean().refine((v) => v === true, {
    message: 'Необходимо принять условия публичной оферты',
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

Schema design note: `pdnAgreed` and `ofertaAgreed` use `z.boolean().refine(v => v === true, ...)` instead of `z.literal(true, ...)`. Why: `z.literal(true)` infers `true` as the type, forcing `defaultValues` in RHF to either be `true` (visually checked at mount — WRONG UX for legal consent) or use a `false as unknown as true` cast (type-safety smell, ESLint will warn). `z.boolean().refine` infers `boolean` so `defaultValues` is plain `false: boolean` (correct unchecked state at mount) AND the schema still rejects `false` at submit with the right Russian message. The submit-disabled guard in RegisterForm reads `form.watch('pdnAgreed') === true` which works identically with either schema shape.

Plans 08 + 09 will EXTEND this file with `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema`. Keep the file pure-data (no imports beyond `zod`) so it's safe to import from client components.

2. **`src/lib/schemas/auth.test.ts`** — unit tests (Vitest, jsdom by default since src/):
   - passwordSchema: rejects 7-char, rejects no-digit, accepts 8-char-with-digit
   - emailSchema: rejects malformed, accepts standard, lowercases
   - registerSchema: rejects pdnAgreed=false, rejects ofertaAgreed=false, rejects missing captchaToken, accepts fully-valid input

3. **`src/server/actions/auth.ts`** — Server Actions file. Use the EXACT pattern from RESEARCH §Pattern 2 (lines 326-433) adapted to project conventions. Skeleton:
```typescript
'use server';

import 'server-only';
import { headers } from 'next/headers';
import * as Sentry from '@sentry/nextjs';

import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyCaptcha } from '@/lib/captcha/verify';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/headers/client-ip';
import { auditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { LEGAL_POLICY_VERSION } from '@/lib/legal/policy-version';
import { env } from '@/env';
import { registerSchema, type RegisterInput } from '@/lib/schemas/auth';
import { createHash } from 'node:crypto';

type RegisterResult =
  | { ok: true; emailSentTo: string }
  | { ok: false; error: string; field?: 'email' | 'password' | 'captcha' };

export async function registerAction(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]!.message };
  }
  const { email, password, captchaToken } = parsed.data;

  const ip = getClientIp();

  // 1. Rate limit (cheap, before captcha API call)
  const rl = await rateLimit({
    key: ip ?? 'unknown-ip',
    action: 'auth.register',
    windowSec: 3600,
    maxAttempts: 3,
  });
  if (!rl.ok) {
    return {
      ok: false,
      error: `Слишком много попыток регистрации. Попробуйте через час.`,
    };
  }

  // 2. Captcha verify
  const captchaResult = await verifyCaptcha(captchaToken, ip);
  if (!captchaResult.ok) {
    return {
      ok: false,
      error: 'Капча не пройдена. Обновите страницу и попробуйте снова.',
      field: 'captcha',
    };
  }

  // 3. Sign up via Supabase Auth (sends confirmation email through default SMTP in P2)
  const supabase = createServerSupabase();
  const emailRedirectTo = `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/dashboard`;
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (signUpError) {
    logger.warn({ err: signUpError.message, email_hash: hashEmail(email) }, 'register signUp failed');
    // Don't leak user-exists — generic error
    return { ok: false, error: 'Не удалось завершить регистрацию. Попробуйте ещё раз.' };
  }

  const userId = signUpData.user?.id;
  if (!userId) {
    logger.error({ email_hash: hashEmail(email) }, 'register: signUp returned no user');
    return { ok: false, error: 'Не удалось создать аккаунт. Попробуйте ещё раз.' };
  }

  // 4. Insert 2 consent rows via admin (Pitfall #14)
  try {
    const admin = createAdminClient();
    const ua = headers().get('user-agent') ?? '';
    const acceptedAt = new Date().toISOString();
    const { error: consentError } = await admin.from('user_consents').insert([
      { user_id: userId, purpose: 'pdn_processing', policy_version: LEGAL_POLICY_VERSION, ip, user_agent: ua, accepted_at: acceptedAt },
      { user_id: userId, purpose: 'oferta', policy_version: LEGAL_POLICY_VERSION, ip, user_agent: ua, accepted_at: acceptedAt },
    ]);
    if (consentError) {
      logger.error({ err: consentError, userId }, 'consent insert failed');
      // Compensating policy: do NOT auto-delete auth.users (P6 admin tool can clean orphans).
      return { ok: false, error: 'Не удалось сохранить согласие. Обратитесь в поддержку.' };
    }

    // 5. Audit
    await auditLog({
      userId,
      action: 'auth.register',
      entityType: 'user',
      entityId: userId,
      meta: { email_hash: hashEmail(email), policy_version: LEGAL_POLICY_VERSION },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { surface: 'auth.register' } });
    logger.error({ err }, 'register: unexpected error after signUp');
    return { ok: false, error: 'Ошибка сервера. Попробуйте ещё раз.' };
  }

  return { ok: true, emailSentTo: email };
}

/**
 * Resend confirmation email. Used by plan-10's EmailVerificationBanner.
 * Rate-limited 1/min/email to avoid Supabase default-SMTP throttle blow-up.
 */
type ResendResult = { ok: true } | { ok: false; error: string };

export async function resendConfirmationAction(emailRaw: string): Promise<ResendResult> {
  // Validate email shape (don't error on case)
  const parsed = z.string().email().max(254).safeParse(emailRaw);
  if (!parsed.success) return { ok: false, error: 'Введите корректный email.' };
  const email = parsed.data.toLowerCase();

  const rl = await rateLimit({
    key: `email:${email}`,
    action: 'auth.resend_confirmation',
    windowSec: 60,
    maxAttempts: 1,
  });
  if (!rl.ok) return { ok: false, error: 'Подождите минуту перед повторной отправкой.' };

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/dashboard` },
  });
  if (error) {
    logger.warn({ err: error.message, email_hash: hashEmail(email) }, 'resend confirmation failed');
    // Neutral message — don't leak whether user exists
    return { ok: true }; // OWASP-style neutral success
  }

  await auditLog({ action: 'auth.resend_confirmation', meta: { email_hash: hashEmail(email) } });
  return { ok: true };
}

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 12);
}
```

Note: `import { z } from 'zod'` is needed inside `resendConfirmationAction` if not already imported at top. Add an `import { z } from 'zod';` at the top of the file.

4. **`src/server/actions/auth.test.ts`** — Vitest unit tests. Mock all external deps (`rateLimit`, `verifyCaptcha`, `createServerSupabase`, `createAdminClient`, `auditLog`, `Sentry`, `getClientIp`, `next/headers`). Cover the 7 paths listed in `<behavior>` above. Suite description in Russian.

Plans 08 + 09 will EXTEND this test file with their cases.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run test:ci -- src/lib/schemas/auth src/server/actions/auth && head -2 src/server/actions/auth.ts | grep -q "'use server'" && grep -q "import 'server-only'" src/server/actions/auth.ts && grep -q "LEGAL_POLICY_VERSION" src/server/actions/auth.ts</automated>
  </verify>
  <done>schemas/auth.ts exports registerSchema + passwordSchema + emailSchema; server/actions/auth.ts has registerAction (full pipeline) + resendConfirmationAction + hashEmail helper; both action files have proper `'use server';` + `import 'server-only';`; unit tests pass for 3 schema cases + 7 action paths.</done>
</task>

<task type="auto">
  <name>Task 2: SmartCaptchaWidget + ConsentCheckboxes + /auth/confirm Route Handler</name>
  <files>src/components/auth/SmartCaptchaWidget.tsx, src/components/auth/ConsentCheckboxes.tsx, src/app/auth/confirm/route.ts</files>
  <action>
1. **`src/components/auth/SmartCaptchaWidget.tsx`** — Client Component wrapper. Per UI-SPEC §4.3 widget placement + RESEARCH §Pattern 5 lines 627-633:
```tsx
'use client';

import { SmartCaptcha } from '@yandex/smart-captcha';

interface SmartCaptchaWidgetProps {
  onToken: (token: string) => void;
  /** Optional override; defaults to env var */
  sitekey?: string;
}

export function SmartCaptchaWidget({ onToken, sitekey }: SmartCaptchaWidgetProps) {
  const key = sitekey ?? process.env.NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY;
  if (!key) {
    return (
      <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        Капча недоступна — установите NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY в .env.local
      </div>
    );
  }
  return (
    <div aria-label="Проверка что вы не робот">
      <SmartCaptcha
        sitekey={key}
        onSuccess={onToken}
        onTokenExpired={() => onToken('')}
        language="ru"
      />
    </div>
  );
}
```
Per RESEARCH §User Constraints, P2 uses VISIBLE widget (not invisible) — straightforward, lower fight with React 18 strict mode.

2. **`src/components/auth/ConsentCheckboxes.tsx`** — Client Component (uses Radix Checkbox state). Per UI-SPEC §4.3 + §9.1:
```tsx
'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Control } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { RegisterInput } from '@/lib/schemas/auth';

interface ConsentCheckboxesProps {
  control: Control<RegisterInput>;
}

export function ConsentCheckboxes({ control }: ConsentCheckboxesProps) {
  return (
    <div className="space-y-3">
      <FormField
        control={control}
        name="pdnAgreed"
        render={({ field }) => (
          <FormItem className="flex items-start gap-3 space-y-0">
            <FormControl>
              <Checkbox
                checked={field.value === true}
                onCheckedChange={(c) => field.onChange(c === true)}
                id="consent-pdn"
              />
            </FormControl>
            <div className="space-y-1">
              <FormLabel htmlFor="consent-pdn" className="text-sm font-normal leading-5 cursor-pointer">
                Я согласен с{' '}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-4 hover:text-primary"
                >
                  обработкой персональных данных
                  <ExternalLink className="inline ml-1 size-3" aria-label="откроется в новой вкладке" />
                </Link>
              </FormLabel>
              <FormMessage />
            </div>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="ofertaAgreed"
        render={({ field }) => (
          <FormItem className="flex items-start gap-3 space-y-0">
            <FormControl>
              <Checkbox
                checked={field.value === true}
                onCheckedChange={(c) => field.onChange(c === true)}
                id="consent-oferta"
              />
            </FormControl>
            <div className="space-y-1">
              <FormLabel htmlFor="consent-oferta" className="text-sm font-normal leading-5 cursor-pointer">
                Я принимаю условия{' '}
                <Link
                  href="/oferta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-4 hover:text-primary"
                >
                  публичной оферты
                  <ExternalLink className="inline ml-1 size-3" aria-label="откроется в новой вкладке" />
                </Link>
              </FormLabel>
              <FormMessage />
            </div>
          </FormItem>
        )}
      />
    </div>
  );
}
```

3. **`src/app/auth/confirm/route.ts`** — GET Route Handler. Per RESEARCH §Pattern 3 (lines 438-478):
```typescript
import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const rawNext = searchParams.get('next');
  // Open-redirect safety per security/SKILL.md §3
  const safeNext = rawNext?.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  if (!tokenHash || !type) {
    logger.warn({ hasToken: !!tokenHash, type }, 'auth/confirm missing params');
    redirect('/login?error=invalid_link');
  }

  const supabase = createServerSupabase();
  const { error, data } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    logger.warn({ err: error.message, type }, 'verifyOtp failed');
    redirect('/login?error=expired_link');
  }

  await auditLog({
    userId: data.user?.id,
    action: type === 'signup' ? 'auth.email_confirmed' : `auth.${type}_verified`,
    entityType: 'user',
    entityId: data.user?.id,
    meta: { type },
  });

  redirect(safeNext);
}
```
Note: `redirect()` from `next/navigation` throws — that's why both error paths just call it (no NextResponse). Returns inferred as `never` after redirect.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && ls src/components/auth/SmartCaptchaWidget.tsx src/components/auth/ConsentCheckboxes.tsx src/app/auth/confirm/route.ts && grep -q "verifyOtp" src/app/auth/confirm/route.ts && grep -q "startsWith.*'//'.*''" src/app/auth/confirm/route.ts || grep -q "startsWith('//')" src/app/auth/confirm/route.ts && head -2 src/app/auth/confirm/route.ts | grep -q "server-only"</automated>
  </verify>
  <done>3 files exist; SmartCaptchaWidget renders the visible Yandex widget; ConsentCheckboxes uses RHF FormField pattern (two checkboxes with Link to /privacy + /oferta, target=_blank); /auth/confirm calls verifyOtp + redirects with open-redirect safety.</done>
</task>

<task type="auto">
  <name>Task 3: /register page + RegisterForm + RegisterForm component test + integration tests</name>
  <files>src/app/(marketing)/register/page.tsx, src/app/(marketing)/register/components/RegisterForm.tsx, src/app/(marketing)/register/components/RegisterForm.test.tsx, tests/integration/auth/consent.test.ts, tests/integration/auth/confirm.test.ts</files>
  <action>
1. **`src/app/(marketing)/register/page.tsx`** — Server Component. Wraps form in `<Suspense>` defensively (consistency with `/login` plan-08):
```tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RegisterForm } from './components/RegisterForm';

export const metadata: Metadata = {
  title: 'Зарегистрироваться',
  description: 'Создайте аккаунт VideoEdit Academy, чтобы получить доступ к курсу.',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <div className="container mx-auto max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle>Зарегистрироваться</CardTitle>
          <CardDescription>Создайте аккаунт, чтобы получить доступ к курсу</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <RegisterForm />
          </Suspense>
        </CardContent>
        <CardFooter className="flex justify-between text-sm">
          <span className="text-muted-foreground">Уже есть аккаунт?</span>
          <Link href="/login" className="font-medium underline-offset-4 hover:underline">Войти</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
```

2. **`src/app/(marketing)/register/components/RegisterForm.tsx`** — Client Component. Per UI-SPEC §4.3 + RESEARCH §Pattern 5 lines 530-645. Use the canonical RHF + useTransition + ConsentCheckboxes + SmartCaptchaWidget composition:
```tsx
'use client';

import { useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';

import { registerSchema, type RegisterInput } from '@/lib/schemas/auth';
import { registerAction } from '@/server/actions/auth';
import { ConsentCheckboxes } from '@/components/auth/ConsentCheckboxes';
import { SmartCaptchaWidget } from '@/components/auth/SmartCaptchaWidget';

export function RegisterForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      captchaToken: '',
      pdnAgreed: false,
      ofertaAgreed: false,
    },
    mode: 'onBlur',
  });

  // Live-derived: submit only if both consents true + captcha received + not pending
  const pdnAgreed = form.watch('pdnAgreed');
  const ofertaAgreed = form.watch('ofertaAgreed');
  const canSubmit = pdnAgreed === true && ofertaAgreed === true && captchaToken.length > 0 && !pending;

  const onSubmit = (values: RegisterInput) => {
    startTransition(async () => {
      const result = await registerAction({ ...values, captchaToken });
      if (!result.ok) {
        toast.error(result.error);
        if (result.field) {
          form.setError(result.field, { message: result.error });
        }
        return;
      }
      toast.success(`Письмо отправлено на ${result.emailSentTo}. Проверьте почту.`);
      router.push(`/login?registered=1`);
    });
  };

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
                <Input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" {...field} />
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
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
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
              <FormDescription>Минимум 8 символов и хотя бы одна цифра</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <ConsentCheckboxes control={form.control} />

        <SmartCaptchaWidget onToken={(token) => { setCaptchaToken(token); form.setValue('captchaToken', token); }} />

        <Button type="submit" disabled={!canSubmit} className="w-full" aria-busy={pending}>
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {pending ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
        </Button>
      </form>
    </Form>
  );
}
```

3. **`src/app/(marketing)/register/components/RegisterForm.test.tsx`** — Vitest + Testing Library component test. Mock `@/server/actions/auth` and `@yandex/smart-captcha`. Test the AUTH-02 contract:
   - «Submit button disabled when both checkboxes unchecked» (initial state)
   - «Submit enables only after both checkboxes checked AND captcha token set» (interactive)
   - «Server error displayed via toast on registerAction returning { ok: false }»
   - «Successful action redirects to /login?registered=1»

Pattern: `vi.mock('@yandex/smart-captcha', () => ({ SmartCaptcha: ({ onSuccess }: any) => (<button onClick={() => onSuccess('test-token')}>simulate-captcha</button>) }))`.

4. **`tests/integration/auth/consent.test.ts`** — integration against local Supabase + RLS harness. AUTH-03 hard gate verification. **Single-path approach (no hedging):** use Vitest's auto-mock for `next/headers` so `registerAction` is called directly and the resulting `user_consents` rows are queried via the admin client.

Step 4a: create `__mocks__/next/headers.ts` at repo root (Vitest discovers `__mocks__` siblings automatically when `vi.mock('next/headers')` is invoked in the test file):
```typescript
// __mocks__/next/headers.ts
import { vi } from 'vitest';
export const headers = vi.fn(() => new Headers({
  'x-forwarded-for': '203.0.113.42',
  'user-agent': 'Test Agent 1.0',
}));
// next/headers also exports cookies() — stub to a minimal cookie store if any code path needs it.
// For consent-test scope, only headers() is touched.
export const cookies = vi.fn(() => ({ get: () => undefined, getAll: () => [], has: () => false, set: () => {}, delete: () => {} }));
```

Step 4b: write `tests/integration/auth/consent.test.ts` with the canonical RLS harness pattern + ONE path (no fallback):
```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { makeAdminClient } from '../helpers/test-clients';
import { createTestUser, deleteTestUser } from '../helpers/test-users';

// Wire the auto-mock — Vitest replaces the real module with __mocks__/next/headers.ts above.
vi.mock('next/headers');
// Captcha verify is the other unsafe boundary — short-circuit it to always-ok in this test.
vi.mock('@/lib/captcha/verify', () => ({
  verifyCaptcha: vi.fn(async () => ({ ok: true })),
}));
// Rate-limit must not block multiple test runs against the same IP — bypass it.
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ ok: true, remaining: 999 })),
}));

import { registerAction } from '@/server/actions/auth';

describe('register → user_consents (AUTH-03)', () => {
  const admin = makeAdminClient();
  const testEmail = `consent-test-${Date.now()}@example.com`;
  let userId: string;

  afterAll(async () => {
    if (userId) await deleteTestUser(userId);
  });

  it('creates two consent rows with full evidence on successful register', async () => {
    const result = await registerAction({
      email: testEmail,
      password: 'TestPass1',
      captchaToken: 'mocked-token',
      pdnAgreed: true,
      ofertaAgreed: true,
    });
    expect(result.ok).toBe(true);

    // Look up the created user id via admin (auth.users)
    const { data: userLookup } = await admin.from('auth.users').select('id').eq('email', testEmail).single();
    userId = userLookup!.id;

    const { data } = await admin.from('user_consents').select('*').eq('user_id', userId);
    expect(data).toHaveLength(2);
    expect(data!.find((r) => r.purpose === 'pdn_processing')).toMatchObject({
      policy_version: '1.0-draft',
      ip: '203.0.113.42',
      user_agent: 'Test Agent 1.0',
    });
    expect(data!.find((r) => r.purpose === 'oferta')).toMatchObject({
      policy_version: '1.0-draft',
      ip: '203.0.113.42',
      user_agent: 'Test Agent 1.0',
    });
  });

  it('attempted UPDATE on existing consent row is blocked by trigger', async () => {
    const { error } = await admin
      .from('user_consents')
      .update({ ip: '0.0.0.0' })
      .eq('user_id', userId);
    expect(error?.message).toMatch(/append-only/);
  });

  it('attempted DELETE on existing consent row is blocked by trigger', async () => {
    const { error } = await admin
      .from('user_consents')
      .delete()
      .eq('user_id', userId);
    expect(error?.message).toMatch(/append-only/);
  });
});
```

This is the SINGLE chosen path — no admin-only fallback. If the Vitest auto-mock pattern proves brittle in CI (e.g., the resolver does not pick up `__mocks__/next/headers.ts` because the Vitest config uses a custom `resolve.alias`), update vitest.integration.config.ts `server.deps.inline` and/or add an explicit `__mocks__` alias resolution; do NOT introduce a parallel admin-only test.

5. **`tests/integration/auth/confirm.test.ts`** — AUTH-04 verification:
   - **Test 1:** GET `/auth/confirm?token_hash=<valid>&type=signup&next=/dashboard` — uses Supabase admin to manually generate a confirm token for a test user, then makes an HTTP request to the dev server `/auth/confirm`. Asserts redirect status 302/307 with Location: `/dashboard`.
   - **Test 2:** GET `/auth/confirm` without params → redirects to `/login?error=invalid_link`
   - **Test 3:** GET `/auth/confirm?token_hash=garbage&type=signup` → verifyOtp fails → redirects to `/login?error=expired_link`

These tests require the dev server to be running (`npm run dev` background) — alternatively use `next-test-api-route-handler` to invoke the route handler directly without HTTP.

If integration env not provisioned, mark tests `it.skip` and document.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run test:ci -- src/app/\\\(marketing\\\)/register/components/RegisterForm && grep -q "Suspense" src/app/\\\(marketing\\\)/register/page.tsx && grep -q "'use client'" src/app/\\\(marketing\\\)/register/components/RegisterForm.tsx && grep -q "ConsentCheckboxes" src/app/\\\(marketing\\\)/register/components/RegisterForm.tsx && grep -q "SmartCaptchaWidget" src/app/\\\(marketing\\\)/register/components/RegisterForm.tsx</automated>
  </verify>
  <done>/register page (SC), RegisterForm (CC), RegisterForm.test.tsx with at least 4 cases, 2 integration test files; component test passes; lint + typecheck + build all clean.</done>
</task>

</tasks>

<verification>
After all 3 tasks:
1. `npm run lint && npm run typecheck && npm run test:ci && npm run build` — must pass
2. With YANDEX_CAPTCHA env vars + Supabase running:
   - `npm run dev`, open http://localhost:3000/register
   - Fill form: valid email, password «Pass1234», tick both consents, solve captcha
   - Submit → toast «Письмо отправлено на ...» → redirect to /login?registered=1
   - Check inbox (solo dev's own email) → click confirmation link → land on /dashboard (plan-10 must be merged for the empty state; in plan-07-only state, /dashboard is a stub from plan-01 — chrome appears later)
3. Database verification: `SELECT * FROM user_consents WHERE user_id = '<just-registered-user>';` → 2 rows, both `policy_version='1.0-draft'`, both `ip` non-null, both `user_agent` containing browser string
4. Test cap edge: leave a checkbox unchecked → Submit button disabled (visually + DOM)
5. `npm run test:integration -- tests/integration/auth/consent.test.ts` passes (Docker required)
</verification>

<success_criteria>
- AUTH-01: `/register` accepts email + password with min 8 chars + 1 digit; rejects invalid
- AUTH-02: Two visible checkboxes (privacy + oferta) with target=_blank links; submit disabled until both ticked + captcha solved
- AUTH-03: `user_consents` has exactly 2 rows after register with `(user_id, purpose, policy_version='1.0-draft', ip, user_agent, accepted_at)` populated; immutability trigger blocks UPDATE/DELETE
- AUTH-04: Welcome email sent via Supabase default SMTP; clicking link calls `/auth/confirm` → `verifyOtp` → redirect to `/dashboard`; resendConfirmationAction available for plan-10 banner
- AUTH-09 (widget half): Yandex SmartCaptcha visible on /register; server-side verify gate active in registerAction
- AUTH-10 (register half): Rate-limit 3/hr/IP on `auth.register`
- Pitfall #14 mitigated: full evidence captured
- Pitfall #21: all server modules `import 'server-only';`
</success_criteria>

<out_of_scope>
- Login, logout, auth-gate — plan-08
- Forgot/reset password — plan-09
- Email-verification banner UI on /dashboard — plan-10
- `/auth/check-email` interstitial — UI-SPEC §11.3 mentions but we redirect to /login?registered=1 instead (simpler)
- Custom SMTP / Russian email templates — P7
- Marketing opt-in checkbox — out of scope per PROJECT.md
- Login with `?next=` query param — plan-08
- Profile editing — Phase 6
</out_of_scope>

<references>
- UI-SPEC.md §4.3 (full register screen), §9.1 (consent checkbox UX), §11.2 (component inventory)
- RESEARCH.md §Pattern 2 (registerAction template, lines 326-433), §Pattern 3 (auth/confirm Route Handler, lines 438-478), §Pattern 5 (RegisterForm template, lines 530-645)
- RESEARCH.md §Pitfall #14 (consent capture with evidence), §Pitfall #16 (default SMTP acceptable for P2)
- REQUIREMENTS.md AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-09
- api-conventions/SKILL.md §Server Actions (discriminated union, requireUser pattern)
- security/SKILL.md §3 (Open Redirect, Rate Limiting), §4 (Никогда не доверяй клиенту), §5 (Капча), §7 (152-ФЗ consent)
- testing/SKILL.md §2 (Component tests), §3 (Integration tests — RLS)
</references>

<output>
Create `.planning/phases/2-auth-marketing-consent/plans/2-07-SUMMARY.md` when done documenting:
- registerSchema + emailSchema + passwordSchema (shared)
- registerAction (full pipeline) + resendConfirmationAction
- /auth/confirm Route Handler with open-redirect safety
- /register page (SC) + RegisterForm (CC) + SmartCaptchaWidget + ConsentCheckboxes
- Component test (4 cases) + 2 integration test files (Docker may defer runtime)
- Audit log entries: auth.register, auth.email_confirmed, auth.resend_confirmation
- Deferred: login (plan-08), forgot/reset (plan-09), banner (plan-10)
</output>
