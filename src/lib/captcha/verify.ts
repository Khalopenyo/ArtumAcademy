import 'server-only';
/**
 * verifyCaptcha() — server-side Yandex SmartCaptcha token validator
 * (AUTH-09, plan-06).
 *
 * The Yandex SmartCaptcha widget (rendered on /register + /forgot-password
 * via @yandex/smart-captcha) produces a token on the client. Plans 07
 * (register) and 09 (forgot-password) pass that token to this helper from
 * their Server Action; this helper POSTs the (secret, token, ip) tuple to
 * Yandex's validate endpoint and returns a strict ok/deny result.
 *
 * Endpoint: https://smartcaptcha.cloud.yandex.ru/validate
 *   Method: POST
 *   Content-Type: application/x-www-form-urlencoded
 *   Body: secret=<YANDEX_CAPTCHA_SERVER_KEY>&token=<widget-token>&ip=<client-ip>
 *   Response: { status: 'ok' | 'failed', message?: string, host?: string }
 *
 * Strict-deny policy (P2 dev choice):
 *   - HTTP errors (non-2xx) → reason='network', ok=false.
 *   - Network exception (fetch throws, timeout fires) → reason='network'.
 *   - Yandex returns status=failed → reason='invalid'.
 *   - YANDEX_CAPTCHA_SERVER_KEY missing → reason='server_misconfig'.
 *
 * Production graceful-degradation (treat HTTP error as 'ok' per Yandex
 * docs) is deliberately NOT implemented in P2 — strict-deny surfaces
 * integration bugs early. Revisit in P7 once we have Sentry monitoring
 * (security/SKILL.md §5 + RESEARCH.md §Pattern 6 footnote).
 *
 * 5-second timeout via AbortSignal.timeout — prevents a slow/unreachable
 * captcha endpoint from blocking the whole auth request indefinitely.
 *
 * Failure mode: this helper NEVER throws. All error paths return
 * ok=false with a reason string and log via pino.
 */

import { logger } from '@/lib/logger';

const VALIDATE_URL = 'https://smartcaptcha.cloud.yandex.ru/validate';

export interface CaptchaResult {
  ok: boolean;
  reason?: 'invalid' | 'expired' | 'network' | 'server_misconfig';
}

export async function verifyCaptcha(token: string, ip: string | null): Promise<CaptchaResult> {
  const secret = process.env.YANDEX_CAPTCHA_SERVER_KEY;
  if (!secret) {
    logger.error('YANDEX_CAPTCHA_SERVER_KEY missing');
    return { ok: false, reason: 'server_misconfig' };
  }

  const body = new URLSearchParams({ secret, token });
  if (ip) body.append('ip', ip);

  try {
    const res = await fetch(VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'captcha validate HTTP error');
      // STRICT in P2 dev — block submission. Production graceful degradation
      // (treat HTTP error as ok per Yandex docs) is a P7 decision once we
      // have monitoring. For dev: surface bugs.
      return { ok: false, reason: 'network' };
    }
    const json = (await res.json()) as { status: 'ok' | 'failed'; message?: string };
    if (json.status === 'ok') return { ok: true };
    logger.warn({ message: json.message }, 'captcha rejected by Yandex');
    return { ok: false, reason: 'invalid' };
  } catch (err) {
    logger.error({ err }, 'captcha validate threw');
    return { ok: false, reason: 'network' };
  }
}
