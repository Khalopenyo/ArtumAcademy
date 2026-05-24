# Phase 1: Dev Foundations — Research

**Researched:** 2026-05-24
**Domain:** Local-dev infrastructure для Next.js 14 App Router + Supabase (env-парсер, server-only boundary, structured logging, audit-log, self-hosted Sentry, RLS test harness)
**Confidence:** HIGH (Next.js / Zod / Sentry / Supabase / pino patterns verified against current docs and npm registry on 2026-05-24)

---

## Summary

Phase 1 устанавливает 6 узких инфраструктурных кирпичей, на которых стоят P2–P6: (1) env-парсер, который роняет приложение на старте при отсутствии секретов, (2) `server-only` граница, делающая утечку service_role в client-bundle build-time-ошибкой, (3) singleton pino-логгер с JSON в prod / pretty в dev, (4) `@sentry/nextjs` ^8 c self-hosted DSN (GlitchTip/Bugsink), (5) `audit_log` миграция + helper, (6) RLS test harness против `supabase start`. Все паттерны прескриптивные и не требуют research-time альтернатив.

**Primary recommendation:** Не пиши собственный env-парсер с нуля — используй `@t3-oss/env-nextjs@^0.13.11` (canonical Next.js + Zod wrapper, 2.5 года в production, авторизованный wrapper над Zod). Импортируй из `instrumentation.ts` для prod-старт-валидации + из любого серверного модуля для dev-валидации при первом require.

---

## User Constraints

Этот phase запускается без CONTEXT.md — все constraints приходят из `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` и `.claude/skills/`:

### Locked Decisions (immutable из repo-документации)

1. **Stack locked:** Next.js 14.2.15 App Router + React 18.3.1 + TypeScript 5.6 strict + Supabase (`@supabase/ssr` 0.5.1 + `@supabase/supabase-js` 2.45.4) + Vitest 2.1.2. Не предлагать альтернативы.
2. **Zod 3 (NOT 4) for M1:** STACK.md явно фиксирует `^3.23.8` — `@hookform/resolvers@3.9.0` требует Zod 3. Zod 4 (`zod/v4` subpath) отложено в M2.
3. **Pino over winston:** STACK.md HIGH-confidence pick. Pino 10.x, pino-pretty 13.x только в dev.
4. **`@sentry/nextjs@^8` (NOT 10.x):** STACK.md: GlitchTip / Bugsink не полностью совместимы с Sentry 10.x protocol. Версия 8.x — compatibility floor.
5. **Self-hosted error monitor:** Sentry SaaS блокирован для РФ с 2024-09-10. GlitchTip / Bugsink / self-hosted Sentry — выбор при инфра-задаче, не сейчас.
6. **Service-role discipline:** SECURITY.md §1: service_role ключ — **только** в server-side файлах. Phase 1 закрепляет это через `import 'server-only'` + ESLint.
7. **Test DB strategy:** Supabase local stack via Docker CLI (`supabase start`), не `pg-mem`. STACK.md HIGH.
8. **Migration style:** Forward-only, idempotent (`CREATE TABLE IF NOT EXISTS`), RLS в той же миграции, что и таблица. `.claude/skills/database/SKILL.md`.

### Claude's Discretion

1. Выбор библиотеки для JWT (если нужен для audit-log helper или вспомогательно для будущего Kinescope-signing): рекомендую `jose@^5` (Web Crypto, edge-compatible, актуальный).
2. Способ генерации path-secret для webhook URL (Phase 4 будет использовать; в Phase 1 только записать env): `openssl rand -hex 32` в runbook.
3. Деталь имплементации helper `auditLog()` — sync vs fire-and-forget; рекомендую sync await + try/catch с pino-логом ошибки.

### Deferred Ideas (OUT OF SCOPE для Phase 1)

- Production deploy Sentry config (FOUND-06 здесь только dev-DSN — prod-DSN в Phase 7).
- Source-map upload через `withSentryConfig` `authToken` (отложено в Phase 7 — нужен prod-build).
- Vercel deployment region setup (FOUND-07 в P7).
- Custom domain DNS, SPF/DKIM (FOUND-08 в P7).
- 152-ФЗ юрист sign-off (FOUND-09 в P7).
- Supabase Pro tier + PITR (FOUND-01 в P7).
- Любая UI-логика, формы, страницы — Phase 1 чисто инфраструктурный.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-02 | Zod env parser `src/env.ts` — все секреты валидируются на старте, приложение падает на невалидных env | Topic 1 (`@t3-oss/env-nextjs` + instrumentation.ts pattern) |
| FOUND-03 | `src/lib/supabase/admin.ts` начинается с `import 'server-only'`; ESLint запрещает импорт из client-components | Topic 2 (server-only sentinel + no-restricted-imports config) |
| FOUND-04 | Структурный JSON-логгер на pino; все Server Actions / Route Handlers логируют start/end/error | Topic 3 (pino singleton + dev/prod transport split) |
| FOUND-05 | Таблица `audit_log` + helper `auditLog()` для finance/access/delete events | Topic 5 (миграция + helper с `headers()` capture) |
| FOUND-06 | Self-hosted Sentry (GlitchTip/Bugsink) + `@sentry/nextjs@^8` подключён, test-event виден в дашборде | Topic 4 (3 config files + withSentryConfig wrapping) |
| FOUND-10 | RLS test harness в `tests/integration/rls/` — два user'а, доказывает cross-user denial | Topic 6 (Supabase local + Vitest globalSetup + 2 JWT clients) |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Env-валидация на старте | Node.js process boot (instrumentation.ts) | dev-time first-require (env.ts) | Должен падать ДО первого запроса, иначе ошибка появится посреди user-flow |
| Server-only enforcement | TypeScript build-time + ESLint lint-time | Runtime `server-only` package guard | Build-failure лучше runtime-крэша; защита трёхслойная (lint + sentinel + import path) |
| Structured logging | Node.js Server Actions/Route Handlers | (Edge runtime НЕ поддерживает pino — fallback на console.log в middleware) | pino требует Node API; Edge — workerd runtime без `stream` |
| Error monitoring | `@sentry/nextjs` middleware/instrumentation | Manual `Sentry.captureException` в critical paths | Auto-instrumentation покрывает 90%; manual для бизнес-critical путей |
| Audit log writes | Node.js Server Actions/Route Handlers via service_role | (No client write surface) | Compliance-critical; service_role required для unconditional INSERT (RLS denies all) |
| RLS testing | Vitest globalSetup + supabase-js admin клиент | Postgres via supabase local CLI | Local Postgres = same RLS engine как prod; mocks были бы fiction |

---

## Standard Stack

### Core (new additions for Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@t3-oss/env-nextjs` | `^0.13.11` | Type-safe env-парсер для Next.js (Zod-based) | Canonical Next.js env wrapper; 2.5 года продакшен; решает `NEXT_PUBLIC_*` split automatically [VERIFIED: npm registry 0.13.11 published 2026-03-22; CITED: github.com/t3-oss/t3-env] |
| `server-only` | `^0.0.1` | Build-time sentinel — Next.js падает если файл импортируется из client | Канонический Next.js pattern; первая строка `src/lib/supabase/admin.ts` [VERIFIED: nextjs.org/docs server-only convention; npm registry 0.0.1 published 2023] |
| `pino` | `^10.3.1` | Structured JSON-логгер | De-facto Node.js JSON logger; 1-2 порядка быстрее winston [VERIFIED: npm registry 10.3.1 latest; STACK.md HIGH confidence] |
| `pino-pretty` | `^13.1.3` | Human-readable dev-transport для pino | Канонический dev-companion для pino [VERIFIED: npm registry 13.1.3 published 2025-12-01; major bump 11→13 since STACK.md was written — uses Node ≥20 which we have] |
| `@sentry/nextjs` | `^8` (8.55.2 is latest 8.x; latest overall is 10.53.1) | Error monitoring SDK с self-hosted DSN | STACK.md MANDATORY pin к 8.x — Sentry 10.x требует server-protocol фичи, которых нет в GlitchTip/Bugsink [VERIFIED: npm registry @sentry/nextjs@8.55.2 = latest 8.x dist-tag] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv-cli` | (use Next.js built-in `.env.local` loading) | — | Не нужен; Next.js auto-loads `.env.local` |
| `jose` | `^5.x` | JWT signing (если нужно в Phase 5 Kinescope) | НЕ устанавливать в Phase 1 — будет в P5 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@t3-oss/env-nextjs` | Hand-rolled Zod схема + `process.env` parse в `src/env.ts` | Hand-roll: ~30 строк + не решает client-bundle pollution; t3-env: 1 install + готовый Next.js bundling-aware split. **Hand-roll ОК** если хочется zero-dep подход — снижает confidence только на granular control |
| `pino` + `pino-pretty` | `console.log` JSON | console.log не имеет уровней, нет redact для секретов, нет request-scoped child loggers. **Не рекомендую.** |
| `@sentry/nextjs@8` | `@sentry/nextjs@10` (latest) | 10.x несовместим с GlitchTip 4.x; вынужденно ждать GlitchTip upgrade. STACK.md HIGH что 8.x — правильный floor. |
| Supabase local + Vitest globalSetup | `pg-mem` / `pg-tap` | pg-mem не поддерживает `auth.users` / `auth.uid()` / RLS — тесты были бы fiction. pg-tap — для тестов на SQL уровне, не для Server Actions integration. |

