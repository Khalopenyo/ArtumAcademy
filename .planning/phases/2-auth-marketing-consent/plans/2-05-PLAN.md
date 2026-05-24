---
plan: 05-seo-and-lighthouse
phase: 2
wave: 3
type: execute
maps_to: [LAND-03, LAND-04]
depends_on: [01-shadcn-and-design-system, 02-legal-pages-and-security-headers, 03-landing-page, 04-course-preview]
autonomous: false
mode: mvp
estimated_tasks: 3
files_modified:
  - src/app/sitemap.ts
  - src/app/robots.ts
  - public/og-default.png
  - src/app/(marketing)/page.tsx
  - src/app/(marketing)/courses/[slug]/page.tsx
  - src/app/(marketing)/privacy/page.tsx
  - src/app/(marketing)/oferta/page.tsx
  - src/app/layout.tsx
  - .env.example
requirements: [LAND-03, LAND-04]
must_haves:
  truths:
    - "GET /sitemap.xml returns a valid XML sitemap including / + /privacy + /oferta + /courses/<MVP_SLUG>"
    - "GET /robots.txt returns the right policy (preview blocked, production allow /, disallow /api/ + /dashboard + /auth/)"
    - "/, /courses/[slug], /privacy, /oferta have unique <title> + meta-description set via Metadata API"
    - "OpenGraph image is set in root layout metadata (public/og-default.png 1200×630 placeholder)"
    - "Lighthouse mobile Performance score ≥ 0.80 for / (verified by checkpoint)"
  artifacts:
    - path: src/app/sitemap.ts
      provides: "Next.js sitemap.ts file convention — auto-generates /sitemap.xml at build"
    - path: src/app/robots.ts
      provides: "Next.js robots.ts file convention — auto-generates /robots.txt; preview-aware"
    - path: public/og-default.png
      provides: "1200×630 PNG OG image (placeholder wordmark on dark background; ≤200KB)"
    - path: src/app/(marketing)/page.tsx
      provides: "Landing metadata export (title + description + openGraph + alternates.canonical + revalidate=300)"
    - path: src/app/(marketing)/courses/[slug]/page.tsx
      provides: "generateMetadata() — per-course title/description/og"
    - path: src/app/layout.tsx
      provides: "Root layout default openGraph image + metadataBase"
  key_links:
    - from: src/app/sitemap.ts
      to: NEXT_PUBLIC_APP_URL env var
      via: process.env / env
      pattern: "NEXT_PUBLIC_APP_URL\\|NEXT_PUBLIC_SITE_URL"
    - from: src/app/robots.ts
      to: VERCEL_ENV (preview vs production gating)
      via: process.env.VERCEL_ENV
      pattern: "VERCEL_ENV"
---

<objective>
Ship the SEO baseline (`sitemap.xml`, `robots.txt`, per-page metadata, OpenGraph image) and verify Lighthouse mobile-performance ≥ 80 — the LAND-03 hard gate for shipping Phase 2. This plan can only run after landing (plan-03), course preview (plan-04), and legal pages (plan-02) exist, because Lighthouse audits a real page and `sitemap.xml` references real routes.

Purpose: LAND-04 (SEO baseline per ROADMAP) requires unique titles + meta-descriptions + sitemap + robots + OG image. LAND-03 requires Lighthouse mobile-perf ≥ 80 — the only externally-verifiable performance gate in P2. The mobile-first Tailwind code that delivers the score was authored in plan-01/03/04; THIS plan measures it and tunes if needed.

