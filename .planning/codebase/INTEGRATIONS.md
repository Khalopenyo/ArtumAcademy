# External Integrations

**Analysis Date:** 2026-05-23

This project is at early scaffolding stage. Supabase is fully wired; ЮKassa, Kinescope, Unisender, OAuth providers, captcha, Telegram, monitoring, and analytics have env vars reserved in `.env.example` and (for some) empty wrapper folders in `src/lib/`, but no implementation code yet. Document below distinguishes "wired" from "reserved".

## APIs & External Services

### Supabase (Database + Auth + Storage) — WIRED

- Purpose: Primary backend. Postgres database, authentication (email/password + planned OAuth), storage for user-uploaded submissions.
- SDKs: `@supabase/supabase-js` ^2.45.4, `@supabase/ssr` ^0.5.1 (cookie-aware clients for App Router)
- Region recommended: `eu-central-1` (Frankfurt) per `README.md`
- Env vars:
  - `NEXT_PUBLIC_SUPABASE_URL` — client + server
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client + server (subject to RLS)
  - `SUPABASE_SERVICE_ROLE_KEY` — server-only (Server Actions / Route Handlers), bypasses RLS
- Wrapper modules in `src/lib/supabase/`:
  - `src/lib/supabase/client.ts` — `createBrowserSupabase()` for Client Components
  - `src/lib/supabase/server.ts` — `createServerSupabase()` using Next `cookies()` for Server Components / Server Actions
  - `src/lib/supabase/middleware.ts` — `updateSession(request)` called from `src/middleware.ts` to refresh session cookies on every non-static request
- Auth helpers: `src/lib/auth/require.ts` exposes `requireUser()` and `requireRole(...roles)` (roles: `'admin' | 'curator' | 'content_manager'`), throwing `UnauthorizedError` / `ForbiddenError`
- Generated DB types: `src/types/database.ts` (currently a placeholder; regenerated via `npm run db:types`)

### Kinescope (Video Hosting) — RESERVED

- Purpose: Russian-market video hosting for course lessons; signed playback URLs with 4-hour TTL and watermarking (per `.claude/skills/security/SKILL.md`).
- Wrapper directory: `src/lib/kinescope/` exists but is empty (no files yet)
- Env vars:
  - `KINESCOPE_API_TOKEN` — server only
  - `KINESCOPE_PROJECT_ID` — server only
- Image domain whitelisted in `next.config.js`: `*.kinescope.io`
- Database field reserved: `lessons.video_id text` in `supabase/migrations/20260522000001_init_base_tables.sql`

### ЮKassa (Primary Payment Provider) — RESERVED

- Purpose: Russian payment gateway. Server-issued payments and webhook receipts (54-ФЗ fiscal receipts auto-sent by ЮKassa).
- Wrapper directory: `src/lib/yookassa/` exists but is empty
- Env vars:
  - `YOOKASSA_SHOP_ID` — server only
  - `YOOKASSA_SECRET_KEY` — server only
- Conventions (from `.claude/skills/security/SKILL.md`):
  - Price always read from DB by `planId`, never trusted from client input
  - Webhook must verify HMAC signature and be idempotent via `webhook_events` table (`UNIQUE (provider, external_id)`)
  - `receipt` items must be present in payment payload

### CloudPayments (Backup Payment Provider) — RESERVED

- Purpose: Fallback payment gateway
- Env vars:
  - `CLOUDPAYMENTS_PUBLIC_ID`
  - `CLOUDPAYMENTS_API_SECRET`
- No wrapper directory yet

### Unisender (Transactional + Marketing Email) — RESERVED

- Purpose: Email delivery (account confirmation, password reset, course notifications)
- Wrapper directory: `src/lib/unisender/` exists but is empty
- Env vars:
  - `UNISENDER_API_KEY` — server only
  - `UNISENDER_FROM_EMAIL` (default `noreply@your-domain.ru`)
  - `UNISENDER_FROM_NAME` (default `"VideoEdit Academy"`)

### Yandex SmartCaptcha — RESERVED

- Purpose: Bot protection on registration, password-reset, and homework-submission forms
- Env vars:
  - `NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY` — client widget
  - `YANDEX_CAPTCHA_SERVER_KEY` — server validation (POST to `https://smartcaptcha.yandexcloud.net/validate`)
