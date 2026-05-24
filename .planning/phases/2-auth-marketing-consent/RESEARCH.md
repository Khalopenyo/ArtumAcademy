# Phase 2: Auth + Marketing Shell + 152-ФЗ Consent (dev SMTP) — Research

**Researched:** 2026-05-24
**Domain:** Next.js 14 App Router auth (Supabase) + RU legal compliance (152-ФЗ) + RU mobile landing + Yandex SmartCaptcha + Postgres-backed rate limit
**Confidence:** HIGH for `@supabase/ssr` flow + `@yandex/smart-captcha` (verified on npm + official docs); HIGH for React Hook Form + Zod patterns (verified against current Next.js 14 docs + RHF discussions); MEDIUM for Russian privacy/oferta legal structure (kontur.ru references + 152-ФЗ official text but specific wording requires юрист sign-off in P7); HIGH for Postgres rate-limit pattern (Neon + Supabase community guides).

## Summary

This is the **first phase where real users land on the product**. They open the landing on a phone, read about the course, click "Регистрация", tick two checkboxes (152-ФЗ consent + offerta), pass Yandex SmartCaptcha, get a confirmation email through Supabase default SMTP, click the link, and end up on an empty `/dashboard`. Email deliverability (Mail.ru/Yandex/Rambler), custom SMTP, juridical sign-off, and CSP enforcement are **deferred to Phase 7** — we ship with Supabase default SMTP to dev mailboxes only.

