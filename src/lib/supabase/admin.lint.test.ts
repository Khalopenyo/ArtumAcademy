// src/lib/supabase/admin.lint.test.ts
//
// Reproducible test that the no-restricted-imports rule actually blocks
// client-side imports of @/lib/supabase/admin. Runs in CI forever.
// Replaces the plant-and-remove smoke verification from the earlier
// plan-02 draft (per RESEARCH.md Fix 4) — this test never plants files
// on disk; it lints a STRING via the ESLint Node API.

// @vitest-environment node
// (the ESLint Node API uses fs/path and works best outside jsdom;
// the repo default in vitest.config.ts is jsdom, hence the pragma)

import path from 'node:path';

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../');

describe('admin.ts ESLint boundary (FOUND-03)', () => {
  let eslint: ESLint;

  beforeAll(() => {
    // Reuse the repo's .eslintrc.json — do NOT inline a new config.
    // useEslintrc is the v8 API option; ESLint resolves .eslintrc.json
    // relative to cwd.
    eslint = new ESLint({
      cwd: REPO_ROOT,
      useEslintrc: true,
    });
  });

  it('reports a no-restricted-imports error when a client component imports @/lib/supabase/admin', async () => {
    const source = [
      "'use client';",
      "import { createAdminClient } from '@/lib/supabase/admin';",
      'export function ClientLeak() {',
      '  createAdminClient();',
      '  return null;',
      '}',
    ].join('\n');

    // Use a synthetic file path under src/components/ so the lint
    // overrides for src/server/**, src/app/api/**, etc. do NOT exempt it.
    const results = await eslint.lintText(source, {
      filePath: path.join(REPO_ROOT, 'src/components/__synthetic_client_leak__.tsx'),
    });

    const ruleErrors =
      results[0]?.messages.filter(
        (m) => m.ruleId === 'no-restricted-imports' && m.severity === 2,
      ) ?? [];

    expect(ruleErrors.length).toBeGreaterThan(0);
    expect(ruleErrors[0]!.message).toMatch(/server-only/i);
  });

  it('does NOT report a no-restricted-imports error when src/lib/audit-log.ts imports @/lib/supabase/admin', async () => {
    const source = "import { createAdminClient } from '@/lib/supabase/admin';\n";

    const results = await eslint.lintText(source, {
      filePath: path.join(REPO_ROOT, 'src/lib/audit-log.ts'),
    });

    const ruleErrors =
      results[0]?.messages.filter(
        (m) => m.ruleId === 'no-restricted-imports' && m.severity === 2,
      ) ?? [];

    expect(ruleErrors).toHaveLength(0);
  });
});
