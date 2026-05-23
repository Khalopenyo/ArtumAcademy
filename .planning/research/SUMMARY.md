# Project Research Summary

**Project:** VideoEdit Academy
**Domain:** Paid LMS (single-instructor, single-course MVP) — RU/CIS market
**Researched:** 2026-05-24
**Confidence:** HIGH (core technical picks verified against npm + official docs + Russian legal practitioner sources; MEDIUM on a handful of provider-specific surfaces flagged below)

## Executive Summary

VideoEdit Academy is a single-instructor paid-courses platform for the RU/CIS market. The Core Value is «купивший пользователь смотрит контент без возможности скачать» — every architectural decision is judged against payment correctness, access correctness, and video protection on a market where Stripe/Paddle/Mailgun-US do not apply and where 152-ФЗ + 54-ФЗ create real personal liability. The recommended approach is **Next.js 14 App Router + Supabase + ЮKassa + Kinescope (private signed URL)**, deployed first to Vercel `fra1` for an alpha and planned to migrate to Yandex Cloud / Selectel before public launch (`*.vercel.app` only for alpha; custom `.ru` domains on Vercel are intermittently blocked by Roskomnadzor).

M1 is a **vertical MVP, 4-6 weeks solo**, structured as 6 sequential phases through one critical path: foundations → auth+landing → catalog+payment → webhook+access → video player → progress+ship. Research converges strongly on this build order, with two phase-boundary research spikes that must run before code: the **ЮKassa webhook auth model** (the three docs disagree — see Open Questions) before P3, and the **Kinescope private signed-URL JWT claim shape** before P4.

The dominant risks are not technical but compliance and market-fit. **HIGH-severity items that must be addressed in early phases:** (1) ЮKassa webhook idempotency + signature/IP verification + server-side price lookup before any production payment, (2) RLS `WITH CHECK` on every UPDATE policy + `service_role` behind `import 'server-only'`, (3) 152-ФЗ data localisation post-1-July-2025 (Supabase Frankfurt as primary storage is not compliant without legal mitigation), (4) consent capture with full evidence (`user_consents` table with IP/UA/policy_version) shipped together with registration, (5) RU email deliverability via custom SMTP + SPF/DKIM/DMARC (Mail.ru/Yandex reject Supabase default SMTP). Skipping any of these turns a recoverable incident into an existential one for a solo operator.

## Key Findings

### 1. Top Stack Picks (M1 additive — locked core not re-recommended)

Full detail in `.planning/research/STACK.md`.

| # | Package | Version | One-line rationale |
|---|---------|---------|--------------------|
| 1 | `@kinescope/react-kinescope-player` | `^0.5.4` | Official React wrapper for the Core-Value playback surface; saves rolling our own iframe/postMessage lifecycle. HIGH confidence. |
| 2 | `@a2seven/yoo-checkout` | `^1.1.4` (+ mandatory `axios@^1.7.7` override) | Only viable maintained ЮKassa Node SDK; alternatives are unpublished/abandoned. Wrap behind `src/lib/yookassa/client.ts` to allow swap to custom REST. MEDIUM (SDK fossilized 2022). |
| 3 | `@sentry/nextjs` | `^8.x` (NOT 10.x) | Sentry SaaS is fully blocked for RU users since 2024-09-10; pair this SDK with a self-hosted DSN (GlitchTip or Bugsink on Yandex Cloud/Selectel). HIGH on SDK, MEDIUM on hosting. |
| 4 | `pino` + `pino-pretty` | `^10.3.1` / `^11.x` | Structured JSON ops-logging that pairs with the `audit_log` table mandated by the security skill. HIGH. |
| 5 | `msw` | `^2.14.6` | Mocks ЮKassa / Kinescope / Unisender in Vitest without hitting real services. HIGH. |
| Gated | `@upstash/ratelimit` | `^2.0.8` | Only if Upstash is reachable from RU egress; ship `src/lib/rate-limit/index.ts` wrapper with Postgres fallback. LOW on RU availability. |

**Defer / do-not-bump:** Zod 4 (resolver compatibility blocks it), Vitest 3 (optional), Resend/Mailgun/Stripe/Vercel KV/Cloudflare anything (sanctions / RU connectivity).

### 2. MVP Feature Set (M1 only — table stakes v1 + critical-minimum v2)