- No wrapper module yet

### Telegram Bot — RESERVED

- Purpose: Notifications channel; `profiles.telegram_id bigint` column already reserved in `supabase/migrations/20260522000001_init_base_tables.sql`
- Env vars:
  - `TELEGRAM_BOT_TOKEN` — server only
  - `TELEGRAM_BOT_USERNAME`
- No wrapper module yet

## OAuth Providers (planned, RESERVED)

### Yandex OAuth

- Provider: https://oauth.yandex.ru/
- Env vars:
  - `YANDEX_OAUTH_CLIENT_ID` — client + server
  - `YANDEX_OAUTH_CLIENT_SECRET` — server only
- Integration model: expected via Supabase Auth third-party providers (Route Handlers under `src/app/api/` per `README.md` directory plan); no code present yet

### VK ID OAuth

- Provider: https://id.vk.com/about/business/go
- Env vars:
  - `VK_OAUTH_CLIENT_ID` — client + server
  - `VK_OAUTH_CLIENT_SECRET` — server only
- No code present yet

## Data Storage

### Databases

- Type/Provider: PostgreSQL via Supabase (managed)
- Connection: Supabase JS SDK (no direct `DATABASE_URL` env var — connection brokered by Supabase URL + anon/service keys)
- Client modules: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
- Migrations: `supabase/migrations/` — forward-only SQL. Current migrations:
  - `supabase/migrations/20260522000001_init_base_tables.sql` — creates `profiles`, `user_roles` (enum `user_role`), `courses`, `modules`, `lessons`; enables RLS on all; sets up `handle_new_user()` trigger on `auth.users` insert and `touch_updated_at()` triggers; defines initial RLS policies for public read access to published content and self-read for profiles/roles
- Seed data: `supabase/seed.sql` (runs on `npm run db:reset`) — inserts sample courses, modules, lessons
- Generated types: `src/types/database.ts` (placeholder; regenerated via `npm run db:types`)
- CLI: `supabase` ^1.200.3 (dev dependency)

### File Storage

- Provider: Supabase Storage (planned bucket `submissions/{user_id}/...` per `.claude/skills/security/SKILL.md`)
- Visibility: bucket must be private; access via signed URLs for owner + curators
- No buckets defined in migrations yet

### Caching

- Not yet integrated. `.claude/skills/security/SKILL.md` notes rate-limiting will use `@upstash/ratelimit` with Upstash Redis or Vercel KV (not yet installed).

## Authentication & Identity

- Auth Provider: Supabase Auth (email/password primary; OAuth Yandex/VK planned)
- Session model: HTTP-only cookies refreshed by `src/middleware.ts` → `updateSession()` in `src/lib/supabase/middleware.ts`; cookie attributes target `httpOnly`, `SameSite=Lax`, `Secure` (production); 30-day rolling sessions
- Auto profile creation: `handle_new_user()` PL/pgSQL trigger (in `supabase/migrations/20260522000001_init_base_tables.sql`) inserts a `profiles` row on every `auth.users` insert, seeding `full_name` from `raw_user_meta_data`
- Role model: `user_roles` table with enum `user_role` = `admin | curator | content_manager`; queried by `requireRole(...)` in `src/lib/auth/require.ts`
- Route protection pattern: planned `src/app/(app)/layout.tsx` and `src/app/(admin)/layout.tsx` call `createServerSupabase().auth.getUser()` and `redirect('/login')` when missing (per `.claude/skills/security/SKILL.md`); files themselves not yet present (`src/app/(app)/`, `src/app/(admin)/`, `src/app/(marketing)/`, `src/app/api/` directories exist but contain no files)

## Monitoring & Observability

### Error Tracking — RESERVED

- Provider: Sentry (planned)
- Env vars:
  - `SENTRY_DSN` — server
  - `NEXT_PUBLIC_SENTRY_DSN` — client
- No Sentry SDK installed in `package.json` yet

### Analytics — RESERVED

- Yandex Metrika: `NEXT_PUBLIC_YANDEX_METRIKA_ID`
- PostHog: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (default `https://eu.posthog.com`)
- No SDKs installed; no implementation code