Output:
- `src/app/sitemap.ts` (Next.js 14 file convention — type-safe)
- `src/app/robots.ts` (Next.js 14 file convention — preview-aware)
- `public/og-default.png` (1200×630 placeholder — checkpoint lets user replace with real brand image when ready)
- `metadata` exports on `/` + `/privacy` + `/oferta` + `generateMetadata` on `/courses/[slug]`
- `metadataBase` + default openGraph image set in root `src/app/layout.tsx`
- `.env.example` updated with `NEXT_PUBLIC_APP_URL`
- `npx lighthouse` run + checkpoint asking user to confirm score ≥ 0.8
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/2-auth-marketing-consent/PLAN.md
@.planning/phases/2-auth-marketing-consent/UI-SPEC.md
@.planning/phases/2-auth-marketing-consent/RESEARCH.md
@.planning/REQUIREMENTS.md
@src/env.ts
@src/app/layout.tsx
@src/app/(marketing)/page.tsx
@src/app/(marketing)/courses/[slug]/page.tsx
@src/app/(marketing)/privacy/page.tsx
@src/app/(marketing)/oferta/page.tsx
@.env.example
</context>

<interfaces>
From src/env.ts (P1):
```typescript
// client.NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000')
// Note: this exists from P1. RESEARCH §Pattern 5 + §sitemap example uses NEXT_PUBLIC_APP_URL.
// PLANNER DECISION: standardize on NEXT_PUBLIC_SITE_URL (it's already declared with default).
// If RESEARCH-style snippets reference NEXT_PUBLIC_APP_URL, alias to NEXT_PUBLIC_SITE_URL.
```

From src/lib/constants/course.ts (plan-03):
```typescript
export const MVP_COURSE_SLUG = 'videoedit-mvp';
```

From plan-02 + plan-03 + plan-04:
- `/privacy` and `/oferta` have `metadata` exports with `title` + `description` + `robots: { index: true, follow: false }` (plan-02 set these)
- `/` (marketing/page.tsx) currently has NO metadata export (plan-03 deferred to plan-05)
- `/courses/[slug]` has NO metadata export (plan-04 deferred to plan-05)
- Plan-02's metadata on /privacy + /oferta uses `index: true` so sitemap entries make sense

From src/app/layout.tsx (P1):
```typescript
// Already exports `metadata: Metadata` with title.default + title.template + description + icons + manifest
// Does NOT have: metadataBase (required for resolving relative OG image URLs), openGraph defaults
// Plan-05 augments: metadataBase + openGraph.images default
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: sitemap.ts + robots.ts + .env.example update</name>
  <files>src/app/sitemap.ts, src/app/robots.ts, .env.example</files>
  <action>
1. **`src/app/sitemap.ts`** — Next.js 14 file convention. Type-safe, generates `/sitemap.xml`:
```typescript
import type { MetadataRoute } from 'next';
import { MVP_COURSE_SLUG } from '@/lib/constants/course';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const now = new Date();
  return [
    { url: `${base}/`,                                 lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/courses/${MVP_COURSE_SLUG}`,       lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/privacy`,                          lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/oferta`,                           lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
```

2. **`src/app/robots.ts`** — preview-aware. Per RESEARCH §Example lines 1110-1126:
```typescript
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  // Block crawlers on Vercel preview deploys (preview URLs leak; we don't want SEO indexing)
  if (process.env.VERCEL_ENV === 'preview') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/auth/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
```

3. **`.env.example`** — verify `NEXT_PUBLIC_SITE_URL` is documented (P1 should have added it). If missing, add:
```
# Public-facing app URL (used by sitemap, robots, OG image absolute URLs, email confirmation redirect)
# Local dev: http://localhost:3000
# Production: https://your-domain.ru
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
If P1 documented this under a different name (e.g., `NEXT_PUBLIC_APP_URL`), add an aliased line OR rename in `src/env.ts` to match this plan's choice. **Recommended:** keep the existing `NEXT_PUBLIC_SITE_URL` from P1.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run build && ls src/app/sitemap.ts src/app/robots.ts && grep -q "NEXT_PUBLIC_SITE_URL" .env.example</automated>
  </verify>
  <done>sitemap.ts + robots.ts both exist; both reference NEXT_PUBLIC_SITE_URL with fallback to localhost; robots.ts respects VERCEL_ENV=preview; .env.example documents the var; npm run build succeeds (Next.js generates /sitemap.xml + /robots.txt at compile time).</done>
</task>

<task type="auto">
  <name>Task 2: Per-page metadata exports + root layout openGraph + placeholder OG image</name>
  <files>src/app/(marketing)/page.tsx, src/app/(marketing)/courses/[slug]/page.tsx, src/app/(marketing)/privacy/page.tsx, src/app/(marketing)/oferta/page.tsx, src/app/layout.tsx, public/og-default.png</files>
  <action>
1. **`src/app/layout.tsx`** — extend the existing `metadata` export via a surgical `add`-only unified diff. **DO NOT** rewrite the object wholesale and **DO NOT** touch the existing `title`, `description`, `icons`, `manifest` keys.

Current file (P1 ships this verbatim — see `src/app/layout.tsx` in context):
```typescript
export const metadata: Metadata = {
  title: {
    default: 'VideoEdit Academy — обучение монтажу видео',
    template: '%s · VideoEdit Academy',
  },
  description: 'Онлайн-платформа для обучения монтажу видео с проверкой работ куратором.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
};
```

Apply the following ADD-only diff (two new TOP-LEVEL keys, nothing else changes):

```diff
 import type { Metadata, Viewport } from 'next';
+import { env } from '@/env';

 export const metadata: Metadata = {
+  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
   title: {
     default: 'VideoEdit Academy — обучение монтажу видео',
     template: '%s · VideoEdit Academy',
   },
   description: 'Онлайн-платформа для обучения монтажу видео с проверкой работ куратором.',
+  openGraph: {
+    type: 'website',
+    locale: 'ru_RU',
+    siteName: 'VideoEdit Academy',
+    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'VideoEdit Academy' }],
+  },
   icons: {
     icon: '/favicon.ico',
     apple: '/apple-touch-icon.png',
   },
   manifest: '/manifest.json',
 };
