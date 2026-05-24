---
plan: 04-course-preview
phase: 2
wave: 2
type: execute
maps_to: [LAND-02]
depends_on: [01-shadcn-and-design-system]
autonomous: true
mode: mvp
estimated_tasks: 3
files_modified:
  - src/server/queries/courses.ts
  - src/components/marketing/CoursePreviewCard.tsx
  - src/app/(marketing)/courses/[slug]/page.tsx
  - src/app/(marketing)/courses/[slug]/loading.tsx
  - src/app/(marketing)/courses/[slug]/not-found.tsx
  - src/app/(marketing)/courses/[slug]/error.tsx
  - src/types/database.ts
  - supabase/seed.sql
  - tests/e2e/landing.spec.ts
requirements: [LAND-02]
must_haves:
  truths:
    - "GET /courses/videoedit-mvp returns 200 with course title, cover, duration, price, modules tree, CTA «Купить»"
    - "GET /courses/does-not-exist returns 404 via not-found.tsx with link back to /"
    - "Anonymous user clicking «Купить» is sent to /register?next=/courses/videoedit-mvp"
    - "loading.tsx shows skeleton while server query resolves"
    - "Lessons listed without per-lesson access links (no access until purchase — P3+) and without seconds-watched counters"
    - "At least one lesson title is visible on /courses/videoedit-mvp under anon RLS (Playwright assertion in Task 3)"
    - "Seed contains exactly one course with slug=videoedit-mvp, published=true, 2 modules, ~6 lessons all is_preview=true AND published=true"
    - "src/types/database.ts has hand-patched Row/Insert/Update for courses + modules + lessons (commented TODO regenerate via npm run db:types when Docker is available)"
  artifacts:
    - path: src/server/queries/courses.ts
      provides: "getCourseBySlug(slug) — fetches course + modules + lessons via single nested select; returns null if not found"
    - path: src/app/(marketing)/courses/[slug]/page.tsx
      provides: "GET /courses/[slug] route; calls notFound() if course missing; renders CoursePreviewCard"
    - path: src/components/marketing/CoursePreviewCard.tsx
      provides: "Card layout: cover image (next/image) + metadata + CTA"
    - path: src/types/database.ts
      provides: "Hand-patched courses + modules + lessons Row/Insert/Update interfaces (Docker-absent fallback, TODO regen)"
    - path: supabase/seed.sql
      provides: "Updated seed with one published MVP course matching MVP_COURSE_SLUG constant + 2 modules + 6 lessons all preview-visible"
  key_links:
    - from: src/app/(marketing)/courses/[slug]/page.tsx
      to: src/server/queries/courses.ts
      via: import getCourseBySlug
      pattern: "getCourseBySlug"
    - from: src/server/queries/courses.ts
      to: supabase.courses
      via: select with nested modules + lessons
      pattern: "modules.*lessons"
    - from: src/components/marketing/CoursePreviewCard.tsx
      to: /register?next=/courses/[slug]
      via: Next.js Link (CTA for anonymous)
      pattern: "register\\?next=/courses"
---

<objective>
Second demo-ready milestone: the course preview page that closes the loop from the landing's «Подробнее о курсе» CTA. After this plan, anonymous users can browse the funnel end-to-end (landing → course detail → /register).

Purpose: LAND-02 + UI-SPEC §4.2. Renders the seeded MVP course with title, cover, duration, price (server-side `formatPrice`), modules tree (without lesson access), and CTA «Купить». Uses the EXISTING `courses`/`modules`/`lessons` schema from P1 base migration (verbatim) — no schema changes in P2. Lesson visibility under anon depends on the P1 RLS policy `is_preview = true AND published = true`, so the seed sets BOTH flags on every preview lesson.