The 18 requirements split into three orthogonal tracks that can be paralleled by sub-agents: (a) **Marketing shell** (LAND-01..05, LEGAL-01..03 — `(marketing)` layout, landing, course preview, footer, `/privacy`, `/oferta` drafts, security headers); (b) **Auth pipeline** (AUTH-01..09 — Server Actions wrapping `supabase.auth.*`, RHF+Zod forms, Yandex SmartCaptcha, `(app)` auth gate); (c) **Compliance evidence** (AUTH-03 consents migration, AUTH-10 Postgres-backed rate-limit, AUTH-08 middleware/auth-gate + `next` redirect with Suspense — Pitfall #20 mitigation).

**Primary recommendation:** Default `@supabase/ssr` v0.5.1 (already locked) password-auth flow + Server Actions in `src/server/actions/auth.ts` returning the project's discriminated union, RHF+Zod with shared schemas in `src/lib/schemas/auth.ts`, `@yandex/smart-captcha@^2.9.1` widget + server validation via POST to `smartcaptcha.cloud.yandex.ru/validate`, Postgres sliding-window rate limit (`rate_limit_log` table + `rateLimit({ key, action, window, max })` wrapper), `user_consents` table with separate rows for `pdn_processing` + `offerta` purposes captured with IP+UA from `next/headers`. Privacy/oferta text marked `[TODO: юрист-ревью P7]` with `policy_version: "1.0-draft"`. No custom SMTP wiring — that is COMP-track in P7.

## User Constraints (derived from PROJECT.md + ROADMAP.md + REQUIREMENTS.md — no `2-CONTEXT.md` exists yet)

### Locked Decisions (from PROJECT.md, ROADMAP.md, research/STACK.md — treated as immutable)

- **Stack:** Next.js 14.2.15 App Router + TypeScript strict + `@supabase/ssr@^0.5.1` + `@supabase/supabase-js@^2.45.4` + Tailwind 3.4 + shadcn/ui (Radix). [VERIFIED: package.json:35-54]
- **Forms:** React Hook Form `^7.53.0` + Zod `^3.23.8` + `@hookform/resolvers@^3.9.0` (already installed in P1). [VERIFIED: package.json:30,48,53]
- **Email in P2:** Supabase Auth **default** SMTP only — sends to dev mailbox addresses (`@gmail.com`, `@yandex.ru` is fine for solo dev's own ящик, but no Mail.ru/Yandex inbox delivery testing in P2). Custom SMTP wiring (EMAIL-01) deferred to P7. [CITED: ROADMAP.md:61-72, REQUIREMENTS.md:330-340]
- **Captcha:** Yandex SmartCaptcha — confirmed by `.claude/skills/security/SKILL.md:218-226` (server validation pattern). Already split into `YANDEX_CAPTCHA_SERVER_KEY` + `NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY` env vars. [CITED: security/SKILL.md:30-31]
- **Rate-limit backend:** Postgres-backed (NOT Upstash) — Upstash reachability from RU not verified per research/STACK.md §Rate Limiting; we use Postgres-only to remove external dependency. [CITED: research/STACK.md:55-60]
- **Service-role boundary:** `src/lib/supabase/admin.ts` is server-only (`import 'server-only'` first line) — ESLint `no-restricted-imports` blocks client imports. P1 set this up; P2 must not violate. [VERIFIED: 1-dev-foundations/VERIFICATION.md:43-65]
- **Audit log:** `audit_log` table exists with helper `auditLog()` capturing IP+UA from `next/headers` (case-insensitive `X-Forwarded-For` parser). P2 reuses it for `auth.register`, `auth.login_success`, `auth.login_failed`, `auth.password_reset_requested`, `auth.password_reset_completed`, `account.consent_granted`. [VERIFIED: 1-dev-foundations/VERIFICATION.md:117-141, supabase/migrations/20260524000001_add_audit_log.sql]
- **Discriminated-union Server Action result:** `{ ok: true; ... } | { ok: false; error: string }` — never throw for business errors. [CITED: api-conventions/SKILL.md:42-46, 80-103]
- **Route grouping:** `(marketing)` owns `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/privacy`, `/oferta`. `(app)/layout.tsx` is the auth gate redirecting to `/login?next=<encoded path>`. [CITED: research/ARCHITECTURE.md:683-716]
- **Locale:** `ru-RU` only — `<html lang="ru">` already set, Inter font with cyrillic subset already loaded. [VERIFIED: src/app/layout.tsx:6,29]

### Claude's Discretion (research → recommend)

- Exact wording of `/privacy` + `/oferta` drafts (only structural skeleton + `[TODO: юрист-ревью P7]` markers — final wording is a P7 COMP-02 gate).
- Choice between `useTransition` vs `useActionState` for form submission UX (recommendation below: **`useTransition`** because it pairs cleanly with `react-hook-form`'s `handleSubmit` and the project's `discriminated-union return` contract).
- Decision on Yandex SmartCaptcha visible vs invisible widget (recommendation: **visible** on `/register` and `/forgot-password`; invisible introduces friction with React 18 strict mode double-renders and is overkill at MVP traffic volume).
- Failover behaviour if `smartcaptcha.cloud.yandex.ru/validate` is unreachable (recommendation: **block submission**, NOT "allow-with-warning" — the Yandex official guidance saying "treat HTTP errors as `status: ok`" is for *production* graceful degradation; for P2 dev stand we choose strict to surface integration bugs).
- Whether to use `next-seo` or pure Next.js Metadata API (recommendation: **pure Metadata API + `app/sitemap.ts` + `app/robots.ts`** — `next-seo` is legacy Pages Router-flavored and adds ~5KB to bundle; Next.js 14 native is the 2026 standard).
- Hero illustration style (animated SVG vs static AVIF) — for Lighthouse mobile-perf ≥80 prefer **static AVIF + `next/image`**.
- FAQ accordion library — recommendation: install `@radix-ui/react-accordion@^1.2` via `npx shadcn@latest add accordion` (already part of shadcn primitives).

### Deferred Ideas — OUT OF SCOPE for P2 (do not implement)

- **Custom SMTP / Unisender SMTP / SPF/DKIM/DMARC** — P7 EMAIL-01.
- **Deliverability testing on Mail.ru/Yandex/Rambler** — P7 EMAIL-03.
- **Юрист sign-off on /privacy + /oferta wording** — P7 COMP-02. P2 ships drafts with `[TODO: юрист-ревью]` markers.
- **РКН notification submission** — P7 COMP-01.
- **OAuth (Google, VK, Yandex ID)** — out of scope M1 (PROJECT.md `## Out of Scope`).
- **Magic link login** — out of scope M1 (PROJECT.md).
- **Marketing email opt-in checkbox** — out of scope M1 (Unisender deferred to M2 per PROJECT.md).
- **Reviews / testimonials on landing** — flagged as M2 in research/FEATURES.md.
- **Multi-language UI (EN)** — out of scope (PROJECT.md).
- **Profile name editing UI** — that is PROF-01 in P6, not P2.
- **Account deletion** — that is PROF-02 in P6.
- **Sentry runtime smoke (Bugsink/GlitchTip live)** — Phase 1 deferred runtime smoke to first dev with Docker. P2 inherits that deferral; it's NOT a P2 task.
- **CSP enforce** — LEGAL-04 deferred to P6.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEGAL-01 | `/privacy` page with policy version, processed data, purposes, retention, ИП реквизиты | §RU Privacy/Oferta Structure + skeleton template + `[TODO: юрист-ревью P7]` markers |
| LEGAL-02 | `/oferta` page with ИП реквизиты, service description, price, refund, jurisdiction | §RU Privacy/Oferta Structure + skeleton template |
| LEGAL-03 | HTTPS-only HSTS + `X-Frame-Options DENY` + `X-Content-Type-Options nosniff` + `Referrer-Policy strict-origin-when-cross-origin` + `Permissions-Policy` in `next.config.js` | §Security Headers (most already in next.config.js per codebase/ARCHITECTURE.md:238 — only need to verify Permissions-Policy is added) |
| LAND-01 | Landing `/` with hero, programme description, pricing block, FAQ, footer with Telegram+email | §Mobile-First Landing Patterns + §FAQ Accordion |
| LAND-02 | `/courses/[slug]` public preview: cover, duration, price, modules tree, CTA buy (anon → `/register?next=<encoded>`) | §Course Preview Page + §Open-Redirect Safety |
| LAND-03 | Adaptive mobile-first vert layout; landing + course page Lighthouse mobile-perf ≥80 | §Lighthouse Mobile Performance Requirements |
| LAND-04 | SEO baseline: per-page `<title>` + meta-description; `robots.txt`; `sitemap.xml`; OpenGraph image | §Next.js 14 Metadata API + `app/sitemap.ts` + `app/robots.ts` |
| LAND-05 | Footer with `/privacy`, `/oferta`, contacts (email + Telegram), copyright | §Footer Pattern |
| AUTH-01 | `/register` email+password; password ≥8 chars, ≥1 digit | §Auth Server Actions + Zod password schema |
| AUTH-02 | Two mandatory checkboxes on register: ПДн + offerta (separate, with links); submit disabled without both | §Consent Capture UX + RHF watch pattern |
| AUTH-03 | `user_consents(user_id, purpose, policy_version, ip, user_agent, accepted_at)` — separate rows per purpose | §`user_consents` Migration + Insertion |
| AUTH-04 | Email confirmation flow + resend button | §Supabase Email Confirmation Flow + `/auth/confirm` route handler |
| AUTH-05 | `/login` email+password; session persists cookie close/reopen | §Supabase Auth Cookies (default 30-day refresh, P1 already wired middleware) |
| AUTH-06 | `/forgot-password` → email link → `/reset-password?code=...`; one-time, 1-hour TTL | §Password Reset Flow (Supabase default TTL = 1h) |
| AUTH-07 | Logout from any page; server-side invalidation | §Logout Server Action — `signOut({ scope: 'global' })` |
| AUTH-08 | Middleware refreshes cookie; `(app)/layout.tsx` redirects to `/login?next=<path>` | §Auth Gate Pattern + §`next` Param Suspense (Pitfall #20) |
| AUTH-09 | Yandex SmartCaptcha on `/register` and `/forgot-password` | §`@yandex/smart-captcha` Integration + §Server Token Verification |
| AUTH-10 | Rate-limit on `/login` (5/15min/IP+email), `/register` (3/hr/IP), `/forgot-password` (3/hr/email); Postgres-backed | §Postgres Sliding-Window Rate Limit |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Landing rendering | Frontend Server (RSC) | CDN (Vercel static) | Static-friendly hero + content; SSR with `revalidate=300`. No client-side fetches. |
| Course preview rendering | Frontend Server (RSC) | Database | Reads `courses` (published only) via RLS; no commerce yet (price column added in P3). |
| Auth form UI | Browser (Client Component) | Frontend Server (Server Action) | RHF + Zod runs in browser for instant feedback; submission flows to Server Action. |
| Supabase auth state | Frontend Server (middleware + Server Action) | Database (auth.users) | Cookies are httpOnly — client never holds the JWT. P1 already wired session refresh. |
| Email confirmation routing | Frontend Server (Route Handler `/auth/confirm`) | Database (auth.users) | Supabase Auth issues `token_hash`; our Route Handler calls `verifyOtp` then redirects. |
| Consent storage | API / Server Action | Database (`user_consents`) | IP + UA captured server-side from `next/headers`; client never sets these. |
| Captcha widget | Browser (Client Component) | Frontend Server (Server Action validate) | Token generated in browser via Yandex JS; validated server-side via Yandex API HTTP. |
| Rate-limit enforcement | Server Action (wrapper invocation) | Database (`rate_limit_log` table) | Sliding-window via SQL aggregation; called at TOP of every rate-limited Server Action before any other work. |
| 152-ФЗ policy page | CDN (static) | — | Pure markdown rendered as RSC; no DB. |
| Audit logging | API (auditLog helper) | Database (`audit_log`) | Reuses P1 helper — captures IP/UA in same `next/headers()` call as consents. |

## Standard Stack

### Core (already locked — DO NOT change)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `14.2.15` | App Router | Locked per PROJECT.md [VERIFIED: package.json:44] |
| `react` / `react-dom` | `^18.3.1` | UI runtime | Locked [VERIFIED: package.json:46-47] |
| `@supabase/ssr` | `^0.5.1` | Cookie-based auth, server client | Locked [VERIFIED: package.json:36]; canonical Supabase pattern for Next.js 14 App Router [CITED: https://supabase.com/docs/guides/auth/server-side/nextjs] |
| `@supabase/supabase-js` | `^2.45.4` | Auth + DB SDK | Locked [VERIFIED: package.json:37] |
| `react-hook-form` | `^7.53.0` | Form state + validation | Locked [VERIFIED: package.json:48] |
| `@hookform/resolvers` | `^3.9.0` | Zod adapter for RHF | Already installed in P1 [VERIFIED: package.json:30] |
| `zod` | `^3.23.8` | Schema validation | Locked [VERIFIED: package.json:53]; share schema client+server |
| `sonner` | `^1.5.0` | Toast notifications | Already in root layout [VERIFIED: src/app/layout.tsx:32] |
| `tailwindcss` | `^3.4.13` | Styling | Locked [VERIFIED: package.json:79] |
| `lucide-react` | `^0.451.0` | Icons (used in footer, buttons) | Locked [VERIFIED: package.json:43] |
| `pino` | `^10.3.1` | Structured logging — wrap every Server Action | Already set up [VERIFIED: src/lib/logger.ts (P1)] |

### Additive in P2

| Library | Version | Purpose | When to Use | Provenance |
|---------|---------|---------|-------------|------------|
| `@yandex/smart-captcha` | `^2.9.1` | Yandex SmartCaptcha React widget | `/register` and `/forgot-password` forms | [VERIFIED: npm registry + maintainers `yandex-bot`, `yandex-metrica-watch` from `@yandex-team.ru` + official docs link `https://yandex.cloud/en/docs/smartcaptcha/concepts/react`] |
| `@radix-ui/react-accordion` | `^1.2.2` | FAQ accordion (added via shadcn) | Landing FAQ block | [VERIFIED: registry shows `1.2.12` latest 2026-05 — pin minor with `^1.2`; install via `npx shadcn@latest add accordion`] |
| `@radix-ui/react-checkbox` | `^1.1.3` | Custom checkbox for consent (added via shadcn) | Two consent checkboxes on register | [VERIFIED: shadcn `checkbox` primitive uses this] |

### Already-installed shadcn primitives needed (verify present, install if missing)

| shadcn primitive | Used for | Install command |
|---|---|---|
| `button` | All CTAs, submit buttons | `npx shadcn@latest add button` |
| `input` | Email, password, name fields | `npx shadcn@latest add input` |
| `label` | Form labels | already have `@radix-ui/react-label` per package.json:33 |
| `form` | RHF-shadcn integration | `npx shadcn@latest add form` |
| `checkbox` | Consent checkboxes | `npx shadcn@latest add checkbox` |
| `card` | Hero, pricing, FAQ cards | `npx shadcn@latest add card` |
| `accordion` | FAQ | `npx shadcn@latest add accordion` |
| `skeleton` | Loading states | `npx shadcn@latest add skeleton` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@yandex/smart-captcha` | hCaptcha / reCAPTCHA / Cloudflare Turnstile | hCaptcha geographically unreliable in RU; reCAPTCHA Google-blocked partially; Turnstile is Cloudflare (PROJECT.md flags sanctions risk). Yandex is RU-resident and skill-mandated. |
| `useTransition` for form pending | `useActionState` (React 19) | We're on React 18.3.1, `useActionState` is React 19 only. `useTransition` is the correct 18.3 pattern. |
| Pure Next.js Metadata API | `next-seo@^7.2.0` | `next-seo` is current (last release 2026-02-15) but adds bundle weight and is mostly Pages-Router-flavored; Next.js 14 native Metadata API + `app/sitemap.ts` + `app/robots.ts` is the 2026 canonical pattern [CITED: nextjs.org/docs/app/getting-started/metadata-and-og-images]. |
| Postgres rate-limit | `@upstash/ratelimit@^2.0.8` | Upstash reachability from RU not verified per research/STACK.md §Rate Limiting [CITED: STACK.md:55-60]. Postgres adds 5-10ms per check vs Upstash's edge speed, but at MVP volume (<100 RPS) cost is invisible. |
| Visible SmartCaptcha widget | `InvisibleSmartCaptcha` | Invisible captcha triggers on submit, fights React strict mode double-mount in dev, and adds UX friction for legitimate users; visible widget is the explicit, accessible default. |

### Installation Command

```bash
# Production deps
npm install @yandex/smart-captcha@^2.9.1

# shadcn primitives (each creates a file under src/components/ui/)
npx shadcn@latest add button input form checkbox label card accordion skeleton
```

### Version Verification (done 2026-05-24)

| Package | Latest | Verified Source |
|---|---|---|
| `@yandex/smart-captcha` | `2.9.1` (published 2 months ago) | `npm view @yandex/smart-captcha` |
| `next` | `14.2.15` (locked) — registry latest `15.x` (do not bump) | `npm view next` |
| `@supabase/ssr` | `0.5.1` (locked) — registry latest `0.10.3` (do not bump) | `npm view @supabase/ssr` |
| `@supabase/supabase-js` | `2.45.4` (locked) | `npm view @supabase/supabase-js` |
| `react-hook-form` | `7.76.1` available; `^7.53.0` lockfile-compatible | `npm view react-hook-form` |
| `@hookform/resolvers` | `5.4.0` available; STAY on `^3.9.0` per STACK.md (Zod 3.23 + resolvers 5.x is breaking) | `npm view @hookform/resolvers` |
| `zod` | `3.23.8` (locked) — Zod 4 available but resolvers 3.x requires Zod ≤3.24 | per research/STACK.md:150 |
| `@radix-ui/react-accordion` | `1.2.12` latest, `^1.2.2` safe | `npm view @radix-ui/react-accordion` |

## Package Legitimacy Audit

> slopcheck install was **denied by the sandbox** (auto-rejected during research). Per `<package_legitimacy_protocol>`, packages NOT verified via slopcheck must be tagged `[ASSUMED]` even when registry-verified. The planner MUST insert a `checkpoint:human-verify` task before each `npm install` step. Reference cross-checks (npm registry metadata, official Yandex Cloud docs URL, maintainer domain) are recorded for the planner's review.

| Package | Registry | Age | Downloads | Source Repo / Maintainer | slopcheck | Disposition |
|---|---|---|---|---|---|---|
| `@yandex/smart-captcha` | npm | 22 versions, latest 2 months ago | Active (per Yandex Cloud official documentation reference) | Maintainers `yandex-bot@yandex-team.ru`, `yandex-metrica-watch@yandex-team.ru` — official Yandex npm scope | [UNAVAILABLE] | **Approved — ASSUMED**. Cross-check: official Yandex Cloud docs at `https://yandex.cloud/en/docs/smartcaptcha/concepts/react` references this exact package; npm install command `npm i -PE @yandex/smart-captcha` documented officially. Planner must add `checkpoint:human-verify` before install. |
| `@radix-ui/react-accordion` | npm | 5+ years, latest 2026-05 | High (Radix is a top-100 maintained library) | github.com/radix-ui/primitives | [UNAVAILABLE] | **Approved — ASSUMED**. Cross-check: shadcn/ui uses this directly; already paired with locked `@radix-ui/react-label`, `react-dialog`, `react-slot` in package.json. Planner must add `checkpoint:human-verify` before install. |
| `@radix-ui/react-checkbox` | npm | active | High | github.com/radix-ui/primitives | [UNAVAILABLE] | **Approved — ASSUMED**. Same provenance as `@radix-ui/react-accordion`. |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck not run).
**Packages flagged as suspicious [SUS]:** none (slopcheck not run).

> **Planner guidance:** Even though all three are `[ASSUMED]` because slopcheck was denied, only `@yandex/smart-captcha` is novel — the two Radix packages are extensions of an already-installed family. The planner may use a single `checkpoint:human-verify` task before the `npm install @yandex/smart-captcha` step that asks the human: "Confirmed @yandex/smart-captcha@2.9.1 is the official Yandex package (maintainer @yandex-team.ru, version 2.9.1 published ~2 months ago, used by Yandex Cloud's own React docs)? Y/n".

## Architecture Patterns

### System Architecture Diagram

```
                                         ┌──────────────────────────┐
                                         │ Browser (mobile-first)    │
                                         │ - React 18 RSC + RHF      │
                                         │ - @yandex/smart-captcha   │
                                         └─────────┬────────────────┘
                                                   │
                              ┌────────────────────┴────────────────┐
                              │ HTTPS + httpOnly sb-* cookies        │
                              ▼                                      ▼
            ┌──────────────────────────────┐    ┌──────────────────────────────┐
            │ (marketing) Server Components│    │ (app) Server Components       │
            │  / /courses/[slug]           │    │  /dashboard (empty in P2)     │
            │  /login /register            │    │  layout.tsx auth gate         │
            │  /forgot-password            │    │   ↳ redirect('/login?next=…') │
            │  /reset-password             │    │     if not authed              │
            │  /privacy /oferta             │    │                               │
            └──────┬───────────────────────┘    └───────────────────────────────┘
                   │                                       ▲
                   │ form submit (RHF)                     │
                   ▼                                       │
            ┌──────────────────────────────┐               │
            │ Server Action (src/server/    │               │
            │  actions/auth.ts)             │               │
            │ 1. Zod safeParse              │               │
            │ 2. rateLimit({ key, action }) │               │
            │ 3. verifyCaptcha(token, ip)   │               │
            │ 4. supabase.auth.signUp/etc.  │               │
            │ 5. insert user_consents (×2)  │               │
            │ 6. auditLog('auth.register')  │               │
            │ 7. return { ok, ... }         │               │
            └────┬─────────────────────────┘
                 │ admin client (server-only)
                 ▼
            ┌──────────────────────────────┐  ┌──────────────────────────┐
            │ Supabase Postgres (eu-central-1) │  │ smartcaptcha.cloud.yandex.ru │
            │ - auth.users                  │←→│ POST /validate              │
            │ - profiles (existing)         │  │ x-www-form-urlencoded         │
            │ - user_consents (NEW P2)      │  └──────────────────────────┘
            │ - rate_limit_log (NEW P2)     │
            │ - audit_log (P1)              │
            └──────┬───────────────────────┘
                   │ Supabase Auth → email link
                   ▼
            ┌──────────────────────────────┐
            │ User's inbox                  │
            │ → click confirmation link     │
            │ → GET /auth/confirm           │
            │   ?token_hash=…&type=signup   │
            │   &next=/dashboard            │
            │ Route Handler:                │
            │ 1. verifyOtp({ token, type }) │
            │ 2. redirect(safeNext)         │
            └──────────────────────────────┘
```

### Recommended File Structure (additions to P1 scaffold)

```
src/
├── app/
│   ├── (marketing)/
│   │   ├── layout.tsx                   # Marketing chrome (header + footer)
│   │   ├── page.tsx                     # Landing /
│   │   ├── components/                  # Page-local components
│   │   │   ├── Hero.tsx
│   │   │   ├── Pricing.tsx
│   │   │   ├── FAQ.tsx
│   │   │   └── Footer.tsx
│   │   ├── courses/
│   │   │   └── [slug]/
│   │   │       ├── page.tsx             # /courses/[slug]
│   │   │       └── components/CoursePreview.tsx
│   │   ├── login/
│   │   │   ├── page.tsx                 # /login (Server Component shell)
│   │   │   └── components/LoginForm.tsx ('use client')
│   │   ├── register/
│   │   │   ├── page.tsx
│   │   │   └── components/RegisterForm.tsx ('use client')
│   │   ├── forgot-password/
│   │   │   ├── page.tsx
│   │   │   └── components/ForgotPasswordForm.tsx ('use client')
│   │   ├── reset-password/
│   │   │   ├── page.tsx
│   │   │   └── components/ResetPasswordForm.tsx ('use client')
│   │   ├── privacy/page.tsx             # /privacy — RSC, static MD-style
│   │   └── oferta/page.tsx              # /oferta
│   ├── (app)/
│   │   ├── layout.tsx                   # Auth gate; redirect('/login?next=…')
│   │   └── dashboard/
│   │       └── page.tsx                 # Empty-state ("у вас пока нет курсов")
│   ├── auth/
│   │   └── confirm/route.ts             # Email confirmation Route Handler
│   ├── sitemap.ts                       # Per Next.js 14 file convention
│   └── robots.ts
├── lib/
│   ├── captcha/
│   │   ├── verify.ts                    # POST to smartcaptcha.cloud.yandex.ru
│   │   └── verify.test.ts
│   ├── rate-limit/
│   │   ├── index.ts                     # rateLimit({ key, action, window, max })
│   │   └── index.test.ts
│   └── schemas/
│       └── auth.ts                      # Shared Zod schemas (client + server)
├── server/
│   └── actions/
│       ├── auth.ts                      # register/login/logout/forgot/reset
│       └── auth.test.ts                 # Validation tests; integration in tests/integration/
└── content/
    ├── privacy.tsx                      # Long-form text component (versioned)
    └── oferta.tsx                       # Long-form text component (versioned)

supabase/migrations/
├── 20260524000001_add_audit_log.sql     # P1 (existing)
├── 20260525000001_add_user_consents.sql # P2 NEW
└── 20260525000002_add_rate_limit_log.sql # P2 NEW
```

### Pattern 1: Supabase Server Client (already wired in P1)

The factory `createServerSupabase()` at `src/lib/supabase/server.ts` is used in **every** Server Component, Server Action, Server Query. Per-request cookies are bridged via `next/headers`. No changes needed in P2 — but new Route Handler `/auth/confirm` will instantiate it.

```ts
// Existing — DO NOT recreate
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (cs) => { /* try-catch in existing impl */ } } }
  );
}
```

### Pattern 2: Auth Server Action (canonical for `/register`)

```ts
// src/server/actions/auth.ts
'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyCaptcha } from '@/lib/captcha/verify';
import { rateLimit } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { headers } from 'next/headers';
import { registerSchema } from '@/lib/schemas/auth';

type RegisterResult =
  | { ok: true; emailSentTo: string }
  | { ok: false; error: string; field?: 'email' | 'password' | 'captcha' };

const POLICY_VERSION = '1.0-draft';

export async function registerAction(input: unknown): Promise<RegisterResult> {
  // 1. Validate
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }
  const { email, password, captchaToken, pdnAgreed, ofertaAgreed } = parsed.data;

  // 2. Rate limit BEFORE captcha (cheap check first)
  const ip = getClientIp();
  const rl = await rateLimit({
    key: ip ?? 'unknown-ip',
    action: 'auth.register',
    windowSec: 3600,
    maxAttempts: 3,
  });
  if (!rl.ok) {
    return { ok: false, error: `Слишком много попыток. Попробуйте через ${rl.retryAfterSec} сек.` };
  }

  // 3. Captcha verify
  const captchaResult = await verifyCaptcha(captchaToken, ip);
  if (!captchaResult.ok) {
    return { ok: false, error: 'Капча не пройдена. Обновите страницу и попробуйте снова.', field: 'captcha' };
  }

  // 4. Sign up via Supabase Auth (sends confirmation email through default SMTP)
  const supabase = createServerSupabase();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Supabase appends ?token_hash=…&type=signup&next=… to this URL
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/dashboard`,
    },
  });

  if (signUpError) {
    logger.warn({ err: signUpError, email_hash: hashEmail(email) }, 'register failed');
    // Do NOT leak user-exists info — generic error
    return { ok: false, error: 'Не удалось завершить регистрацию. Попробуйте ещё раз.' };
  }

  const userId = signUpData.user?.id;
  if (!userId) {
    return { ok: false, error: 'Не удалось создать аккаунт. Попробуйте ещё раз.' };
  }

  // 5. Insert consent rows (two separate rows — admin client to bypass user-not-yet-confirmed gates)
  const admin = createAdminClient();
  const ua = headers().get('user-agent') ?? '';
  const acceptedAt = new Date().toISOString();
  const { error: consentError } = await admin.from('user_consents').insert([
    { user_id: userId, purpose: 'pdn_processing', policy_version: POLICY_VERSION, ip, user_agent: ua, accepted_at: acceptedAt },
    { user_id: userId, purpose: 'oferta',         policy_version: POLICY_VERSION, ip, user_agent: ua, accepted_at: acceptedAt },
  ]);
  if (consentError) {
    logger.error({ err: consentError, userId }, 'consent insert failed');
    // Compensating action: do NOT continue. Return error so user retries.
    // Note: signUp already created auth.users row — we leave it; admin can clean up via cron.
    return { ok: false, error: 'Не удалось сохранить согласие. Обратитесь в поддержку.' };
  }

  // 6. Audit log
  await auditLog({
    userId,
    action: 'auth.register',
    entityType: 'user',
    entityId: userId,
    meta: { email_hash: hashEmail(email), policy_version: POLICY_VERSION },
  });

  return { ok: true, emailSentTo: email };
}

