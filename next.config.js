const { withSentryConfig } = require('@sentry/nextjs');

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
