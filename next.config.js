const { withSentryConfig } = require('@sentry/nextjs');

// Content-Security-Policy. 'unsafe-inline' в script-src нужен для инлайн-скриптов
// гидрации Next (без nonce). Домены: Supabase (БД/realtime), Kinescope (видео),
// Yandex SmartCaptcha. frame-ancestors 'none' дублирует X-Frame-Options.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://smartcaptcha.yandexcloud.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://smartcaptcha.yandexcloud.net https://*.kinescope.io",
  "frame-src 'self' https://smartcaptcha.yandexcloud.net https://*.kinescope.io",
  "media-src 'self' blob: https://*.kinescope.io",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.kinescope.io',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // LEGAL-03 (plan-02): camera/microphone/geolocation/browsing-topics disabled by default.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          { key: 'Content-Security-Policy', value: CSP },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  // ---- Self-hosted GlitchTip/Bugsink targeting (FOUND-06, plan-05) ----
  // P1 dev: developer-local Bugsink container, no upload target needed.
  // Uncomment + populate in P7 when prod self-hosted instance exists:
  // sentryUrl: 'https://glitchtip.your-domain.ru',
  // org: 'videoedit-academy',
  // project: 'web',
  // authToken: process.env.SENTRY_AUTH_TOKEN, // source-map upload (P7)

  hideSourceMaps: true,             // don't expose maps to client
  telemetry: false,                 // disable Sentry SaaS telemetry
  silent: !process.env.SENTRY_DSN,  // silently skip if no DSN (dev convenience)
});
