---
phase: 2
slug: auth-marketing-consent
mode: mvp
status: ready-to-execute
created: 2026-05-24
last_revised: 2026-05-24
total_plans: 11
total_waves: 6
requirements_total: 18
requirements_mapped: 18
depends_on_phases: [1]
---

# Phase 2 — Auth + Marketing Shell + 152-ФЗ Consent (dev SMTP)

> **Master plan-of-plans.** Per-plan files live in `./plans/`. Each plan is one atomic PR. After every plan, the app builds, lints, tests pass, and the thin slice is demoable in browser.

---

## Phase Goal (from ROADMAP.md, verbatim)

Незалогиненный пользователь может изучить курс на лендинге, прочесть юридические страницы (драфты), зарегистрироваться с явным согласием на ПДн, залогиниться и увидеть пустой `/dashboard`. К началу P3 есть аутентифицированный пользователь, который может что-то купить. Email доставляется через Supabase default SMTP на тестовые ящики (без deliverability-evidence на Mail.ru/Yandex — это отложено в P7).

---

## Mode: MVP (vertical slices)

Per `ROADMAP.md` Phase 2 + `config.json` `mvp: true`. Each plan delivers a thin end-to-end slice (UI + Server Action + migration if needed + tests). NOT horizontal layers. After each plan, **a tangible thing works in the browser** for a developer running `npm run dev`.

Example milestones the user can see live:
- After plan-01: shadcn primitives + marketing/auth/app layouts render; navigate empty `/` shows new chrome
- After plan-02: `/privacy` + `/oferta` render readable Russian drafts; security headers visible in browser DevTools
- After plan-03: full landing `/` with hero + programme + pricing + FAQ + footer
- After plan-04: `/courses/[slug]` shows seeded course preview
- After plan-05: `robots.txt`, `sitemap.xml`, OG image working; Lighthouse mobile-perf ≥ 80
- After plan-06: rate-limit + captcha-verify helpers + 2 migrations applied (no UI yet — infra)
- After plan-07: register form works end-to-end → confirmation email → click link → `/dashboard`
- After plan-08: login/logout works; `(app)` auth gate enforced
- After plan-09: forgot/reset password works
- After plan-10: empty `/dashboard` + email-verification banner + greeting

---

## Success Criteria (from ROADMAP.md, verbatim — copy into verify-phase)

1. Незалогиненный пользователь открывает `/` на мобиле, видит hero + ценовой блок + FAQ + футер с `/privacy` + `/oferta` (драфты, текст содержит TODO-маркеры для финального юриста-ревью в P7), и проходит Lighthouse mobile-perf ≥ 80
2. Пользователь регистрируется на `/register`, получает welcome-confirm письмо через Supabase default SMTP на тестовый адрес (не проверяется доставка на Mail.ru/Yandex — это для P7), подтверждает email и автоматически попадает в `(app)/dashboard`
3. Без обеих галочек («согласие ПДн» + «оферта») кнопка «Зарегистрироваться» disabled; после регистрации в `user_consents` появляются две раздельные записи с IP, UA, policy_version и timestamp
4. Пользователь сбрасывает пароль через email-ссылку (одноразовую, истекающую через 1 час) и логинится новым паролем; сессия сохраняется после закрытия браузера
5. 6-я и 11-я попытка логина за 15 минут с одного IP отвергается с 429; SmartCaptcha видна на `/register` и `/forgot-password`

---

## Dependencies on Phase 1