Output:
- `getCourseBySlug` server query (single nested select, no N+1)
- `CoursePreviewCard` component
- 4 route files: page, loading, not-found, error
- `src/types/database.ts` hand-patched with `courses` + `modules` + `lessons` table types (P1 already shipped `audit_log`; this plan adds the base catalog tables using the same pattern + TODO comment)
- `supabase/seed.sql` updated with one published MVP course + 2 modules + 6 preview-visible lessons
- E2E adds visible-lesson assertion to verify the RLS preview path
- Reuse existing P1 base tables (`courses`, `modules`, `lessons`) — DO NOT add commerce columns (that's P3 CRSE-01)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/2-auth-marketing-consent/PLAN.md
@.planning/phases/2-auth-marketing-consent/UI-SPEC.md
@.planning/REQUIREMENTS.md
@.claude/skills/ui-conventions/SKILL.md
@.claude/skills/database/SKILL.md
@.claude/skills/api-conventions/SKILL.md
@src/lib/utils.ts
@src/types/database.ts
@supabase/seed.sql
@supabase/migrations/20260522000001_init_base_tables.sql
</context>

<interfaces>
From P1 base migration `supabase/migrations/20260522000001_init_base_tables.sql` — **REAL columns, source of truth**:
```sql
-- courses: id uuid, slug text UNIQUE, title text, description text, cover_url text,
--          order_index int, published boolean DEFAULT false, created_at, updated_at
-- modules: id uuid, course_id uuid FK ON DELETE CASCADE, title text, description text,
--          order_index int, created_at
-- lessons: id uuid, module_id uuid FK ON DELETE CASCADE, title text, description text,
--          video_id text (NOT video_url),
--          duration_sec integer DEFAULT 0 (NOT duration_minutes),
--          order_index int, is_preview boolean DEFAULT false (NOT is_free),
--          published boolean DEFAULT false, created_at, updated_at
--
-- RLS on courses:  SELECT WHERE published = true (anon allowed)
-- RLS on modules:  SELECT WHERE EXISTS (course where published = true)
-- RLS on lessons:  SELECT WHERE is_preview = true AND published = true  ← CRITICAL
--                  (full-content access policy via purchases joined in P3)
-- The column name is `published` (boolean), NOT `is_published`. CRSE-01 in Phase 3 will
-- RENAME to is_published + add price_minor + currency + kinescope_video_id.
-- P2 uses `published`/`is_preview`/`duration_sec`/`video_id` as-is.
```

From P1 base migration seed pattern (`supabase/seed.sql` currently has demo data per VERIFICATION):
```sql
-- Existing seed inserts demo courses with slugs like 'demo-davinci'.
-- This plan UPDATES seed to ensure one row has slug = 'videoedit-mvp' AND published = true.
```

From src/lib/constants/course.ts (created in plan-03):
```typescript
export const MVP_COURSE_SLUG = 'videoedit-mvp';
export const MVP_COURSE_PRICE_MINOR = 1_990_000; // 19 900 ₽
```

From src/lib/utils.ts (P1):
```typescript
export function formatPrice(value: number): string;  // ru-RU → "19 900 ₽"
```

From src/lib/supabase/server.ts (P1):
```typescript
export function createServerSupabase(): SupabaseClient;
```

From src/types/database.ts (current P1 state — only `audit_log` is hand-patched per the comment at top of the file). Plan-04 EXTENDS the same hand-patch pattern by adding three more tables. Pattern reference: the `audit_log` block in `src/types/database.ts` lines 22-59.

From src/components/ui/* (plan-01):
```typescript
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
```

From next/image (already configured for `*.supabase.co` + `*.kinescope.io` per next.config.js).
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Hand-patch database types + getCourseBySlug server query + seed update (real P1 columns)</name>
  <files>src/types/database.ts, src/server/queries/courses.ts, supabase/seed.sql</files>
  <action>
1. **Hand-patch `src/types/database.ts`** — extend `Database['public']['Tables']` with `courses`, `modules`, `lessons` mirroring `supabase/migrations/20260522000001_init_base_tables.sql` columns verbatim. Pattern: same structure as the existing P1 `audit_log` entry (Row + Insert + Update + Relationships). Add **at the top of the file** a TODO comment block (immediately after the existing `Plan-04 (FOUND-05) NOTE`):

```typescript
/**
 * Plan-04 (P2 LAND-02) NOTE: courses + modules + lessons types are hand-patched
 * here following the same Docker-absent fallback pattern as the P1 audit_log
 * entry. Source-of-truth: supabase/migrations/20260522000001_init_base_tables.sql.
 * As soon as a developer with Docker runs `npm run db:reset && npm run db:types`,
 * this file regenerates from the live DB schema and supersedes the hand-written
 * placeholders; the regen should be a no-op diff (column names + nullability
 * already match the migration verbatim).
 *
 * TODO: regenerate via `npm run db:types` (alias for `supabase gen types ...`)
 *       when Docker is available locally.
 */
```

Then add inside `Database.public.Tables` (alongside the existing `audit_log`):

```typescript
courses: {
  Row: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    cover_url: string | null;
    order_index: number;
    published: boolean;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    slug: string;
    title: string;
    description?: string | null;
    cover_url?: string | null;
    order_index?: number;
    published?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    slug?: string;
    title?: string;
    description?: string | null;
    cover_url?: string | null;
    order_index?: number;
    published?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};
modules: {
  Row: {
    id: string;
    course_id: string;
    title: string;
    description: string | null;
    order_index: number;
    created_at: string;
  };
  Insert: {
    id?: string;
    course_id: string;
    title: string;
    description?: string | null;
    order_index?: number;
    created_at?: string;
  };
  Update: {
    id?: string;
    course_id?: string;
    title?: string;
    description?: string | null;
    order_index?: number;
    created_at?: string;
  };
  Relationships: [];
};
lessons: {
  Row: {
    id: string;
    module_id: string;
    title: string;
    description: string | null;
    video_id: string | null;
    duration_sec: number;
    order_index: number;
    is_preview: boolean;
    published: boolean;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    module_id: string;
    title: string;
    description?: string | null;
    video_id?: string | null;
    duration_sec?: number;
    order_index?: number;
    is_preview?: boolean;
    published?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    module_id?: string;
    title?: string;
    description?: string | null;
    video_id?: string | null;
    duration_sec?: number;
    order_index?: number;
    is_preview?: boolean;
    published?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};
```

2. **`src/server/queries/courses.ts`** (Server Query — runs in Server Components):
```typescript
import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type CourseRow = Database['public']['Tables']['courses']['Row'];
type ModuleRow = Database['public']['Tables']['modules']['Row'];
type LessonRow = Database['public']['Tables']['lessons']['Row'];

export interface CoursePreview {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    order_index: number;
    lessons: Array<{
      id: string;
      title: string;
      order_index: number;
      durationSeconds: number | null;
      isPreview: boolean;
    }>;
  }>;
  totalLessons: number;
  totalDurationSeconds: number;
}

/**
 * Public preview — anyone (anon or authed) can call.
 * Filters to `published = true` on courses (matches RLS policy).
 * Lessons returned are gated by P1 RLS: `is_preview = true AND published = true`.
 * Returns null if slug not found / course not published.
 *
 * Single query with nested select — no N+1 (database/SKILL.md §Запросы).
 */
export async function getCourseBySlug(slug: string): Promise<CoursePreview | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('courses')
    .select(`
      id, slug, title, description, cover_url, published,
      modules (
        id, title, description, order_index,
        lessons (
          id, title, order_index, duration_sec, is_preview
        )
      )
    `)
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (error || !data) return null;

  // Sort modules + lessons by order_index (Supabase nested selects do not guarantee order)
  const modules = (data.modules ?? [])
    .map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      order_index: m.order_index,
      lessons: (m.lessons ?? [])
        .map((l) => ({
          id: l.id,
          title: l.title,
          order_index: l.order_index,
          durationSeconds: l.duration_sec,
          isPreview: l.is_preview,
        }))
        .sort((a, b) => a.order_index - b.order_index),
    }))
    .sort((a, b) => a.order_index - b.order_index);

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalDurationSeconds = modules.reduce(
    (sum, m) => sum + m.lessons.reduce((s, l) => s + (l.durationSeconds ?? 0), 0),
    0
  );

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    description: data.description,
    coverUrl: data.cover_url,
    modules,
    totalLessons,
    totalDurationSeconds,
  };
}
```

3. **Update `supabase/seed.sql`** — ensure ONE course row has `slug = 'videoedit-mvp'` AND `published = true`, with 2 modules and 6 lessons. **CRITICAL:** every seeded lesson sets BOTH `is_preview = true` AND `published = true` so anon-RLS makes the titles visible on the preview page (otherwise the lesson list renders empty and the E2E «at least one lesson title visible» assertion in Task 3 will fail). Convert previous minute durations × 60 → seconds.
   - Read the current seed.sql first to understand existing structure
   - Either:
     - (a) ADD a new course row with `slug = 'videoedit-mvp'` if no existing row matches, OR
     - (b) RENAME an existing demo course's slug to `'videoedit-mvp'` + set `published=true`
   - **Recommended (a):** add a new INSERT block at the top of seed.sql:
```sql
-- MVP-фаза один курс (plan-04). Slug совпадает с src/lib/constants/course.ts MVP_COURSE_SLUG.
-- Цена для MVP — статичная в коде (PricingBlock); commerce-колонки (price_minor) добавит CRSE-01 в P3.
INSERT INTO courses (id, slug, title, description, cover_url, published, order_index)
VALUES (
  '11111111-1111-4111-8111-000000000001',
  'videoedit-mvp',
  'Монтаж видео в DaVinci Resolve',
  'Авторский курс по монтажу видео. От первого реза до финального экспорта.',
  NULL,  -- обложка опциональна, рендерится placeholder gradient в CoursePreviewCard
  TRUE,
  0
)
ON CONFLICT (slug) DO UPDATE SET
  published = EXCLUDED.published,
  title = EXCLUDED.title,
  description = EXCLUDED.description;

