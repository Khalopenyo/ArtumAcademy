# Stack Research — Gap Fills

**Domain:** Paid online-courses (LMS), RU/CIS market, Russia-hosted operations
**Researched:** 2026-05-24
**Confidence:** HIGH for core picks (Sentry/Vercel/Kinescope/RHF/Resolvers/MSW/Zod/Pino verified on npm + official sources); MEDIUM for YooKassa SDK (npm + GitHub commit history confirm SDK fossilization, recommendation depends on that fact); MEDIUM for deployment (Vercel-blocking is documented as real but variable).

Only **gap** items are documented here. The locked core (Next 14.2.15 / React 18.3.1 / TS 5.6.2 / Supabase 2.45.4 + ssr 0.5.1 / Tailwind 3.4.13 / shadcn+Radix / framer-motion / sonner / TanStack Query 5.59 / Zustand 4.5.5 / RHF 7.53 + Zod 3.23 / Vitest 2.1.2 + Testing Library 16 + Playwright 1.48 / lucide-react) is intentionally **not** re-recommended.

---

## TL;DR — Top 5 picks to add to `package.json` in M1

| # | Package | Version | Reason it's critical for M1 |
|---|---------|---------|----------------------------|
| 1 | `@kinescope/react-kinescope-player` | `^0.5.4` | Core Value path. Official Kinescope React wrapper; private-link playback is the income-protecting feature. |
| 2 | `@a2seven/yoo-checkout` | `^1.1.4` (pinned, with `axios@^1.7` override) | Only viable maintained-enough Node.js wrapper for ЮKassa REST. Alternative is rolling our own — `M1` doesn't have budget for that surface area. |
| 3 | `@sentry/nextjs` | `^8.x` (NOT 10.x) | Error monitoring is required by `.claude/skills/security/SKILL.md` launch checklist. Sentry SaaS is **BLOCKED for RU-located users since 2024-09-10**, so install with self-hosted DSN (GlitchTip or Sentry-self-hosted) — see Section "Error Monitoring" for region setup. |
| 4 | `pino` + `pino-pretty` | `^10.3.1` / `^11.x` | Structured JSON logging for Server Actions / Route Handlers. Pairs with `audit_log` table (skill-mandated). |
| 5 | `msw` | `^2.14.6` | Required to mock ЮKassa/Kinescope/Unisender in Vitest unit tests without hitting real services. Skill `testing` will reference this. |

Everything else in this document is M2-or-later or a configuration decision, not a new package.

---

## Recommended Stack — Gap Fills

### Payments — ЮKassa SDK

| Decision | Value |
|---|---|
| **Pick** | `@a2seven/yoo-checkout@^1.1.4` |
| **Confidence** | MEDIUM |
| **RU availability** | ✅ Library is npm-public, ЮKassa API is RU-hosted; runtime fully reachable. |
| **Rationale** | Only npm-published Node.js wrapper for ЮKassa REST v3 that (a) exists, (b) supports all methods we need (`createPayment`, `capturePayment`, `cancelPayment`, `getPayment`, `createRefund`), (c) has 14 published versions and a real GitHub repo. Hand-rolling the REST surface for M1 risks 2-3 days of integration work + ongoing maintenance for ~10 endpoints. |
| **Rejected** | `yookassa-ts-sdk` — **unpublished from npm on 2025-12-14** (verified via `npm view`); `yookassa-ts@0.1.14` — last release 2022, 110 weekly downloads; `@appigram/yookassa-node` — unofficial; **custom REST** — viable fallback, deferred to M2 if `@a2seven` proves limiting. |
| **Caveats** | Last commit on `a2seven/yoocheckout` is **2022-08-29** — effectively frozen. Bundles `axios@^0.21.1` which has CVEs (CVE-2021-3749 ReDoS, CVE-2023-45857 CSRF). **Mandatory mitigation:** add npm `overrides` in `package.json` to force `axios@^1.7.7`. Wrap the SDK behind our own `src/lib/yookassa/client.ts` so we can swap to custom REST without touching call sites if the SDK ever blocks us. |
| **Notes for M1** | Webhook signature verification: ЮKassa **does not use HMAC** — verification is done by **source IP allow-list** (publicly listed by YooMoney). Our `webhook_events`-based idempotency (security skill §4) is the primary defense; IP check is the secondary. This decision changes how we write the webhook handler — no `crypto.timingSafeEqual` step needed. |