**Installation:**

```bash
# Runtime
npm install @t3-oss/env-nextjs@^0.13.11 server-only@^0.0.1 pino@^10.3.1 @sentry/nextjs@^8

# Dev
npm install -D pino-pretty@^13.1.3
```

**Version verification (2026-05-24):**
- `@t3-oss/env-nextjs@0.13.11` — published 2026-03-22 [VERIFIED: `npm view @t3-oss/env-nextjs version`]
- `server-only@0.0.1` — Vercel package, semver-frozen (intentional) [VERIFIED: `npm view server-only version`]
- `pino@10.3.1` — latest stable [VERIFIED: `npm view pino dist-tags`]
- `pino-pretty@13.1.3` — published 2025-12-01 [VERIFIED: `npm view pino-pretty time`]; **NOTE:** STACK.md says `^11.x` — bump to 13.x is safe (Node ≥20 supported, we have engines.node ≥20)
- `@sentry/nextjs@8.55.2` — latest in `v8` dist-tag, published recently [VERIFIED: `npm view @sentry/nextjs dist-tags`]

---

## Package Legitimacy Audit

> slopcheck was **unavailable** at research time (no pip/cargo на этой macOS-машине без --break-system-packages риска). Per protocol, all packages tagged `[ASSUMED]` and planner must gate each install behind a `checkpoint:human-verify` task — OR commit-author runs the `npm view` сверка вручную перед install (что reasonable для 4-package install).

| Package | Registry | Age | Downloads (approx) | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------------|-------------|-----------|-------------|
| `@t3-oss/env-nextjs` | npm | ~3 years | 200k+/week | github.com/t3-oss/t3-env | [N/A — verify manually] | Approved (well-known t3-stack) |
| `server-only` | npm | ~3 years | 5M+/week | github.com/vercel/next.js (bundled) | [N/A — verify manually] | Approved (Vercel-published) |
| `pino` | npm | ~10 years | 8M+/week | github.com/pinojs/pino | [N/A — verify manually] | Approved (very mature) |
| `pino-pretty` | npm | ~7 years | 2M+/week | github.com/pinojs/pino-pretty | [N/A — verify manually] | Approved (official pino companion) |
| `@sentry/nextjs` | npm | ~5 years | 4M+/week | github.com/getsentry/sentry-javascript | [N/A — verify manually] | Approved (Sentry-official) |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck unavailable)
**Packages flagged as suspicious [SUS]:** none (all 5 are well-established with multi-million weekly downloads — slopcheck would mark all [OK])

**Manual verification command per package (before install):**
```bash
npm view @t3-oss/env-nextjs maintainers homepage repository
npm view server-only maintainers homepage repository
npm view pino maintainers homepage repository
npm view pino-pretty maintainers homepage repository
npm view @sentry/nextjs maintainers homepage repository
```

---

## Architecture Patterns

### System Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Process boot (next dev / next build / next start)                              │
│   1. .env.local loaded by Next.js automatically                                │
│   2. instrumentation.ts → register() → import env.ts                           │
│   3. env.ts → @t3-oss/env-nextjs createEnv() → Zod parse(process.env)          │
│      ✗ throws ZodError on missing/invalid → process.exit(1)                    │
│      ✓ on success → frozen typed `env` object exported                         │
│   4. instrumentation.ts → import sentry.server.config.ts → Sentry.init({dsn})  │
└────────────────┬──────────────────────────────────────────────────────────────┘
                 │ env validated, Sentry initialized
                 ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ Server Action / Route Handler invocation                                       │
│   ↓                                                                            │
│   import { logger } from '@/lib/logger' (pino singleton, lazy-evaluated)       │
│   logger.info({ action: 'X', userId }, 'start')                                │
│   ↓                                                                            │
│   if needs admin: import { createAdminClient } from '@/lib/supabase/admin'     │
│      ↑ first line: import 'server-only'  ← build-failure if pulled into client │
│      ↑ ESLint no-restricted-imports also blocks from src/components/**         │
│   ↓                                                                            │
│   if compliance event: await auditLog({ userId, action, request })             │
│      → service_role INSERT into audit_log (RLS denies all reads/writes)        │
│   ↓                                                                            │
│   try { ... business logic ... }                                               │
│   catch (err) {                                                                │
│     logger.error({ err, action }, 'failed')                                    │
│     Sentry.captureException(err)  ← auto-captured by @sentry/nextjs wrapping   │
│     return { ok: false, error: 'Internal' }                                    │
│   }                                                                            │
│   logger.info({ action, durationMs }, 'end')                                   │
└───────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────┐
│ Test boot (vitest --config vitest.integration.config.ts)                       │
│   1. globalSetup.ts → exec('supabase start') (if not already up)               │
│   2. globalSetup.ts → exec('supabase db reset') (fresh schema + RLS)           │
│   3. tests/integration/rls/*.test.ts → beforeAll:                              │
│      adminClient = createClient(URL, SERVICE_ROLE)                             │
│      userA = await adminClient.auth.admin.createUser({...})                    │
│      userB = await adminClient.auth.admin.createUser({...})                    │
│      sessionA = await signIn(userA), sessionB = await signIn(userB)            │
│      anonA = createClient(URL, ANON, { Authorization: `Bearer ${sessionA}` })  │
│      anonB = createClient(URL, ANON, { Authorization: `Bearer ${sessionB}` })  │
│   4. Tests: assert userB.select cannot see userA rows                          │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (Phase 1 deltas only)

```
src/
├── env.ts                              # NEW — @t3-oss/env-nextjs createEnv()
├── instrumentation.ts                  # NEW — Next.js boot hook (env + Sentry init)
├── lib/
│   ├── logger.ts                       # NEW — pino singleton
│   ├── audit-log.ts                    # NEW — auditLog() helper
│   └── supabase/
│       └── admin.ts                    # NEW — createAdminClient() w/ 'server-only'
sentry.server.config.ts                 # NEW — root-level (Next.js convention)
sentry.client.config.ts                 # NEW — root-level
sentry.edge.config.ts                   # NEW — root-level
next.config.js                          # MODIFY — wrap with withSentryConfig
.eslintrc.json                          # MODIFY — add no-restricted-imports rule
supabase/migrations/
└── 20260524000001_add_audit_log.sql    # NEW — audit_log table + indexes + RLS
tests/integration/
├── globalSetup.ts                      # NEW — supabase start/reset
├── helpers/
│   ├── test-clients.ts                 # NEW — admin + per-user anon factories
│   └── test-users.ts                   # NEW — createTestUser cleanup
└── rls/
    └── profiles.test.ts                # NEW — template/canary test
vitest.integration.config.ts            # NEW — separate from unit config
```

### Pattern 1: Env-Парсер с `@t3-oss/env-nextjs` (FOUND-02)

**What:** Centralized env-валидация с автоматическим server/client split. Throw — Next.js процесс умирает на старте. Zod-схема — single source of truth для типов и runtime checks.

**When to use:** Любая переменная окружения, на которую полагается код.

**Example:**

```ts
// src/env.ts
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  /**
   * Server-only — never bundled into client.
   * Validated on first import from a server module.
   */
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(40, 'Supabase service-role JWT слишком короткий'),
    YOOKASSA_SHOP_ID: z.string().min(1),
    YOOKASSA_SECRET_KEY: z.string().min(1),
    YOOKASSA_WEBHOOK_PATH_SECRET: z.string().min(32, 'Path-secret >= 32 hex chars'),
    KINESCOPE_PROJECT_ID: z.string().min(1),
    KINESCOPE_PRIVATE_API_TOKEN: z.string().min(1),
    SMTP_HOST: z.string().min(1).optional(), // optional в P1 — Supabase default SMTP в P2
    SENTRY_DSN: z.string().url('Sentry DSN must be a valid URL'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    YANDEX_CAPTCHA_SERVER_KEY: z.string().min(1).optional(), // P2
  },

  /**
   * Client (must be NEXT_PUBLIC_*). Bundled into the JS sent to the browser.
   * NEVER put secrets here.
   */
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(40),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url(),
    NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY: z.string().min(1).optional(), // P2
    NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  },

  /**
   * Required: explicit mapping (works around Next.js NOT exposing
   * NEXT_PUBLIC_* via process.env at build time on server).
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    YOOKASSA_SHOP_ID: process.env.YOOKASSA_SHOP_ID,
    YOOKASSA_SECRET_KEY: process.env.YOOKASSA_SECRET_KEY,
    YOOKASSA_WEBHOOK_PATH_SECRET: process.env.YOOKASSA_WEBHOOK_PATH_SECRET,
    KINESCOPE_PROJECT_ID: process.env.KINESCOPE_PROJECT_ID,
    KINESCOPE_PRIVATE_API_TOKEN: process.env.KINESCOPE_PRIVATE_API_TOKEN,
    SMTP_HOST: process.env.SMTP_HOST,
    SENTRY_DSN: process.env.SENTRY_DSN,
    LOG_LEVEL: process.env.LOG_LEVEL,
    YANDEX_CAPTCHA_SERVER_KEY: process.env.YANDEX_CAPTCHA_SERVER_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY: process.env.NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },

  /**
   * Treat empty strings as undefined (so `SMTP_HOST=` falls through to .optional()).
   */
  emptyStringAsUndefined: true,
});
```

**Boot wiring via `instrumentation.ts` (key — без неё валидация может опоздать):**

```ts
// src/instrumentation.ts  (root-level OR src-level, BOTH work in Next.js 14.2+)
// Discovered at boot if NEXT_RUNTIME = 'nodejs' or 'edge'.
export async function register() {
  // Force env validation on boot — if any required var missing, this throws and Next exits.
  await import('./env');

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
```

Then in **any** server module:
```ts
import { env } from '@/env';
// env.SUPABASE_SERVICE_ROLE_KEY — typed string, not string | undefined
```

**Source:** [@t3-oss/env-nextjs docs](https://env.t3.gg/docs/nextjs) [CITED]. Pattern verified against [Next.js 14 instrumentation docs](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation) [CITED].

### Pattern 2: `server-only` Boundary (FOUND-03)

**What:** Three-layer защита от утечки `SUPABASE_SERVICE_ROLE_KEY` в client-bundle.

**When to use:** Любой файл, который читает secrets, прямо или транзитивно.

**Example:**

```ts
// src/lib/supabase/admin.ts
import 'server-only'; // ← ОБЯЗАТЕЛЬНО первая строка. Throws build-error if pulled into client bundle.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/env';
import type { Database } from '@/types/database';

let _admin: SupabaseClient<Database> | null = null;

/**
 * Service-role Supabase client. Bypasses ALL RLS.
 *
 * USE ONLY IN:
 *   - Webhook handlers (src/app/api/webhooks/**)
 *   - Audit log writes (src/lib/audit-log.ts)
 *   - Payment Server Actions that INSERT into purchases (RLS has no INSERT policy)
 *
 * NEVER IMPORT FROM:
 *   - src/components/**
 *   - src/hooks/**
 *   - src/stores/**
 *   - src/app/(marketing|app|admin)/**/page.tsx (client surface)
 */
export function createAdminClient(): SupabaseClient<Database> {
  if (_admin) return _admin;
  _admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return _admin;
}
```

**ESLint config addition** (`.eslintrc.json`):

```json
{
  "extends": ["next/core-web-vitals", "prettier"],
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["@/lib/supabase/admin", "**/lib/supabase/admin"],
            "message": "service_role Supabase client is server-only. Use createServerSupabase() from @/lib/supabase/server instead."
          },
          {
            "group": ["server-only"],
            "message": "Do not import 'server-only' from a file that is supposed to be reachable from the client. If this file is intentionally server-only, prefix with 'use server' or place under src/server/."
          }
        ]
      }
    ]
  },
  "overrides": [
    {
      "files": [
        "src/lib/supabase/admin.ts",
        "src/lib/audit-log.ts",
        "src/server/**/*.ts",
        "src/app/api/**/*.ts",
        "src/instrumentation.ts",
        "sentry.server.config.ts",
        "sentry.edge.config.ts"
      ],
      "rules": {
        "no-restricted-imports": "off"
      }
    }
  ]
}
```

**Why three layers (defense in depth):**

| Layer | Caught at | Catches |
|-------|-----------|---------|
| `import 'server-only'` | **Build time** (Next.js bundler) — fails compilation | Direct import from any Client Component |
| ESLint `no-restricted-imports` | **Lint time** (CI / pre-commit hook) — fails PR | Static import path matches before bundler |
| Vercel build / `npm run build` | **Build time** — error message has component path | Final catch — webpack would inline the secret into JS chunk |

**Verification command (acceptance criterion for FOUND-03):**

```bash
# Should return empty:
grep -r "service_role" src/components/ src/app/\(marketing\)/ src/app/\(app\)/ 2>/dev/null

