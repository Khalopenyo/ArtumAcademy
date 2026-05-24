/**
 * Centralised env validation for VideoEdit Academy (FOUND-02, plan-01).
 *
 * Built on `@t3-oss/env-nextjs` — canonical Next.js+Zod wrapper.
 *
 * Behaviour:
 *   - Evaluates at module load (no lazy factory). Any missing or invalid
 *     env throws a ZodError immediately, which kills the calling process
 *     (next dev / next start / `tsx src/env.ts` prebuild).
 *   - `runtimeEnv` lists every var explicitly because Next.js does not
 *     statically expose `process.env.*` to client bundles by default.
 *   - `emptyStringAsUndefined: true` so `SMTP_HOST=` resolves through
 *     `.optional()` instead of failing `.min(1)`.
 *
 * Boot wiring lives in `src/instrumentation.ts`; build-time validation
 * is enforced via the `prebuild` npm script (`tsx src/env.ts`).
 *
 * See: .planning/phases/1-dev-foundations/RESEARCH.md §Pattern 1.
 */

import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  /**
   * Server-only — never bundled into client.
   * Validated on first import from a server module (and from the
   * prebuild `tsx src/env.ts` invocation).
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