### Video — Kinescope SDK

| Decision | Value |
|---|---|
| **Pick** | `@kinescope/react-kinescope-player@^0.5.4` |
| **Confidence** | HIGH |
| **RU availability** | ✅ Kinescope is RU-hosted (kinescope.io); SDK is on npm. |
| **Rationale** | Official Kinescope React component; encapsulates iframe lifecycle, events (`play`/`pause`/`ended`/`progress`), and prop-based config (autoplay, muted, watermark). Saves us writing an `<iframe>` wrapper, postMessage event bus, and signed-URL refresh logic by hand. Built on top of Kinescope's own iframe API. |
| **Rejected** | Raw `<iframe>` with `@kinescope/player-iframe-api-loader` — works but requires us to implement event subscription + lifecycle hooks ourselves; ~half a day of boilerplate, no benefit over the React wrapper for our use case. |
| **Caveats** | `0.x` versioning — minor bumps may have breaking changes; pin with caret only after confirming peer-deps work with React 18.3.1. Domain `*.kinescope.io` is already whitelisted in `next.config.js` `images.remotePatterns` for poster frames. |
| **Notes for M1** | The signed-URL generation lives on the server (Server Action that returns a 4-hour-TTL URL based on user + lesson access check). The React player just renders the URL. Watermark with `${user.email}` is set via the player's `watermark` prop. |

### Rate Limiting

| Decision | Value |
|---|---|
| **Pick** | `@upstash/ratelimit@^2.0.8` with `@upstash/redis` — but **gated behind feasibility check before M1 lock-in** |
| **Confidence** | LOW (RU-availability not verified, see caveats) |
| **RU availability** | ⚠️ **UNKNOWN.** No public statement from Upstash on RU sanctions compliance. Upstash is a US-incorporated company; OFAC's June 2024 IT-services determination could apply. Vercel KV is built on Upstash Redis, so same risk. |
| **Rationale** | If Upstash is reachable from our deployment region (Frankfurt-Supabase + Vercel-Frankfurt scenario), this is the lowest-friction choice — algorithm is sound (sliding window built-in), well-documented for Next.js Route Handlers / Server Actions. Skill `security` already names it as the intended choice. |
| **Rejected (with reasons)** | **(a) Pure-Supabase PostgreSQL sliding window** — runs on infra we already pay for (HIGH RU-availability), proven pattern (Neon's guide, Figma's blog), zero new vendor; downside is each rate-limit check is a Postgres round-trip (~5-10ms) so login-spam attacks add load to our primary DB. **(b) `express-rate-limit` with `rate-limit-postgresql`** — Express middleware, doesn't fit App Router server actions. **(c) Vercel KV / Edge Config** — depends on Vercel, which is unstable for RU egress (see Deployment row). |
| **M1 recommendation** | Implement rate-limiting as a **wrapper module** `src/lib/rate-limit/index.ts` with two backends: `upstash` (default) and `postgres` (fallback). Decide which to wire at deploy time based on actual RU connectivity test. The wrapper API takes (`key`, `limit`, `window`) and returns `{ ok, remaining, reset }` regardless of backend. This costs ~half a day extra in M1 but de-risks a hard dependency. |

### Error Monitoring