### Logs

- Approach: no centralized logging library configured. ESLint allows `console.warn` and `console.error` only (see `.eslintrc.json`). Audit-log table (`audit_log`) planned in `.claude/skills/security/SKILL.md` but not yet migrated.

## CI/CD & Deployment

- Hosting: Not declared in repo, but `.gitignore` includes `.vercel` → Vercel is the assumed target. Yandex Cloud is mentioned as an alternative in `.claude/skills/security/SKILL.md`.
- CI Pipeline: No GitHub Actions, GitLab CI, or other CI config files detected at repo root. Playwright config has CI-aware branches (`process.env.CI` toggles reporter, retries, workers) indicating CI is planned but not yet configured.
- Pre-commit: Husky + lint-staged installed; hooks installed via `npm run prepare`

## Environment Configuration

**Required for local dev (minimum to boot):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Full env var inventory (from `.env.example`):**
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- ЮKassa: `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`
- CloudPayments: `CLOUDPAYMENTS_PUBLIC_ID`, `CLOUDPAYMENTS_API_SECRET`
- Kinescope: `KINESCOPE_API_TOKEN`, `KINESCOPE_PROJECT_ID`
- Unisender: `UNISENDER_API_KEY`, `UNISENDER_FROM_EMAIL`, `UNISENDER_FROM_NAME`
- Yandex OAuth: `YANDEX_OAUTH_CLIENT_ID`, `YANDEX_OAUTH_CLIENT_SECRET`
- VK OAuth: `VK_OAUTH_CLIENT_ID`, `VK_OAUTH_CLIENT_SECRET`
- Yandex SmartCaptcha: `NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY`, `YANDEX_CAPTCHA_SERVER_KEY`
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`
- Sentry: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
- Analytics: `NEXT_PUBLIC_YANDEX_METRIKA_ID`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- App: `NEXT_PUBLIC_APP_URL` (default `http://localhost:3000`)

**Secrets location:**
- Local: `.env.local` (git-ignored via `.gitignore`)
- Production: deployment-platform env UI (Vercel or Yandex Cloud); `service_role` key and OAuth secrets must never leak into client bundle (only vars prefixed `NEXT_PUBLIC_` reach the browser, per Next.js convention and skill rule #1 in `.claude/skills/security/SKILL.md`)
- `.env.example` ships variable names + comments only, no values

## Webhooks & Callbacks

### Incoming

- ЮKassa payment webhook — PLANNED, location reserved under `src/app/api/` (no handler file present yet)
- CloudPayments webhook — PLANNED (no handler yet)
- OAuth callbacks (Yandex, VK) — PLANNED under `src/app/api/`
- Idempotency contract (from `.claude/skills/security/SKILL.md`): all webhooks insert into `webhook_events (provider, external_id) UNIQUE` and treat duplicate-key error `23505` as already-processed

### Outgoing

- Kinescope API calls — PLANNED (signed-URL generation for video playback)
- Unisender API calls — PLANNED (transactional email send)
- Telegram Bot API — PLANNED (notifications)
- Yandex SmartCaptcha validation — PLANNED (`https://smartcaptcha.yandexcloud.net/validate`)

## Image Optimization Allow-list

`next.config.js` `images.remotePatterns` permits:
- `https://*.supabase.co` (Supabase Storage public assets)
- `https://*.kinescope.io` (Kinescope poster frames / thumbnails)

Any new external image host must be added here before `next/image` will render it.

## Wrapper Module Map (`src/lib/`)

| Directory | Status | Files |
|---|---|---|
| `src/lib/supabase/` | implemented | `client.ts`, `server.ts`, `middleware.ts` |
| `src/lib/auth/` | implemented | `require.ts` |
| `src/lib/kinescope/` | empty (reserved) | — |
| `src/lib/yookassa/` | empty (reserved) | — |
| `src/lib/unisender/` | empty (reserved) | — |
| `src/lib/utils.ts` | implemented | `cn()`, `formatPrice()` (RUB formatting via `Intl.NumberFormat('ru-RU')`) |

When implementing a new integration, create files inside the matching `src/lib/<provider>/` folder; the directory layout is already established and referenced by skills.

---

*Integration audit: 2026-05-23*
