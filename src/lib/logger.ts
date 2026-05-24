import 'server-only';
/**
 * pino structured logger singleton (FOUND-04, plan-03).
 *
 * Behaviour:
 *   - Lazy-evaluated singleton: avoids import-time side-effects when Next.js
 *     re-imports the module across workers / bundles.
 *   - Pretty (colorized, human-readable) output in dev via pino-pretty
 *     transport; raw JSON on stdout in prod (Vercel + Yandex Cloud log
 *     aggregators parse this natively).
 *   - `level: 'silent'` under NODE_ENV=test so `vitest run` is quiet.
 *   - Redact list masks secret-shaped keys (`password`, `token`,
 *     auth headers, project secret env vars) — see redact.paths.
 *
 * Imports:
 *   - `import 'server-only'` (first line) — guards against accidental
 *     inclusion in Edge runtime bundles (workerd has no Node `stream`
 *     API; pino crashes). Middleware must use console.log directly.
 *
 * Surface:
 *   - getLogger(): explicit factory returning the singleton.
 *   - logger: Proxy over getLogger() — `import { logger } from '@/lib/logger'`.
 *   - LOGGER_OPTIONS: exported config object for test reuse
 *     (`src/lib/logger.test.ts` builds a memory-buffer pino with the same
 *     redact + base config to assert structure and redaction).
 *
 * Usage (Server Action / Route Handler):
 *   const log = logger.child({ action: 'register', user_id });
 *   log.info('start');
 *   // ...
 *   log.info({ ms: performance.now() - t0 }, 'success');
 *
 * See: .planning/phases/1-dev-foundations/RESEARCH.md §Pattern 3.
 */

import pino, { type Logger, type LoggerOptions } from 'pino';

import { env } from '@/env';

const isDev = env.NODE_ENV === 'development';
const isTest = env.NODE_ENV === 'test';

/**
 * Pino options used by both the runtime singleton and unit tests.
 * Tests strip `transport` (transport is for runtime stdout; tests
 * point pino at an in-memory Writable via `pino.destination`).
 */
export const LOGGER_OPTIONS: LoggerOptions = {
  level: isTest ? 'silent' : env.LOG_LEVEL,

  // Redact secret-shaped keys. pino walks object keys and replaces matches
  // with the censor string. Paths use pino's glob-ish path syntax.
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

  // Base fields on every log line — let aggregators / Sentry join across services.
  base: {
    service: 'videoedit-academy',
    env: env.NODE_ENV,
  },

  // ISO timestamps survive log aggregators better than epoch milliseconds.
  timestamp: pino.stdTimeFunctions.isoTime,

  // Pretty transport ONLY in dev — string target (not import) so pino loads
  // pino-pretty via require() in a worker thread, keeping it OUT of the
  // production bundle. See RESEARCH.md §Pitfall 4.
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
};

/**
 * Singleton pino instance. Lazy so re-imports across Next.js bundles
 * (server, workers, route handlers) reuse the same logger.
 */
let _logger: Logger | null = null;

export function getLogger(): Logger {
  if (_logger) return _logger;
  _logger = pino(LOGGER_OPTIONS);
  return _logger;
}

/**
 * Convenience export for the common case.
 * Equivalent to `getLogger()` but reads naturally:
 *   import { logger } from '@/lib/logger';
 *   logger.info({ user_id }, 'message');
 */
export const logger = new Proxy({} as Logger, {
  get: (_target, prop) => Reflect.get(getLogger(), prop),
});