function getClientIp(): string | null {
  const xff = headers().get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return headers().get('x-real-ip');
}

function hashEmail(email: string): string {
  // Use sha256 + first 12 hex chars — for audit search without storing raw PII in logs
  // crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 12);
  return '<sha256-prefix>'; // implementation detail
}
```

### Pattern 3: Email Confirmation Route Handler

```ts
// src/app/auth/confirm/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const rawNext = searchParams.get('next');
  // Open-redirect safety per security/SKILL.md §3 + skill rule
  const next = rawNext?.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  if (!token_hash || !type) {
    logger.warn({ token_hash: !!token_hash, type }, 'auth/confirm missing params');
    redirect(`/login?error=invalid_link`);
  }

  const supabase = createServerSupabase();
  const { error, data } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    logger.warn({ err: error, type }, 'verifyOtp failed');
    redirect(`/login?error=expired_link`);
  }

  await auditLog({
    userId: data.user?.id ?? null,
    action: type === 'signup' ? 'auth.email_confirmed' : `auth.${type}_verified`,
    entityType: 'user',
    entityId: data.user?.id,
    meta: { type },
  });

  redirect(next);
}
```

### Pattern 4: Shared Zod Schema (client + server)

```ts
// src/lib/schemas/auth.ts
import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Минимум 8 символов')
  .regex(/\d/, 'Должна быть хотя бы одна цифра');

