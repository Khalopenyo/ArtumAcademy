import { expect, test } from '@playwright/test';

/**
 * LEGAL-03 — verify all 5 required security headers are present on every response.
 *
 * Headers configured in next.config.js → headers() → source: '/(.*)'.
 */

test('homepage response includes all 5 required security headers (LEGAL-03)', async ({
  request,
}) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);

  const headers = res.headers();

  // 1. HSTS — HTTPS-only enforcement
  expect(headers['strict-transport-security']).toContain('max-age=63072000');
  expect(headers['strict-transport-security']).toContain('includeSubDomains');

  // 2. X-Frame-Options — clickjacking prevention
  expect(headers['x-frame-options']).toBe('DENY');

  // 3. X-Content-Type-Options — MIME sniffing prevention
  expect(headers['x-content-type-options']).toBe('nosniff');

  // 4. Referrer-Policy — limit referer leakage to cross-origin
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');

  // 5. Permissions-Policy — disable camera/microphone/geolocation/browsing-topics
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['permissions-policy']).toContain('microphone=()');
  expect(headers['permissions-policy']).toContain('geolocation=()');
});