Full detail in `.planning/research/FEATURES.md`. Differentiators (watermark expansion, certificates, ДЗ, admin panel, promo codes) explicitly deferred to M2+.

| Category | Must-have features (M1) | Complexity sum |
|----------|-------------------------|----------------|
| **Marketing & legal** | Landing + course detail page, `/privacy` (152-ФЗ versioned), `/oferta` (with ИП requisites), HTTPS + security headers | ~S+S+M+S = small-medium |
| **Auth (Supabase)** | Email+password register/login/logout/recovery, 152-ФЗ consent checkbox, auth gate `(app)/layout.tsx`, rate limiting, right-to-delete-account (soft→cron hard) | ~S×6 = small |
| **Payment (ЮKassa)** | `createPayment` Server Action (price from DB), 54-ФЗ receipt in payload, webhook with verify + idempotency, `payment.canceled` + `refund.succeeded`, success/failure pages, purchase + access grant | ~M×4 = medium (the largest surface) |
| **Course access (Kinescope)** | Server-side `assertCourseAccess`, private signed URL (4h TTL, watermark), sandboxed iframe, dashboard "Мои курсы", binary lesson progress | ~M+M+S+S+S = medium |
| **Critical-minimum v2** | Welcome/verify/reset email via custom SMTP (SPF/DKIM/DMARC), FAQ on landing, Telegram+email contacts, mobile responsive, loading/error states, basic SEO, Sentry, Playwright smoke E2E | ~M×8 = medium |

**Anti-features (deliberately NOT building, each with reasons in FEATURES.md):** OAuth, magic links, native mobile app, video offline download, custom HLS player, real-time chat, Stripe/PayPal, in-platform reviews, gamification, AI chatbot, multi-currency, autoplay video, locked-progression lessons, right-click theatre, tax-deduction-13% messaging without Rosobrnadzor license.

### 3. Build Order — Dependency Graph (Vertical MVP)

Full detail in `.planning/research/ARCHITECTURE.md §12`. Each phase is a SPIDR vertical slice through every layer.

```
P0 Foundations & Compliance (week 0, ~3 days)
   │  Supabase Pro + PITR + Sentry self-hosted DSN + admin.ts ('server-only') +
   │  env Zod parser + DNS for custom SMTP (24-48h lead) + Vercel fra1 region +
   │  152-ФЗ architecture decision + RLS test harness + audit_log + pino
   ▼
P1 Auth + Marketing Shell + 152-ФЗ Consent (week 1)
   │  Landing skeleton, /privacy + /oferta, register/login/forgot/reset,
   │  user_consents (IP/UA/version), Yandex SmartCaptcha, auth gate,
   │  empty /dashboard, rate limiting, custom SMTP verified vs Mail.ru/Yandex
   ▼  (cannot test buy without auth; consent legally must ship with register)
P2 Catalog + Payment Redirect (week 2)
   │  M1 commerce migration (purchases, webhook_events, audit_log, courses.price_minor),
   │  /courses/[slug] preview, yookassa client (createPayment only),
   │  payments Server Action (price-from-DB, Idempotence-Key, 54-ФЗ receipt),
   │  /dashboard/orders/[id] processing status, FAQ, contacts
   ▼
P3 Webhook + Access Grant + Refund Flow (week 3)  ⚠️ RESEARCH SPIKE FIRST
   │  yookassa/verify.ts (auth strategy TBD after spike — see Open Q #1),
   │  webhook route handler (path-secret), idempotency, payment.canceled +
   │  refund.succeeded, dashboard owned-courses, E2E sandbox test
   ▼  (until webhook works, no user has status='succeeded' for P4 to render)
P4 Video Player + Lesson Access Control (week 4-5)  ⚠️ RESEARCH SPIKE FIRST
   │  Paid-access RLS on lessons, kinescope/sign.ts (JWT), getLessonForViewing
   │  with assertCourseAccess, LessonPlayer (sandbox + strict-origin, no download),
   │  Kinescope domain whitelist = production only, CSP frame-src, threat model doc
   ▼
P5 Progress + Profile + Ship (week 5-6)
      lesson_progress activated, debounced upsert, dashboard %-aggregation,
      /profile (RO + delete-account confirmation), soft-delete + pg_cron hard-delete,
      full Playwright smoke, prod deploy fra1, ЮKassa shop fiscalization verified,
      CSP enforcement, RKN notification, legal sign-off, rollback runbook
```