export const registerSchema = z.object({
  email: z.string().email('Введите корректный email').max(254),
  password: passwordSchema,
  captchaToken: z.string().min(1, 'Подтвердите, что вы не робот'),
  pdnAgreed: z.literal(true, {
    errorMap: () => ({ message: 'Необходимо согласие на обработку персональных данных' }),
  }),
  ofertaAgreed: z.literal(true, {
    errorMap: () => ({ message: 'Необходимо принять условия публичной оферты' }),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Введите корректный email').max(254),
  password: z.string().min(1, 'Введите пароль'),
  // No captcha on login per skill — rate-limit catches brute force; captcha only on register + forgot-password
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Введите корректный email').max(254),
  captchaToken: z.string().min(1, 'Подтвердите, что вы не робот'),
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  passwordConfirm: z.string(),
}).refine((d) => d.password === d.passwordConfirm, {
  message: 'Пароли не совпадают',
  path: ['passwordConfirm'],
});
```

### Pattern 5: RHF + Zod + useTransition + Captcha (full register form)

```tsx
// src/app/(marketing)/register/components/RegisterForm.tsx
'use client';

import { useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SmartCaptcha } from '@yandex/smart-captcha';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

import { registerAction } from '@/server/actions/auth';
import { registerSchema, type RegisterInput } from '@/lib/schemas/auth';

export function RegisterForm() {
  const [pending, startTransition] = useTransition();
  const [captchaToken, setCaptchaToken] = useState('');
  const router = useRouter();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', captchaToken: '', pdnAgreed: false as any, ofertaAgreed: false as any },
    mode: 'onBlur',
  });

  // Live-derive whether submit is enabled: both checkboxes ticked + captcha received
  const pdnAgreed = form.watch('pdnAgreed');
  const ofertaAgreed = form.watch('ofertaAgreed');
  const canSubmit = Boolean(pdnAgreed) && Boolean(ofertaAgreed) && captchaToken.length > 0 && !pending;

  const onSubmit = (values: RegisterInput) => {
    startTransition(async () => {
      const result = await registerAction({ ...values, captchaToken });
      if (!result.ok) {
        toast.error(result.error);
        if (result.field) form.setError(result.field, { message: result.error });
        return;
      }
      toast.success(`Письмо отправлено на ${result.emailSentTo}. Проверьте почту.`);
      router.push(`/login?registered=1`);
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input type="email" inputMode="email" autoComplete="email" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Пароль</FormLabel>
            <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="pdnAgreed" render={({ field }) => (
          <FormItem className="flex items-start gap-2">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={field.onChange} id="pdn" />
            </FormControl>
            <div>
              <FormLabel htmlFor="pdn" className="text-sm">
                Я согласен на обработку моих персональных данных в соответствии с{' '}
                <Link href="/privacy" target="_blank" className="underline">Политикой обработки персональных данных</Link>
              </FormLabel>
              <FormMessage />
            </div>
          </FormItem>
        )} />

        <FormField control={form.control} name="ofertaAgreed" render={({ field }) => (
          <FormItem className="flex items-start gap-2">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={field.onChange} id="oferta" />
            </FormControl>
            <div>
              <FormLabel htmlFor="oferta" className="text-sm">
                Я принимаю условия{' '}
                <Link href="/oferta" target="_blank" className="underline">Публичной оферты</Link>
              </FormLabel>
              <FormMessage />
            </div>
          </FormItem>
        )} />

        <SmartCaptcha
          sitekey={process.env.NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY!}
          onSuccess={(token) => setCaptchaToken(token)}
          onTokenExpired={() => setCaptchaToken('')}
          language="ru"
          // test={process.env.NODE_ENV !== 'production'}  // omit in dev to test real flow with sandbox sitekey
        />

        <Button type="submit" disabled={!canSubmit} className="w-full">
          {pending ? 'Регистрируем…' : 'Зарегистрироваться'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Уже есть аккаунт? <Link href="/login" className="underline">Войти</Link>
        </p>
      </form>
    </Form>
  );
}
```

### Pattern 6: Yandex SmartCaptcha Server Verify

```ts
// src/lib/captcha/verify.ts
import 'server-only';
import { logger } from '@/lib/logger';

const VALIDATE_URL = 'https://smartcaptcha.cloud.yandex.ru/validate';

export interface CaptchaResult {
  ok: boolean;
  reason?: 'invalid' | 'expired' | 'network' | 'server_misconfig';
}

export async function verifyCaptcha(token: string, ip: string | null): Promise<CaptchaResult> {
  const secret = process.env.YANDEX_CAPTCHA_SERVER_KEY;
  if (!secret) {
    logger.error('YANDEX_CAPTCHA_SERVER_KEY missing');
    return { ok: false, reason: 'server_misconfig' };
  }

  const body = new URLSearchParams({ secret, token });
  if (ip) body.append('ip', ip);

  try {
    const res = await fetch(VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'captcha validate HTTP error');
      // STRICT in P2 dev — block submission. Production graceful-degradation per Yandex docs ("treat HTTP error as ok")
      // is a P7 decision once we have monitoring. For dev: surface bugs.
      return { ok: false, reason: 'network' };
    }
    const json = (await res.json()) as { status: 'ok' | 'failed'; message?: string; host?: string };
    if (json.status === 'ok') return { ok: true };
    logger.warn({ message: json.message }, 'captcha rejected by Yandex');
    return { ok: false, reason: 'invalid' };
  } catch (err) {
    logger.error({ err }, 'captcha validate threw');
    return { ok: false, reason: 'network' };
  }
}
```

### Pattern 7: Postgres Sliding-Window Rate Limit

```ts
// src/lib/rate-limit/index.ts
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export interface RateLimitArgs {
  key: string;           // e.g. ip or `ip:${email}` or `email:${email}`
  action: string;        // 'auth.login', 'auth.register', 'auth.forgot_password'
  windowSec: number;     // e.g. 900 for 15min
  maxAttempts: number;   // e.g. 5
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec?: number;
}

export async function rateLimit(args: RateLimitArgs): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - args.windowSec * 1000).toISOString();

  // Count recent attempts
  const { count, error } = await supabase
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('key', args.key)
    .eq('action', args.action)
    .gte('attempted_at', cutoff);

  if (error) {
    logger.error({ err: error, args }, 'rate_limit count failed; failing open');
    return { ok: true, remaining: args.maxAttempts }; // fail-open to avoid lock-out on DB error
  }

  const used = count ?? 0;
  if (used >= args.maxAttempts) {
    return { ok: false, remaining: 0, retryAfterSec: args.windowSec };
  }

  // Record this attempt (admin client bypasses RLS)
  const { error: insertError } = await supabase.from('rate_limit_log').insert({
    key: args.key,
    action: args.action,
    attempted_at: new Date().toISOString(),
  });
  if (insertError) logger.error({ err: insertError, args }, 'rate_limit insert failed');

  return { ok: true, remaining: args.maxAttempts - used - 1 };
}
```

### Pattern 8: `(app)/layout.tsx` Auth Gate

```tsx
// src/app/(app)/layout.tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Capture current path so we can return after login
    const path = headers().get('x-invoke-path') ?? '/dashboard';
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return <>{children}</>;
}
```

### Pattern 9: Login form with `?next=` (Suspense — Pitfall #20 mitigation)

```tsx
// src/app/(marketing)/login/page.tsx — Server Component
import { Suspense } from 'react';
import { LoginForm } from './components/LoginForm';
import { Skeleton } from '@/components/ui/skeleton';