| Phase-1 artifact | Used by P2 plans | How |
|---|---|---|
| `src/env.ts` (Zod parser, has `YANDEX_CAPTCHA_*` slots) | 06, 07, 09 | Adds `NEXT_PUBLIC_APP_URL` if missing; reads captcha keys |
| `src/lib/supabase/admin.ts` (`import 'server-only'`) | 06, 07, 08, 09 | Used by rate-limit, audit-log, consent insertion |
| `src/lib/supabase/server.ts` (`createServerSupabase`) | 04, 07, 08, 09, 10 | All Server Actions + auth-gated pages |
| `src/lib/auth/require.ts` (`requireUser`, `UnauthorizedError`) | 10 | `(app)/layout.tsx` gate (also used directly in plan-08) |
| `src/lib/logger.ts` (pino) | 06, 07, 08, 09 | All Server Actions log start/end/error |
| `src/lib/audit-log.ts` + `audit_log` migration | 07, 08, 09 | `auth.register`, `auth.login_success`, `auth.login_failed`, etc. |
| `src/middleware.ts` (auth-cookie refresh via `updateSession`) | 08 | Already wired in P1 — P2 does NOT touch this file (Pitfall #22 mitigation) |
| ESLint `no-restricted-imports` (admin.ts boundary) | 06, 07 | Allowed paths already include `src/server/**`, `src/app/api/**`, `src/lib/audit-log.ts` |
| RLS test harness (`tests/integration/globalSetup.ts` + helpers) | 06, 07 | Integration tests for `user_consents` RLS + rate_limit_log |

---

## Plan Inventory

| # | Plan ID | Wave | REQ-IDs covered | Depends on | Autonomous |
|---|---|---|---|---|---|
| 0 | 00-typecheck-baseline | 0 | (none — baseline fix) | — | yes |
| 1 | 01-shadcn-and-design-system | 1 | (none — foundation) | 00 (implicit: needs clean typecheck) | yes |
| 2 | 02-legal-pages-and-security-headers | 1 | LEGAL-01, LEGAL-02, LEGAL-03 | 00 (implicit) | yes |
| 3 | 06-rate-limit-and-captcha-infra | 1 | AUTH-10 (infra), AUTH-09 (server-verify), AUTH-03 (schema) | 00 (implicit) | no (1 checkpoint: human-verify `@yandex/smart-captcha` install) |
| 4 | 03-landing-page | 2 | LAND-01, LAND-05 | 01 | yes |
| 5 | 04-course-preview | 2 | LAND-02 | 01 | yes |
| 6 | 05-seo-and-lighthouse | 3 | LAND-03, LAND-04 | 01, 02, 03, 04 | no (1 checkpoint: human-verify Lighthouse ≥ 80) |
| 7 | 07-register-consent-email-confirm | 3 | AUTH-01, AUTH-02, AUTH-03 (capture), AUTH-04, AUTH-09 (widget) | 01, 02, 06 | no (1 checkpoint: human-setup Yandex SmartCaptcha sitekey) |
| 8 | 08-login-logout-middleware-authgate | 4 | AUTH-05, AUTH-07, AUTH-08 | 01, 06, 07 | yes |
| 9 | 09-forgot-reset-password | 4 | AUTH-06, AUTH-09 (second site) | 01, 06, 07 | yes |
| 10 | 10-dashboard-empty-and-verify-banner | 5 | (none new — finalises AUTH-04 + AUTH-08 UX) | 07, 08 | yes |

**Total: 11 plans, 6 waves (Wave 0 baseline + Waves 1-5 features), 18/18 REQ-IDs mapped.**

> **Wave 0 (plan-00-typecheck-baseline)** is a one-task surgical fix landing BEFORE Wave 1. It zeroes out 13 pre-existing TypeScript errors (10 implicit-any in Supabase cookie handlers + 3 missing-types in admin.lint.test.ts) shipped by Phase 1's scaffold. Without it, every Wave-1+ plan's `npm run typecheck` verify gate fails before any new code is written, masking real plan-introduced errors. Plan-00 has zero REQ-ID mapping (it's infrastructure hygiene), runs alone in Wave 0, and ships a single atomic commit `chore(2-00): fix pre-existing TS gaps from Phase 1 scaffold`.

---

## Wave / Parallelisation Graph

```
                  Wave 0 (serial, baseline fix)
                  ┌──────────────────────────────┐
                  │ 00-typecheck-baseline        │  ── single 1-task plan
                  └──────────────────────────────┘    │
                                                      ▼
                  Wave 1 (parallel, needs 00)         │
                  ┌──────────────────────────────┐    │
                  │ 01-shadcn-and-design-system  │  ──┤
                  │ 02-legal-pages-and-headers   │  ──┤
                  │ 06-rate-limit-and-captcha    │  ──┤
                  └──────────────────────────────┘    │
                                                      │
                  Wave 2 (parallel, needs 01)         │
                  ┌──────────────────────────────┐    │
                  │ 03-landing-page              │ ◄──┤
                  │ 04-course-preview            │ ◄──┤
                  └──────────────────────────────┘    │
                                                      │
                  Wave 3 (parallel)                   │
                  ┌──────────────────────────────┐    │
                  │ 05-seo-and-lighthouse        │ ◄── needs 01+02+03+04
                  │ 07-register+consent+confirm  │ ◄── needs 01+02+06
                  └──────────────────────────────┘
                                                       │
                  Wave 4 (parallel, needs 07)          │
                  ┌──────────────────────────────┐     │
                  │ 08-login+logout+authgate     │ ◄───┤
                  │ 09-forgot+reset-password     │ ◄───┘
                  └──────────────────────────────┘
                                                       │
                  Wave 5                               │
                  ┌──────────────────────────────┐     │
                  │ 10-dashboard-empty+banner    │ ◄── needs 07+08
                  └──────────────────────────────┘
```

> Wave 0 is implicit dependency for ALL subsequent waves: every `npm run typecheck` verify gate in waves 1-5 only becomes meaningful once plan-00 zeroes out the 13 pre-existing baseline TS errors from Phase 1. Solo dev MUST land plan-00 first; orchestrator wave-execution must execute Wave 0 before queuing Wave 1.

### File ownership (no overlaps within a wave)

**Wave 0:**
- **00:** `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `src/lib/supabase/admin.lint.test.ts` (NO source edit — only @types/eslint install fixes its TS), `package.json` (adds `@types/eslint` devDependency), `package-lock.json`

**Wave 1:**
- **01:** `components.json`, `src/components/ui/**` (shadcn primitives), `src/components/shared/Logo.tsx`, `src/components/marketing/Header.tsx`, `src/components/marketing/Footer.tsx`, `src/app/(marketing)/layout.tsx`, `src/app/(auth)/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/globals.css` (extensions), `tailwind.config.ts` (typography plugin if needed), `package.json` (shadcn deps: `@radix-ui/react-accordion`, `@radix-ui/react-checkbox`, `@tailwindcss/typography`)
- **02:** `src/content/privacy.tsx`, `src/content/oferta.tsx`, `src/app/(marketing)/privacy/page.tsx`, `src/app/(marketing)/oferta/page.tsx`, `src/components/shared/LegalDocPage.tsx`, `src/lib/legal/policy-version.ts`, `next.config.js` (add `Permissions-Policy`)
- **06:** `supabase/migrations/20260525000001_add_user_consents.sql`, `supabase/migrations/20260525000002_add_rate_limit_log.sql`, `src/lib/rate-limit/index.ts`, `src/lib/rate-limit/index.test.ts`, `src/lib/captcha/verify.ts`, `src/lib/captcha/verify.test.ts`, `src/lib/headers/client-ip.ts`, `src/lib/audit-log.ts` (refactor: import `getClientIp`, drop inline IP extraction), `src/lib/audit-log.test.ts` (mock update for shared helper), `src/types/database.ts` (hand-patch additions for `user_consents` + `rate_limit_log` — separate from plan-04's hand-patch for `courses`/`modules`/`lessons`, so they merge cleanly), `tests/integration/rls/user-consents.test.ts`, `tests/integration/rate-limit.test.ts`, `tests/integration/captcha.test.ts`, `package.json` (adds ONLY `@yandex/smart-captcha@^2.9.1`; Radix packages are plan-01's concern)

> Note: ALL of 00, 01, 06 touch `package.json`. Recommended order: 00 → 01 → 06 (single solo-dev linear run). For parallel agents, plan-00 ships first (single 1-task atomic commit), then 01 + 06 must serialise their `package.json` writes — 01 ships its deps first, then 06 rebases and ships its single dep. Plan-02 does not touch `package.json`.
>
> Note: plan-04 (Wave 2) and plan-06 (Wave 1) both touch `src/types/database.ts` (different tables — courses/modules/lessons vs user_consents/rate_limit_log). They edit different lines and merge cleanly, but the executor for plan-04 must `git pull` after plan-06 merges to pick up the new wave-1 hand-patched tables in the same file.

**Wave 2:**
- **03:** `src/app/(marketing)/page.tsx` (replace existing root `src/app/page.tsx`), `src/components/marketing/Hero.tsx`, `src/components/marketing/ProgramOutline.tsx`, `src/components/marketing/PricingBlock.tsx`, `src/components/marketing/FaqAccordion.tsx`, `src/app/page.tsx` (delete or convert to redirect)
- **04:** `src/app/(marketing)/courses/[slug]/page.tsx`, `src/app/(marketing)/courses/[slug]/loading.tsx`, `src/app/(marketing)/courses/[slug]/not-found.tsx`, `src/app/(marketing)/courses/[slug]/error.tsx`, `src/components/marketing/CoursePreviewCard.tsx`, `src/server/queries/courses.ts`, `supabase/seed.sql` (ensure one published course)

**Wave 3:**
- **05:** `src/app/sitemap.ts`, `src/app/robots.ts`, `public/og-default.png` (PLACEHOLDER — checkpoint asks user to confirm or use shipped placeholder), `src/app/(marketing)/page.tsx` (add `metadata` export), `src/app/(marketing)/courses/[slug]/page.tsx` (add `generateMetadata`), `src/app/(marketing)/privacy/page.tsx` (verify `metadata`), `src/app/(marketing)/oferta/page.tsx` (verify `metadata`)
- **07:** `src/app/(marketing)/register/page.tsx`, `src/app/(marketing)/register/components/RegisterForm.tsx`, `src/server/actions/auth.ts` (initial — adds `registerAction` + `resendConfirmationAction`), `src/server/actions/auth.test.ts`, `src/lib/schemas/auth.ts`, `src/lib/schemas/auth.test.ts`, `src/components/auth/ConsentCheckboxes.tsx`, `src/components/auth/SmartCaptchaWidget.tsx`, `src/app/auth/confirm/route.ts`, `src/app/(marketing)/register/components/RegisterForm.test.tsx`, `tests/integration/auth/consent.test.ts`, `tests/integration/auth/confirm.test.ts`

> Note: 05 and 07 both touch `src/app/(marketing)/page.tsx` and `src/app/(marketing)/{privacy,oferta}/page.tsx` (metadata exports). To avoid merge conflict: plan-05 lands metadata exports for `/`, `/privacy`, `/oferta`, `/courses/[slug]`; plan-07 must NOT touch those metadata exports (its new pages `/register` get their own).

**Wave 4:**
- **08:** `src/app/(marketing)/login/page.tsx`, `src/app/(marketing)/login/components/LoginForm.tsx`, `src/server/actions/auth.ts` (extend — add `loginAction`, `logoutAction`), `src/server/actions/auth.test.ts` (extend), `src/lib/schemas/auth.ts` (extend with `loginSchema`), `src/app/(app)/layout.tsx` (auth gate via `requireUser`), `src/components/auth/LogoutButton.tsx`, `tests/integration/auth/login.test.ts`, `tests/integration/auth/logout.test.ts`, `tests/e2e/auth-login.spec.ts`, `tests/e2e/auth-gate.spec.ts`
- **09:** `src/app/(marketing)/forgot-password/page.tsx`, `src/app/(marketing)/forgot-password/components/ForgotPasswordForm.tsx`, `src/app/(marketing)/reset-password/page.tsx`, `src/app/(marketing)/reset-password/components/ResetPasswordForm.tsx`, `src/server/actions/auth.ts` (extend — add `forgotPasswordAction`, `resetPasswordAction`), `src/lib/schemas/auth.ts` (extend with `forgotPasswordSchema`, `resetPasswordSchema`), `tests/integration/auth/recovery.test.ts`

> Note: 08 and 09 both extend `src/server/actions/auth.ts` and `src/lib/schemas/auth.ts`. Per dependency table both depend on 07 (which created these files). Run 08 first, then rebase 09 on top, OR sequentialize 08 → 09 in solo-dev mode (recommended).

**Wave 5:**
- **10:** `src/app/(app)/dashboard/page.tsx`, `src/components/shared/EmailVerificationBanner.tsx`, `src/server/actions/auth.ts` (extend — `resendConfirmationAction` if not added in plan-07), `src/components/shared/AppHeader.tsx`, `src/app/(app)/layout.tsx` (add `AppHeader` + `EmailVerificationBanner` rendering — note plan-08 created the gate)

---

## Coverage Matrix — Success criterion → Plans

| Success criterion | Plans that deliver |
|---|---|
| #1 Mobile landing + pricing + FAQ + footer + privacy/oferta + Lighthouse ≥ 80 | 01 (chrome), 02 (legal pages), 03 (landing), 05 (Lighthouse + SEO) |
| #2 Register → email confirm → redirect to dashboard | 06 (consent migration), 07 (register form + Server Action + `/auth/confirm`), 10 (dashboard target) |
| #3 Submit disabled until both checkboxes ticked + 2 `user_consents` rows captured with IP/UA/policy_version/timestamp | 06 (migration), 07 (`ConsentCheckboxes` + `registerAction` consent insert + integration test) |
| #4 Forgot → email link (1h TTL, one-time) → reset → login → session persists | 09 (forgot/reset), 08 (login), Supabase default JWT TTL (1h access, 30d refresh — NOT touched per Pitfall #18) |
| #5 6th/11th login attempt → 429; SmartCaptcha visible on /register + /forgot-password | 06 (`rateLimit` helper + `verifyCaptcha`), 07 (captcha on register), 08 (rate-limit wired into login), 09 (captcha on forgot) |

**Every success criterion has at least one plan delivering it. Every plan maps to at least one criterion or is foundational (01).**

---

## Coverage Matrix — Source artifacts (multi-source audit)

### Sources audited:
1. **GOAL:** ROADMAP.md `**Goal:**` line for Phase 2 (above)
2. **REQ:** REQUIREMENTS.md `Phase 2 → 18 IDs` (LEGAL-01..03, LAND-01..05, AUTH-01..10)
3. **RESEARCH:** `.planning/phases/2-auth-marketing-consent/RESEARCH.md` (all features + constraints + pitfalls)
4. **UI-SPEC:** `.planning/phases/2-auth-marketing-consent/UI-SPEC.md` (11 screens + design tokens + Russian copy)
5. **CONTEXT:** `2-CONTEXT.md` does NOT exist → no locked user decisions to honor beyond what's in ROADMAP/RESEARCH

### REQ coverage table

| REQ ID | Plan | Status | Notes |
|---|---|---|---|
| LEGAL-01 | 02 | COVERED | `/privacy` drafts with [TODO: юрист-ревью] markers + `policy_version` constant |
| LEGAL-02 | 02 | COVERED | `/oferta` mirror structure |
| LEGAL-03 | 02 | COVERED | `Permissions-Policy` added (other 4 headers already in next.config.js per VERIFICATION) |
| LAND-01 | 03 | COVERED | Hero + ProgramOutline + Pricing + FAQ on `/` |
| LAND-02 | 04 | COVERED | `/courses/[slug]` with seeded course |
| LAND-03 | 05 | COVERED | Lighthouse run + responsive verified via UI-SPEC §6 (built into 03+04 via mobile-first Tailwind) |
| LAND-04 | 05 | COVERED | sitemap.ts + robots.ts + per-page metadata + OG image |
| LAND-05 | 03 | COVERED | Footer with `/privacy` + `/oferta` + email + Telegram + ИП реквизиты `[TODO]` markers (lives in plan-01 layout, populated in plan-03) |
| AUTH-01 | 07 | COVERED | `/register` + RHF + Zod `passwordSchema` (≥8 chars + ≥1 digit) |
| AUTH-02 | 07 | COVERED | Two checkboxes + submit `disabled` until both checked + captcha present |
| AUTH-03 | 06 (migration) + 07 (capture) | COVERED | `user_consents` table + 2-row INSERT in `registerAction` via admin client |
| AUTH-04 | 07 | COVERED | Supabase signUp → email → `/auth/confirm` Route Handler → redirect `/dashboard` + resend button (plan-10 banner) |
| AUTH-05 | 08 | COVERED | `/login` Server Action + Supabase cookie (30d refresh default, NOT touched per Pitfall #18) |
| AUTH-06 | 09 | COVERED | `/forgot-password` + `/reset-password` + Supabase password recovery (1h TTL default) |
| AUTH-07 | 08 | COVERED | `logoutAction` with `signOut({ scope: 'global' })` |
| AUTH-08 | 08 (gate) + middleware existing | COVERED | `(app)/layout.tsx` calls `requireUser()` → redirect `/login?next=<encoded>`; middleware already refreshes cookie (P1) |
| AUTH-09 | 06 (verify helper) + 07 (register widget) + 09 (forgot widget) | COVERED | Yandex SmartCaptcha on both forms; server-verify via POST to `smartcaptcha.cloud.yandex.ru/validate` |
| AUTH-10 | 06 (helper) + 07 (register) + 08 (login) + 09 (forgot) | COVERED | Postgres-backed sliding window: register 3/hr/IP, login 5/15min/IP+email, forgot 3/hr/email |

**18/18 REQ-IDs covered.**

### RESEARCH features audited (non-REQ)

| Feature/constraint from RESEARCH.md | Plan | Status |
|---|---|---|
| `@supabase/ssr@0.5.1` (already locked) — used in Server Actions + `/auth/confirm` | 07, 08, 09 | COVERED |
| `useTransition` form pattern (not `useActionState` — React 18.3 not 19) | 07, 08, 09 | COVERED |
| Open-redirect safety (`startsWith('/')` AND NOT `startsWith('//')`) | 07 (`/auth/confirm`), 08 (login `?next=`) | COVERED |
| Suspense around `useSearchParams()` (Pitfall #20) | 08 (login `?next=`) | COVERED |
| Discriminated union Server Action results | 07, 08, 09 | COVERED |
| Audit log calls for `auth.register`, `auth.login_*`, `auth.password_*`, `account.consent_granted` | 07, 08, 09 | COVERED |
| Yandex SmartCaptcha test mode in dev (no `test={true}` to surface integration bugs) | 07 | COVERED |
| Strict captcha-failure-blocks-submit policy in P2 dev | 06 | COVERED |
| Hero `next/image` AVIF for Lighthouse ≥ 80 | 03 (Hero is text-only per UI-SPEC §10.6) | N/A — UI-SPEC explicitly defers hero illustration to M2; text-only hero is the P2 choice |
| `@yandex/smart-captcha@^2.9.1` install with `checkpoint:human-verify` (slopcheck unavailable) | 06 | COVERED |
| FAQ accordion via shadcn `add accordion` | 01 (shadcn add) + 03 (FAQ component) | COVERED |
| Hash email in audit logs (PII reduction) | 07 (helper in `auth.ts`) | COVERED |
| `policy_version: '1.0-draft'` constant in `src/lib/legal/policy-version.ts` | 02 | COVERED |
| `next/script strategy="lazyOnload"` for SmartCaptcha (or library autoloader) | 07 | COVERED |
| `prefers-color-scheme` respect — no manual theme toggle in P2 (per UI-SPEC §10.4) | 01 | COVERED (default Tailwind dark via `.dark` class — deferred to native via prefers-color-scheme without JS toggle) |

### UI-SPEC screens audited (11 screens)

| UI-SPEC §4.N | Screen | Plan |
|---|---|---|
| 4.1 | `/` landing | 03 |
| 4.2 | `/courses/[slug]` course preview | 04 |
| 4.3 | `/register` | 07 |
| 4.4 | `/login` | 08 |
| 4.5 | `/forgot-password` | 09 |
| 4.6 | `/reset-password` | 09 |
| 4.7 | `/privacy` | 02 |
| 4.8 | `/oferta` | 02 |
| 4.9 | `/auth/confirm` (Route Handler — no UI) | 07 |
| 4.10 | `/dashboard` empty placeholder | 10 |
| 4.11 | Email-verification banner | 10 |

**11/11 screens covered.**

### Deferred / out-of-scope (NOT in plans — explicit acknowledgement)

| Item | Why deferred | Where |
|---|---|---|
| Custom SMTP / SPF/DKIM/DMARC / deliverability evidence on Mail.ru | P7 EMAIL-01/02/03 | RESEARCH §User Constraints |
| Юрист sign-off on /privacy + /oferta text | P7 COMP-02 | RESEARCH §User Constraints |
| OAuth providers, magic link, marketing opt-in | M2 / PROJECT.md Out of Scope | PROJECT.md |
| CSP enforcement | LEGAL-04 → P6 | RESEARCH §User Constraints |
| Profile edit / account deletion UI | PROF-01/02 → P6 | RESEARCH §Deferred Ideas |
| Sentry runtime smoke (Bugsink container) | P1 deferred → P6 OPS-01 | RESEARCH §User Constraints |
| Theme toggle UI | M2 per UI-SPEC §10.4 | UI-SPEC |
| Hero illustration / animated background | M2 per UI-SPEC §10.6 | UI-SPEC |
| `@vercel/og` dynamic OG generation | M2 — static `public/og-default.png` is fine for P2 | UI-SPEC §10.1 |

---

## Risks & Mitigations (HIGH-severity pitfalls)

### Pitfall #14 (HIGH) — Consent capture without versioning/IP/UA
**Where:** plan-06 (migration) + plan-07 (insertion). **Mitigation:**
- `user_consents` table has 5 mandatory columns: `(user_id, purpose, policy_version, ip, user_agent, accepted_at)`
- Two SEPARATE rows per registration (`purpose='pdn_processing'` + `purpose='oferta'`)
- `policy_version` is a compile-time constant (`'1.0-draft'` in `src/lib/legal/policy-version.ts`)
- IP extracted from `next/headers` via the SAME helper as P1 `auditLog` (case-insensitive `X-Forwarded-For` parser)
- Integration test asserts both rows present with correct shape

### Pitfall #18 (MED → HIGH if combined) — JWT TTL / stolen session reuse
**Where:** plan-08 (logout) + Supabase config. **Mitigation:**
- DO NOT touch Supabase Auth TTLs (default 1h access + 30d refresh + rotation enabled)
- `logoutAction` calls `signOut({ scope: 'global' })` — invalidates refresh tokens on all devices
- `(app)/layout.tsx` uses `requireUser()` which calls `supabase.auth.getUser()` (re-validates JWT against Supabase Auth server, NOT `getSession()`)
- Documented in plan-08 SUMMARY for future devs

### Pitfall #20 (MED → HIGH if it ships) — `useSearchParams()` without Suspense
**Where:** plan-08 (login `?next=` + `?registered=1`). **Mitigation:**
- `/login` is a Server Component that wraps `<LoginForm />` in `<Suspense fallback={<Skeleton />}>`
- `LoginForm.tsx` is the Client Component that calls `useSearchParams()`
- Plan-08 verification includes `npm run build` to catch this at build time

### Pitfall #16 (HIGH normally — but ACCEPTED for P2)
Supabase default SMTP throttled to 3-30/hr. **Acceptable** because P2 only sends to dev's own mailbox (per ROADMAP Phase 2 success criterion #2 wording: "тестовый адрес"). EMAIL-01 (custom SMTP) → P7. Plan-07 SUMMARY explicitly documents this.

### Pitfall #21 (MED) — server-only import leak
**Where:** plan-06 (new server files), plan-07 (auth.ts), plan-08, plan-09. **Mitigation:**
- Every new server file in `src/server/` and `src/lib/` begins with `import 'server-only';` on the FIRST line
- ESLint `no-restricted-imports` already gates `@/lib/supabase/admin` (P1) — plans 06 and 07 import from allowed paths (`src/server/**`, `src/app/api/**`, `src/lib/audit-log.ts`)

### Pitfall #22 (MED) — middleware bloat
**Where:** plan-08. **Mitigation:**
- P2 does NOT touch `src/middleware.ts` — auth gate lives in `(app)/layout.tsx`, NOT middleware
- Existing middleware (P1) only does `updateSession()` (refresh cookies) — kept as-is

### Pitfall #24 (MED) — over-build
**Where:** plan-10. **Mitigation:**
- `/dashboard` ships as empty-state ONLY ("у вас пока нет купленных курсов" + CTA to `/`)
- DO NOT prebuild courses-list UI — that's DASH-01 in P4
- Plan-10 explicitly forbids list rendering in `<out-of-scope>`

### Pitfall #30 (MED) — large landing assets
**Where:** plan-03, plan-05. **Mitigation:**
- Hero is text-only per UI-SPEC §10.6 (no illustration in P2)
- OG image `public/og-default.png` capped at ≤200KB (PNG 1200×630)
- Lighthouse mobile-perf ≥ 80 is a P2 gate (plan-05 verification)

---

## Solo-Dev Linear Sequencing Recommendation

For a solo developer working alone (no merge-conflict-resolving teammate), the recommended sequential order — even though waves CAN parallelise — is:

```
0.  plan-00-typecheck-baseline                 (15-min surgical fix — zeroes 13 pre-existing TS errors, makes every subsequent typecheck gate meaningful)
1.  plan-01-shadcn-and-design-system           (foundation; nothing else moves without it)
2.  plan-02-legal-pages-and-security-headers   (parallel candidate but solo; ships first user-visible content)
3.  plan-06-rate-limit-and-captcha-infra       (infra for plan-07; no UI yet — internal-only; also refactors audit-log.ts to share getClientIp)
4.  plan-03-landing-page                       (FIRST DEMO-READY MILESTONE: dev sees real landing in browser)
5.  plan-04-course-preview                     (SECOND DEMO MILESTONE: /courses/[slug] works)
6.  plan-05-seo-and-lighthouse                 (Lighthouse audit; gates the LAND-03 success criterion)
7.  plan-07-register-consent-email-confirm     (BIGGEST PLAN — register works end-to-end with real email)
8.  plan-08-login-logout-middleware-authgate   (THIRD DEMO MILESTONE: full session lifecycle)
9.  plan-09-forgot-reset-password              (fills the recovery gap; AUTH-06 + AUTH-09 site 2)
10. plan-10-dashboard-empty-and-verify-banner  (FINAL UX POLISH: greeting + banner + footer wrap-up)
```

Estimated cumulative time for solo + Claude: ~1 week (per ROADMAP). Plan-07 is the heaviest (~2 days); rest are ~half-day to 1-day each.

If you DO have parallel-capable agents (e.g., `gsd-executor` orchestrating), waves 1-2-3 may parallelise to cut wall-clock time by ~30%. Same-wave plans have zero file conflict per the file-ownership map above.

---

## Phase Verification (after all 11 plans complete — 00 baseline + 01-10 features)

Run from repo root:
```bash
# 1. CI pipeline must be green
npm run lint && npm run typecheck && npm run test:ci && npm run build

# 2. Integration tests (requires Docker + Supabase local — defer per P1 pattern if absent)
npm run test:integration

# 3. E2E smoke (Playwright against dev server)
npm run test:e2e -- tests/e2e/landing.spec.ts tests/e2e/legal-pages.spec.ts tests/e2e/auth-login.spec.ts tests/e2e/auth-gate.spec.ts tests/e2e/security-headers.spec.ts

# 4. Lighthouse mobile (success criterion #1)
npx lighthouse http://localhost:3000 --quiet --chrome-flags="--headless" --only-categories=performance --form-factor=mobile --output=json --output-path=./lighthouse-report.json
# Must report performance score >= 0.8

# 5. Manual happy-path smoke (solo dev's own email)
# Open http://localhost:3000 → click "Регистрация" → fill form → check both consents → submit captcha →
# check email → click link → land on /dashboard with empty state + greeting

# 6. Database verification (after manual registration)
# Connect to local Supabase: psql ... -c "SELECT purpose, policy_version, ip, length(user_agent) > 0 AS has_ua FROM user_consents;"
# Should return 2 rows: pdn_processing, oferta — both with policy_version='1.0-draft', non-null IP, non-null UA
```

Then run `/gsd:verify-phase 2` for goal-backward verification against ROADMAP success criteria.

---

## Confidence Assessment

**HIGH overall.** RESEARCH.md is exhaustive (1471 lines including copy-paste-ready code for every pattern), UI-SPEC.md fully specifies all 11 screens with Russian copy and ASCII layouts, and Phase 1 already shipped all foundational primitives (`env.ts`, `admin.ts`, `logger.ts`, `audit-log.ts`, `audit_log` migration, RLS harness). The only MEDIUM-confidence area is the `@yandex/smart-captcha` install (slopcheck was unavailable in research, mitigated by a blocking `checkpoint:human-verify` task in plan-06). Plan-07 is the largest single plan but stays under the 50% context budget by deferring forgot/reset (plan-09) and login/logout (plan-08) to dedicated plans. Wave-3 onwards has clean file-ownership boundaries that make parallel execution safe.

**Risks called out and mitigated above:** Pitfalls #14, #18, #20, #16 (accepted), #21, #22, #24, #30.

---

*Phase 2 PLAN.md — created 2026-05-24; revised 2026-05-24 (15 plan-checker fixes; +1 plan-00 typecheck baseline)*
*Next: `/gsd:execute-phase 2` (or sequentially `/gsd:execute-plan 2 00` → `2 01` → ... → `/gsd:execute-plan 2 10`)*