**Why this order (constraints from ARCHITECTURE.md, validated by PITFALLS.md):**

- **Auth before payment** — cannot test buy flow without `requireUser`; 152-ФЗ consent legally must ship with registration.
- **Payment redirect (P2) before webhook (P3)** — splits ЮKassa surface into outbound vs inbound so each is testable in isolation; migration ships full commerce schema in P2 to avoid double-review.
- **Webhook (P3) before video (P4)** — until webhook flips `status='succeeded'`, lesson page has nothing real to render; sequential reduces bug surface.
- **Video (P4) before progress (P5)** — progress depends on a working playback surface; cutting progress does not block ship (P5 cut-line).
- **Compliance gates clustered at P5** — RKN notification, legal sign-off, custom-domain DNS, and Pro-tier confirmation must be in-place-not-in-progress before public launch.

### 4. HIGH-Severity Pitfalls (Core-Value-impacting, with prevention)

Full detail in `.planning/research/PITFALLS.md`. The 13 HIGH-severity items mapped to phases:

| # | Pitfall (short) | Prevention (one-line) | Phase |
|---|-----------------|-----------------------|-------|
| 1 | ЮKassa webhook double-delivery → duplicate access grant | `webhook_events UNIQUE(provider, external_id)` + `INSERT … ON CONFLICT DO NOTHING` + tx-wrapped side effects | P3 (non-negotiable) |
| 2 | Webhook auth missing/wrong → fake payments grant free access | Ship BOTH IP-allowlist AND path-secret in URL; add HMAC if API supports it; verify before parsing JSON | P3 (after spike) |
| 3 | Client-supplied price trusted → pay 1₽ for full course | Server Action accepts only `courseId`; loads `price_minor` from DB; webhook re-verifies amount matches | P3 (before writing action) |
| 4 | 54-ФЗ receipt missing → ФНС fine + ЮKassa account suspension | Always pass `receipt.customer.email` + `items[]` with `vat_code=2` (USN); verify in ЛК ЮKassa "Чеки" tab | P3 + P5 manual gate |
| 6 | Refund accounting drift | Refund handler ships in SAME PR as payment handler; idempotent via same `webhook_events`; partial refund does NOT revoke access | P3 |
| 7 | Kinescope signed-URL leak via client persistence | Server-build URL per page render; pass as render-time prop only; NEVER in localStorage/React Query/Sentry breadcrumbs | P4 |
| 10 | RLS UPDATE without `WITH CHECK` → privilege escalation (CVE-2025-48757 class) | Every `FOR UPDATE` has both `USING` and `WITH CHECK`; cross-user RLS tests mandatory | P0 + every table migration |
| 12 | `service_role` leaks to client bundle → total DB compromise | `import 'server-only'` first line of `admin.ts`; no `NEXT_PUBLIC_*SERVICE*` ever; pre-launch grep `.next/static/` for `service_role` | P0 |
| 13 | 152-ФЗ data localisation (post-1-July-2025) → RKN fine + site block | Supabase Frankfurt NOT compliant as primary PII store; dual-write (`profiles_pii` on RU-hosted Postgres + pseudonymous IDs in Supabase) OR full migration; legal sign-off required | P0 architecture, P5 implement |
| 14 | Consent without versioning/IP/UA → cannot prove agreement to RKN | `user_consents (user_id, purpose, policy_version, ip, ua, accepted_at)`; separate marketing checkbox from mandatory ПДн | P1 |
| 15 | Soft-delete only for account deletion → 152-ФЗ "right to be forgotten" violation | 30-day soft-delete → pg_cron hard-delete; nullify PII; keep `purchases` anonymised (402-ФЗ 5-year retention) | P5 |
| 16+17 | RU email deliverability → users never receive confirmations | Custom SMTP (Unisender/Selectel, NOT Supabase default) + SPF + DKIM + DMARC `p=quarantine` `adkim=s aspf=s`; DNS 24-48h lead | P0 DNS + P1 wiring |
| 23 | Solo dev cuts safety nets (backups/monitoring/E2E) | Supabase Pro from day 1 ($25/mo for PITR), Sentry wired in P0, Playwright E2E for critical path mandatory, rollback runbook | P0 + P5 |
| 32 | Lesson link sharing trivially works | `requireUser()` necessary but not sufficient; lesson page also calls `assertCourseAccess(user.id, courseId)`; watermark with `user.email` | P4 |