| Decision | Value |
|---|---|
| **Pick** | `@sentry/nextjs@^8.x` package + **self-hosted DSN** (Sentry self-hosted OR GlitchTip OR Bugsink, decided at deploy time) |
| **Confidence** | HIGH (on the SDK package) / MEDIUM (on hosting choice — pick at infra time) |
| **RU availability** | 🚫 **Sentry SaaS is BLOCKED.** Per Sentry's own FAQ (Sept 2024), all paid accounts of RU-located customers terminated, all access from RU IPs blocked, no new RU payments accepted. The SDK itself is OSS and can post events to any compatible DSN. |
| **Rationale for the SDK** | `@sentry/nextjs` is the standard Next.js integration: source-map upload via `withSentryConfig` wrapper, automatic Server Action / Route Handler instrumentation, RSC support, edge runtime support. Skill `security` mandates Sentry as the launch checklist item. The SDK works against any Sentry-protocol-compatible backend. |
| **Rationale for self-hosting choice** | **GlitchTip** is the best M1 fit: Sentry-API-compatible (drop-in), runs on 4 containers (web + worker + Redis + Postgres), can be deployed on Yandex Cloud / Selectel for ~2 GB VPS. **Bugsink** is the absolute minimalist (single container, SQLite default), also Sentry-compatible — pick this if we want literally one Docker command. **Self-hosted Sentry** is overkill — 40+ services, requires ongoing ops. |
| **Why pin SDK to 8.x not 10.x** | `@sentry/nextjs@10.x` requires Sentry server protocol features only available on recent Sentry versions; GlitchTip / Bugsink track Sentry's protocol with some lag. Sentry 8.x is the safest compatibility floor while still being current enough for Next 14.2 App Router support. Re-evaluate before M2. |
| **Rejected** | **Sentry SaaS** — blocked for our RU users (won't help diagnose their errors at all). **Yandex Cloud Monitoring** — works for infra metrics but no JS source-map / stack-trace symbolication = useless for our actual use case. **Rollbar / Bugsnag** — also US-sanctions-affected. |
| **M1 deliverable** | Install `@sentry/nextjs`, wire `sentry.{client,server,edge}.config.ts`, set DSN from env. Stand up GlitchTip on Yandex Cloud / Selectel VPS (separate ops task, ~2 h). |

### Logging

| Decision | Value |
|---|---|
| **Pick** | `pino@^10.3.1` (runtime) + `pino-pretty@^11.x` (dev only) + `audit_log` Postgres table (skill-defined schema) |
| **Confidence** | HIGH |
| **RU availability** | ✅ OSS, no SaaS dependency. |
| **Rationale** | Pino is the de-facto Node.js structured-JSON logger (1-2 orders of magnitude faster than winston, lower allocation). Outputs JSON in prod (Vercel / Yandex Cloud picks up automatically), `pino-pretty` for human-readable dev logs. Skill `security` §6 already defines the **audit_log** table (`id`, `user_id`, `action`, `entity_type`, `entity_id`, `meta`, `ip_address`, `created_at`) — Pino covers operational logs, the table covers compliance/audit. Two layers, different purposes. |
| **Rejected** | **winston** — slower, larger; no advantage. **Console-only** — fine for dev but no JSON shape for prod log ingestion. **Sentry-as-logging** — Sentry is for errors, not info-level operational logs; sending high-volume info logs to Sentry is a cost/perf anti-pattern. |
| **M1 deliverable** | `src/lib/logger.ts` exporting a single Pino instance, configured with `level: process.env.LOG_LEVEL ?? 'info'` and `transport: pino-pretty` in dev only. Migration to create `audit_log` table. Helper `logAudit({ userId, action, entityType, entityId, meta })` that writes via service-role Supabase client. |

### Email (Transactional Split)

| Decision | Value |
|---|---|
| **Pick (M1)** | **Supabase Auth default SMTP** (no extra config) for `signup confirmation` + `password reset` only |
| **Pick (M2)** | Configure Supabase Auth to use **Unisender SMTP** as custom provider OR use Supabase Auth + Unisender API separately for marketing |
| **Confidence** | HIGH for M1 (no work needed) / MEDIUM for M2 (Unisender SMTP integration is documented but not Supabase-officially blessed) |
| **RU availability** | ✅ Unisender is RU-hosted. ⚠️ Supabase default SMTP is hard-capped at **2 emails/hour** and rate-limited — fine for dev / smoke-testing, will throttle real users at ~10 signups/day. |
| **Rationale** | M1 has email volume of effectively zero (~5-50 signups during pilot). Default Supabase SMTP carries us through onboarding the first real customers. Switching to Unisender SMTP is a runtime config change (no code) when we hit the rate limit — it's not on the critical path. Project doc `.planning/PROJECT.md` explicitly defers Unisender to M2. |
| **Rejected** | **Resend / Postmark / Mailgun / SendGrid / AWS SES** — all US-based, sanctions risk or RU IP delivery problems. **Custom SMTP via own server** — operational overhead with no benefit over Unisender. |
| **M1 deliverable** | Configure Supabase Auth → Email Templates with branded copy in Russian (signup confirmation, password reset). No code change. Set `Site URL` to production domain so confirmation links resolve. M2 task: switch to Unisender SMTP (host: `smtp.unisender.com`, port: `587`, auth via Unisender API user). |

### Image Optimization

| Decision | Value |
|---|---|
| **Pick** | **Next.js built-in `next/image`** with default loader (no external transformation service) |
| **Confidence** | HIGH |
| **RU availability** | ✅ Self-contained in the Next.js runtime. |
| **Rationale** | M1 has very few images: hero illustration(s), course thumbnail(s), course poster from Kinescope (already a CDN URL — `next/image` will just re-serve). `next/image` does WebP/AVIF conversion, responsive `srcset`, lazy loading — all out of the box. Already configured with `remotePatterns` for `*.supabase.co` and `*.kinescope.io` in `next.config.js`. **Zero new dependency.** |
| **Rejected** | **Supabase Storage image transformations** — Pro-plan-only paid feature; doesn't help our hero/marketing images that aren't in Supabase Storage anyway. **Cloudflare Images** — US service, sanctions risk, $5/month minimum. **imgix / Cloudinary** — US-based + paid. |
| **M1 deliverable** | None — already configured. When M2 adds user-uploaded avatars / submission attachments, revisit Supabase Storage transforms (and account for the Pro-plan cost). |

### Deployment Platform

| Decision | Value |
|---|---|
| **Pick** | **Stage 1 (private alpha, M1):** Vercel (Frankfurt region) with monitored RU access. **Stage 2 (public launch):** **Yandex Cloud** (Cloud Functions or Container Apps) OR **Selectel VDS** with Docker + Caddy. |
| **Confidence** | MEDIUM (the Vercel issue is real but partial, not absolute) |
| **RU availability** | ⚠️ **Vercel:** `*.vercel.app` subdomains work from RU IPs in most reports; **custom domains pointing to Vercel anycast IPs are intermittently blocked by Roskomnadzor** (multiple confirmed community reports through 2025). ✅ **Yandex Cloud / Selectel:** RU-hosted, no question. |
| **Rationale for Vercel in M1** | Zero-config Next.js deployment, preview branches, free hobby tier, native App Router + Server Actions support. While we have <10 alpha users, we can tolerate the occasional RU access blip — the velocity gain through M1 is worth it. Use a `*.vercel.app` subdomain for the alpha (not a custom domain) to dodge the blocking pattern. |
| **Rationale for migrating M2 onward** | Once we have paying customers, RU connectivity becomes a revenue-blocker, not a nuisance. Yandex Cloud Container Apps run Node.js Docker images natively; Selectel VDS lets us run Next.js standalone build behind Caddy/Nginx. Both are RU-resident, both let us point a `.ru` custom domain without RU-firewall risk. |
| **Rejected** | **Netlify / Cloudflare Pages / Render / Fly.io** — all US-based, same Vercel-style RU blocking risk + worse Next.js App Router support than Vercel. **VK Cloud** — possible but ecosystem and docs are weaker than Yandex Cloud. |
| **M1 deliverable** | Deploy to Vercel on `videoedit-academy.vercel.app` (or similar). Document migration path to Yandex Cloud Container Apps as an M2-or-M3 task. Test access from RU IPs (use Yandex.Cloud Functions or AdGuard's RU server as a probe) **before** announcing the alpha publicly. |
| **Note** | Don't fight a custom `.ru` domain on Vercel — it's a known multi-month problem with no stable workaround. |

### Test DB Strategy

| Decision | Value |
|---|---|
| **Pick** | **Supabase local stack (Docker via Supabase CLI)** for integration & RLS tests; **mocked Supabase client** (no DB) for unit tests |
| **Confidence** | HIGH |
| **RU availability** | ✅ Local Docker — runs anywhere. |
| **Rationale** | Supabase CLI `supabase start` boots a real Postgres + Auth + Storage + Realtime stack on Docker. Same schema, same RLS, same auth — test results actually predict prod behavior. Officially documented by Supabase as the recommended testing approach. Already in our dev deps (`supabase@^1.200.3`). |
| **Rejected** | **`pg-mem`** — pure JS in-memory Postgres; doesn't support Supabase's `auth.users`, RLS via `auth.uid()`, or Supabase Storage. Would force us to test against a fictional database. **Ephemeral cloud Supabase project per CI run** — slow (~1-2 min spin-up), needs Supabase API automation, costs money. **SQLite shim** — incompatible with Postgres-specific features (RLS, JSONB, triggers) we rely on. |
| **M1 deliverable** | (a) `tests/integration/setup.ts` that runs `supabase db reset` before each suite; (b) `vitest.integration.config.ts` (script `test:integration` is already declared in `package.json` but missing the config file); (c) helper to create a test user via `supabase.auth.admin.createUser` and seed `purchases` rows for access-control tests. |

### HTTP Mocking — MSW

| Decision | Value |
|---|---|
| **Pick** | `msw@^2.14.6` |
| **Confidence** | HIGH |
| **RU availability** | ✅ OSS. |
| **Rationale** | MSW 2.x is the current major (Released Oct 2023, last patch ~9 days before today). API uses fetch-based handlers (`http.post(...)`), supports Node 18+ (matches our `engines.node >= 20`), works in both browser tests (Vitest with `jsdom`) and Node tests. Lets us mock ЮKassa API responses, Kinescope signed-URL endpoints, Unisender SMTP-replies, etc. without ever hitting the real services in CI. |
| **Rejected** | **`nock`** — Node-only, doesn't help component tests. **`fetch-mock`** — works but smaller community, more boilerplate. **Vitest's own `vi.fn()` mocks** — fine for one-off calls but you end up reinventing MSW once you have >5 endpoints to mock. |
| **M1 deliverable** | `tests/unit/msw/handlers.ts` with mock handlers for ЮKassa `POST /payments`, Kinescope sign endpoint, and a `tests/unit/msw/server.ts` Node setup. Wire into `tests/unit/setup.ts` with `beforeAll/afterEach/afterAll` hooks. |

---

## Version Bumps — Evaluate, mostly DON'T do in M1

| Package | Locked | Latest | Recommendation |
|---|---|---|---|
| `zod` | `^3.23.8` | `4.4.3` | **Stay on Zod 3** for M1. Zod 4 ships under `zod/v4` subpath import for compatibility, and `@hookform/resolvers@5.x` only supports **Zod 3.25.0+**. Our 3.23.8 is below that — we'd need a coordinated bump of Zod (to 3.25+) and `@hookform/resolvers` (to 5.4.0) **and** drop the resolver import-path change. Save for M2 cleanup. Risk of breakage > value of perf gains for a 50-user MVP. |
| `vitest` | `^2.1.2` | `4.1.7` (Vitest 3 stable since Jan 2025, Vitest 4 latest) | **Bump to Vitest 3.x** if convenient before M1 ships. Migration is minor (fake-timers default change, `workspace`→`projects` rename). Vitest 4 also fine. Don't block M1 on this — but if a fresh `npm install` puts us on a newer compatible version, accept it. |
| `react-hook-form` | `^7.53.0` | `7.76.1` | **Bump to `^7.76.1` for new install** — same major (7.x), bug fixes only, no breaking changes. Caret in lockfile means `npm install` already pulls newest 7.x. |
| `@hookform/resolvers` | not in package.json yet | `5.4.0` | Install at `^3.9.0` (compatible with Zod 3.23). Do NOT install 5.x until we also upgrade Zod past 3.25. |
| `next` (14.2.15), `react` (18.3.1), `@supabase/*`, `tailwindcss` (3.4.13), `playwright` (1.48.0) | locked | various | **Stay on locked versions for M1.** Stack-stability over chasing latest. Re-evaluate after M1 ships. |

---

## Installation (M1 additive set only)

```bash
# Runtime (production deps)
npm install \
  @kinescope/react-kinescope-player@^0.5.4 \
  @a2seven/yoo-checkout@^1.1.4 \
  @sentry/nextjs@^8 \
  pino@^10.3.1 \
  @hookform/resolvers@^3.9.0

# Optional in M1 — only if rate-limit feasibility test passes
npm install @upstash/ratelimit@^2.0.8 @upstash/redis

# Dev / test deps
npm install -D \
  msw@^2.14.6 \
  pino-pretty@^11

# Add to package.json `overrides` (CVE mitigation for axios bundled by @a2seven/yoo-checkout):
# "overrides": { "axios": "^1.7.7" }
```

---

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| **Stripe / Paddle / Lemon Squeezy** | RU-blocked: cannot accept cards from RU banks; sanctions on RU merchants. | ЮKassa (locked), CloudPayments (skill-mandated fallback). |
| **Resend / Postmark / Mailgun / SendGrid / SES** | US-based, sanctions risk, RU IP delivery problems. | Unisender (skill-locked); Supabase Auth default for M1. |
| **Sentry SaaS account** | Blocked for RU-located users since 2024-09-10 — won't capture errors of our actual customers. | `@sentry/nextjs` SDK + self-hosted GlitchTip / Bugsink / Sentry-self-hosted DSN. |
| **`yookassa-ts-sdk`** | Unpublished from npm on 2025-12-14. | `@a2seven/yoo-checkout`. |
| **`yookassa-ts@0.1.14`** | Last release 2022, ~110 weekly downloads, unmaintained. | `@a2seven/yoo-checkout`. |
| **Vercel custom `.ru` domain** | Roskomnadzor intermittent blocks of Vercel anycast IPs through 2025. | Use `*.vercel.app` subdomain for alpha; migrate hosting to Yandex Cloud / Selectel before public launch with custom domain. |
| **Cloudflare Images / Cloudflare R2 with custom domain** | US-based + sanctions risk + intermittent RU connectivity. | `next/image` default + Supabase Storage (Frankfurt) for M1; reconsider for M2 if image volume grows. |
| **`pg-mem`** | No `auth.users`, no RLS, no Supabase Storage — tests are a fiction. | Supabase local stack via Docker. |
| **Self-hosted Sentry (full)** | 40+ services, ops nightmare for solo dev. | GlitchTip (4 services) or Bugsink (1 container). |
| **`winston` for logging** | Slower, heavier than Pino with no compensating advantage. | `pino`. |
| **`react-player` for Kinescope** | Generic wrapper, doesn't know about Kinescope's private signed URLs or watermark prop. | `@kinescope/react-kinescope-player`. |
| **Zod 4 (`zod/v4`)** | `@hookform/resolvers@5.x` migration path requires coordinated Zod 3.25+ bump first; M1 risk not worth it. | Stay on Zod `^3.23.8` for M1. |

---

## Version Compatibility Notes

| Package A | Compatible With | Notes |
|---|---|---|
| `@sentry/nextjs@8.x` | Next.js 14.2, React 18 | Use `withSentryConfig` wrapper in `next.config.js`. Source-map upload requires `SENTRY_AUTH_TOKEN` env at build time. |
| `@sentry/nextjs@10.x` | Recent Sentry server only | Avoid — GlitchTip/Bugsink don't fully implement Sentry 10.x protocol features. |
| `msw@2.x` | Node 18+, TypeScript 4.7+ | We're on Node ≥20 + TS 5.6 — fully fine. Handler API uses `http.post()` not `rest.post()` (this is the 1.x→2.x change). |
| `@a2seven/yoo-checkout@1.1.4` | Node ≥12 | Bundled `axios@0.21.1` is a CVE risk — **add `overrides` to force `axios@^1.7.7`** in our `package.json`. |
| `@kinescope/react-kinescope-player@0.5.4` | React 18 | Pre-1.0; pin with caret and re-test on minor bumps. |
| `pino@10.x` + `pino-pretty@11.x` | Node ≥18 | `pino-pretty` is dev-only — never include in production bundle. |
| `@hookform/resolvers@3.9.0` | RHF 7.53.x, Zod 3.23.x | Safe pairing for current locked stack. |
| `@hookform/resolvers@5.4.0` | Zod 3.25.0+ or Zod 4 | Don't upgrade resolvers without bumping Zod first. |
| `@upstash/ratelimit@2.x` | Edge + Node runtimes | Works in Next.js middleware, Route Handlers, and Server Actions. Requires `@upstash/redis@^1.x` peer. |

---

## Open Questions / Validation Needed Before M1 Lock-in

1. **RU access to Upstash** — Test from a RU IP (or Yandex.Cloud egress) whether `https://*.upstash.io` is reachable and whether Upstash will accept a RU-billing-address account. If blocked → switch rate-limit backend to Postgres before writing first handler.
2. **GlitchTip vs Bugsink final pick** — Defer to deploy phase; both are Sentry-compatible at the SDK level, so this is a config-not-code decision.
3. **Vercel custom-domain plan** — Confirm that an alpha launch on a `*.vercel.app` subdomain is acceptable for the first paying users. If not, escalate hosting decision to M1 instead of M2.
4. **ЮKassa account opening lead time** — Account approval can take 1–2 weeks. Start the application early in M1 — the SDK choice is meaningless if we don't have a `SHOP_ID` to test against.
5. **Kinescope account + project for `KINESCOPE_PROJECT_ID`** — Same: account first, then code.

---

## Sources

- [@a2seven/yoo-checkout on npm (1.1.4)](https://www.npmjs.com/package/@a2seven/yoo-checkout) — verified version + axios dep + last publish date
- [a2seven/yoocheckout commit history](https://github.com/a2seven/yoocheckout) — confirmed last commit 2022-08-29
- [`yookassa-ts-sdk` 404 on npm (verified via `npm view`, "Unpublished on 2025-12-14")](https://www.npmjs.com/package/yookassa-ts-sdk)
- [@kinescope/react-kinescope-player on npm (0.5.4)](https://www.npmjs.com/package/@kinescope/react-kinescope-player) — verified version
- [Kinescope security features overview](https://www.kinescope.com/products/video-hosting) — DRM, watermarks, signed URLs, React SDK confirmed
- [Sentry's Response to U.S.-Russia Sanctions (FAQ, official)](https://sentry.zendesk.com/hc/en-us/articles/28038067843739-FAQ-Sentry-s-Response-to-U-S-Russia-Sanctions) — RU access fully blocked since 2024-09-10
- [GlitchTip vs Sentry vs Bugsink comparison](https://www.bugsink.com/blog/glitchtip-vs-sentry-vs-bugsink/) — architecture/footprint comparison
- [Top Sentry alternatives 2025 (Uptrace)](https://uptrace.dev/comparisons/sentry-alternatives) — confirms GlitchTip is Sentry-API-compatible
- [@upstash/ratelimit on npm (2.0.8)](https://www.npmjs.com/package/@upstash/ratelimit) — verified version
- [Upstash sliding-window algorithm docs](https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms) — algorithm reference
- [Rate Limiting in Postgres (Neon guide)](https://neon.com/guides/rate-limiting) — fallback pattern reference
- [Supabase rate-limiting with PostgreSQL + pgheaderkit (Mansueli)](https://blog.mansueli.com/rate-limiting-supabase-requests-with-postgresql-and-pgheaderkit) — fallback reference
- [msw on npm (2.14.6)](https://www.npmjs.com/package/msw) — verified version
- [MSW 2.0 announcement / migration guide](https://mswjs.io/blog/introducing-msw-2.0/) — Node 18+ TS 4.7+ requirement
- [Vercel community: RU custom-domain blocking reports (multiple 2025 threads)](https://community.vercel.com/t/ip-i-was-provided-by-vercel-for-my-custom-domain-is-blocked-by-russia/32366) — confirmed pattern
- [Vercel OFAC firewall template (sanctions context)](https://vercel.com/templates/vercel-firewall/block-ofac-sanctioned-countries-firewall-rule)
- [Yandex Cloud Functions / Container Apps](https://yandex.cloud/) — RU-resident alternative
- [Selectel pricing and infra](https://vds.selectel.ru/en/pricing.html) — RU-resident VDS alternative
- [Supabase: Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) — Unisender SMTP integration model for M2
- [Supabase Storage image transformations](https://supabase.com/docs/guides/storage/serving/image-transformations) — confirmed Pro-plan-only paid feature
- [Supabase local development & testing overview](https://supabase.com/docs/guides/local-development/testing/overview) — Docker stack testing approach
- [Challenges testing Supabase RLS with Vitest (index.garden)](https://index.garden/supabase-vitest/) — RLS test pattern reference
- [Zod v4 release notes / migration](https://zod.dev/v4) — subpath import strategy + resolver compat caveat
- [@hookform/resolvers on npm — Zod 3.25+ requirement noted in changelog](https://www.npmjs.com/package/@hookform/resolvers)
- [Vitest 3 release announcement](https://vitest.dev/blog/vitest-3) — migration notes for our 2.x → 3.x bump
- [pino-nextjs example (official pino repo)](https://github.com/pinojs/pino-nextjs-example) — confirms Pino is the canonical Next.js logger pattern
- [YooKassa webhooks doc — IP allow-list verification](https://yookassa.ru/developers/using-api/webhooks) — confirms no HMAC, IP allow-list + idempotency approach
- [`.claude/skills/security/SKILL.md`](file:///Users/tkestkes/Desktop/repo/.claude/skills/security/SKILL.md) — defines `audit_log` schema, webhook_events idempotency, Sentry as launch-checklist item
- [`.planning/codebase/INTEGRATIONS.md`](file:///Users/tkestkes/Desktop/repo/.planning/codebase/INTEGRATIONS.md) — confirms wrapper directory layout (`src/lib/yookassa/`, `src/lib/kinescope/`, `src/lib/unisender/`)

---

*Stack research for: VideoEdit Academy M1 MVP — RU/CIS LMS gap-fills only*
*Researched: 2026-05-24*