-- 2 модуля
INSERT INTO modules (id, course_id, title, description, order_index) VALUES
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 'Модуль 1 — Введение в DaVinci Resolve', 'Установка, интерфейс, импорт материалов, первый монтаж.', 0),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000001', 'Модуль 2 — Базовый монтаж', 'Резка, склейка, транзишены, синхронизация.', 1)
ON CONFLICT (id) DO NOTHING;

-- 6 уроков (3 на модуль). is_preview + published = TRUE так анон-RLS видит названия (для MVP single-course preview).
-- video_id = NULL пока (P5 заполнит Kinescope ID). duration_sec = старые минуты × 60.
INSERT INTO lessons (id, module_id, title, video_id, duration_sec, order_index, is_preview, published) VALUES
  ('33333333-3333-4333-8333-000000000001', '22222222-2222-4222-8222-000000000001', 'Установка и интерфейс',   NULL, 1080, 0, TRUE, TRUE),
  ('33333333-3333-4333-8333-000000000002', '22222222-2222-4222-8222-000000000001', 'Импорт материалов',       NULL, 1320, 1, TRUE, TRUE),
  ('33333333-3333-4333-8333-000000000003', '22222222-2222-4222-8222-000000000001', 'Первый монтаж',           NULL, 2100, 2, TRUE, TRUE),
  ('33333333-3333-4333-8333-000000000004', '22222222-2222-4222-8222-000000000002', 'Резка и склейка',         NULL, 1680, 0, TRUE, TRUE),
  ('33333333-3333-4333-8333-000000000005', '22222222-2222-4222-8222-000000000002', 'Транзишены',              NULL, 1440, 1, TRUE, TRUE),
  ('33333333-3333-4333-8333-000000000006', '22222222-2222-4222-8222-000000000002', 'Синхронизация со звуком', NULL, 1860, 2, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;
```
   - **If pre-existing seed.sql conflicts with these IDs**, alter the IDs to non-conflicting UUIDs (the exact UUID values don't matter as long as referential integrity holds within the file)

4. **Apply seed to local Supabase (if Docker available):**
```bash
npm run db:reset  # WARNING: drops all local data; safe in dev
```
This re-runs migrations + seed.sql. If Docker absent, skip and document per P1 pattern.

5. Verify seed correctness via psql or `supabase db dump` (if local Supabase running). At minimum: `grep -c "videoedit-mvp" supabase/seed.sql` returns ≥ 1, and `grep -c "is_preview, published" supabase/seed.sql` returns ≥ 1 (the new INSERT block uses this column tuple).
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && grep -q "getCourseBySlug" src/server/queries/courses.ts && grep -q "videoedit-mvp" supabase/seed.sql && grep -q "modules.*lessons" src/server/queries/courses.ts && head -1 src/server/queries/courses.ts | grep -q "server-only" && grep -q "duration_sec" src/server/queries/courses.ts && grep -q "is_preview, published" supabase/seed.sql && grep -q "lessons:" src/types/database.ts && grep -q "modules:" src/types/database.ts && grep -q "courses:" src/types/database.ts</automated>
  </verify>
  <done>src/types/database.ts hand-patched with courses + modules + lessons Row/Insert/Update (TODO regen comment present); src/server/queries/courses.ts exists with getCourseBySlug (single nested select, server-only) using real P1 columns (duration_sec, video_id, is_preview, published); supabase/seed.sql contains one course row with slug='videoedit-mvp' + 2 modules + 6 lessons all is_preview=TRUE AND published=TRUE; if Docker available, `npm run db:reset` re-applies cleanly; `npm run typecheck` clean (now that types are hand-patched).</done>
</task>

<task type="auto">
  <name>Task 2: CoursePreviewCard component + 4 route files (page + loading + not-found + error)</name>
  <files>src/components/marketing/CoursePreviewCard.tsx, src/app/(marketing)/courses/[slug]/page.tsx, src/app/(marketing)/courses/[slug]/loading.tsx, src/app/(marketing)/courses/[slug]/not-found.tsx, src/app/(marketing)/courses/[slug]/error.tsx</files>
  <action>
1. **`src/components/marketing/CoursePreviewCard.tsx`** — Server Component. Per UI-SPEC §4.2 ASCII layout (desktop 2-col, mobile stacked). The consumer converts seconds to minutes/hours for display via `Math.round(totalSec / 60)` and `Math.round(totalSec / 3600)`:

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { Clock, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatPrice } from '@/lib/utils';
import { MVP_COURSE_PRICE_MINOR } from '@/lib/constants/course';
import type { CoursePreview } from '@/server/queries/courses';

interface CoursePreviewCardProps {
  course: CoursePreview;
}

export function CoursePreviewCard({ course }: CoursePreviewCardProps) {
  const totalMinutes = Math.round(course.totalDurationSeconds / 60);
  const hours = Math.round(course.totalDurationSeconds / 3600);

  return (
    <article className="container mx-auto py-8 md:py-12">
      <div className="grid gap-8 md:grid-cols-12">
        {/* Cover (md+ 5 cols, mobile full) */}
        <div className="md:col-span-5">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-secondary">
            {course.coverUrl ? (
              <Image
                src={course.coverUrl}
                alt={course.title}
                fill
                className="object-cover"
                sizes="(min-width: 768px) 40vw, 100vw"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-secondary to-secondary/50">
                <BookOpen className="size-12 text-muted-foreground" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>

        {/* Meta + CTA (md+ 7 cols) */}
        <div className="md:col-span-7">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{course.title}</h1>
          {course.description && (
            <p className="mt-4 text-muted-foreground">{course.description}</p>
          )}

          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>
                {course.totalLessons} уроков · ≈ {hours} {hours === 1 ? 'час' : 'часов'}
                <span className="text-muted-foreground"> ({totalMinutes} мин)</span>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>
                {course.modules.length} {course.modules.length === 1 ? 'модуль' : 'модулей'}
              </span>
            </li>
          </ul>

          <div className="mt-8">
            <div className="text-3xl font-semibold">{formatPrice(MVP_COURSE_PRICE_MINOR / 100)}</div>
            <Button asChild className="mt-4 w-full md:w-auto" size="lg">
              <Link href={`/register?next=/courses/${course.slug}`}>Купить</Link>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Анонимные пользователи — на регистрацию; залогиненные перейдут к оплате (Phase 3).
            </p>
          </div>
        </div>
      </div>

      {/* Programme tree */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">Программа курса</h2>
        <div className="mt-6 space-y-6">
          {course.modules.map((m) => (
            <div key={m.id} className="rounded-lg border bg-card p-4 md:p-6">
              <h3 className="text-lg font-semibold">{m.title}</h3>
              {m.description && (
                <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
              )}
              <ul className="mt-4 space-y-1.5 text-sm">
                {m.lessons.map((l, i) => (
                  <li key={l.id} className="flex items-start gap-2">
                    <span className="text-muted-foreground tabular-nums">{(i + 1).toString().padStart(2, '0')}.</span>
                    <span>{l.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
```

Notes:
- Lessons render as plain text, no link (per UI-SPEC §4.2 — «уроки без часов, без access. Только список»). Per-lesson minutes hidden in preview (avoid leaking pacing detail; revealed only after purchase).
- CTA always points to `/register?next=...` — universal anon path. For authenticated users in P2, plan-08's middleware/auth-gate will route them appropriately (registering when already-authed redirects to dashboard or back to `next` per Supabase flow). Phase 3 will replace the `<Link>` with a Server Action `<form>`.
- Lesson visibility under anon is gated by P1 RLS `is_preview = true AND published = true` on `lessons` — Task 1's seed ensures both flags are TRUE for all 6 lessons in the MVP course.

2. **`src/app/(marketing)/courses/[slug]/page.tsx`** — route file. Server Component. Uses `notFound()` from `next/navigation` for missing slug.
```tsx
import { notFound } from 'next/navigation';
import { getCourseBySlug } from '@/server/queries/courses';
import { CoursePreviewCard } from '@/components/marketing/CoursePreviewCard';

interface PageProps {
  params: { slug: string };
}

export default async function CoursePreviewPage({ params }: PageProps) {
  const course = await getCourseBySlug(params.slug);
  if (!course) notFound();
  return <CoursePreviewCard course={course} />;
}
```
Per UI-SPEC §4.2, metadata is set in plan-05 via `generateMetadata` — not in P2 plan-04.

3. **`src/app/(marketing)/courses/[slug]/loading.tsx`** — Server Component skeleton per UI-SPEC §4.2 loading state:
```tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function CoursePreviewLoading() {
  return (
    <div className="container mx-auto py-8 md:py-12">
      <div className="grid gap-8 md:grid-cols-12">
        <Skeleton className="aspect-video w-full md:col-span-5" />
        <div className="space-y-3 md:col-span-7">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="mt-6 h-4 w-1/2" />
          <Skeleton className="mt-6 h-9 w-32" />
        </div>
      </div>
    </div>
  );
}
```

4. **`src/app/(marketing)/courses/[slug]/not-found.tsx`** — 404 surface per UI-SPEC §4.2:
```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CourseNotFound() {
  return (
    <div className="container mx-auto flex flex-col items-center py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Курс не найден</h1>
      <p className="mt-4 text-muted-foreground">Возможно, ссылка устарела или курс снят с публикации.</p>
      <Button asChild className="mt-6">
        <Link href="/">На главную</Link>
      </Button>
    </div>
  );
}
```

5. **`src/app/(marketing)/courses/[slug]/error.tsx`** — Client Component (Next.js requires `'use client'` in error.tsx):
```tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CourseError({ error, reset }: ErrorProps) {
  return (
    <div className="container mx-auto flex flex-col items-center py-24 text-center">
      <h2 className="text-2xl font-semibold">Не удалось загрузить курс</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Попробовать снова</Button>
        <Button asChild variant="outline">
          <Link href="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}
```
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run build && ls src/app/\(marketing\)/courses/\[slug\]/page.tsx src/app/\(marketing\)/courses/\[slug\]/loading.tsx src/app/\(marketing\)/courses/\[slug\]/not-found.tsx src/app/\(marketing\)/courses/\[slug\]/error.tsx</automated>
  </verify>
  <done>CoursePreviewCard SC + 4 route files (page, loading, not-found, error); page calls notFound() for missing slug; CTA renders link to /register?next=/courses/[slug]; consumer converts duration_sec → minutes/hours for display; `npm run build` succeeds (Next.js validates dynamic route + error boundary).</done>
</task>

<task type="auto">
  <name>Task 3: Extend landing E2E to verify course preview path + visible lesson title under RLS</name>
  <files>tests/e2e/landing.spec.ts</files>
  <action>
Append to `tests/e2e/landing.spec.ts` (created by plan-03) tests covering the full preview path AND the RLS visibility assertion required by must_have "At least one lesson title is visible on /courses/videoedit-mvp under anon RLS":

```typescript
test('clicking «Подробнее о курсе» from landing reaches a populated course preview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /подробнее о курсе/i }).click();
  await page.waitForURL(/\/courses\/videoedit-mvp/);
  // Course heading visible
  await expect(page.getByRole('heading', { level: 1, name: /монтаж видео.*davinci/i })).toBeVisible();
  // Programme heading visible
  await expect(page.getByRole('heading', { level: 2, name: /программа курса/i })).toBeVisible();
  // At least 2 module headings (`<h3>`)
  await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
  // CTA «Купить» on this page too
  const cta = page.getByRole('link', { name: /^купить$/i });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href', /\/register\?next=\/courses\/videoedit-mvp/);
});

test('GET /courses/videoedit-mvp shows at least one lesson title (anon RLS preview path)', async ({ page }) => {
  // Anon-RLS on lessons: WHERE is_preview = true AND published = true. The seed
  // sets BOTH flags TRUE on every lesson in the MVP course; this test guards
  // against accidental seed/RLS regression by asserting one canonical lesson
  // title is rendered. Pick a stable string from the seed in Task 1.
  await page.goto('/courses/videoedit-mvp');
  await expect(page.getByText(/установка и интерфейс/i)).toBeVisible();
});

test('GET /courses/does-not-exist returns 404 not-found page', async ({ page }) => {
  const response = await page.goto('/courses/does-not-exist');
  // Next.js returns 404 status from notFound()
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /курс не найден/i })).toBeVisible();
});
```

Manual fallback (when Playwright + Supabase aren't co-running): document in SUMMARY that an integration smoke is acceptable in lieu: `curl -s http://localhost:3000/courses/videoedit-mvp | grep -q "Установка и интерфейс"`. Both checks PROVE that anon-RLS allows the seed lessons through.

If integration test env is not provisioned, the first two tests fail because `getCourseBySlug` returns null — that's an acceptable deferral matching the P1 Docker-absent pattern.
  </action>
  <verify>
    <automated>npm run lint && grep -c "подробнее о курсе\|программа курса\|курс не найден\|установка и интерфейс" tests/e2e/landing.spec.ts | grep -v ':0$'</automated>
  </verify>
  <done>tests/e2e/landing.spec.ts extended with 3 new test cases (course preview reached from landing + lesson-title-visible-under-RLS + 404 path); lint clean.</done>
</task>

</tasks>

<verification>
After all 3 tasks:
1. `npm run lint && npm run typecheck && npm run build` — must pass (typecheck only goes green after Task 1 hand-patches database types)
2. If Docker + local Supabase available:
   - `npm run db:reset` to apply seed
   - `npm run dev`, open http://localhost:3000/courses/videoedit-mvp — should render course title, 2 modules, 6 lessons (titles visible), price 19 900 ₽, CTA «Купить»
   - `npm run test:e2e -- tests/e2e/landing.spec.ts` — all 7 cases pass (4 from plan-03 + 3 new)
3. Open http://localhost:3000/courses/foobar — should show «Курс не найден»
4. Click «Подробнее о курсе» on landing → lands on /courses/videoedit-mvp populated page
5. View source of /courses/videoedit-mvp → string «Установка и интерфейс» present (proves anon-RLS allowed the lesson)
</verification>

<success_criteria>
- LAND-02 satisfied: `/courses/[slug]` renders the seeded MVP course with cover (or gradient placeholder), title H1, duration metric, modules tree, lesson titles visible (anon RLS preview path), price, CTA «Купить»
- `getCourseBySlug` is a single nested query (no N+1) per database/SKILL.md
- Anonymous user click path works: landing → course preview → register
- Missing slug → proper Next.js 404 page (notFound()) with link back
- Loading + error states render without crashing
- `src/types/database.ts` typecheck-clean; TODO comment marks regen path for future Docker-available dev
- Seed sets `is_preview = true AND published = true` on every MVP lesson, enabling anon RLS preview
</success_criteria>

<out_of_scope>
- CRSE-01..05 (commerce-friendly schema: price_minor, currency, kinescope_video_id; rename `published` → `is_published` on lessons) — Phase 3
- Authenticated buy flow (Server Action `createCoursePayment`) — Phase 3
- Email-verification gating on the CTA — plan-10 ships the banner; the CTA is universal-anon-path in P2 by design
- Multiple courses / filtering — Phase M2
- Markdown/MDX in `course.description` — P3+ if rich text needed; for P2 plain text is fine
- `generateMetadata` per-course SEO — plan-05
- Lesson access detection (`isAccessible` flag on each lesson) — Phase 3+
- Auto-regenerate of `src/types/database.ts` from live DB — happens any time a dev with Docker runs `npm run db:types` (TODO comment in the file marks this)
</out_of_scope>

<references>
- UI-SPEC.md §4.2 (full course preview spec with ASCII + states + access modes)
- REQUIREMENTS.md LAND-02
- RESEARCH.md §Architectural Responsibility Map (Course preview rendering = RSC + Database)
- database/SKILL.md §Запросы (no N+1, named queries in src/server/queries/)
- api-conventions/SKILL.md §Server Queries
- supabase/migrations/20260522000001_init_base_tables.sql (existing courses/modules/lessons schema — DO NOT alter; lessons RLS = `is_preview = true AND published = true`)
- src/types/database.ts (P1 hand-patch pattern reference — extend, don't replace)
</references>

<output>
Create `.planning/phases/2-auth-marketing-consent/plans/2-04-SUMMARY.md` when done documenting:
- src/types/database.ts hand-patched: courses + modules + lessons Row/Insert/Update added (TODO regen comment)
- getCourseBySlug Server Query (single nested select, server-only) using real P1 columns
- CoursePreviewCard SC + 4 route files (page, loading, not-found, error)
- supabase/seed.sql updated: MVP course (slug=videoedit-mvp), 2 modules, 6 lessons all is_preview=TRUE AND published=TRUE
- E2E coverage of preview path + RLS lesson-visibility + 404
- Deferred to P3: commerce columns (price_minor), authed buy flow, lesson access flags
- Deferred to plan-05: generateMetadata for /courses/[slug] SEO
</output>