## RU-Market Notes — What's Different from Generic SaaS

### Payments (ЮKassa, not Stripe)
Stripe/Paddle/PayPal don't work with РФ ИП since 2022. ЮKassa is the only realistic provider. **СБП mandatory** (`payment_method_data.type: 'sbp'`). **Мир cards** supported by default. **54-ФЗ fiscal receipt** generated by ЮKassa BUT only if create-payment includes `receipt.customer.email` + `receipt.items[]` with correct `vat_code` (USN=2). Omission = ФНС fine + ЮKassa suspension. **Refund** in M1 = operator-initiated via ЛК (no in-app button); webhook handles revocation. **Account approval lead time** 1-3 days, may stretch; start in P0.

### Email Deliverability (custom SMTP from day 1)
Supabase default SMTP is rate-limited (3-30/hr) and sender is on Mail.ru blacklist. **Mail.ru / Yandex / Rambler** reject foreign IPs without strict SPF + DKIM + DMARC `p=quarantine` `adkim=s aspf=s`. **Unisender** (RU-resident) or Selectel Mail recommended; Mailgun-US / Sendgrid-US are NOT viable. **DNS lead time 24-48h** for propagation — set in P0 before first email in P1. Test against live Mail.ru + Yandex + Rambler addresses, not just Gmail. **Separate domains** for transactional (`noreply@mail.your-domain.ru`) vs marketing (`news@news.your-domain.ru`, M2 Unisender).

### Legal (152-ФЗ, 54-ФЗ, оферта)
**152-ФЗ data localisation (post-1-July-2025):** primary PII storage outside РФ is prohibited. Supabase Frankfurt = not compliant. Mitigation: dual-write (`profiles_pii` on RU-hosted Postgres) OR migrate to Yandex Cloud Managed Postgres OR document legal opinion. RKN registration as оператор ПДн is free + mandatory regardless. **152-ФЗ consent capture:** `user_consents` table + wording must name оператор (full legal entity), purposes, data categories, retention. **152-ФЗ right to be forgotten:** 30-day soft → cron hard-delete; keep `purchases` anonymised (402-ФЗ 5-year). **Публичная оферта:** required at ЮKassa application; contains ИП requisites (ФИО, ИНН, ОГРНИП, банк); юрист ~5-15k₽; lead 1-2 weeks. **Налоговый вычет 13%** messaging ONLY with Rosobrnadzor license — otherwise consumer-protection-law violation.

### Deployment / Hosting
**Vercel custom `.ru` domains** intermittently blocked by Roskomnadzor through 2025; `*.vercel.app` subdomains generally work for alpha. **Vercel default region `iad1`** is bad for RU (+150-200ms); **set to `fra1`** in `vercel.json`. Post-alpha migration to Yandex Cloud Container Apps / Selectel VDS is planned M2 ops task before public custom-domain launch. **Sentry SaaS fully blocked** for RU users since 2024-09-10; self-host GlitchTip (4 containers) or Bugsink (1 container).

### Cultural / UX
No OAuth (Google distrust, Facebook blocked, Apple Verified Domain pain) — email/password is norm. Telegram contact in footer = standard for small RU schools. Pricing in ₽ (no $/€ for СНГ). Mobile traffic 60%+ — mobile-first is not optional. `Intl.NumberFormat('ru-RU', {currency:'RUB'})`, never raw `$9.99`.

### Sanctions-Affected Vendors to Avoid
Stripe / Paddle / PayPal / Lemon Squeezy (payments), Resend / Postmark / Mailgun / Sendgrid / AWS SES (email), Sentry SaaS / Rollbar / Bugsnag (errors), Cloudflare Images (assets), App Store / Play Store dev accounts (native mobile — also an anti-feature).

## Open Questions

Unresolved items the roadmapper or executor must decide. Each is blocking for the phase noted.