export default function LoginPage() {
  return (
    <main className="container mx-auto max-w-md py-12">
      <h1 className="text-2xl font-semibold">Войти</h1>
      <Suspense fallback={<Skeleton className="mt-6 h-64 w-full" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
```

```tsx
// src/app/(marketing)/login/components/LoginForm.tsx
'use client';
import { useSearchParams } from 'next/navigation';
// ... useSearchParams() now safely inside a Suspense boundary
const params = useSearchParams();
const next = params.get('next') ?? '/dashboard';
```

### Anti-Patterns to Avoid

- **`useSearchParams()` at page root without Suspense** — Pitfall #20, production build fails or page goes blank on slow RU mobile. Always nest the Client Component that calls `useSearchParams()` inside `<Suspense>`.
- **Storing `next` in cookies** — adds CSRF surface. Query param + open-redirect validation (`startsWith('/')` AND NOT `startsWith('//')`) is sufficient.
- **Putting captcha verify inside middleware** — middleware runs on EVERY request; captcha is form-bound and belongs in the Server Action only. Pitfall #22.
- **Hand-rolling captcha widget with iframe** — use `@yandex/smart-captcha` which handles widget lifecycle.
- **Mixing pdn + oferta into one checkbox** — Pitfall #14 explicitly forbids; separate rows in `user_consents`.
- **Predicating consent ONLY on `accepted_at`** — Pitfall #14: must also capture `policy_version`, `ip`, `user_agent` — without these, RKN audits cannot reconstruct what user agreed to.
- **Calling `supabase.auth.signOut()` without `{ scope: 'global' }`** — Pitfall #18: only clears local cookie, refresh token still valid on other devices.
- **Using Server Component's `createServerSupabase().auth.signOut()` from a button onClick** — auth mutations need Server Action wrapper.
- **`window.alert` for errors** — use `sonner` toast per ui-conventions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Email confirmation tokens | Custom JWT + email template + verify endpoint | Supabase Auth `signUp` + `verifyOtp` | Supabase handles hash, TTL, single-use, replay protection out of the box. |
| Password hashing | bcrypt/argon2 manual | `supabase.auth.signInWithPassword` | Auth service owns the hashing config. |
| Captcha widget | Custom iframe with proof-of-work | `@yandex/smart-captcha` | Behavioral analysis, accessibility, mobile UX — months of work. |
| Form state | Custom `useReducer` or controlled state machine | React Hook Form + Zod | RHF handles dirty/touched/error states; zodResolver does the validation glue. |
| Sitemap XML | Manual XML string builder | `app/sitemap.ts` (Next.js convention) | Type-safe + auto-routed by Next.js. |
| robots.txt | Static `public/robots.txt` | `app/robots.ts` (preferred per Next.js docs) | Dynamic per-env (block in preview, allow in prod); type-safe. |
| FAQ accordion | Custom toggle state + height animation | `@radix-ui/react-accordion` via shadcn `add accordion` | Accessibility (ARIA `aria-expanded`, keyboard nav) included. |
| Open-redirect safety | Naive `startsWith('/')` only | Both `startsWith('/')` AND `!startsWith('//')` check | `//evil.com` is treated as absolute URL by some browsers. |
| Rate limit storage | In-memory `Map` | Postgres table with cleanup | Vercel functions are stateless; in-memory state lost on cold start. |
| IP extraction | `req.connection.remoteAddress` | `next/headers` → `x-forwarded-for` first hop (case-insensitive) | Vercel always proxies; remoteAddress is the Vercel edge. **P2 extracts this into `src/lib/headers/client-ip.ts` (`getClientIp()`)** so rate-limit, consent capture, audit-log all share one helper. Plan-06 also refactors `src/lib/audit-log.ts` to import `getClientIp` and delete its inline implementation. |

**Key insight:** Every item above either has a maintained library or is solved by a project utility we already shipped in P1. The total surface area we own in P2 is: Zod schemas, form components, page layouts, two SQL migrations, two server wrappers (captcha, rate-limit), Server Actions, one Route Handler. Everything else delegates.

## Runtime State Inventory

> Not applicable — Phase 2 is a greenfield/additive phase (no rename, refactor, or migration of existing data). Skipped.

## Common Pitfalls (highlighted with mitigation)

### Pitfall #14 (HIGH) — Consent capture without versioning / IP / proof

**What goes wrong:** Registration shows a "Согласен с обработкой ПДн" checkbox, server stores only `accepted_at`. Six months later we update the policy; RKN asks for proof user X agreed to v2.1. We have nothing.

**Mitigation in P2:**
- `user_consents` table with **all five fields** mandatory: `(user_id, purpose, policy_version, ip, user_agent, accepted_at)`.
- **Two separate rows** per registration: `purpose='pdn_processing'` AND `purpose='oferta'`.
- `policy_version` set to compile-time constant in Server Action — bump when wording changes.
- IP via `getClientIp()` reading `x-forwarded-for` (case-insensitive — P1 already verified).
- UA via `headers().get('user-agent')`.
- Insert via service-role admin client (RLS denies anon writes).

**Test:**
```ts
// tests/integration/consent.test.ts
const { data } = await admin.from('user_consents').select('*').eq('user_id', testUser.id);
expect(data).toHaveLength(2);
expect(data.find(r => r.purpose === 'pdn_processing')).toMatchObject({
  policy_version: '1.0-draft',
  ip: expect.stringMatching(/^\d+\.\d+\.\d+\.\d+$/),
  user_agent: expect.stringContaining('Mozilla'),
});
```

### Pitfall #18 (MED→HIGH if combined) — Long-lived JWT TTL leaves stolen sessions usable for weeks

**What goes wrong:** Developer raises Supabase Auth access TTL "for convenience"; stolen JWT remains valid for that whole window. Logout only clears local cookie.

**Mitigation in P2:**
- **Do NOT touch Supabase Auth defaults**: access token = 1h, refresh token = 30 days with rotation = on.
- `logoutAction` calls `supabase.auth.signOut({ scope: 'global' })` — invalidates refresh tokens on all devices.
- `(app)/layout.tsx` calls `supabase.auth.getUser()` (NOT `.getSession()`) — `getUser()` re-validates token against Supabase Auth server.
- Document this in `docs/security/auth-defaults.md` as a phase deliverable so future devs see why we left it alone.

**Test:**
```ts
// tests/integration/auth-logout.test.ts
// After logoutAction: getUser() returns null AND
// any subsequent .auth.refreshSession() with old refresh token returns error
```

### Pitfall #20 (MED→HIGH if it ships) — `useSearchParams` without Suspense → production build fails or page goes blank

**What goes wrong:** Login page reads `?next=/dashboard` via `useSearchParams()` in a Client Component. Local dev works; production `next build` fails with `Missing Suspense boundary with useSearchParams` OR (in some 14.2.x patch versions) the page becomes fully CSR with a flash of blank content on slow RU mobile.

**Mitigation in P2:**
- **Every** Client Component that calls `useSearchParams()` is rendered inside `<Suspense fallback={<Skeleton />}>` from a Server Component parent.
- Pages affected in P2: `/login` (`?next=` + `?registered=1` + `?error=…`), `/reset-password` (`?token_hash=…&type=recovery` — actually handled by /auth/confirm; the form itself takes new password), `/forgot-password` (no params), `/register` (no params).
- Add Suspense check to CI: `npm run build` must succeed before merging any auth page PR.

**Test:**
- `npm run build` succeeds locally (Phase 2 verification gate)
- Playwright smoke `await page.goto('/login?next=/dashboard')` followed by assertion the form is visible within 1s (catches CSR-flash regression)

### Other Pitfalls Relevant to P2 (mitigation summarized — full text in research/PITFALLS.md)

- **Pitfall #10 (HIGH) — RLS USING but no WITH CHECK:** every UPDATE policy in P2 migrations needs both clauses. `user_consents` is INSERT-only (per definition — consent is immutable once given); INSERT policy alone is correct. `rate_limit_log` has NO user-facing policies (service-role only).
- **Pitfall #11 (MED at scale) — `auth.uid()` per-row in RLS:** P2 `user_consents` policy is `(select auth.uid()) = user_id`.
- **Pitfall #12 (HIGH) — service_role leak:** `src/lib/supabase/admin.ts` is already gated by P1. P2 imports it ONLY from `src/server/actions/auth.ts`, `src/lib/audit-log.ts`, `src/lib/rate-limit/index.ts` — all in the allowlist of P1's ESLint config. Do NOT add new client paths.
- **Pitfall #16 (HIGH normally — but deferred) — Supabase default SMTP throttle (~3-30/hr).** This is acceptable for P2 because we test with the solo dev's own ящик. P7 fixes via custom SMTP. Document this clearly in the SUMMARY for P2 close: "Confirmed default SMTP delivers to one dev address; production deliverability is P7 EMAIL-01/02/03."
- **Pitfall #21 (MED) — server-only import leak:** every new server file in P2 (`captcha/verify.ts`, `rate-limit/index.ts`, `server/actions/auth.ts`) begins with `import 'server-only';` as the FIRST line.
- **Pitfall #22 (MED) — middleware bloat:** P2 does NOT touch `src/middleware.ts`. The auth gate is in `(app)/layout.tsx`, not middleware.
- **Pitfall #24 (MED) — over-build:** P2 ships `/dashboard` as an empty-state component ("у вас пока нет курсов") — DO NOT prebuild the courses-list UI (that's DASH-01 in P4).
- **Pitfall #30 (MED) — large landing images:** hero illustration must be AVIF/WebP via `next/image`, ≤200KB; Lighthouse mobile-perf ≥80 is a P2 success gate.

## Migrations (P2 — two new files)

### `20260525000001_add_user_consents.sql`

```sql
-- supabase/migrations/20260525000001_add_user_consents.sql

CREATE TYPE consent_purpose AS ENUM ('pdn_processing', 'oferta');

CREATE TABLE IF NOT EXISTS user_consents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose         consent_purpose NOT NULL,
  policy_version  text NOT NULL,
  ip              inet,
  user_agent      text,
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  -- One row per (user, purpose, version) — re-consent on new version creates new row
  UNIQUE (user_id, purpose, policy_version)
);

CREATE INDEX idx_user_consents_user_purpose
  ON user_consents(user_id, purpose);
CREATE INDEX idx_user_consents_purpose_version
  ON user_consents(purpose, policy_version);

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- Users CAN read their own consents (right to access — 152-ФЗ)
CREATE POLICY "Users read own consents"
  ON user_consents FOR SELECT
  USING ((select auth.uid()) = user_id);

-- No INSERT/UPDATE/DELETE policies — only service_role writes.
-- Consent is INSERT-only by domain — never updated. (If user revokes, we soft-delete via cron job in P6.)

-- Immutability: prevent UPDATE on existing rows even from service_role (defence in depth)
CREATE OR REPLACE FUNCTION user_consents_no_update()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'user_consents is append-only';
END;
$$;

CREATE TRIGGER user_consents_immutable
  BEFORE UPDATE OR DELETE ON user_consents
  FOR EACH ROW EXECUTE FUNCTION user_consents_no_update();
```

### `20260525000002_add_rate_limit_log.sql`

```sql
-- supabase/migrations/20260525000002_add_rate_limit_log.sql

CREATE TABLE IF NOT EXISTS rate_limit_log (
  id            bigserial PRIMARY KEY,
  key           text NOT NULL,           -- e.g. '203.0.113.5' or 'email:user@example.com'
  action        text NOT NULL,           -- 'auth.login', 'auth.register', 'auth.forgot_password'
  attempted_at  timestamptz NOT NULL DEFAULT now()
);

-- Partial index for hot-path query: count attempts for (key, action) within last window
CREATE INDEX idx_rate_limit_log_key_action_time
  ON rate_limit_log(key, action, attempted_at DESC);

ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
-- No policies — only service_role can read/write.

-- Cleanup function (call from pg_cron daily — wiring in P6 ops phase or manually run)
CREATE OR REPLACE FUNCTION rate_limit_log_cleanup()
  RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM rate_limit_log
  WHERE attempted_at < now() - interval '24 hours';
END;
$$;

COMMENT ON TABLE rate_limit_log IS
  'Sliding-window rate-limit attempt log. Cleanup via rate_limit_log_cleanup() — schedule with pg_cron daily.';
```

After applying both: `npm run db:types` regenerates `src/types/database.ts`. (Docker-dependent per P1 deferral; if Docker absent, hand-patch types per P1 plan-04 SUMMARY pattern.)

## Code Examples (verified patterns)

### Example: Marketing Layout with Header + Footer

```tsx
// src/app/(marketing)/layout.tsx
import Link from 'next/link';
import { Footer } from './components/Footer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <nav className="container mx-auto flex h-14 items-center justify-between">
          <Link href="/" className="font-bold">VideoEdit Academy</Link>
          <div className="flex gap-3">
            <Link href="/login" className="text-sm hover:underline">Войти</Link>
            <Link href="/register" className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">
              Регистрация
            </Link>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
```

### Example: Footer with mandatory legal links (LAND-05)

```tsx
// src/app/(marketing)/components/Footer.tsx
import Link from 'next/link';
import { Mail, Send } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto grid gap-6 py-8 md:grid-cols-3">
        <div>
          <div className="font-bold">VideoEdit Academy</div>
          <p className="mt-2 text-sm text-muted-foreground">
            {/* [TODO: юрист-ревью P7 — реквизиты ИП] */}
            ИП Иванов И.И. · ИНН 000000000000 · ОГРНИП 000000000000000
          </p>
          <p className="mt-1 text-xs text-muted-foreground">© 2026 Все права защищены</p>
        </div>
        <div>
          <div className="text-sm font-semibold">Документы</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href="/privacy" className="hover:underline">Политика конфиденциальности</Link></li>
            <li><Link href="/oferta" className="hover:underline">Публичная оферта</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold">Контакты</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <Mail className="size-4" />
              <a href="mailto:support@videoedit-academy.ru">support@videoedit-academy.ru</a>
            </li>
            <li className="flex items-center gap-2">
              <Send className="size-4" />
              <a href="https://t.me/videoedit_academy" target="_blank" rel="noreferrer noopener">@videoedit_academy</a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
```

### Example: SEO via Metadata API + `app/sitemap.ts` + `app/robots.ts`

```tsx
// src/app/(marketing)/page.tsx
import type { Metadata } from 'next';
import { Hero } from './components/Hero';
import { Pricing } from './components/Pricing';
import { FAQ } from './components/FAQ';

export const metadata: Metadata = {
  title: 'VideoEdit Academy — курс по монтажу видео',
  description:
    'Авторский онлайн-курс по монтажу видео в DaVinci Resolve. Доступ навсегда, оплата через ЮKassa.',
  openGraph: {
    title: 'VideoEdit Academy — курс по монтажу видео',
    description: 'Авторский онлайн-курс по монтажу видео.',
    type: 'website',
    locale: 'ru_RU',
    images: ['/og-default.png'],  // 1200x630 AVIF/PNG in /public
  },
  alternates: { canonical: 'https://videoedit-academy.ru/' },
};

export const revalidate = 300;  // ISR — landing rebuilds every 5 min if traffic

export default function HomePage() {
  return (
    <>
      <Hero />
      <Pricing />
      <FAQ />
    </>
  );
}
```

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://videoedit-academy.ru';
  return [
    { url: `${base}/`,        lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/oferta`,  lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    // /courses/[slug] added in P3 dynamically
  ];
}
```

```ts
// src/app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://videoedit-academy.ru';
  // Block crawlers on preview deploys (Vercel sets VERCEL_ENV=preview)
  if (process.env.VERCEL_ENV === 'preview') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard', '/auth/'] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
```

### Example: FAQ Accordion (shadcn-generated)

```tsx
// src/app/(marketing)/components/FAQ.tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const faq = [
  { q: 'Когда начнётся доступ к урокам?', a: 'Сразу после успешной оплаты — обычно в течение 1 минуты.' },
  { q: 'Можно ли вернуть деньги?', a: 'Да, в течение 14 дней с момента покупки, если вы не успели приступить к обучению.' },
  { q: 'Какие способы оплаты?', a: 'Карты Visa, Mastercard, Мир и СБП — через защищённую страницу ЮKassa.' },
  { q: 'Нужен ли DaVinci Resolve для прохождения?', a: 'Да, бесплатной версии DaVinci Resolve достаточно для всех уроков.' },
  { q: 'Сколько длится курс?', a: 'Около 6 часов видео + практика. Доступ навсегда.' },
];

export function FAQ() {
  return (
    <section className="container mx-auto py-16">
      <h2 className="text-2xl font-bold sm:text-3xl">Частые вопросы</h2>
      <Accordion type="single" collapsible className="mt-6">
        {faq.map((item, i) => (
          <AccordionItem key={i} value={`q${i}`}>
            <AccordionTrigger>{item.q}</AccordionTrigger>
            <AccordionContent>{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
```

### Example: `/privacy` page (draft skeleton)

```tsx
// src/app/(marketing)/privacy/page.tsx
import { Privacy_v1_0_draft } from '@/content/privacy';

export const metadata = {
  title: 'Политика обработки персональных данных',
  description: 'Политика обработки персональных данных VideoEdit Academy в соответствии с 152-ФЗ',
  robots: { index: true, follow: false },
};

export default function PrivacyPage() {
  return <Privacy_v1_0_draft />;
}
```

```tsx
// src/content/privacy.tsx — versioned module
// [TODO: юрист-ревью P7] Все блоки помеченные [TODO] требуют согласования с юристом в P7 (COMP-02).
export const POLICY_VERSION = '1.0-draft';

export function Privacy_v1_0_draft() {
  return (
    <article className="prose mx-auto max-w-3xl py-12 dark:prose-invert">
      <h1>Политика обработки персональных данных</h1>
      <p className="text-sm text-muted-foreground">Версия {POLICY_VERSION} · действует с 2026-05-26</p>

      <h2>1. Общие положения</h2>
      <p>
        Настоящая Политика определяет порядок обработки персональных данных Оператором: {/* [TODO: юрист-ревью P7] */}
        ИП [ФИО], ИНН [ИНН], ОГРНИП [ОГРНИП], адрес: [Адрес регистрации], email: support@videoedit-academy.ru
        (далее — «Оператор»), в отношении физических лиц, использующих сайт videoedit-academy.ru
        (далее — «Сайт»).
      </p>

      <h2>2. Основания обработки</h2>
      <p>
        Обработка персональных данных осуществляется на основании Федерального закона от 27.07.2006 № 152-ФЗ
        «О персональных данных», согласия пользователя, и публичной оферты, размещённой по адресу
        videoedit-academy.ru/oferta.
      </p>

      <h2>3. Категории персональных данных</h2>
      <ul>
        <li>Идентификационные: email, имя</li>
        <li>Технические: IP-адрес, тип браузера, время посещения</li>
        <li>Платёжные: данные не хранятся Оператором; передача карточных данных осуществляется напрямую в
            ЮKassa (платёжная система), Оператор получает только статус и идентификатор платежа</li>
      </ul>

      <h2>4. Цели обработки</h2>
      <ul>
        <li>Регистрация и предоставление доступа к платному образовательному контенту</li>
        <li>Исполнение договора-оферты (приём оплаты, выдача доступа, формирование фискальных чеков по 54-ФЗ)</li>
        <li>Связь с пользователем по вопросам поддержки</li>
      </ul>

      <h2>5. Срок хранения</h2>
      <p>
        Персональные данные хранятся в течение действия учётной записи пользователя.
        Финансовые документы (записи о покупках) хранятся {/* [TODO: юрист-ревью P7 — точный срок] */} в течение
        срока, установленного законодательством РФ (как правило, 5 лет согласно 402-ФЗ «О бухгалтерском учёте»).
      </p>

      <h2>6. Права субъекта персональных данных</h2>
      <ul>
        <li>Право на доступ к своим данным</li>
        <li>Право на исправление неточных данных</li>
        <li>Право на отзыв согласия и удаление данных (обработка в течение 30 дней, см. /profile)</li>
        <li>Право на обжалование в Роскомнадзоре</li>
      </ul>

      <h2>7. Способы передачи данных</h2>
      <p>{/* [TODO: юрист-ревью P7 — необходимо описать схему хранения, см. FOUND-09 в P7] */}</p>

      <h2>8. Контактная информация</h2>
      <p>Вопросы по обработке персональных данных направляйте на: support@videoedit-academy.ru</p>

      <p className="mt-12 rounded-md border border-amber-500/30 bg-amber-50/30 p-4 text-sm">
        ⚠ <strong>Внимание:</strong> данная версия Политики — драфт, подлежит юридическому ревью в Phase 7
        (COMP-02). Финальная редакция будет опубликована перед production-запуском.
      </p>
    </article>
  );
}
```

### Example: `/oferta` page (draft skeleton, same versioning pattern)

Mirror `privacy` structure: `src/app/(marketing)/oferta/page.tsx` renders `Oferta_v1_0_draft` from `src/content/oferta.tsx`. Sections: Предмет договора, Цена и порядок оплаты, Порядок предоставления доступа, Возврат денежных средств, Ответственность сторон, Срок действия, Реквизиты ИП, Способ заключения договора (акцепт = регистрация). Every section that names reality (e.g. refund window, jurisdiction) is wrapped in `[TODO: юрист-ревью P7]`.

### Example: Security Headers Verification (LEGAL-03)

Verify `next.config.js` already sets:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (✓ per codebase/ARCHITECTURE.md:238)
- `X-Frame-Options: DENY` (✓)
- `X-Content-Type-Options: nosniff` (✓)
- `Referrer-Policy: strict-origin-when-cross-origin` (✓)

**Add in P2:**
```js
// next.config.js
{
  key: 'Permissions-Policy',
  value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
}
```

Note: CSP enforcement is LEGAL-04 (P6). P2 does not introduce CSP. (Premature enforcement risks breaking Yandex SmartCaptcha and Kinescope embeds before we know their domains.)

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|---|---|---|---|
| `useFormStatus` in `<form action={...}>` | `useTransition` + RHF `handleSubmit` | Stable since Next.js 14 / React 18.3 | RHF still gives blur/change validation that `<form action>` doesn't; pair both via `useTransition` |
| `next-seo` library | Native `Metadata` + `app/sitemap.ts` + `app/robots.ts` | Next.js 13.3+ → fully canonical in 14 | Smaller bundle, type-safe, server-only |
| `useRouter().push()` from `'use client'` for navigation after action | Still correct in Client Components; `redirect()` in Server Actions | unchanged | — |
| Pages-Router `getServerSideProps` | RSC + Server Actions | Next.js 13.4 → standard in 14 | scaffold already uses App Router |
| `auth.getSession()` in middleware | `auth.getUser()` (re-validates against server) | Supabase recommendation since `@supabase/ssr` 0.4+ | Existing P1 middleware uses `getUser()` ✓ |
| Single combined consent checkbox | Separate consent rows per purpose | RKN practice and Pitfall #14 | P2 ships separate rows |
| `confirmation_token` query param | `token_hash` + `type` query params (Supabase Auth current) | `@supabase/ssr` 0.5+ | Use `verifyOtp({ type, token_hash })` |

**Deprecated/outdated:**
- `supabase-auth-helpers-nextjs` — replaced by `@supabase/ssr` (the project is already on `ssr` 0.5.1).
- `getServerSideProps` / `getStaticProps` — Pages Router only, not used in App Router.
- `next-auth` for Supabase — overkill; project uses Supabase Auth directly.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@yandex/smart-captcha@2.9.1` is the legitimate Yandex package (verified registry maintainer = yandex-team.ru; verified by official Yandex Cloud docs page that references the exact package) — but slopcheck was unavailable | Standard Stack + Package Legitimacy Audit | If wrong → malicious captcha widget could exfiltrate keystrokes / form data. Planner MUST insert `checkpoint:human-verify` before install. |
| A2 | `@radix-ui/react-accordion` and `@radix-ui/react-checkbox` are the canonical Radix packages (verified by family relationship with already-installed `@radix-ui/react-label`, `react-dialog`, `react-slot` and shadcn ecosystem) — but slopcheck was unavailable | Standard Stack | If wrong → bundle contains malicious UI primitive. Low risk because they're additions to an existing trusted family. |
| A3 | Supabase Auth password recovery token TTL is 1 hour by default; verifyOtp accepts the `type='recovery'` shape | Pattern 3 + AUTH-06 | If TTL is different in current Supabase build, AUTH-06 spec (1h) needs adjustment. Easy to fix — Supabase dashboard setting. |
| A4 | Supabase default SMTP CAN deliver to one solo-dev mailbox during P2 dev work (rate limit 2-30/hour is sufficient for self-testing) | User Constraints — Locked Decisions | If even self-test bounces, P2 demos fail. Mitigation: in P2 we use the dev's own @gmail / @yandex address NOT prod mass-test. If even that fails, escalate EMAIL-01 (custom SMTP) from P7 to P2. |
| A5 | Yandex SmartCaptcha free tier covers MVP testing volume (~100 captcha tokens during dev + a few users in P6 demos) | AUTH-09 | If tier is paid-from-start, add to budget table; not blocking. |
| A6 | Postgres rate-limit table query is sub-10ms at MVP load with the recommended partial index | Pattern 7 + AUTH-10 | Verify with `EXPLAIN ANALYZE` once data exists. If slow, switch to materialized count or Upstash (escalates from STACK.md fallback). |
| A7 | The exact wording of `/privacy` and `/oferta` drafts (operator name, ИНН, retention periods, jurisdiction) will be filled in by user before юрист sees them in P7 — research provides skeleton only with `[TODO]` markers | LEGAL-01, LEGAL-02 | Draft must be readable for plan-checker; will get final wording in P7 COMP-02. Solo dev must enter ИП placeholders OR mark them explicitly TBD. |
| A8 | The Next.js 14 `Metadata` API + `app/sitemap.ts` + `app/robots.ts` pattern is supported by current `next@14.2.15` (verified canonical pattern in Next.js current docs) | Pattern 5 + LAND-04 | If file conventions differ in 14.2.15 specifically (vs 14.x), check Next.js changelog. Very low risk. |
| A9 | Yandex SmartCaptcha test mode sitekey can be used in dev (per Yandex docs `test={false}` is default) — full visible widget in development is acceptable UX | Pattern 5 | If test mode is mandatory in dev, switch to `test={true}` on non-prod env. |
| A10 | `headers().get('x-forwarded-for')` returns the correct client IP through Vercel's edge — P1 helper already verified case-insensitive parsing | Pattern 2 + AUTH-10 | Already validated in P1 — see `audit-log.test.ts` Case 2. |

**If this table seems large:** it is — because P2 is mostly about correctly-wired user-facing flows where many small assumptions add up. The planner / discuss-phase should triage which need explicit user confirmation. A1 and A7 are highest priority.

## Open Questions

1. **Email confirmation `next` round-trip security.** Supabase appends `?token_hash=…&type=…` to our `emailRedirectTo` URL. If we pass `next=/dashboard` in `emailRedirectTo`, will Supabase preserve it through the email link? The recommended pattern (`https://supabase.com/ui/docs/nextjs/password-based-auth`) shows the email link landing on `/auth/confirm` and the Route Handler reading `next` from query params. ✓ — Verified via Supabase docs.
2. **`policy_version` versioning scheme.** Started at `"1.0-draft"`. After P7 юрист sign-off, bump to `"1.0"`. Future revisions: semver like `"1.1"` (patch text), `"2.0"` (substantive). Plan-phase may want to formalize this in a `docs/compliance/policy-versions.md` file. Recommendation: defer the formalization doc to P7.
3. **Should `/login` require captcha?** PROJECT and AUTH-09 say captcha only on `/register` and `/forgot-password`. Login is protected by rate-limit (5/15min per IP+email). This is the correct posture — captcha on login adds UX friction and rate-limit handles brute-force at MVP scale. Keep as is.
4. **What email subject for confirmation in P2?** Supabase default English template ("Confirm your email"). User-facing email is acceptable in English for P2 dev test; Russian localization is EMAIL-02 (P7). Plan-phase should not assign a task to localize SMTP templates in P2.
5. **Sentry SDK on auth errors in P2?** P1 deferred runtime Sentry smoke (no Bugsink container). P2 should wrap auth Server Actions in `Sentry.captureException` for unexpected errors but the Sentry "verify in dashboard" smoke remains a P6 deliverable (OPS-01). Recommendation: wrap, but don't add new dashboard-verification work.
6. **Initial seed data for `/courses/[slug]`?** P2 needs at least ONE published course to render. P1 has `supabase/seed.sql` with three demo courses — confirm one is `published=true` with a working `slug`. Plan task: extend or verify seed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, dev | ✓ (per .nvmrc / engines) | ≥20.0.0 | — |
| Next.js | Runtime | ✓ | 14.2.15 (locked) | — |
| Supabase project (cloud or local) | Auth + DB | ⚠ Cloud needed at minimum (dev tier); local Docker for integration tests | Cloud free tier | If local Docker absent: integration tests deferred to first dev with Docker (P1 precedent) |
| Supabase CLI | Migrations, `db:types` | ✓ (per package.json devDependency) | ^1.200.3 | — |
| Docker | Local Supabase, integration tests | ⚠ Not on ship machine per P1 verification | — | Defer integration tests per P1 pattern |
| Yandex SmartCaptcha account + sitekey | AUTH-09 | ⚠ Not yet created | — | Solo dev creates free sitekey in `console.cloud.yandex.ru` before AUTH-09 task starts; planner should add a `checkpoint:human-setup` task |
| Supabase Auth default SMTP | AUTH-04, AUTH-06 | ✓ enabled by default | — | If rate-limited during dev (3-30/hr), wait or escalate to EMAIL-01 |
| `NEXT_PUBLIC_APP_URL` env var | `emailRedirectTo`, sitemap, robots | ⚠ Needs setting | — | Defaults to `http://localhost:3000` in dev; planner adds to `.env.example` |
| `YANDEX_CAPTCHA_SERVER_KEY` env var | Captcha verify | ⚠ Needs setting once sitekey created | — | Zod env-parser already requires (per `.env.example`); fails build if missing — correct behaviour |
| `NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY` env var | Widget render | ⚠ Needs setting | — | Same as above |

**Missing dependencies with no fallback:** Yandex SmartCaptcha sitekey (must be created by solo dev — ~5min in Yandex Cloud console). Plan-phase should insert a `checkpoint:human-setup` task before AUTH-09 task.

**Missing dependencies with fallback:** Docker (defer integration tests per P1 pattern); Supabase default SMTP (proven sufficient for solo dev's own ящик).

## Validation Architecture

> `workflow.nyquist_validation: true` per `.planning/config.json`. Section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.2 (unit + component) + Playwright 1.48 (E2E) |
| Config files | `vitest.config.ts` (jsdom — unit); `vitest.integration.config.ts` (node + Supabase local — integration); `playwright.config.ts` (chromium + mobile-chrome) |
| Quick run command | `npm run test:ci` |
| Full suite command | `npm run lint && npm run typecheck && npm run test:ci && npm run build && npm run test:integration && npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| AUTH-01 | Password schema validates ≥8 chars + ≥1 digit | unit | `npx vitest run src/lib/schemas/auth.test.ts` | ❌ Wave 0 |
| AUTH-02 | Submit disabled until both checkboxes ticked | component | `npx vitest run src/app/(marketing)/register/components/RegisterForm.test.tsx` | ❌ Wave 0 |
| AUTH-03 | `user_consents` stores two rows on register with IP+UA+version | integration | `npm run test:integration -- tests/integration/auth/consent.test.ts` | ❌ Wave 0 (Docker-deferred) |
| AUTH-04 | `/auth/confirm` verifies token and redirects | integration | `npm run test:integration -- tests/integration/auth/confirm.test.ts` | ❌ Wave 0 (Docker-deferred) |
| AUTH-05 | Login sets cookie, persists across reload | E2E | `npm run test:e2e -- tests/e2e/auth-login.spec.ts` | ❌ Wave 0 |
| AUTH-06 | Forgot password sends email, link expires | integration | `npm run test:integration -- tests/integration/auth/recovery.test.ts` | ❌ Wave 0 (Docker-deferred) |
| AUTH-07 | Logout invalidates session globally | integration | `npm run test:integration -- tests/integration/auth/logout.test.ts` | ❌ Wave 0 (Docker-deferred) |
| AUTH-08 | `/dashboard` redirects to `/login?next=…` for anon; `?next=` preserved through login | E2E | `npm run test:e2e -- tests/e2e/auth-gate.spec.ts` | ❌ Wave 0 |
| AUTH-09 | Captcha server verify rejects invalid token | unit + integration | `npx vitest run src/lib/captcha/verify.test.ts` + `tests/integration/captcha.test.ts` | ❌ Wave 0 |
| AUTH-10 | 6th attempt in 15min returns 429 | integration | `npm run test:integration -- tests/integration/rate-limit.test.ts` | ❌ Wave 0 (Docker-deferred) |
| LEGAL-01,02 | Privacy and oferta pages render | E2E smoke | `npx playwright test tests/e2e/legal-pages.spec.ts` | ❌ Wave 0 |
| LEGAL-03 | Security headers present on response | E2E header assertion | `npx playwright test tests/e2e/security-headers.spec.ts` | ❌ Wave 0 |
| LAND-01..05 | Landing renders hero + pricing + FAQ + footer | E2E smoke + Lighthouse | `npx playwright test tests/e2e/landing.spec.ts && npx lighthouse http://localhost:3000 --only-categories=performance --form-factor=mobile` | ❌ Wave 0 |
| LAND-03 | Lighthouse mobile-perf ≥80 | manual + CI | `npx lighthouse http://localhost:3000 --quiet --chrome-flags="--headless" --only-categories=performance --form-factor=mobile --output=json` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run lint && npm run typecheck && npm run test:ci` (sub-30s — unit + component only, no integration/E2E)
- **Per wave merge:** Add `npm run build` (catches Pitfall #20 — `useSearchParams` Suspense)
- **Phase gate:** Full suite green before `/gsd:verify-work` (integration + E2E + Lighthouse)

### Wave 0 Gaps

Files to create as part of phase execution (Wave 0 = test scaffolding, before feature waves):

- [ ] `src/lib/schemas/auth.test.ts` — unit tests for Zod schemas (covers AUTH-01)
- [ ] `src/lib/captcha/verify.test.ts` — unit tests with mocked fetch (covers AUTH-09)
- [ ] `src/lib/rate-limit/index.test.ts` — unit tests with mocked admin client (covers AUTH-10 logic)
- [ ] `tests/integration/auth/consent.test.ts` — covers AUTH-03 with real DB
- [ ] `tests/integration/auth/confirm.test.ts` — covers AUTH-04
- [ ] `tests/integration/auth/recovery.test.ts` — covers AUTH-06
- [ ] `tests/integration/auth/logout.test.ts` — covers AUTH-07
- [ ] `tests/integration/captcha.test.ts` — covers AUTH-09 server flow
- [ ] `tests/integration/rate-limit.test.ts` — covers AUTH-10 with sliding window
- [ ] `tests/e2e/auth-login.spec.ts` — covers AUTH-05
- [ ] `tests/e2e/auth-gate.spec.ts` — covers AUTH-08
- [ ] `tests/e2e/landing.spec.ts` — covers LAND-01..05
- [ ] `tests/e2e/legal-pages.spec.ts` — covers LEGAL-01..02
- [ ] `tests/e2e/security-headers.spec.ts` — covers LEGAL-03
- [ ] `src/app/(marketing)/register/components/RegisterForm.test.tsx` — covers AUTH-02
- [ ] Component test pattern for LoginForm, ForgotPasswordForm, ResetPasswordForm — minimum: validation rendering, disabled-state, submit-on-success calls action mock
- [ ] Add a manual smoke step in phase SUMMARY: "Verified register + email confirm + login + logout flow end-to-end against dev Supabase project on my own email."

Framework install: NONE — all test frameworks installed in P1.

## Security Domain

> `security_enforcement` is not explicitly false in config → enabled. Section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | Supabase Auth + httpOnly cookies + 30-day refresh with rotation (default) + global logout scope |
| V3 Session Management | YES | `@supabase/ssr` cookie bridge (existing) + middleware refresh (existing) + getUser() re-validates JWT server-side |
| V4 Access Control | YES | `(app)/layout.tsx` auth gate + RLS on `user_consents` (own only) |
| V5 Input Validation | YES | Zod schemas shared client+server + safeParse before any DB call |
| V6 Cryptography | YES (delegated) | Never hand-roll; Supabase Auth handles password hash; SmartCaptcha tokens validated against Yandex |
| V8 Data Protection | YES | IP+UA captured as 152-ФЗ evidence; logged via pino with `redact.paths` (P1 helper); audit_log immutable trigger |
| V11 Business Logic | YES | Open-redirect check on `next` param; submit-disabled state until both consents ticked |
| V12 File / Resource | n/a (no file upload in P2) | — |
| V13 API | YES | Rate-limit on all auth Server Actions; captcha on `/register` + `/forgot-password`; discriminated union response (no internal error leak) |
| V14 Configuration | YES | Env via Zod (P1); `.env.local` gitignored; production secrets in Vercel env (P7) |

### Known Threat Patterns for {Next.js 14 + Supabase + RU LMS}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Brute-force login | Tampering / DoS | Postgres rate-limit (5 attempts / 15min / IP+email) + Yandex captcha on register/forgot-password (not login per AUTH-09 spec) |
| Stolen JWT replay | Spoofing | Supabase default 1h access TTL + refresh rotation + `signOut({ scope: 'global' })` |
| Open redirect via `?next=` | Tampering | Both `startsWith('/')` AND `!startsWith('//')` check in `/auth/confirm` and `(app)/layout.tsx` |
| Form-submitted plaintext password (CSRF) | Tampering | Server Actions auto-protected by Next.js origin check; HTTPS enforced via HSTS (existing) |
| Cross-user consent forgery | Spoofing | `user_consents` RLS allows SELECT own only; INSERT denied to anon/auth — only service-role via Server Action |
| Open registration spam | DoS | Captcha + rate-limit + email confirmation gate (unconfirmed user has no `email_confirmed_at` → blocked from `/dashboard` via Supabase) |
| Replay of confirmation link | Tampering | Supabase Auth tokens single-use; `verifyOtp` rejects already-used hash |
| RKN consent audit | Repudiation | `user_consents` stores IP+UA+version+timestamp; immutable trigger prevents tampering |
| 152-ФЗ data localisation | Information Disclosure (regulatory) | OUT OF SCOPE for P2 — architectural decision is FOUND-09 in P7. P2 RESEARCH explicitly notes this. |

## Sources

### Primary (HIGH confidence)

- [`@yandex/smart-captcha` on npm — official Yandex maintainers, version 2.9.1](https://www.npmjs.com/package/@yandex/smart-captcha) — verified version, maintainers, license, used by Yandex Cloud's own React docs
- [Yandex Cloud — React integration docs](https://yandex.cloud/en/docs/smartcaptcha/concepts/react) — official component usage, props (`sitekey`, `onSuccess`, `language`, `test`)
- [Yandex Cloud — Server-side validation docs](https://yandex.cloud/en/docs/smartcaptcha/operations/validate-captcha) — exact URL (`https://smartcaptcha.cloud.yandex.ru/validate`), POST body format, JSON response shape
- [Supabase — Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — canonical SSR pattern, cookie bridging
- [Supabase UI Docs — Next.js password-based auth](https://supabase.com/ui/docs/nextjs/password-based-auth) — `/auth/confirm` Route Handler with `verifyOtp`, sign-up form pattern
- [Next.js Metadata API + OG Images (App Router)](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) — current 2026 standard, `app/sitemap.ts`, `app/robots.ts`
- [Next.js — Missing Suspense with useSearchParams](https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout) — Pitfall #20 official mitigation
- [In-repo: `.claude/skills/security/SKILL.md`](file:///Users/tkestkes/Desktop/repo/.claude/skills/security/SKILL.md) — auth gate pattern, captcha verify pattern (skill-mandated)
- [In-repo: `.claude/skills/api-conventions/SKILL.md`](file:///Users/tkestkes/Desktop/repo/.claude/skills/api-conventions/SKILL.md) — Server Action contract, Zod validation, discriminated union return
- [In-repo: `.claude/skills/ui-conventions/SKILL.md`](file:///Users/tkestkes/Desktop/repo/.claude/skills/ui-conventions/SKILL.md) — RHF + Zod + useTransition pattern
- [In-repo: `.claude/skills/database/SKILL.md`](file:///Users/tkestkes/Desktop/repo/.claude/skills/database/SKILL.md) — RLS USING+WITH CHECK, migration naming
- [In-repo: Phase 1 VERIFICATION.md](file:///Users/tkestkes/Desktop/repo/.planning/phases/1-dev-foundations/VERIFICATION.md) — what's already shipped (env, admin client, audit_log helper, ESLint boundary)
- [In-repo: research/ARCHITECTURE.md §5 (Auth + Session)](file:///Users/tkestkes/Desktop/repo/.planning/research/ARCHITECTURE.md) — `(app)/layout.tsx` pattern, `requireUser` + Server Action layering
- [In-repo: research/PITFALLS.md #14, #18, #20](file:///Users/tkestkes/Desktop/repo/.planning/research/PITFALLS.md) — consent capture, JWT TTL, useSearchParams Suspense

### Secondary (MEDIUM confidence)

- [Kontur — Политика обработки персональных данных: структура и требования по 152-ФЗ](https://kontur.ru/articles/4871) — RU practitioner reference for mandatory sections (drafts here must be reviewed by юрист in P7)
- [КонсультантПлюс — 152-ФЗ official text](https://www.consultant.ru/document/cons_doc_LAW_61801/) — primary law text
- [Aurora Scharff — Implementing React Hook Form with Next.js 14 Server Actions](https://aurorascharff.no/posts/implementing-react-hook-form-with-nextjs-14-server-actions/) — useTransition pattern verified against multiple community sources
- [nehalist.io — How to use react-hook-form with Next.js Server Actions and Zod validation](https://nehalist.io/react-hook-form-with-nextjs-server-actions/) — shared schema pattern
- [GitHub Discussions — vercel/next.js #72396 useTransition vs useFormStatus](https://github.com/vercel/next.js/discussions/72396) — pattern selection rationale
- [Neon — Rate Limiting in Postgres guide](https://neon.com/guides/rate-limiting) — sliding window with SQL pattern reference (used for §Postgres Sliding-Window Rate Limit)
- [Mansueli — Supabase rate-limiting with PostgreSQL](https://blog.mansueli.com/rate-limiting-supabase-requests-with-postgresql-and-pgheaderkit) — Supabase-flavored implementation reference

### Tertiary (LOW confidence — flagged for validation)

- None — every claim above is either verified against official docs, in-repo code, or maintainer registry metadata.

## Metadata

**Confidence breakdown:**
- Standard stack (Supabase, RHF, Zod, Yandex captcha library identity): HIGH — locked versions verified on npm; Yandex package verified via official Yandex Cloud docs URL referencing it
- Architecture patterns (auth Server Actions, `/auth/confirm` Route Handler, RLS on `user_consents`): HIGH — matches Supabase 2026 documentation and skill rules
- Privacy/oferta legal structure: MEDIUM — kontur.ru and 152-ФЗ official text confirm mandatory sections; **exact final wording requires юрист sign-off in P7 (COMP-02)**
- Captcha integration: HIGH — official Yandex docs URL + verified npm package identity; tagged `[ASSUMED]` per slopcheck-protocol on package install (planner adds `checkpoint:human-verify`)
- Pitfall mitigations (#14, #18, #20): HIGH — research/PITFALLS.md already documents these for this exact stack; mitigations applied verbatim
- Rate-limit Postgres pattern: MEDIUM — Neon guide and Supabase community blog confirm pattern works; performance at scale validated by EXPLAIN ANALYZE in implementation

**Research date:** 2026-05-24
**Valid until:** 2026-06-23 (30 days — stable stack and patterns; revisit if `@yandex/smart-captcha` major version or `@supabase/ssr` 0.5.x EOL announcement appears)