```

Rules:
- ADD only: `metadataBase` and `openGraph` are NEW top-level keys
- DO NOT modify: `title`, `description`, `icons`, `manifest`, `viewport` export, default-export RootLayout body, `<Toaster>` mount
- Source of `NEXT_PUBLIC_SITE_URL`: `@/env` (P1 declared this with default `http://localhost:3000`); use `env.NEXT_PUBLIC_SITE_URL` rather than `process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'` so the Zod parse already validated the value at module load
- After the edit, per-page metadata exports can override `title`, `description`, `openGraph.images`; everything else inherits from this root.

2. **`src/app/(marketing)/page.tsx`** — add `metadata` export at top (do NOT change the default export):
```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VideoEdit Academy — курс по монтажу видео',
  description:
    'Авторский онлайн-курс по монтажу видео в DaVinci Resolve. Цветокоррекция, звук, графика. Доступ навсегда, оплата через ЮKassa.',
  alternates: { canonical: '/' },
};

export const revalidate = 300; // ISR — rebuild every 5 min if traffic
```

3. **`src/app/(marketing)/courses/[slug]/page.tsx`** — add `generateMetadata` (dynamic per-course):
```typescript
import type { Metadata } from 'next';
import { getCourseBySlug } from '@/server/queries/courses';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const course = await getCourseBySlug(params.slug);
  if (!course) {
    return { title: 'Курс не найден', robots: { index: false, follow: false } };
  }
  return {
    title: course.title,
    description: course.description ?? `${course.title} — авторский курс на VideoEdit Academy.`,
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: {
      title: course.title,
      description: course.description ?? undefined,
      type: 'website',
      // Course cover OR default site OG
      images: course.coverUrl ? [{ url: course.coverUrl, alt: course.title }] : undefined,
    },
  };
}
```