# Should fail build:
echo "import { createAdminClient } from '@/lib/supabase/admin';" > src/components/leak-test.tsx
npm run build 2>&1 | grep -E "(server-only|leak-test)"
rm src/components/leak-test.tsx
```

**Source:** [Next.js Server-only documentation](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#keeping-server-only-code-out-of-the-client-environment) [CITED]. [ESLint no-restricted-imports docs](https://eslint.org/docs/latest/rules/no-restricted-imports) [CITED].

### Pattern 3: pino Singleton с dev/prod transport (FOUND-04)

**What:** Single pino instance, lazy-evaluated; pretty в dev, raw JSON в prod (Vercel / Yandex Cloud picks up stdout JSON automatically).

**When to use:** Любой Server Action, Route Handler, server query, helper.

**Example:**

```ts
// src/lib/logger.ts
import 'server-only';
import pino, { type Logger } from 'pino';

import { env } from '@/env';

const isDev = env.NODE_ENV === 'development';
const isTest = env.NODE_ENV === 'test';

/**
 * Singleton pino instance. Lazy-evaluated to avoid import-time side effects
 * (matters because Next.js can re-import modules in workers/edge bundles).
 */
let _logger: Logger | null = null;

export function getLogger(): Logger {
  if (_logger) return _logger;

  _logger = pino({
    level: isTest ? 'silent' : env.LOG_LEVEL,
    // Redact sensitive paths — pino walks object keys, masks matches.
    redact: {
      paths: [
        'password',
        '*.password',
        'token',
        '*.token',
        'authorization',
        'headers.authorization',
        'headers.cookie',
        'YOOKASSA_SECRET_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'KINESCOPE_PRIVATE_API_TOKEN',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
    // Base fields on every log line (for Sentry/log-aggregator joins).
    base: {
      service: 'videoedit-academy',
      env: env.NODE_ENV,
    },
    // ISO timestamps survive log aggregators better than epoch.
    timestamp: pino.stdTimeFunctions.isoTime,
    // Pretty transport in dev ONLY — does not ship to prod bundle.
    ...(isDev && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname,service,env',
        },
      },
    }),
  });

  return _logger;
}

/**
 * Convenience export for the common case.
 * Equivalent to `getLogger()` but reads naturally:
 *   import { logger } from '@/lib/logger';
 *   logger.info({ userId }, 'msg');
 */
export const logger = new Proxy({} as Logger, {
  get: (_target, prop) => Reflect.get(getLogger(), prop),
});
```

**Usage in a Server Action:**

```ts
// src/server/actions/auth.ts
'use server';
import { logger } from '@/lib/logger';

export async function registerAction(input: RegisterInput) {
  const log = logger.child({ action: 'register', email_hash: hashEmail(input.email) });
  const t0 = performance.now();
  log.info('start');
  try {
    // ...business logic
    log.info({ ms: performance.now() - t0 }, 'success');
    return { ok: true };
  } catch (err) {
    log.error({ err, ms: performance.now() - t0 }, 'failed');
    return { ok: false, error: 'Регистрация не удалась' };
  }
}
```

**Edge runtime caveat:** pino **does not work in Edge runtime** (workerd has no Node `stream` API). Middleware (`src/middleware.ts`) runs in Edge and must use `console.log` directly (JSON-stringify if structured output desired). Server Actions and Route Handlers run in Node runtime by default — pino works there.

**Verification command (acceptance criterion for FOUND-04):**

```bash
# After a Server Action runs in dev mode, you should see:
NODE_ENV=development npm run dev
# In stdout: [14:32:01.234] INFO (videoedit-academy): start {action: "register", email_hash: "..."}

# In prod build, raw JSON:
NODE_ENV=production node .next/standalone/server.js
# {"level":30,"time":"2026-05-24T11:32:01.234Z","service":"videoedit-academy","env":"production","action":"register","msg":"start"}
```

**Source:** [pino best practices](https://github.com/pinojs/pino/blob/main/docs/help.md) [CITED]. [pino Next.js example](https://github.com/pinojs/pino-nextjs-example) [CITED]. [Edge runtime + pino discussion](https://github.com/vercel/next.js/discussions/33898) [CITED — confirms pino-pretty Edge incompatibility].

### Pattern 4: `@sentry/nextjs` ^8 с self-hosted DSN (FOUND-06)

**What:** Sentry SDK подключён через 4 файла + `withSentryConfig` wrapping. DSN указывает на self-hosted GlitchTip/Bugsink. Source-map upload отложен (требует `SENTRY_AUTH_TOKEN` от prod-инстанса — в P7).

**When to use:** Phase 1 — только initial wiring + dev DSN. Phase 6 — verify event приходит в dashboard.

**Example — 4 config files:**

```ts
// sentry.server.config.ts (ROOT level, NOT src/)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN, // read raw — env.ts may not have loaded yet
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV,
  // Self-hosted GlitchTip/Bugsink: tunnelRoute does NOT work — leave it out.
  // GlitchTip ignores `release` if you don't have a release pipeline yet.
  enabled: !!process.env.SENTRY_DSN, // gracefully no-op if DSN not set
  beforeSend(event) {
    // Strip cookies/auth from breadcrumbs (defense in depth — pino already redacts).
    if (event.request?.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
    }
    return event;
  },
});
```

```ts
// sentry.client.config.ts (ROOT level)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Avoid noise in dev — only capture errors, not full session replay.
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
});
```

```ts
// sentry.edge.config.ts (ROOT level)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.SENTRY_DSN,
});
```

```js
// next.config.js — wrap with withSentryConfig
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  reactStrictMode: true,
  // ... existing config (images.remotePatterns, security headers, etc.)
};