1. **ЮKassa webhook auth mechanism** (HMAC vs IP-allowlist-only vs both vs path-secret) — three research docs disagree. **Decide:** P3 research spike against current `yookassa.ru/developers/using-api/webhooks` + ЛК ЮKassa. **Default if undecided:** ship all three layers.
2. **152-ФЗ architecture choice** — dual-write (recommended for solo) vs full migration to Yandex Cloud vs documented legal opinion accepting risk. **Decide:** P0, requires юрист, documented in `docs/compliance/152fz-architecture.md`.
3. **Юр.форма: ИП or самозанятый?** — affects `/oferta` requisites, allowed operations (самозанятый cannot accept from юр.лиц), revenue limit (2.4M₽/year). **Decide:** before P2 and before ЮKassa application.
4. **Rosobrnadzor license — held or planned?** — only affects tax-deduction-13% messaging. Does not block M1; copy in P1 must NOT mention vычет until decided.
5. **ЮKassa account status** — already connected or needs to apply? Lead 1-3 days + offer URL required. **Decide:** start P0.
6. **Custom domain** — already purchased? DNS lead 24-48h for SPF/DKIM. **Decide:** P0 week 0.
7. **Custom SMTP provider** — Unisender (recommended) vs Selectel Mail vs Yandex Mail for Business. **Decide:** P0.
8. **Self-hosted error monitoring backend** — GlitchTip vs Bugsink vs full Sentry self-hosted. **Decide:** at deploy time (P0 ops sub-task); SDK identical.
9. **Upstash RU availability test** — reachable from production deploy region? **Decide:** P0 connectivity test; fallback to Postgres rate-limiter.
10. **Vercel alpha vs immediate Yandex Cloud migration** — if first paying users need `.ru` domain immediately, escalate hosting to P0. **Decide:** P0.
11. **Юрист for `/oferta`** — own template review vs full consultation. Blocks ЮKassa application + P2 ship. **Decide:** P0, ~5-15k₽.
12. **Single fixed price for M1 course** (no multi-tier, no promo) — recommended; trivial later change but architecture is simpler if fixed P0.
13. **Kinescope account + project ID + secret token** — needed before P4. **Decide:** start P0.
14. **Realtime in M1?** — recommendation NO (poll-on-load + refresh CTA). **Decide:** P0 confirm.
15. **Exact Kinescope JWT claim shape** — confirm in P4 research spike against current Kinescope private API docs.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core picks verified on npm + official sources. Upstash RU availability LOW (mitigated by Postgres fallback wrapper). |
| Features | HIGH | Critical path verified against 8 RU EdTech competitors + legal sources. MEDIUM on niche UX (watermark variants, certificate timing). |
| Architecture | HIGH | Built on existing scaffold conventions in `.claude/skills/` and `.planning/codebase/`. |
| Pitfalls | HIGH | Verified against current 2025-2026 sources (CVE-2025-48757, 152-ФЗ July 2025, Sentry RU FAQ, kinescope-dl bypass). |

**Overall confidence:** HIGH for build; MEDIUM for two integration spikes (ЮKassa webhook auth, Kinescope JWT shape), both flagged as pre-phase research spikes.

## Sources

**Primary (HIGH):**
- In-repo: `.planning/PROJECT.md`, `.planning/codebase/{ARCHITECTURE,STRUCTURE,STACK,CONCERNS}.md`, `.claude/skills/{api-conventions,database,security,testing}/SKILL.md`, `supabase/migrations/20260522000001_init_base_tables.sql`
- Research: `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md`
- Sentry RU sanctions FAQ; 152-ФЗ July 2025 amendments (comply.ru / b-152.ru / habr cloud4y); CVE-2025-48757 analysis + Supabase 2025 security retro; ЮKassa 54-ФЗ receipts; Kinescope DRM guide; `kinescope-dl` bypass tool

**Secondary (MEDIUM):**
- ЮKassa webhook docs (`yookassa.ru/developers/using-api/webhooks`) — needs P3 spike
- Vercel RU custom-domain blocking pattern (multiple 2025 community threads)
- Yandex DMARC/SPF/DKIM setup guides; GlitchTip vs Sentry vs Bugsink comparison

**Tertiary (LOW, needs validation):**
- Upstash RU availability (needs runtime probe); Vercel cold-start latency from RU (needs real measurement); Kinescope JWT exact claim shape (needs P4 doc spike)

---
*Research completed: 2026-05-24*
*Ready for roadmap: yes*
