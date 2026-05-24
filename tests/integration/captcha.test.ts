/**
 * Integration test for verifyCaptcha against Yandex's live validate endpoint
 * (AUTH-09, plan-06 Task 3).
 *
 * Yandex SmartCaptcha publishes a documented "test-mode" sitekey/serverkey
 * pair that always succeeds (per
 * https://yandex.cloud/en/docs/smartcaptcha/operations/validate-captcha).
 * To opt into the live path, set:
 *   YANDEX_CAPTCHA_SERVER_KEY=<test-mode-server-key>
 * and rerun `npm run test:integration`. The live happy-path test (Test 1)
 * is skipped when the env var is absent or unmistakably non-test-mode.
 *
 * The bogus-token case (Test 2) always runs and is the canonical
 * smoke for `verifyCaptcha`: regardless of network reachability, an
 * obviously-malformed token must return ok=false (reason='invalid' if
 * Yandex was reachable; reason='network' if not). Either outcome
 * proves the helper never leaks ok=true on bad input.
 *
 * Docker note: This file runs inside the integration suite that boots
 * the local Supabase stack. Yandex itself is reached over the public
 * internet — the test does NOT require Docker for the captcha endpoint,
 * but the global setup that boots Supabase does. Per plan-06 P1 pattern,
 * deferred runtime to first dev with Docker.
 */

import { describe, expect, it } from 'vitest';

import { verifyCaptcha } from '@/lib/captcha/verify';

const TEST_MODE_KEY_HINTS = ['ysc1__test', 'test', 'sandbox'];

function looksLikeTestModeKey(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return TEST_MODE_KEY_HINTS.some((hint) => v.includes(hint));
}

describe('verifyCaptcha (integration)', () => {
  const haveTestKey = looksLikeTestModeKey(process.env.YANDEX_CAPTCHA_SERVER_KEY);

  it.skipIf(!haveTestKey)(
    '1. live happy path — Yandex test-mode pair returns ok=true',
    async () => {
      // The Yandex test-mode server-key accepts ANY token and returns
      // status='ok'. The widget on the client would issue a real token,
      // but for the server-side smoke we send a placeholder.
      const result = await verifyCaptcha('test-mode-placeholder-token', '127.0.0.1');
      expect(result.ok).toBe(true);
    },
  );

  it('2. obviously-bogus token never returns ok=true', async () => {
    // This runs regardless of whether YANDEX_CAPTCHA_SERVER_KEY is set:
    // - If unset: helper returns ok=false with reason='server_misconfig'.
    // - If set: helper hits Yandex which rejects (reason='invalid') or
    //   the network errors out (reason='network'). Any non-ok outcome
    //   is the safe behaviour.
    const result = await verifyCaptcha('clearly-not-a-real-yandex-captcha-token-' + Date.now(), null);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/^(invalid|network|server_misconfig)$/);
  });
});