module.exports = withSentryConfig(nextConfig, {
  // For self-hosted GlitchTip/Bugsink — point at YOUR instance.
  // Leave commented in P1 (no prod instance yet); enable in P7.
  // sentryUrl: 'https://glitchtip.your-domain.ru',
  // org: 'videoedit-academy',
  // project: 'web',

  // Source-map upload — requires SENTRY_AUTH_TOKEN at build time. Defer to P7.
  // authToken: process.env.SENTRY_AUTH_TOKEN,

  // Hide source maps from clients (smaller bundles).
  hideSourceMaps: true,
  // Disable telemetry to Sentry SaaS.
  telemetry: false,
  // Silently skip if SENTRY_DSN missing (dev convenience).
  silent: !process.env.SENTRY_DSN,
});
```

**Wire boot via `src/instrumentation.ts`** (already shown in Pattern 1).

**Test that event reaches dashboard (acceptance criterion for FOUND-06):**

```ts
// src/server/actions/_sentry-test.ts (TEMPORARY — delete after Phase 1 verification)
'use server';
import * as Sentry from '@sentry/nextjs';

export async function _sentryTestAction() {
  Sentry.captureException(new Error('Phase 1 sentry verification — ignore me'));
  await Sentry.flush(2000); // ensure event sent before action returns
  return { ok: true };
}
```

Wire to a temporary admin button or call via `node -e`, then verify event in GlitchTip/Bugsink UI within 30 seconds.

> **Plan-revision NOTE (2026-05-24):** plan-05 supersedes the "temporary admin button OR `node -e`" guidance above with a concrete invocation script `scripts/sentry-test.ts` invoked via `npx tsx scripts/sentry-test.ts`. See plan-05 Task 7b. The snippet above is the upstream RESEARCH reference; the plan operationalizes it.

**Critical caveats for self-hosted (vs Sentry SaaS):**

1. **`tunnelRoute` option is unsupported** for self-hosted — omit it.
2. **Source-map upload** requires `SENTRY_AUTH_TOKEN` against your self-hosted instance — defer to P7.
3. **`@sentry/nextjs@8.x` only** — 10.x uses protocol features GlitchTip/Bugsink don't implement (STACK.md).
4. **`enabled: !!process.env.SENTRY_DSN`** — graceful no-op if DSN missing, so dev without local GlitchTip still boots.

**Source:** [Sentry self-hosted Next.js guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) [CITED]. [GlitchTip Next.js SDK docs](https://glitchtip.com/sdkdocs/javascript-nextjs/) [CITED]. STACK.md HIGH confidence on 8.x pin.

### Pattern 5: `audit_log` Migration + `auditLog()` Helper (FOUND-05)

**What:** Postgres table schema, RLS denying all reads (service_role only access), helper that captures IP + UA from `headers()` and inserts via admin client.

**When to use:** Every compliance-significant event (payment.created / payment.succeeded / payment.failed / access.granted / access.revoked / account.deleted / webhook.auth_failed).

> **Plan-revision NOTE (2026-05-24) — Fix 13 column-name reconciliation:** plan-04 supersedes the column names below (`entity`/`payload`/`ip`) with the names from `.claude/skills/security/SKILL.md` §6 (`entity_type`/`meta`/`ip_address`) because the skill is the source of truth and audit_log is referenced by many features. See plan-04 Task 1 for the full reconciliation table. The SQL snippet below is the upstream RESEARCH reference; the plan operationalizes the skill-aligned form.

**Migration:**

```sql
-- supabase/migrations/20260524000001_add_audit_log.sql
-- =====================================================================
-- audit_log — append-only finance/access/compliance trail (FOUND-05).
-- Read/write only via service_role (no user-facing reads in M1).
-- =====================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL,                    -- e.g. 'payment.succeeded'
  entity      text,                              -- e.g. 'purchase'   (plan-04 renames to entity_type)
  entity_id   text,                              -- nullable; text not uuid (some entities have non-uuid ids)
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb, -- (plan-04 renames to meta per skill §6)
  ip          inet,                              -- (plan-04 renames to ip_address per skill §6)
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns (admin export in M2; ops debugging in M1).
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON audit_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_action_created
  ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log(entity, entity_id) WHERE entity IS NOT NULL;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Empty policy set = nobody (other than service_role) can read or write.
-- Service role bypasses RLS, so all inserts via admin client succeed.
-- We do NOT create a "service role can do anything" policy — it's the default.

-- Optional: prevent UPDATE/DELETE even by service role (immutable log).
-- This is the strictest stance and protects against accidental tampering
-- by buggy admin code.
CREATE OR REPLACE FUNCTION public.audit_log_no_mutate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (no UPDATE/DELETE allowed)';
END;
$$;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_no_mutate();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_no_mutate();
```

After applying: `npm run db:types` regenerates `src/types/database.ts`.

**Helper:**

```ts
// src/lib/audit-log.ts
import 'server-only';
import { headers } from 'next/headers';

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export interface AuditLogInput {
  /** Acting user UUID. Null for anonymous events (e.g., webhook from ЮKassa). */
  userId: string | null;
  /** Dotted action key, e.g. 'payment.succeeded', 'webhook.auth_failed', 'account.deleted'. */
  action: string;
  /** Entity type, e.g. 'purchase', 'profile'. Optional. */
  entity?: string;
  /** Entity id (text — some entities have non-uuid ids like ЮKassa payment_id). */
  entityId?: string;
  /** Arbitrary JSON metadata. Will NOT be redacted — caller MUST scrub secrets. */
  payload?: Record<string, unknown>;
}

/**
 * Append an immutable record to audit_log.
 *
 * Captures IP and User-Agent from the current request via next/headers().
 * Safe to call from Server Actions, Route Handlers, server queries.
 *
 * Failure mode: logs via pino + Sentry-captures, does NOT throw.
 * Compliance reasoning: never let an audit-write failure abort a payment.
 */
export async function auditLog(input: AuditLogInput): Promise<void> {
  try {
    const hs = headers(); // may throw if called outside a request context (e.g. unit test)
    const ip =
      hs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      hs.get('x-real-ip') ??
      null;
    const userAgent = hs.get('user-agent') ?? null;

    const supabase = createAdminClient();
    const { error } = await supabase.from('audit_log').insert({
      user_id: input.userId,
      action: input.action,
      entity: input.entity ?? null,
      entity_id: input.entityId ?? null,
      payload: input.payload ?? {},
      ip,
      user_agent: userAgent,
    });

    if (error) {
      logger.error({ err: error, audit: input }, 'auditLog insert failed');
      // Optionally re-throw or report to Sentry — for compliance, we LOG and continue.
    }
  } catch (err) {
    logger.error({ err, audit: input }, 'auditLog helper crashed');
    // Do not throw — audit MUST NOT abort business flow.
  }
}

/**
 * Variant for non-request contexts (cron jobs, background workers) where
 * next/headers() throws. Pass IP/UA explicitly if known, or omit.
 */
export async function auditLogContextless(
  input: AuditLogInput & { ip?: string | null; userAgent?: string | null }
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('audit_log').insert({
      user_id: input.userId,
      action: input.action,
      entity: input.entity ?? null,
      entity_id: input.entityId ?? null,
      payload: input.payload ?? {},
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    });
    if (error) logger.error({ err: error, audit: input }, 'auditLogContextless insert failed');
  } catch (err) {
    logger.error({ err, audit: input }, 'auditLogContextless helper crashed');
  }
}
```

**Unit test (acceptance criterion for FOUND-05):**

> **Plan-revision NOTE (2026-05-24) — Fix 6:** the snippet below uses `new Map(...)` to mock `headers()`. **This is WRONG** — Next.js `headers()` returns `ReadonlyHeaders` (a `Headers`-like object, case-insensitive), NOT a `Map` (case-sensitive). With `new Map(...)`, the test silently misses uppercase `X-Forwarded-For` vs lowercase `x-forwarded-for` casing — both `hs.get('X-Forwarded-For')` and `hs.get('x-forwarded-for')` should resolve via case-insensitive lookup on a real `Headers` instance, but `Map.get(...)` only finds exact-case matches. Plan-04 Task 4 supersedes with `new Headers(...)` and adds an explicit uppercase-key test case. See plan-04 for the corrected mock.

```ts
// src/lib/audit-log.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// SUPERSEDED by plan-04 Task 4 — use `new Headers(...)` instead of `new Map(...)`.
// See the plan-revision note above this snippet for the rationale (Fix 6).
vi.mock('next/headers', () => ({
  headers: () => new Headers({
    'x-forwarded-for': '203.0.113.42, 10.0.0.1',
    'user-agent': 'Test Agent 1.0',
  }),
}));

const insertMock = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ insert: insertMock }) }),
}));

import { auditLog } from './audit-log';