4. **`src/app/(marketing)/privacy/page.tsx` + `src/app/(marketing)/oferta/page.tsx`** — plan-02 set baseline metadata with `robots: { index: true, follow: false }`. Plan-05 keeps as-is (don't undo). If plan-02 set `robots: { index: false, follow: false }` instead — verify and switch to `{ index: true, follow: false }` so the pages appear in sitemap.xml and search results but don't dilute crawl budget through outbound links.

5. **`public/og-default.png`** — placeholder OG image. Create a 1200×630 PNG with the wordmark «VideoEdit Academy» centered on a dark background. Size MUST be ≤ 200KB per RESEARCH §Pitfall #30.

**Implementation choice (no design tool available):** generate programmatically via a one-off Node script using `sharp` or use a pre-existing online tool to create. **Acceptable fallback:** ship a minimal 1×1 PNG placeholder + add a TODO comment in this plan's SUMMARY pointing to the file to replace. Solo dev replaces with real brand image before launch.

For the executor: use one of these approaches in order of preference:
- **(a) ImageMagick (if installed):** `convert -size 1200x630 xc:'#0A0A0B' -font 'Helvetica-Bold' -pointsize 80 -fill white -gravity center -draw "text 0,0 'VideoEdit Academy'" public/og-default.png`
- **(b) Node + sharp (NOT installed by default — skip if no sharp):** would require `npm install -D sharp`; OVERKILL for placeholder
- **(c) Minimal placeholder (recommended for plan-05):** save a 100×52-byte solid-color PNG fetched from a public placeholder service OR commit a literally empty bytes-1x1 PNG. Plan SUMMARY documents «public/og-default.png is a placeholder — replace before launch» and marks `[TODO: brand-OG-image]`.

The OG metadata reference `{ url: '/og-default.png' }` resolves relative to `metadataBase` — at minimum the file must exist at `public/og-default.png` so the URL doesn't 404 even if the image is a placeholder.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run build && test -f public/og-default.png && grep -q "metadataBase" src/app/layout.tsx && grep -q "generateMetadata" src/app/\(marketing\)/courses/\[slug\]/page.tsx && grep -q "export const metadata" src/app/\(marketing\)/page.tsx</automated>
  </verify>
  <done>Root layout has metadataBase + openGraph default; /, /privacy, /oferta have unique metadata exports; /courses/[slug] has generateMetadata; public/og-default.png exists (placeholder OK); npm run build succeeds.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
SEO baseline shipped. About to verify the LAND-03 hard gate: Lighthouse mobile-performance score ≥ 80 for the landing page.

Pre-checkpoint, the executor should run:
```bash
# Start prod build (Lighthouse should audit prod build, not dev — dev has React DevTools overhead)
npm run build && npm run start &
SERVER_PID=$!
sleep 5

# Run Lighthouse mobile-perf audit
npx lighthouse http://localhost:3000 \
  --quiet --chrome-flags="--headless" \
  --only-categories=performance \
  --form-factor=mobile \
  --output=json --output=html \
  --output-path=./lighthouse-landing

kill $SERVER_PID

# Extract score
node -e "const r = require('./lighthouse-landing.report.json'); console.log('Mobile Performance:', Math.round(r.categories.performance.score * 100));"
```

Optionally run on /courses/videoedit-mvp too:
```bash
npx lighthouse http://localhost:3000/courses/videoedit-mvp ... --output-path=./lighthouse-course
```

Reports saved to ./lighthouse-landing.report.{json,html} and (optionally) lighthouse-course.report.{json,html}. Solo dev opens the HTML report in browser to review.
  </what-built>
  <how-to-verify>
1. The executor ran Lighthouse and reports a score. Read the score from the output above.
2. If score ≥ 80 on the landing page: type «approved» — LAND-03 satisfied, plan-05 closes.
3. If score < 80: examine the Lighthouse HTML report. Common low-score reasons in P2:
   - Large unoptimized image (we have no real OG image — placeholder is fine; the AUDIT page is `/` which has no images at all)
   - Render-blocking CSS (shouldn't apply — Tailwind is tree-shaken at build)
   - Slow LCP from Inter font weight loading (mitigation: `next/font` does font-display=swap by default)
   - Heavy First Load JS (shadcn primitives are tree-shaken; framer-motion isn't imported by landing)
4. If tuning needed: open an issue listing the specific opportunities ranked by Lighthouse, schedule for a follow-up PR. Do NOT block plan-05 close if score is 75-79 — open follow-up to push past 80 and mark plan-05 SUMMARY with the deficit.

Type «approved» to close plan-05 (success criteria met OR documented sub-80 with follow-up), or describe blockers.
  </how-to-verify>
  <resume-signal>Type "approved" (with score noted) or describe Lighthouse blockers</resume-signal>
</task>

</tasks>

<verification>
After all 3 tasks (last one is the checkpoint):
1. `npm run lint && npm run typecheck && npm run build` — must pass
2. `npm run start`, then `curl http://localhost:3000/sitemap.xml` — returns valid XML listing 4 URLs
3. `curl http://localhost:3000/robots.txt` — returns the policy with sitemap line
4. Open http://localhost:3000 in browser, View Source — `<meta property="og:image" content=".../og-default.png">` present, `<title>` is page-specific
5. Open https://www.opengraph.xyz/url/http%3A%2F%2Flocalhost%3A3000 — OG preview renders (or run a curl against `http://localhost:3000` with `Accept: text/html` and grep for og:image)
6. Lighthouse mobile-perf ≥ 80 verified by checkpoint
</verification>

<success_criteria>
- LAND-03 satisfied: Lighthouse mobile Performance score ≥ 0.80 for / (checkpoint records the actual number)
- LAND-04 satisfied: sitemap.xml lists 4 URLs, robots.txt is preview-aware + disallows /api/ + /dashboard + /auth/ in prod, every marketing page has unique title + description, OG image set with default fallback
- `metadataBase` set so OG image URLs resolve to absolute URLs in social-share previews
- `.env.example` documents `NEXT_PUBLIC_SITE_URL` for solo dev's reference
</success_criteria>

<out_of_scope>
- Dynamic OG image generation (`@vercel/og` or `next/og`) — UI-SPEC §10.1 defers to M2 (we ship one static image)
- Per-course unique OG images — only fall back to course cover or default
- Open Graph Twitter Card — defer (not in REQUIREMENTS — only `openGraph` baseline)
- Structured data (JSON-LD for courses) — M2 SEO enhancement
- Yandex Webmaster / Google Search Console verification meta tags — P7 launch prep
- Performance tuning beyond Lighthouse ≥ 80 — if score is 80-85, ship; chase higher only if obvious win
- Locale variants (`hreflang`) — single-locale ru-RU per PROJECT.md
</out_of_scope>

<references>
- UI-SPEC.md §10.1 (OG image deferred to static), §10.9 (SEO meta per page), §10.10 (perf budget)
- RESEARCH.md §Example §SEO via Metadata API + sitemap.ts + robots.ts (lines 1058-1126)
- RESEARCH.md §Pitfall #30 (large landing images — ≤200KB OG)
- REQUIREMENTS.md LAND-03, LAND-04
- Next.js docs: sitemap.ts + robots.ts file conventions (canonical in Next 14)
</references>

<output>
Create `.planning/phases/2-auth-marketing-consent/plans/2-05-SUMMARY.md` when done documenting:
- sitemap.ts + robots.ts file conventions added
- metadata exports on / + /privacy + /oferta; generateMetadata on /courses/[slug]
- Root layout metadataBase + openGraph defaults
- public/og-default.png placeholder shipped (size + method)
- Lighthouse mobile-perf score (actual number from checkpoint)
- Deferred to M2: dynamic OG, per-course OG images, JSON-LD structured data
- Deferred to P7: search-console verification meta tags
</output>
