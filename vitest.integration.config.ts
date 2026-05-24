// vitest.integration.config.ts
//
// Separate Vitest config for integration tests that exercise a real Supabase
// Postgres instance via `supabase start` (Docker). Unit-only config lives in
// `vitest.config.ts` and excludes `tests/integration/**`, so the two suites
// never collide.
//
// Run via: `npm run test:integration` (defined in package.json).
//
// Why a separate config:
//   - environment is `node` (no jsdom — we hit real HTTP + Postgres)
//   - singleThread is on (each test mutates DB; parallel pools would collide)
//   - globalSetup boots/asserts Supabase local stack (see tests/integration/globalSetup.ts)
//   - testTimeout/hookTimeout are generous (real I/O against local Docker)

import { defineConfig } from 'vitest/config';
import path from 'node:path';

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
      '@': path.resolve(__dirname, './src'),
    },
  },
});