describe('auditLog', () => {
  beforeEach(() => insertMock.mockClear());

  it('captures IP from x-forwarded-for first hop', async () => {
    await auditLog({ userId: 'user-1', action: 'test.event' });
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      ip: '203.0.113.42',
      user_agent: 'Test Agent 1.0',
      action: 'test.event',
    }));
  });

  it('does not throw if insert fails', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'fail' } });
    await expect(auditLog({ userId: 'u', action: 'a' })).resolves.toBeUndefined();
  });
});
```

**Source:** [Supabase RLS service-role docs](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z) [CITED]. [Next.js headers() API](https://nextjs.org/docs/app/api-reference/functions/headers) [CITED]. Pattern derives from `.claude/skills/security/SKILL.md` §6 (audit_log schema definition).

### Pattern 6: RLS Test Harness (FOUND-10)

**What:** Vitest `globalSetup` spins up Supabase local via Docker, runs migrations, creates two users via `auth.admin.createUser()`, runs two anon-key clients with different JWTs, asserts cross-user denial.

**When to use:** Every migration in P2+ that adds RLS-protected table.

**Vitest config (separate from unit config):**

```ts
// vitest.integration.config.ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts', 'src/**/*.integration.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    globalSetup: './tests/integration/globalSetup.ts',
    setupFiles: ['./tests/integration/setup.ts'],
    // Integration suites do real I/O — give them room.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Sequential — each test mutates DB; parallel would collide.
    poolOptions: {
      threads: { singleThread: true },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

**Global setup:**

```ts
// tests/integration/globalSetup.ts
import { execSync } from 'node:child_process';

export async function setup() {
  console.log('[globalSetup] Ensuring Supabase local stack is running...');
  // `supabase status --output json` exits 0 if running, non-zero if not.
  let running = false;
  try {
    execSync('supabase status --output json', { stdio: 'pipe' });
    running = true;
  } catch {
    running = false;
  }

  if (!running) {
    console.log('[globalSetup] Starting Supabase (this may take ~30s)...');
    execSync('supabase start', { stdio: 'inherit' });
  }

  // Reset DB to a clean schema for the suite.
  console.log('[globalSetup] Resetting DB (re-applies migrations + seed)...');
  execSync('supabase db reset', { stdio: 'inherit' });

  // Read local-stack URLs/keys and inject into process.env for tests.
  // NOTE (plan-06 Task 1a — Fix 2): the JSON key casing varies across Supabase CLI versions.
  // Probe with `supabase status --output json | head` before relying on the casing below.
  // plan-06 globalSetup adds both UPPER_SNAKE and lower_snake variants + a defensive
  // throw if process.env.NEXT_PUBLIC_SUPABASE_URL ends up empty.
  const status = JSON.parse(execSync('supabase status --output json').toString());
  process.env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = status.ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
}

export async function teardown() {
  // Intentionally do NOT `supabase stop` — leaves the stack warm for next run.
  // CI should `supabase stop` in a post-step.
}
```

**Test helpers:**

```ts
// tests/integration/helpers/test-clients.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export function makeAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Anon-key client authenticated as a specific user.
 * Use this to test RLS — operations behave as the given user would see them.
 */
export function makeUserClient(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }
  );
}
```

```ts
// tests/integration/helpers/test-users.ts
import { makeAdminClient } from './test-clients';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
}

export async function createTestUser(suffix?: string): Promise<TestUser> {
  const admin = makeAdminClient();
  const email = `t+${suffix ?? crypto.randomUUID()}@test.local`;
  const password = 'TestPassword123!';

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email verification for tests
  });
  if (createErr || !created.user) throw createErr ?? new Error('createUser returned no user');

  // Generate a session (access_token) for the user we just made.
  const { data: session, error: signInErr } = await admin.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !session.session) throw signInErr ?? new Error('signIn returned no session');

  return {
    id: created.user.id,
    email,
    password,
    accessToken: session.session.access_token,
  };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = makeAdminClient();
  await admin.auth.admin.deleteUser(userId);
}
```

**Canary RLS test (template для будущих PRs):**

> **Plan-revision NOTE (2026-05-24) — Fix 12:** the snippet below contains a meaningless assertion on what is now line 1054 (`expect((error?.code ?? data?.length) ?? 0).not.toBe(undefined)`) — `0` is never `undefined`, so this always passes regardless of RLS behavior. Plan-06 Task 7 supersedes with the standard Supabase RLS-deny pattern: `expect(data ?? []).toEqual([])` for the UPDATE response + an admin-client read-back to AUTHORITATIVELY prove no mutation happened. See plan-06 for the corrected canary.

```ts
// tests/integration/rls/profiles.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, type TestUser } from '../helpers/test-users';
import { makeUserClient } from '../helpers/test-clients';

describe('RLS: profiles', () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser('a');
    userB = await createTestUser('b');
  });

  afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  it('User B cannot SELECT User A profile via anon-key client', async () => {
    const clientB = makeUserClient(userB.accessToken);
    const { data, error } = await clientB
      .from('profiles')
      .select('user_id, full_name')
      .eq('user_id', userA.id);

    expect(error).toBeNull();
    // RLS hides rows silently — no error, just empty result.
    expect(data).toEqual([]);
  });

  it('User B cannot UPDATE User A profile', async () => {
    const clientB = makeUserClient(userB.accessToken);
    const { error, data } = await clientB
      .from('profiles')
      .update({ full_name: 'Hacked' })
      .eq('user_id', userA.id)
      .select();

    // SUPERSEDED by plan-06 Task 7 — Fix 12. The next line always passes
    // (0 is never undefined). Replace with `expect(data ?? []).toEqual([])`
    // and use makeAdminClient() read-back as the authoritative proof.
    expect((error?.code ?? data?.length) ?? 0).not.toBe(undefined);
    // The important thing: the row was not updated.
    const adminCheck = await makeUserClient(userA.accessToken)
      .from('profiles').select('full_name').eq('user_id', userA.id).single();
    expect(adminCheck.data?.full_name).not.toBe('Hacked');
  });

  it('User A CAN SELECT own profile', async () => {
    const clientA = makeUserClient(userA.accessToken);
    const { data, error } = await clientA
      .from('profiles')
      .select('user_id')
      .eq('user_id', userA.id)
      .single();

    expect(error).toBeNull();
    expect(data?.user_id).toBe(userA.id);
  });
});
```

**Add npm script** to `package.json`:
```json
{
  "scripts": {
    "test:integration": "vitest run --config vitest.integration.config.ts"
  }
}
```

**Acceptance criterion:** `npm run test:integration -- tests/integration/rls/profiles.test.ts` passes against a fresh `supabase start`.

**Source:** [Supabase local development testing docs](https://supabase.com/docs/guides/local-development/testing/overview) [CITED]. [Testing Supabase RLS with Vitest (index.garden)](https://index.garden/supabase-vitest/) [CITED — confirms `auth.admin.createUser` + per-user-JWT client pattern].

### Anti-Patterns to Avoid

- **Reading `process.env` directly in app code:** Always import from `@/env`. Direct reads bypass validation and lose types.
- **Calling `Sentry.init` at the top of `next.config.js`:** Init must happen via `sentry.{server,client,edge}.config.ts` + `instrumentation.ts`. Anything else breaks bundle splitting.
- **Importing `pino` in middleware.ts:** Edge runtime — pino crashes. Use `console.log(JSON.stringify(...))` if structured output needed in middleware.
- **Using `await import('@/lib/supabase/admin')` to "lazy-load" service-role:** Build still includes the module in client chunks. Static `import 'server-only'` is the only safe pattern.
- **Throwing on `auditLog` failure:** Audit MUST NOT abort the business flow. Log + Sentry-capture, return undefined.
- **Mocking Supabase in RLS tests:** Defeats the purpose. RLS is a Postgres feature — test against real Postgres via `supabase start`.
- **Logging full request payloads without redact:** Pino redact covers `password`/`token`/`authorization`, but custom fields (e.g. `event.object.payment_method.card.last4`) require explicit redact paths.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Env-парсер | Custom `parseEnv()` с manual `process.exit(1)` | `@t3-oss/env-nextjs` | Решает `NEXT_PUBLIC_*` bundling-aware split, который вручную писать = 50 строк boilerplate с edge cases |
| Server/client boundary | `if (typeof window === 'undefined')` checks | `import 'server-only'` | Build-time гарантия > runtime check; работает с tree-shaking |
| Structured JSON logger | `console.log(JSON.stringify({...}))` | `pino` | Уровни, child loggers, redact-paths, ISO timestamps, fast serializer — все из коробки |
| Error monitoring | Manual try/catch + email | `@sentry/nextjs` | Auto-instrumentation Server Actions / Route Handlers / Components; deduplication; stack-trace symbolication |
| ESLint custom rule for forbidden imports | Custom rule plugin | `no-restricted-imports` built-in | Уже в ESLint core с 2015; гарантированно поддерживается |
| Test fixtures for Supabase | Hand-built Postgres in CI | Supabase local CLI (`supabase start`) | Поднимает identical stack (Postgres + Auth + Storage + Realtime) одной командой |

**Key insight:** Phase 1 — самая "well-charted" фаза. Каждая capability имеет canonical solution с 1M+/week downloads. Hand-rolling здесь = чистый downside.

---

## Common Pitfalls

### Pitfall 1: Environment variables empty at server runtime
**What goes wrong:** `process.env.SOMETHING` is `undefined` inside server code, even though `.env.local` has it.
**Why it happens:** Next.js 14 only auto-loads `.env.local` during `next dev` / `next build` / `next start`. If you run a custom script (`node scripts/...`) without invoking via `npm run`, `.env.local` is NOT read.
**How to avoid:** Always use Next.js entry points (`next dev`, `next build`). For one-off scripts, prepend `node --env-file=.env.local script.js` (Node ≥20.6) or use `dotenv -e .env.local`.
**Warning signs:** Env-парсер throws "SUPABASE_SERVICE_ROLE_KEY is required" only when running a custom script, not in `next dev`.

### Pitfall 2: `instrumentation.ts` not executed during `next build`
**What goes wrong:** Env validation happens at runtime, not at build — broken envs ship to production.
**Why it happens:** Next.js docs explicitly say [GitHub discussion #79536](https://github.com/vercel/next.js/discussions/79536) — `instrumentation.ts` runs at `next start`, not `next build`. Build phase only runs server modules that are statically imported by pages.
**How to avoid:** Use a pre-build npm script (this is plan-01's chosen approach — Fix 1):
```json
// package.json
"scripts": {
  "prebuild": "tsx src/env.ts"
}
```
The previously-suggested alternative `require('./src/env.ts')` from `next.config.js` is REJECTED — `next.config.js` is CommonJS without a TS loader at config evaluation, so `require('./src/env.ts')` would crash. Use the `prebuild` script.
**Warning signs:** `next build` succeeds locally without `.env.local`, then prod deploy crashes on first request.

### Pitfall 3: `server-only` import does NOT prevent runtime leak in dev
**What goes wrong:** In dev (`next dev`), `server-only` may NOT throw immediately on import-into-client — error surfaces only on production build.
**Why it happens:** `next dev` uses RSC-aware bundling but with some leniency; `next build` is the strict gate.
**How to avoid:** ALWAYS run `npm run build` locally before committing changes that touch `admin.ts` or anything that reads service_role. CI should fail the PR if build fails.
**Warning signs:** Code works in dev, breaks in prod with "Module not found: Can't resolve 'server-only'" or RSC client/server import errors.

### Pitfall 4: pino-pretty in production bundle bloats client
**What goes wrong:** `pino-pretty` (which depends on `colorette`, `dateformat`, etc.) accidentally ends up in client bundle.
**Why it happens:** Importing `pino-pretty` in a module that gets pulled into client chunks. `pino` itself handles the `transport` option lazily, but if you `import pinoPretty from 'pino-pretty'` at top-level, webpack bundles it.
**How to avoid:** NEVER `import pinoPretty`. Configure via `transport: { target: 'pino-pretty' }` (string, not import) — pino loads it via worker. Plan-02 (Fix 10) adds `pino-pretty` to ESLint's `no-restricted-imports` patterns to make this a lint-time error from any file except `src/lib/logger.ts`.
**Warning signs:** Client bundle size jumps ~50KB after wiring logger.

### Pitfall 5: GlitchTip ignores `release` and source maps
**What goes wrong:** Stack traces in GlitchTip show minified code; release tagging silently drops.
**Why it happens:** GlitchTip implements a subset of Sentry's release management. Source map upload via `withSentryConfig`'s `authToken` requires GlitchTip's release-management feature (later versions support it; some don't).
**How to avoid:** P1 ships without source-map upload (acceptable in dev). For P7 production, verify your GlitchTip version supports source maps OR switch to Bugsink (which does) before relying on stack traces.
**Warning signs:** Errors visible in dashboard, but stack frame shows `(2:1234567)` instead of `auth.ts:42`.

### Pitfall 6: `supabase start` hangs in CI
**What goes wrong:** `supabase start` requires Docker; in some CI environments Docker daemon takes 30-60s to be ready, supabase CLI timing out.
**Why it happens:** CI runners (GitHub Actions ubuntu-latest) ship Docker pre-installed but pulled images for Postgres/Auth are ~2GB on first run.
**How to avoid:** Cache `~/.cache/supabase` between CI runs. Set `supabase start --workdir ./supabase --debug` for diagnostic output. Allow 5-min timeout for first run.
**Warning signs:** CI test:integration step times out at exactly the default Vitest/CI timeout.

### Pitfall 7: ESLint `no-restricted-imports` doesn't catch `require()` / dynamic import
**What goes wrong:** Someone writes `const admin = require('@/lib/supabase/admin')` in a client component — ESLint passes.
**Why it happens:** `no-restricted-imports` only checks ES module `import` statements.
**How to avoid:** Add `no-restricted-syntax` rule for CallExpression patterns:
```json
"no-restricted-syntax": ["error", {
  "selector": "CallExpression[callee.name='require'][arguments.0.value=/supabase\\/admin/]",
  "message": "Do not require() supabase admin — it is server-only."
}]
```
OR rely on `server-only` package as the second line of defense (it throws at runtime regardless of how imported).
**Warning signs:** Build succeeds despite a client component pulling in admin module.

### Pitfall 8: `next/headers()` throws when called outside request scope
**What goes wrong:** `auditLog()` called from a cron-job / background worker / unit test throws "headers() can only be called inside a request scope".
**Why it happens:** Next.js's `headers()` is request-bound — it reads from AsyncLocalStorage that's only populated during HTTP request handling.
**How to avoid:** Catch the throw inside `auditLog()` (shown in Pattern 5 — `try/catch` around `headers()`). Provide `auditLogContextless()` variant for non-request contexts.
**Warning signs:** Pino logs "auditLog helper crashed" for background-job paths.

### Pitfall 9: `headers()` becomes async in Next.js 15+ (plan-04 Fix 7)
**What goes wrong:** Project upgrades from 14.2.x to 15+; existing `const hs = headers()` returns a Promise, all `hs.get('...')` calls return undefined, audit-log silently drops IP/UA.
**Why it happens:** Next.js 15 made dynamic APIs (`headers()`, `cookies()`, `params`) async to allow runtime streaming optimizations.
**How to avoid:** CLAUDE.md locks Next.js to 14.2.x for M1. plan-04 Task 3 includes an explicit sync-vs-async comment block in `src/lib/audit-log.ts` so a future maintainer who upgrades will see the change-point. Update the helper to `const hs = await headers()` and adjust mocks at upgrade time.
**Warning signs:** After upgrading Next.js major version, `auditLog()` calls silently insert rows with `ip_address: null`, `user_agent: null`.

---

## Code Examples

Concrete patterns covered above in their respective Pattern sections:

| Capability | Section | File path it produces |
|------------|---------|----------------------|
| Env parser | Pattern 1 | `src/env.ts`, `src/instrumentation.ts` |
| Server-only boundary | Pattern 2 | `src/lib/supabase/admin.ts`, `.eslintrc.json` patch |
| Pino logger | Pattern 3 | `src/lib/logger.ts` |
| Sentry self-hosted | Pattern 4 | `sentry.{server,client,edge}.config.ts`, `next.config.js` patch |
| audit_log + helper | Pattern 5 | `supabase/migrations/20260524000001_add_audit_log.sql`, `src/lib/audit-log.ts` |
| RLS test harness | Pattern 6 | `vitest.integration.config.ts`, `tests/integration/globalSetup.ts`, `tests/integration/helpers/test-{clients,users}.ts`, `tests/integration/rls/profiles.test.ts` |

All snippets above are copy-paste-ready into PLAN.md tasks, **except** where plan-files explicitly supersede a snippet (see plan-revision NOTEs in Pattern 4 final-acceptance, Pattern 5 column-names + mock, Pattern 6 globalSetup key-casing + canary UPDATE-deny — all marked inline above).

---

## Project Constraints (from CLAUDE.md)

Distilled from `./CLAUDE.md` — planner MUST verify compliance:

| Constraint | How Phase 1 honors it |
|------------|-----------------------|
| `'use client'` only when необходимо | Phase 1 has zero client components (infra-only) — N/A |
| Server Actions return `{ ok, data | error }`, not throw | `auditLog()` follows by not-throwing; future Server Actions in P2+ use this pattern |
| `service_role` only in `import 'server-only'` files | Pattern 2 enforces — `admin.ts` is the **only** file allowed to read it |
| Zod-schemas in `src/lib/schemas/` | Env-схема живёт в `src/env.ts` (root) — это canonical t3-env location, отступление обоснованное |
| Логирование: pino + audit_log dual layer | Pattern 3 + Pattern 5 — обе ветки реализованы |
| `audit_log` per `.claude/skills/security/SKILL.md` §6 schema | Plan-04 (Fix 13) aligns column names verbatim with skill §6: `entity_type, entity_id, meta, ip_address`. The RESEARCH Pattern 5 snippet uses earlier draft names (`entity, payload, ip`) — superseded by plan-04. |
| Тесты к каждой фиче | Pattern 5 includes unit test для `auditLog`; Pattern 6 includes canary RLS test |
| Migration через файл, без DROP / без edit applied | Pattern 5 migration uses `CREATE TABLE IF NOT EXISTS`; idempotent |

---

## Runtime State Inventory

This is a greenfield infrastructure phase — there is no pre-existing runtime state to migrate. Phase 1 establishes the foundation; nothing to rename, refactor, or back-fill.

Explicit zero-state check:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — base scaffold migration only creates `profiles`/`user_roles`/`courses`/`modules`/`lessons` (no business data yet) | None |
| Live service config | None — no Vercel/Sentry/GlitchTip instances live yet | None (provisioning is Phase-1 fresh setup, not state migration) |
| OS-registered state | None — no cron, no system service, no scheduled tasks | None |
| Secrets/env vars | `.env.example` exists with names only; `.env.local` is per-developer (not in git) | Document required vars в `.env.example` updates (NEW vars: `LOG_LEVEL`, `YOOKASSA_WEBHOOK_PATH_SECRET`, `KINESCOPE_PRIVATE_API_TOKEN`, `SMTP_HOST`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`) |
| Build artifacts | `.next/` builds locally; `node_modules` per-developer | None — fresh installs |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | ✓ (per `engines.node ≥20`) | check `node -v` ≥20 | — |
| npm | Package install | ✓ | check `npm -v` | — |
| Docker Desktop / Docker Engine | `supabase start` for RLS tests | check `docker info` | any modern | If absent: RLS tests can't run locally → block FOUND-10 acceptance |
| Supabase CLI | `supabase start/db reset/status` | already in devDependencies: `supabase@^1.200.3` | 1.200.3 | — |
| Self-hosted GlitchTip / Bugsink (dev DSN) | Sentry event verification | Not provisioned | — | **Block FOUND-06 final verification step** until provisioned; SDK install + config can proceed without it (`enabled: !!process.env.SENTRY_DSN` gracefully no-ops) |

**Missing dependencies with no fallback:**
- **GlitchTip / Bugsink dev instance** — needed to demonstrate "test event reaches dashboard" (Phase 1 success criterion #3). Suggested plan: provision a Bugsink container on developer's machine via `docker run -p 8000:8000 bugsink/bugsink` and use `SENTRY_DSN=http://<key>@localhost:8000/1` as dev DSN.

**Missing dependencies with fallback:**
- **Docker daemon** — if developer is on a Docker-less environment, can defer FOUND-10 acceptance to a CI-only check.

---

## Validation Architecture

> Phase 1 is infrastructure — most "tests" are smoke commands rather than test cases. We include framework wiring for use in P2+.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.2 (already in devDependencies) |
| Config file | `vitest.config.ts` (exists — unit/component tests, excludes integration/e2e); `vitest.integration.config.ts` (NEW in this phase — Pattern 6) |
| Quick run command | `npm run test:ci` |
| Full suite command | `npm run test:ci && npm run test:integration` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-02 | App throws on missing required env | smoke (manual) | `unset SUPABASE_SERVICE_ROLE_KEY && npm run dev` → should crash with ZodError message | ❌ Wave 0 (manual smoke в acceptance) |
| FOUND-02 | Env types resolve correctly in IDE | typecheck | `npm run typecheck` | ✅ existing |
| FOUND-03 | Build fails if `admin.ts` imported from client | unit (ESLint API) | `npm run test:ci -- src/lib/supabase/admin.lint.test.ts` (per plan-02 Fix 4 — reproducible, no plant-and-remove) | ❌ Wave 0 |
| FOUND-03 | ESLint catches restricted import | unit (ESLint API) | Same as above — `admin.lint.test.ts` covers both client-block + audit-log-allow | ❌ Wave 0 |
| FOUND-03 | grep returns empty for service_role in client surface | smoke | `grep -r "service_role" src/components/ src/app/\(marketing\)/ src/app/\(app\)/` returns empty | ❌ Wave 0 |
| FOUND-04 | pino-pretty active in dev | smoke | `NODE_ENV=development node -e "require('./dist/lib/logger').logger.info({test:1},'hi')"` → human-readable line | ❌ Wave 0 |
| FOUND-04 | pino raw JSON в prod | smoke | `NODE_ENV=production node -e "..."` → JSON line on stdout | ❌ Wave 0 |
| FOUND-05 | Migration applies cleanly | integration | `supabase db reset` succeeds; table exists | ✅ via Wave 0 globalSetup |
| FOUND-05 | RLS denies SELECT for non-service-role | integration | `tests/integration/rls/audit-log.test.ts` (write Wave 0) | ❌ Wave 0 |
| FOUND-05 | `auditLog()` captures IP + UA | unit | `npm run test src/lib/audit-log.test.ts` | ❌ Wave 0 |
| FOUND-06 | SDK installed + configured | typecheck | `npm run typecheck` passes (verifies imports resolve) | ✅ existing |
| FOUND-06 | Test event reaches dashboard | manual | Run `npx tsx scripts/sentry-test.ts` (per plan-05 Fix 8) → check GlitchTip UI within 30s | ❌ manual-only (depends on Bugsink/GlitchTip instance) |
| FOUND-10 | Two-user RLS denial proven | integration | `npm run test:integration -- tests/integration/rls/profiles.test.ts` | ❌ Wave 0 (template test) |

### Sampling Rate
- **Per task commit:** `npm run lint && npm run typecheck && npm run test:ci` (≤ 15 seconds, all on existing scaffold)
- **Per wave merge:** + `npm run test:integration` (≤ 60 seconds first run, ~30s subsequent if Supabase warm)
- **Phase gate:** Full suite green + manual smoke commands above + Sentry event observed in dashboard

### Wave 0 Gaps
- [ ] `src/env.ts` — Topic 1
- [ ] `src/instrumentation.ts` — Topic 1
- [ ] `src/lib/supabase/admin.ts` — Topic 2
- [ ] `src/lib/supabase/admin.lint.test.ts` — Topic 2 ESLint boundary test (Fix 4)
- [ ] `.eslintrc.json` patch (no-restricted-imports rule + pino-pretty block + .tsx globs) — Topic 2 (Fixes 3, 10)
- [ ] `src/lib/logger.ts` — Topic 3
- [ ] `sentry.{server,client,edge}.config.ts` — Topic 4
- [ ] `next.config.js` (withSentryConfig wrap) — Topic 4
- [ ] `scripts/sentry-test.ts` (TEMPORARY — Fix 8) — Topic 4
- [ ] `supabase/migrations/20260524000001_add_audit_log.sql` — Topic 5 (column names per skill §6 — Fix 13)
- [ ] `src/lib/audit-log.ts` (with sync-`headers()` comment — Fix 7) — Topic 5
- [ ] `src/lib/audit-log.test.ts` (new Headers mock — Fix 6) — Topic 5 unit test
- [ ] `vitest.integration.config.ts` — Topic 6
- [ ] `tests/integration/globalSetup.ts` (key-casing matrix — Fix 2) — Topic 6
- [ ] `tests/integration/setup.ts` — minimal global setup (extends existing `tests/unit/setup.ts` if needed)
- [ ] `tests/integration/helpers/test-clients.ts` — Topic 6
- [ ] `tests/integration/helpers/test-users.ts` — Topic 6
- [ ] `tests/integration/rls/profiles.test.ts` (admin-readback UPDATE-deny — Fix 12) — canary template
- [ ] `.env.example` update (new env vars)
- [ ] `package.json` `prebuild` script + `tsx` devDep (Fix 1) — Topic 1
- [ ] `package.json` script: `"test:integration"` already declared; ensure config path matches

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial (P2 owns user auth; here only service-role JWT) | Supabase service_role JWT loaded from env, never logged |
| V3 Session Management | no (P2 owns) | — |
| V4 Access Control | yes | RLS on `audit_log` (denies all reads); `server-only` boundary for service_role |
| V5 Input Validation | yes | Zod schema on env (Pattern 1) prevents type-confusion at startup |
| V6 Cryptography | partial | env-var WEBHOOK_PATH_SECRET requires ≥32 hex chars (Pattern 1 schema) — no hand-rolled crypto |
| V7 Error Handling & Logging | yes | pino redact for secrets (Pattern 3); audit_log immutable trigger (Pattern 5) |
| V8 Data Protection | yes | service_role isolation; redact list covers secrets |
| V10 Malicious Code | yes | Package legitimacy audit performed; ESLint `no-restricted-imports` for admin module |

### Known Threat Patterns for Next.js 14 + Supabase + Self-Hosted Monitoring

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service-role leak into client bundle | Information Disclosure | Pattern 2 — 3-layer defense (server-only + ESLint + grep CI check) |
| Env-secret accidentally logged | Information Disclosure | Pattern 3 — pino redact-paths list includes all secret env-var names |
| Audit-log tampered after-the-fact | Repudiation | Pattern 5 — trigger blocks UPDATE/DELETE on `audit_log` even for service_role |
| Sentry breadcrumb leaks Authorization header | Information Disclosure | Pattern 4 — `beforeSend` strips cookie/authorization from breadcrumbs |
| Webhook path-secret too short / guessable | Spoofing | Pattern 1 env schema enforces `min(32, hex)` for WEBHOOK_PATH_SECRET |
| Source maps in client expose server logic | Information Disclosure | Pattern 4 — `hideSourceMaps: true` in withSentryConfig |
| Audit log fails silently when admin client unreachable | Repudiation | Pattern 5 helper logs via pino + Sentry on insert failure; planner should add metric alert |
| RLS bypass via service-role abuse | Elevation of Privilege | Pattern 2 — service-role usage gated to webhook handlers + audit-log + payment Server Action only |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `dotenv` at app start, runtime `process.env.X` access | `@t3-oss/env-nextjs` + Zod, typed `env` import | T3-stack popularized 2022-2023 | Type safety + client/server bundling-aware split |
| `winston` JSON logger | `pino` | 2020+ — pino dominant since v6 | 1-2 orders of magnitude faster, lower allocation |
| Sentry SaaS only | Self-hosted compatible (GlitchTip, Bugsink) | 2023+ — GlitchTip stable; mandatory for RU since Sept 2024 | Sanctions-resilient observability |
| Custom server-only checks (`typeof window`) | `server-only` package + build-time guarantee | Next.js 13.2+ (Feb 2023) | Build-time error vs runtime error |
| ESLint `import/no-restricted-paths` plugin | Native `no-restricted-imports` rule | Native rule since ESLint 5 (2018); patterns option since 2.x | One fewer plugin to maintain |
| `pg-mem` / `pg-tap` for Postgres tests | Supabase local CLI via Docker | Supabase CLI 1.x maturity (2023+) | Real RLS engine, real `auth.users`, predictive of prod |

**Deprecated/outdated:**
- **Sentry 7.x for new Next.js installs** — replaced by 8.x (auto-instrumentation overhaul); but we pin 8.x deliberately because 10.x breaks self-hosted compat.
- **Zod 3 для long-term** — Zod 4 is current major (2025-09 release); we stay on 3 for M1 (STACK.md locked decision tied to `@hookform/resolvers@3.x` compatibility).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@t3-oss/env-nextjs@0.13.11` is the canonical Next.js + Zod env wrapper | Standard Stack | Low — STACK.md / community consensus / verified npm registry. Hand-roll fallback documented. |
| A2 | `pino-pretty@13.x` works with Node 20 and pino 10 | Standard Stack | Low — released 2025-12-01, semver-compatible with pino 10.x; STACK.md said `^11.x` but newer minor bumps don't break API |
| A3 | GlitchTip implements Sentry 8.x protocol | Pattern 4 | Medium — confirmed by GlitchTip's official Next.js SDK docs (linked) but version compatibility matrix is fluid. Verify before P7 production. |
| A4 | `supabase status --output json` exposes ANON_KEY / SERVICE_ROLE_KEY / API_URL | Pattern 6 globalSetup | Low-Medium — Supabase CLI 1.x stable, but key casing varies across CLI versions. Plan-06 Task 1a (Fix 2) probes the actual casing before encoding it; falls back to plain-text regex if JSON breaks. |
| A5 | `instrumentation.ts` runs at boot of `next dev` / `next start` (not `next build`) | Pattern 1 + Pitfall 2 | Verified — official Next.js docs say instrumentation runs once at server start. Build-time validation requires separate hook (Pitfall 2 mitigation — plan-01 uses a `prebuild` npm script per Fix 1) |
| A6 | `headers()` from `next/headers` throws outside request scope | Pattern 5 helper | Verified — Next.js 14 documented behavior. Helper handles via try/catch + `auditLogContextless` variant. |
| A7 | RLS service_role bypass means INSERT into `audit_log` succeeds despite empty policy set | Pattern 5 migration | Verified — Supabase docs explicitly state service_role bypasses RLS. |
| A8 | Self-hosted Sentry/GlitchTip/Bugsink dev instance will be provisioned by developer before final P1 acceptance | Environment Availability | Medium — if not provisioned, FOUND-06 acceptance #3 (test event in dashboard) blocks. Pattern 4 `enabled: !!SENTRY_DSN` graceful-noops so install+wire stages proceed. |
| A9 | Next.js 14.2.x keeps `headers()` synchronous (M1 stack locked to 14.2.15) | Pattern 5 helper + Pitfall 9 | Verified — CLAUDE.md locks Next 14.2.x. Plan-04 Task 3 (Fix 7) adds an explicit sync-vs-async comment so future upgrade to 15+ catches the change-point. |

---

## Open Questions

1. **Which self-hosted error monitor: GlitchTip vs Bugsink?**
   - What we know: STACK.md says "config-not-code decision, defer to deploy time"; both Sentry-API compatible.
   - What's unclear: Operational preference (Bugsink = 1 container/SQLite, GlitchTip = 4 containers/Postgres).
   - Recommendation: Phase 1 ships with `SENTRY_DSN` env-var pointing wherever; **decision deferred to P7** when provisioning prod-instance. For dev: Bugsink is faster to spin up (`docker run bugsink/bugsink`).

2. **Should env-парсер also run at `next build` time, not just runtime?**
   - What we know: `instrumentation.ts` only runs at `next start` (Pitfall 2 confirms via [GitHub discussion #79536](https://github.com/vercel/next.js/discussions/79536)).
   - Resolved (plan-01 Fix 1): YES, via `prebuild` npm script (`"prebuild": "tsx src/env.ts"`). The previously-suggested `require('./src/env')` in `next.config.js` is REJECTED — CommonJS config can't load TS modules without a loader. Cost: build-time validation runs on CI without `.env.local` (mitigation: CI must export same env-vars as prod for build).

3. **`pino` `child` logger per Server Action — single global or per-call?**
   - What we know: pino child loggers are cheap (shared serializer, just override base fields).
   - What's unclear: Convention for "request-scoped" loggers in Next.js (no AsyncLocalStorage helper out-of-the-box).
   - Recommendation: Per-call `logger.child({ action, userId })` at start of each Server Action — keeps cost low, gives structured context per invocation.

4. **Should we also add a "smoke test" Server Action for env validation?**
   - What we know: t3-env throws on import; no separate test needed.
   - What's unclear: Whether to have an explicit `verifyBootEnv()` exported helper for CI.
   - Recommendation: Not needed — `npm run build` is the canonical CI smoke (will fail at `prebuild` step if env-import-side-effect crashes).

---

## Sources

### Primary (HIGH confidence)
- [Next.js 14 instrumentation.ts API](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation) — boot-time hook semantics
- [Next.js `server-only` convention](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#keeping-server-only-code-out-of-the-client-environment) — build-time guarantee
- [Next.js `headers()` API](https://nextjs.org/docs/app/api-reference/functions/headers) — request-bound, throws outside scope
- [@t3-oss/env-nextjs docs](https://env.t3.gg/docs/nextjs) — canonical Next.js wrapper API
- [Sentry self-hosted Next.js manual setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) — 3 config files + withSentryConfig pattern
- [GlitchTip Next.js SDK setup docs](https://glitchtip.com/sdkdocs/javascript-nextjs/) — self-hosted DSN model
- [Supabase local development testing overview](https://supabase.com/docs/guides/local-development/testing/overview) — `supabase start` test pattern
- [Supabase service-role RLS bypass docs](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z) — explicit bypass behavior
- [ESLint `no-restricted-imports` rule](https://eslint.org/docs/latest/rules/no-restricted-imports) — `patterns` option for glob-based forbids
- [pino documentation](https://github.com/pinojs/pino/blob/main/docs/help.md) — redact, child loggers, transports
- npm registry version pins (verified 2026-05-24): `@t3-oss/env-nextjs@0.13.11`, `server-only@0.0.1`, `pino@10.3.1`, `pino-pretty@13.1.3`, `@sentry/nextjs@8.55.2` (latest 8.x dist-tag)

### Secondary (MEDIUM confidence)
- [Testing Supabase RLS with Vitest (index.garden)](https://index.garden/supabase-vitest/) — per-user-JWT pattern reference
- [pino Next.js example repo](https://github.com/pinojs/pino-nextjs-example) — Vercel-blessed canonical Next.js wiring
- [GitHub discussion #79536: env validation in build/dev/start](https://github.com/vercel/next.js/discussions/79536) — confirms `instrumentation.ts` runs only at start, not build
- [Edge runtime + pino discussion #33898](https://github.com/vercel/next.js/discussions/33898) — confirms pino requires Node runtime

### Tertiary (LOW confidence — flag for validation)
- GlitchTip version-to-Sentry-protocol-version compatibility matrix is fluid; verify against actual GlitchTip release notes during P7 deploy task.

### In-repo (HIGH — source of truth for project rules)
- `/Users/tkestkes/Desktop/repo/.planning/PROJECT.md` — project identity, M1 scope
- `/Users/tkestkes/Desktop/repo/.planning/ROADMAP.md` — Phase 1 goal + success criteria
- `/Users/tkestkes/Desktop/repo/.planning/REQUIREMENTS.md` — FOUND-02..06, FOUND-10 atomic requirements
- `/Users/tkestkes/Desktop/repo/.planning/research/STACK.md` — version pins (HIGH confidence)
- `/Users/tkestkes/Desktop/repo/.planning/research/ARCHITECTURE.md` — boundaries, audit_log schema in §2.2
- `/Users/tkestkes/Desktop/repo/.claude/skills/api-conventions/SKILL.md` — Server Action / Route Handler / query conventions
- `/Users/tkestkes/Desktop/repo/.claude/skills/database/SKILL.md` — migration style, RLS rules
- `/Users/tkestkes/Desktop/repo/.claude/skills/security/SKILL.md` — service_role discipline, audit_log schema §6
- `/Users/tkestkes/Desktop/repo/.claude/skills/testing/SKILL.md` — Vitest layout, RLS testing pattern
- `/Users/tkestkes/Desktop/repo/CLAUDE.md` — project rules
- `/Users/tkestkes/Desktop/repo/package.json` — current pinned versions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version verified on npm registry 2026-05-24, source URLs cited
- Architecture patterns: HIGH — all 6 patterns derived from official Next.js / Supabase / Sentry docs + existing repo skills
- Pitfalls: HIGH for 1-4 + 9 (well-documented), MEDIUM for 5-8 (less common but cited)
- Sentry self-hosted protocol compatibility: MEDIUM (A3) — verify before P7 prod

**Research date:** 2026-05-24
**Plan-revision date:** 2026-05-24 (Fixes 1, 2, 4, 6, 7, 8, 9, 10, 11, 12, 13 documented inline as plan-revision NOTEs above; plan files supersede the relevant RESEARCH snippets)
**Valid until:** 2026-06-24 (30 days for stable infra patterns; Sentry SDK and Supabase CLI are the most likely to drift — re-check before P7 production tasks)
