// tests/integration/setup.ts
//
// Per-suite setup file referenced by `vitest.integration.config.ts`
// (setupFiles array). Runs in each worker BEFORE each test file is loaded.
//
// Phase 1 (FOUND-10): intentionally minimal — globalSetup.ts already handles
// the heavy infrastructure boot (supabase start + db reset + env injection).
//
// Add per-test concerns here as the integration suite grows:
//   - Custom Vitest matchers (e.g. expect.extend({ ... }))
//   - Global mocks that need to apply per-test file
//   - Per-test fixtures or hooks (beforeEach cleanup, etc.)
//
// Do NOT add jest-dom matchers here — integration tests run under `node`
// environment (no DOM). The unit suite's tests/unit/setup.ts handles that.

export {};
