# Architecture Research

**Domain:** Paid online courses (LMS) — RU/CIS market, single-course MVP
**Project:** VideoEdit Academy (M1 — `.planning/PROJECT.md`)
**Researched:** 2026-05-24
**Confidence:** HIGH (built on existing scaffold conventions documented in `.planning/codebase/ARCHITECTURE.md` and `.claude/skills/`)

---

## 0. Scope of This Document

Concrete architecture for **M1 — vertical MVP** (4-6 weeks solo). The user flow that must work end-to-end:

```
landing → register/login → browse course → buy (ЮKassa) → watch lessons (Kinescope private) → see progress in mini-dashboard
```

Everything in this document maps to that one path. The existing scaffold (`src/lib/supabase/*`, `src/lib/auth/require.ts`, root migration `supabase/migrations/20260522000001_init_base_tables.sql`, route group placeholders) is treated as **immutable foundation** — this document only extends it.

Out-of-scope (M2+): admin CMS, Unisender mailings, certificates, OAuth, promo codes, multi-course catalog. Architecture must leave seams for these without building them.

---

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                BROWSER                                    │
│   React 18 Server + Client Components · Tailwind/shadcn · sonner          │
│   ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐ │
│   │ (marketing) public │  │ (app) protected    │  │ Kinescope <iframe> │ │
│   │ landing / course   │  │ dashboard / lesson │  │ private + sandbox  │ │
│   └────────────────────┘  └────────────────────┘  └────────────────────┘ │
└─────────────────┬────────────────────────────────────────────────────────┘
                  │ HTTPS · httpOnly sb-* cookies
                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       Next.js 14 App Router (Node)                        │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ Edge middleware  src/middleware.ts → updateSession()                  │ │
│ │ rotates Supabase cookies before every page/action resolves            │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────────┐│
│ │ Route Groups        │  │ Server Actions      │  │ Route Handlers     ││
│ │ src/app/(...)       │  │ src/server/actions/ │  │ src/app/api/...    ││
│ │ pages + layouts     │  │ 'use server'        │  │ webhooks + OAuth   ││
│ │ auth gates in       │  │ Zod → requireUser   │  │ HMAC verify        ││
│ │ layout.tsx          │  │ → supabase write    │  │ idempotency check  ││
│ └──────────┬──────────┘  └──────────┬──────────┘  └─────────┬──────────┘│
│            ▼                        ▼                        ▼           │
│ ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐│
│ │ Server Queries       │  │ Auth helpers          │  │ External wrappers││
│ │ src/server/queries/  │  │ src/lib/auth/         │  │ src/lib/{yookassa│
│ │ typed reads (RLS)    │  │ requireUser/Role      │  │ ,kinescope}/     ││
│ └──────────┬───────────┘  └──────────┬───────────┘  └────────┬─────────┘│
│            │                         │                        │          │
│ ┌──────────▼─────────────────────────▼────────────────────────▼────────┐ │
│ │ Supabase clients  src/lib/supabase/{server,client,middleware}.ts      │ │
│ │ server.ts → anon key + cookies (RLS in effect)                        │ │
│ │ client.ts → anon key (browser, RLS in effect)                         │ │
│ │ middleware.ts → cookie bridge                                         │ │
│ │ + service-role client (NEW, M1) → only inside Route Handlers          │ │
│ └──────────────────────────────────┬────────────────────────────────────┘ │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │ @supabase/ssr
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│        Supabase (Postgres + Auth + Storage, Frankfurt region)             │
│        Tables protected by RLS · Migrations in supabase/migrations/       │
│        M1 adds: purchases, lesson_progress, webhook_events, audit_log     │
└─────────────────────┬───────────────────────────┬────────────────────────┘
                      │ server-only                │ server-only
                      ▼                            ▼
              ┌────────────────┐           ┌────────────────────┐
              │   ЮKassa API   │           │   Kinescope API    │
              │ /v3/payments   │           │ private signed URL │
              │ webhook → us   │           │ TTL 4h, per user   │
              └────────────────┘           └────────────────────┘
```

### Component Responsibilities (M1 additions only)

| Component | Responsibility | Location |
|---|---|---|
| Domain model migration | Adds `purchases`, `lesson_progress`, `webhook_events`, `audit_log` + RLS | `supabase/migrations/20260524000001_m1_commerce_and_progress.sql` (NEW) |
| `payments` Server Action | Create ЮKassa payment, return confirmation URL | `src/server/actions/payments.ts` (NEW) |
| ЮKassa wrapper | HTTP client + signature verify + types | `src/lib/yookassa/{client,verify,types}.ts` (NEW) |
| Kinescope wrapper | Build private signed URL with HMAC + TTL | `src/lib/kinescope/{client,sign,types}.ts` (NEW) |
| ЮKassa webhook handler | Verify → idempotency → grant access → audit | `src/app/api/webhooks/yookassa/route.ts` (NEW) |
| Service-role client | Bypass RLS for webhook writes only | `src/lib/supabase/admin.ts` (NEW, server-only) |
| Lesson access query | Check purchase → return signed URL | `src/server/queries/lessons.ts` (NEW) |
| Progress action | Upsert `lesson_progress` (debounced) | `src/server/actions/progress.ts` (NEW) |
| Auth Server Actions | login/register/logout/forgot/reset wrapping `supabase.auth` | `src/server/actions/auth.ts` (NEW) |
| `(app)/layout.tsx` | Auth gate: `redirect('/login')` if no user | `src/app/(app)/layout.tsx` (NEW) |
| `(admin)/layout.tsx` | Reserved — `requireRole('admin', …)` (deferred body in M2) | `src/app/(admin)/layout.tsx` (NEW stub) |

Existing scaffold pieces (`src/middleware.ts`, `src/lib/supabase/{server,client,middleware}.ts`, `src/lib/auth/require.ts`) are **reused without modification**.

---

## 2. Domain Model

### 2.1 Entities & Relationships

```
auth.users (Supabase Auth — managed)
   │ 1:1
   ▼
profiles            ─┐  (existing — full_name, avatar_url, bio, telegram_id)
   │ 1:N             │  on_auth_user_created trigger handles INSERT
   ▼                 │
user_roles          ─┤  (existing — enum admin|curator|content_manager; M1 unused)
                     │
courses ───────────  │  (existing — slug, title, published, order_index)
   │ 1:N             │
   ▼                 │
modules              │  (existing — course_id, title, order_index)
   │ 1:N             │
   ▼                 │
lessons              │  (existing — module_id, video_id, duration_sec, is_preview)
   │                 │
   │  N:M via        │
   ▼                 │
purchases     ◄──────┤  NEW: user_id × course_id, status, ЮKassa payment id
   │                 │
   │                 │
lesson_progress  ◄───┘  NEW: user_id × lesson_id, seconds_watched, completed_at

webhook_events   (NEW — provider × external_id, idempotency)
audit_log        (NEW — append-only, finance/admin events)
```

### 2.2 New Tables (M1 migration)

```sql
-- supabase/migrations/20260524000001_m1_commerce_and_progress.sql

-- ============================================================
-- purchases — proof a user owns a course (drives access)
-- ============================================================
CREATE TYPE purchase_status AS ENUM ('pending', 'succeeded', 'canceled', 'refunded');

CREATE TABLE IF NOT EXISTS purchases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id           uuid NOT NULL REFERENCES courses(id)    ON DELETE RESTRICT,
  amount_minor        integer NOT NULL CHECK (amount_minor > 0),  -- копейки
  currency            text    NOT NULL DEFAULT 'RUB' CHECK (currency = 'RUB'),
  status              purchase_status NOT NULL DEFAULT 'pending',
  provider            text NOT NULL DEFAULT 'yookassa',
  provider_payment_id text,  -- ЮKassa payment.id, NULL until create_payment returns
  confirmation_url    text,  -- redirect target for the user
  paid_at             timestamptz,
  refunded_at         timestamptz,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,   -- soft delete (152-ФЗ "right to delete")
  UNIQUE (provider, provider_payment_id)
);

CREATE INDEX idx_purchases_user_course_status
  ON purchases(user_id, course_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchases_provider_payment_id
  ON purchases(provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX idx_purchases_status_pending
  ON purchases(created_at) WHERE status = 'pending';  -- janitor for stale carts

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- User reads own purchases (any status, including pending so they can resume)
CREATE POLICY "Users read own purchases"
  ON purchases FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- No INSERT/UPDATE/DELETE policies — only service_role (webhook + payment action) writes.

-- ============================================================
-- lesson_progress — per-lesson playback state
-- ============================================================
CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id       uuid NOT NULL REFERENCES lessons(id)    ON DELETE CASCADE,
  seconds_watched integer NOT NULL DEFAULT 0 CHECK (seconds_watched >= 0),
  completed_at    timestamptz,
  last_watched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_user_completed
  ON lesson_progress(user_id) WHERE completed_at IS NOT NULL;

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own progress"
  ON lesson_progress FOR SELECT USING (auth.uid() = user_id);

-- Insert/update only if user actually owns the course that contains this lesson
CREATE POLICY "Users write own progress for owned lessons"
  ON lesson_progress FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1
      FROM lessons l
      JOIN modules m   ON m.id = l.module_id
      JOIN purchases p ON p.course_id = m.course_id
      WHERE l.id = lesson_progress.lesson_id
        AND p.user_id = auth.uid()
        AND p.status = 'succeeded'
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "Users update own progress for owned lessons"
  ON lesson_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1
      FROM lessons l
      JOIN modules m   ON m.id = l.module_id
      JOIN purchases p ON p.course_id = m.course_id
      WHERE l.id = lesson_progress.lesson_id
        AND p.user_id = auth.uid()
        AND p.status = 'succeeded'
        AND p.deleted_at IS NULL
    )
  );

-- ============================================================
-- lessons — add policy for paid access (extends existing preview policy)
-- ============================================================
CREATE POLICY "Owners read full lessons"
  ON lessons FOR SELECT
  USING (
    published = true AND EXISTS (
      SELECT 1
      FROM modules m
      JOIN purchases p ON p.course_id = m.course_id
      WHERE m.id = lessons.module_id
        AND p.user_id = auth.uid()
        AND p.status = 'succeeded'
        AND p.deleted_at IS NULL
    )
  );

-- ============================================================
-- webhook_events — idempotency log (per .claude/skills/security/SKILL.md §4)
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      text NOT NULL,
  external_id   text NOT NULL,                  -- ЮKassa event.object.id
  event_type    text NOT NULL,                  -- 'payment.succeeded' etc.
  payload       jsonb NOT NULL,
  processed_at  timestamptz,
  process_error text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);

CREATE INDEX idx_webhook_events_unprocessed
  ON webhook_events(created_at) WHERE processed_at IS NULL;

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role can read/write (defense in depth).

-- ============================================================
-- audit_log — append-only finance & admin trail
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL,                    -- 'payment.created' etc.
  entity_type text,
  entity_id   uuid,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address  inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user_id   ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- No policies → service_role only.

-- ============================================================
-- courses — add price columns (single-tier in M1, multi-tier later)
-- ============================================================
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS price_minor integer NOT NULL DEFAULT 0
    CHECK (price_minor >= 0),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'RUB'
    CHECK (currency = 'RUB');

-- updated_at trigger reused from base migration
CREATE TRIGGER purchases_touch_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
```

After applying: `npm run db:types` → regenerates `src/types/database.ts` (per `.claude/skills/database/SKILL.md`).

### 2.3 Soft-Delete Approach

Per `.claude/skills/database/SKILL.md` rule: **`deleted_at timestamptz NULL`** (not boolean). Applied to `purchases` (152-ФЗ; user may request data erasure but financial records must survive for accounting — soft delete is the legal compromise). `lesson_progress` is **hard-deleted** via `ON DELETE CASCADE` from `auth.users` — no value in retention.

Every read query that touches `purchases` must include `WHERE deleted_at IS NULL` — encoded into RLS policies above so callers cannot forget.

### 2.4 RLS Strategy Summary

| Table | Read | Write |
|---|---|---|
| `profiles` | own | own (existing) |
| `user_roles` | own | service_role only (M2 admin) |
| `courses` | public if `published` | service_role only (no admin in M1) |
| `modules` | EXISTS-join to published course | service_role only |
| `lessons` | preview OR EXISTS-join through `purchases.status='succeeded'` | service_role only |
| `purchases` | own (non-deleted) | service_role only (Server Action via admin client + webhook) |
| `lesson_progress` | own | own, gated by EXISTS-join to owned course |
| `webhook_events` | none | service_role only |
| `audit_log` | none (export via Server Action in M2 admin) | service_role only |

The **EXISTS-join pattern** is the load-bearing primitive — it lets a single Server Component fetch lessons for a course and rely on Postgres to silently drop rows the user has not paid for. No application-layer access check is required for reads (defense in depth: the action layer still calls `requireUser`).

---

## 3. Payment Flow (ЮKassa)

### 3.1 Happy Path — Create

```
1. User on /courses/[slug] clicks "Купить"
   ↓
2. Client Component calls Server Action createPaymentAction({ courseId })
   src/server/actions/payments.ts
   ↓
3. Server Action:
   a. requireUser()                           [src/lib/auth/require.ts]
   b. supabase.from('courses').select('id, price_minor, title')
      .eq('id', courseId).eq('published', true).single()
      → price comes from DB, NEVER from client (security skill §4)
   c. supabase admin client INSERT INTO purchases
      (user_id, course_id, amount_minor, status='pending')
      → returns purchase.id
   d. yookassa.createPayment({                [src/lib/yookassa/client.ts]
        amount: { value: price/100, currency: 'RUB' },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: `${BASE_URL}/dashboard/orders/${purchase.id}`
        },
        description: course.title,
        metadata: { purchase_id: purchase.id, user_id: user.id },
        receipt: { customer: { email: user.email }, items: [...] }  // 54-ФЗ
      })
      Headers: Idempotence-Key: purchase.id     ← deterministic, never duplicates
              Authorization: Basic base64(SHOP_ID:SECRET_KEY)
      Timeout: AbortSignal.timeout(5000)
   e. UPDATE purchases SET provider_payment_id, confirmation_url WHERE id = purchase.id
   f. audit_log INSERT 'payment.created'
   g. return { ok: true, confirmationUrl }
   ↓
4. Client receives { ok: true, confirmationUrl }
   → window.location.href = confirmationUrl  (ЮKassa hosted page)
   ↓
5. User pays on ЮKassa → ЮKassa redirects to return_url
   /dashboard/orders/[id] shows status (may still be 'pending' until webhook arrives)
```

### 3.2 Webhook Path — `payment.succeeded`

```
ЮKassa POST → /api/webhooks/yookassa
   src/app/api/webhooks/yookassa/route.ts
   ↓
1. rawBody = await req.text()
2. Verify signature:
   - ЮKassa uses IP allowlist + HTTP Basic auth on the webhook URL (not HMAC).
   - We additionally require `x-yookassa-signature` IF present (future-proof).
   - Source IPs validated against ЮKassa public list:
     185.71.76.0/27, 185.71.77.0/27, 77.75.153.0/25, etc.
   - Reject early if neither matches.
   → 401 if invalid                           [src/lib/yookassa/verify.ts]
3. event = JSON.parse(rawBody)
4. Idempotency check via webhook_events table:
   supabase.admin.from('webhook_events').insert({
     provider: 'yookassa',
     external_id: event.object.id,            -- ЮKassa payment.id
     event_type: event.event,                 -- 'payment.succeeded'
     payload: event
   })
   IF error.code === '23505' (UNIQUE violation)
     → already processed → return 200 immediately
5. Look up purchase by metadata.purchase_id (NOT amount — never trust amounts):
   supabase.admin.from('purchases')
     .select('id, user_id, course_id, amount_minor, status')
     .eq('id', event.object.metadata.purchase_id)
     .single()
6. Verify event.object.amount.value * 100 === purchase.amount_minor
   → mismatch → audit_log 'payment.mismatch' + return 200 + alert Sentry
7. UPDATE purchases SET status='succeeded', paid_at=now()
   WHERE id = purchase.id AND status='pending'
   (idempotent — second processing is a no-op)
8. UPDATE webhook_events SET processed_at = now() WHERE id = …
9. audit_log INSERT 'payment.succeeded'
10. return 200 quickly (< 5s). Any background work (email confirmation) is
    deferred to M2 (Unisender out of scope).
```

### 3.3 Refund Flow

| Event | Action |
|---|---|
| `payment.canceled` (user abandoned, card declined) | `UPDATE purchases SET status='canceled'` |
| `refund.succeeded` | `UPDATE purchases SET status='refunded', refunded_at=now()` — RLS-driven access revokes immediately (next lesson load sees no `succeeded` purchase → 403) |

Refunds in M1 are **operator-initiated via ЮKassa LK** (not in-app). Webhook handler must process the event regardless. No in-app refund button until M2.

### 3.4 Security Invariants

1. **Price always from DB**, never from client request body.
2. **`Idempotence-Key` = `purchase.id`** — guarantees no duplicate ЮKassa payments even if the Server Action is retried.
3. **`webhook_events.UNIQUE(provider, external_id)`** — guarantees no duplicate access-grants even if ЮKassa retries the webhook.
4. **Service-role key used only inside Route Handler + payment Server Action** — never imported by any file under `src/components/`, `src/app/(marketing|app|admin)/.../page.tsx`, or `src/lib/supabase/client.ts`.
5. **54-ФЗ receipt** included in `createPayment` call (`receipt.items`); ЮKassa forwards to OFD.
6. **Webhook source verified by IP allowlist** (ЮKassa does not currently sign payloads; the contract is "allowlisted IP + secret in URL or BasicAuth"). Use a path-secret as belt-and-suspenders: `/api/webhooks/yookassa/[secret]/route.ts` where `[secret]` is a long random env var.

---

## 4. Video Access (Kinescope Private Signed URL)

### 4.1 Flow

```
User opens /lessons/[lessonId]
   src/app/(app)/lessons/[lessonId]/page.tsx  (Server Component)
   ↓
1. Page calls getLessonForViewing(lessonId)   [src/server/queries/lessons.ts]
   ↓
2. Server Query:
   a. requireUser()
   b. supabase.from('lessons')
       .select(`
         id, title, video_id, duration_sec, order_index,
         module:modules(
           id, title, course:courses(id, title, slug)
         )
       `)
       .eq('id', lessonId)
       .single()
       → RLS filters: returns NULL if user has no succeeded purchase
   c. If null → notFound() / 404
   d. const signedUrl = kinescope.buildSignedEmbedUrl({
        videoId: lesson.video_id,
        userId: user.id,
        userEmail: user.email,            // for watermark
        ttlSeconds: 4 * 60 * 60           // 4h, per security skill §5
      })
   e. return { lesson, signedUrl }
   ↓
3. Page renders <LessonPlayer signedUrl={signedUrl} ... />
   src/components/lessons/LessonPlayer.tsx  ('use client')
```

### 4.2 Signed URL Construction

Kinescope private videos use a JWT-signed URL of the form:

```
https://kinescope.io/embed/<videoId>?token=<jwt>
```

Where `<jwt>` is HS256-signed with the project's secret token, containing:

```json
{
  "iss": "videoedit-academy",
  "sub": "<user.id>",
  "video_id": "<videoId>",
  "exp": <now + 14400>,
  "watermark": {
    "text": "<user.email>",
    "opacity": 0.3
  }
}
```

Implementation: `src/lib/kinescope/sign.ts` with `jsonwebtoken` or Web Crypto subtle. Token signed server-side only (`KINESCOPE_API_TOKEN` env var, server-only). Confirm exact JWT claim names against Kinescope private API docs when implementing — claim shape may differ.

### 4.3 Client Embed

```tsx
// src/components/lessons/LessonPlayer.tsx
'use client';

export function LessonPlayer({ signedUrl, lessonId }: Props) {
  return (
    <iframe
      src={signedUrl}
      title="Урок"
      className="aspect-video w-full rounded-lg"
      allow="autoplay; fullscreen; picture-in-picture"
      sandbox="allow-scripts allow-same-origin allow-presentation"
      referrerPolicy="strict-origin"
      // NO `allow="download"` — prevents native download API
      // NO download buttons rendered alongside
    />
  );
}
```

Page-level hardening:

- `next.config.js` already sets `X-Frame-Options: DENY` (our pages can't be embedded by attackers).
- `images.remotePatterns` already permits `*.kinescope.io`.
- Add CSP `frame-src https://kinescope.io https://*.kinescope.io` when CSP migration ships (M2 hardening pass).
- No right-click handler — does not stop determined users (screen recording is undefeatable per `.planning/PROJECT.md` Constraints), but removes the casual download path.

### 4.4 Why Server-Built URL, Not Client-Fetched Token

A naive design exposes `/api/lessons/[id]/signed-url` returning the JWT to the client. That allows scraping (one authenticated GET per lesson, store all tokens). Instead: **URL is constructed on the server during page render** and the client never sees a re-requestable endpoint. TTL of 4h means re-render gives a fresh URL on refresh; no client-side caching surface.

If `<LessonPlayer>` mounts inside an SSR-streamed parent and the URL must rotate without a full page reload, add a Server Action `refreshSignedUrl(lessonId)` later — not needed in M1.

---

## 5. Auth + Session

### 5.1 Stack

- `@supabase/ssr` v0.5+ — cookie-based session
- Edge middleware at `src/middleware.ts` calls `updateSession()` from `src/lib/supabase/middleware.ts` on **every** request (existing scaffold).
- `httpOnly`, `SameSite=Lax`, `Secure` cookies (Supabase default).
- 30-day rolling session, auto-refresh handled by middleware.

### 5.2 Layout-Level Gates

```tsx
// src/app/(app)/layout.tsx  (NEW in M1)
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/dashboard');
  return <>{children}</>;
}
```

### 5.3 Server-Level Gates

Every Server Action and Server Query that touches user-scoped data starts with:

```ts
const user = await requireUser();        // throws UnauthorizedError
// OR
const user = await requireRole('admin'); // throws ForbiddenError (M2)
```

`requireUser` / `requireRole` are already implemented in `src/lib/auth/require.ts`. Server Actions catch `UnauthorizedError` and convert to `{ ok: false, error: 'Требуется вход' }` per the discriminated-union contract (`.claude/skills/api-conventions/SKILL.md`).

### 5.4 Auth Server Actions (M1 scope)

```
src/server/actions/auth.ts
  ├─ registerAction({ email, password, fullName, pdAgreed })
  │   → captcha verify → supabase.auth.signUp → revalidatePath('/')
  │   → 152-ФЗ: `pdAgreed` mandatory boolean, stored in profiles.pd_agreed_at
  ├─ loginAction({ email, password })
  │   → captcha verify → supabase.auth.signInWithPassword
  ├─ logoutAction()
  │   → supabase.auth.signOut → redirect('/')
  ├─ forgotPasswordAction({ email })
  │   → captcha verify → supabase.auth.resetPasswordForEmail
  └─ resetPasswordAction({ password, token })
      → supabase.auth.updateUser
```

Rate limits live at the middleware or wrapper layer (Vercel KV / Upstash — keep `@upstash/ratelimit` install for M1 even if simple). Per `.claude/skills/security/SKILL.md` §3.

Add `pd_agreed_at timestamptz NOT NULL` to `profiles` in the M1 migration to satisfy 152-ФЗ consent retention.

---

## 6. Progress Tracking

### 6.1 Write Triggers

| Event | Action |
|---|---|
| `timeupdate` from `<iframe>` postMessage every 5s | Debounced upsert: `seconds_watched = max(current, played)` |
| `ended` from player | Upsert + set `completed_at = now()` if 90%+ played |
| Page unload (`beforeunload`) | `navigator.sendBeacon` final flush (best-effort) |
| Lesson page mount | No write — read-only |

The 90%-threshold prevents partial scrubs from marking a lesson complete and keeps a useful "% complete" denominator per course.

### 6.2 Server Action

```ts
// src/server/actions/progress.ts
'use server';

export const updateProgressSchema = z.object({
  lessonId: z.string().uuid(),
  secondsWatched: z.number().int().min(0).max(86400),
  isComplete: z.boolean().optional()
});

export async function updateProgressAction(input) {
  const parsed = updateProgressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const user = await requireUser();
  const supabase = createServerSupabase();

  // RLS WITH CHECK enforces user owns the course — no extra check needed here
  const { error } = await supabase
    .from('lesson_progress')
    .upsert({
      user_id: user.id,
      lesson_id: parsed.data.lessonId,
      seconds_watched: parsed.data.secondsWatched,
      completed_at: parsed.data.isComplete ? new Date().toISOString() : null,
      last_watched_at: new Date().toISOString()
    }, { onConflict: 'user_id,lesson_id' });

  if (error) {
    console.error('updateProgress failed', error);
    return { ok: false, error: 'Не удалось сохранить прогресс' };
  }
  return { ok: true };
}
```

No `revalidatePath` on every progress write — would tank performance. Dashboard reads progress via fresh server query on visit only.

### 6.3 Dashboard Read

```ts
// src/server/queries/progress.ts
export async function getMyCoursesWithProgress(userId: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('purchases')
    .select(`
      id, course_id, paid_at,
      course:courses(
        id, slug, title, cover_url,
        modules(
          id, title,
          lessons(id, duration_sec)
        )
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'succeeded')
    .is('deleted_at', null)
    .order('paid_at', { ascending: false });
  if (error) throw error;

  // Fetch progress in one go (RLS scopes to user automatically)
  const lessonIds = data.flatMap(p => p.course.modules.flatMap(m => m.lessons.map(l => l.id)));
  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('lesson_id, completed_at, seconds_watched')
    .in('lesson_id', lessonIds);

  // Compose %-complete per course in JS
  return composeProgress(data, progress ?? []);
}
```

Two-query pattern (one for structure, one for progress) avoids deeply nested join semantics in PostgREST. For 1 course × ~50 lessons, this is sub-100ms.

---

## 7. Route Grouping & URL Map

```
src/app/
├── layout.tsx                       (existing — root)
├── page.tsx                         (existing — temporary; replaced by (marketing)/page.tsx)
│
├── (marketing)/                     PUBLIC — no auth required
│   ├── layout.tsx                   marketing header/footer, no gate
│   ├── page.tsx                     /                       landing
│   ├── courses/[slug]/page.tsx      /courses/[slug]         course preview + buy CTA
│   ├── login/page.tsx               /login                  login form
│   ├── register/page.tsx            /register               register form + 152-ФЗ checkbox
│   ├── forgot-password/page.tsx     /forgot-password
│   ├── reset-password/page.tsx      /reset-password         (token from email)
│   ├── privacy/page.tsx             /privacy                152-ФЗ policy
│   └── terms/page.tsx               /terms                  оферта
│
├── (app)/                           AUTH REQUIRED
│   ├── layout.tsx                   auth gate: redirect('/login') if no user
│   ├── dashboard/page.tsx           /dashboard              my courses + progress
│   ├── dashboard/orders/[id]/page.tsx /dashboard/orders/[id] post-payment status
│   ├── courses/[slug]/page.tsx      /courses/[slug] (auth) module list, deep links to lessons
│   ├── lessons/[id]/page.tsx        /lessons/[id]           video player + lesson nav
│   └── profile/page.tsx             /profile                name (RO), email (RO), delete account
│
├── (admin)/                         M2 — reserved, layout stub returns 404 in M1
│   └── layout.tsx                   await requireRole('admin'); render children
│
└── api/                             ROUTE HANDLERS
    ├── webhooks/
    │   └── yookassa/[secret]/route.ts    POST — webhook with path-secret
    └── auth/
        └── callback/route.ts             (M2 — OAuth, currently unused)
```

**Why `(marketing)` owns `/login` and `/register`** instead of a separate `(auth)` group: they share the marketing chrome (logo, footer), and there are only ~5 auth pages. Splitting yields no win and adds a layout file.

**Why `(admin)/layout.tsx` ships in M1 as a stub**: locks in the role-gate contract so M2 admin work doesn't need to refactor existing pages.

---

## 8. Data-Flow Boundaries (Key Security Property)

| Surface | Allowed Supabase Key | Why |
|---|---|---|
| Browser bundle (Client Components, `src/components/`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` only | Bundled into JS sent to user. Anon key + RLS = safe by design. |
| Server Components, Server Actions, Server Queries | Anon key (via `createServerSupabase()`) | Runs in Node but acts AS THE USER via their cookie. RLS still enforced — defense in depth. |
| Route Handlers (webhooks) | `SUPABASE_SERVICE_ROLE_KEY` (via NEW `src/lib/supabase/admin.ts`) | Bypasses RLS to write `purchases`, `webhook_events`, `audit_log`. Inbound from ЮKassa — there is no user. |
| Payment Server Action (Insert `purchases` with `status='pending'`) | `SUPABASE_SERVICE_ROLE_KEY` (via admin client) | We need to insert a row on behalf of the user before redirect; RLS has no INSERT policy on `purchases` (intentional). Server Action wraps this — `requireUser()` already established identity. |

### Hard Rules

1. **`src/lib/supabase/admin.ts` is server-only** — must `import 'server-only'` at top (Next.js convention) so any accidental import from a Client Component fails the build.
2. **Service role NEVER as a literal string in any file under `src/components/`, `src/stores/`, `src/hooks/`** — enforced by an ESLint custom rule (add `no-restricted-imports` for `@/lib/supabase/admin` from those paths).
3. **`NEXT_PUBLIC_` prefix is the bundling boundary** — already documented in `.planning/codebase/ARCHITECTURE.md` §Architectural Constraints.
4. **Cookies are httpOnly** — `auth.getUser()` is the only way the server reads the user; client JS never sees the JWT.

```
Browser ──────────┬──── Server Components ──────┬─── createServerSupabase()  ──┐
                  │     Server Actions          │   (anon + user's cookies)     ├─→ Supabase
                  │     Server Queries          │                                │   (RLS gate)
                  │                              │                                │
Webhook (ЮKassa) ─┴──── Route Handler ──────────┴─── createAdminSupabase()  ────┘
                                                    (service role, RLS bypass)
```

---

## 9. Standard Patterns (Reaffirmed)

### Pattern 1: Server Component → Query → Render

Already canonical per `.claude/skills/api-conventions/SKILL.md`. No inline Supabase calls in pages.

```tsx
// src/app/(app)/dashboard/page.tsx
import { requireUser } from '@/lib/auth/require';
import { getMyCoursesWithProgress } from '@/server/queries/progress';
import { DashboardCourses } from './components/DashboardCourses';

export default async function DashboardPage() {
  const user = await requireUser();
  const courses = await getMyCoursesWithProgress(user.id);
  return <DashboardCourses courses={courses} />;
}
```

### Pattern 2: Form → Server Action → Discriminated Union

```tsx
// Client component
const result = await createPaymentAction({ courseId });
if (!result.ok) { toast.error(result.error); return; }
window.location.href = result.confirmationUrl;
```

### Pattern 3: Webhook → Verify → Idempotency → Process → 200

Canonical structure in `.claude/skills/api-conventions/SKILL.md` §Route Handlers.

### Pattern 4: External API → Wrapper → Server-Only

`src/lib/yookassa/`, `src/lib/kinescope/` each export `client.ts` (HTTP), `verify.ts` (signatures), `types.ts`. Timeouts (`AbortSignal.timeout(5000)`), idempotency keys, no logging of secrets.

---

## 10. Anti-Patterns Specific to This Domain

### Anti-Pattern 1: Storing video URLs in DB columns
**What people do:** `lessons.video_url text` storing the Kinescope URL.
**Why wrong:** URL becomes the access token; copy-paste leaks the content.
**Instead:** Store `lessons.video_id` only (already in schema). Build the signed URL per-request, server-side.

### Anti-Pattern 2: Trusting `amount` from webhook payload to compute order total
**What people do:** `purchase.amount = event.object.amount.value`.
**Why wrong:** A spoofed webhook (or replay with a tampered IP) can mark a 1₽ purchase as a 50000₽ paid course.
**Instead:** Look up `purchases.amount_minor` by `metadata.purchase_id` and verify webhook amount matches. Reject + alert if not.

### Anti-Pattern 3: Granting access via client-side flag after redirect
**What people do:** Set `localStorage.paid = true` on `return_url` arrival.
**Why wrong:** User can set it themselves; webhook is the only authoritative source.
**Instead:** Access is granted only when the webhook updates `purchases.status='succeeded'`. The `return_url` page just shows "Платёж обрабатывается…" until polling or refresh shows success.

### Anti-Pattern 4: Inline `<video>` tag pointing at Kinescope
**What people do:** `<video src={signedUrl} controls>`.
**Why wrong:** Native `<video>` exposes download button + supports MediaSource scraping.
**Instead:** Always use the Kinescope `<iframe>` embed — they handle DRM-lite hardening (referrer checks, watermark overlay, no native download).

### Anti-Pattern 5: Bypassing RLS by always using service role
**What people do:** "Service role is easier, just use it everywhere on the server."
**Why wrong:** First bug in a query forgets `.eq('user_id', user.id)` → cross-user data leak. RLS is a safety net.
**Instead:** Service role only for: webhooks, payment creation (intentional INSERT into RLS-locked `purchases`), M2 admin operations. Everywhere else: anon key + cookies + `requireUser`.

### Anti-Pattern 6: Polling for payment success from the client
**What people do:** `setInterval(() => fetch('/api/order/[id]/status'), 1000)`.
**Why wrong:** Every active user pegs Supabase. Most pollers finish in 10s but some hang for minutes.
**Instead:** Show a "refresh to check" CTA, optionally Supabase Realtime subscription on `purchases.id` (one channel per user). M1: refresh CTA is fine; Realtime is an M2 polish.

---

## 11. Scaling Considerations

| Scale | Architecture Adjustments |
|---|---|
| **0-100 users** (M1 launch) | Current architecture is correct. Supabase Free + Vercel Hobby. No CDN concerns (Kinescope handles video delivery). |
| **100-1,000 users** | Supabase Pro ($25/mo) for connection pool + better SLA. Add Vercel Analytics. Sentry on Team plan. |
| **1,000-10,000 users** | Add Vercel KV or Upstash for rate limiting (M1 may use in-memory; this is when it matters). Lesson-progress writes become hot: consider batching via Edge Function consuming a queue. Add read replicas via Supabase if dashboard query slows. |
| **10,000+** | Move progress writes to an Edge Function with batching (writes per second × users gets noisy). Cache published-course tree in Vercel Edge Cache with `revalidateTag` on admin edits. Consider splitting video access (signed URL) into a dedicated Edge Function for cold-start consistency. |

### First Bottleneck Likely

**Lesson-progress writes** — every 5s while watching, per user. At 100 concurrent watchers, ~20 writes/sec, which is fine. At 1000 concurrent: 200 writes/sec, still fine in Postgres but worth profiling. **Mitigation seed in M1**: use `upsert` (single row PK) — Postgres handles this efficiently with the PK index.

**Second bottleneck**: the `getLessonForViewing` query JOINs through `purchases` on every lesson load. With `idx_purchases_user_course_status` it stays sub-10ms even at 1M purchases.

---

## 12. Build Order — Vertical MVP Phases

This section feeds the roadmapper. **5 phases, 4-6 weeks solo.** Each phase ships a slice users can actually use (SPIDR: each is a thin vertical through every layer, not a horizontal layer).

### Phase 1 — Foundations: Auth + Marketing Landing (week 1)

**Goal:** A user can land on the site, register, log in, and see "you have no courses yet."

**Vertical slice:** landing page → `/register` → email confirmation → `/login` → empty `/dashboard`.

**Deliverables:**
- `(marketing)/layout.tsx`, `(marketing)/page.tsx` (hero, CTA, FAQ skeleton)
- `(marketing)/privacy/page.tsx`, `(marketing)/terms/page.tsx` (152-ФЗ + оферта)
- `(marketing)/{login,register,forgot-password,reset-password}/page.tsx`
- `src/server/actions/auth.ts` (5 actions)
- M1 migration applied: `pd_agreed_at` column on profiles, no commerce tables yet
- `(app)/layout.tsx` auth gate
- `(app)/dashboard/page.tsx` (empty state only)
- Captcha integration (Yandex SmartCaptcha)
- shadcn/ui bootstrap (Button, Input, Form, Label, Card)
- Rate limiting on auth endpoints

**Blocks:** Phase 2 (needs logged-in user to buy)
**Unblocked by:** Existing scaffold (middleware, supabase clients, `requireUser`)

### Phase 2 — Course Catalog + Payment Skeleton (week 2)

**Goal:** A user can see the course detail page, click "Купить", and get redirected to ЮKassa (but webhook not wired yet — payment goes through; access doesn't).

**Vertical slice:** `/courses/[slug]` (preview) → click buy → ЮKassa hosted page → return to `/dashboard/orders/[id]` ("обработка").

**Deliverables:**
- M1 migration commerce part: `purchases`, `courses.price_minor`, `webhook_events`, `audit_log` tables
- `(marketing)/courses/[slug]/page.tsx` (preview: title, modules tree, price, CTA)
- `src/server/queries/courses.ts` — `getCourseBySlug`, `getCourseWithModules`
- `src/lib/yookassa/{client,types}.ts` (create-payment only)
- `src/lib/supabase/admin.ts` (service-role client with `import 'server-only'`)
- `src/server/actions/payments.ts` — `createPaymentAction`
- `(app)/dashboard/orders/[id]/page.tsx` (status display)
- Seed: 1 published course with realistic price

**Blocks:** Phase 3 (webhook depends on `purchases` rows existing)
**Unblocked by:** Phase 1 (auth required to buy)

### Phase 3 — Webhook + Access Grant (week 3)

**Goal:** Test purchase via ЮKassa test mode → webhook fires → user sees course in dashboard with "Смотреть" button.

**Vertical slice:** Phase 2 flow extended → webhook arrives → `purchases.status='succeeded'` → `/dashboard` shows owned course → click "Смотреть" → empty lesson page placeholder.

**Deliverables:**
- `src/lib/yookassa/verify.ts` (IP allowlist + path-secret check)
- `src/app/api/webhooks/yookassa/[secret]/route.ts`
- Idempotency via `webhook_events`
- `audit_log` writes
- `src/server/queries/progress.ts` (read shape; M1 ignores progress fields, just lists owned courses)
- Updated `/dashboard` rendering owned courses
- E2E: register → buy (ЮKassa test) → webhook simulated → dashboard shows course
- `payment.canceled` + `refund.succeeded` handlers
- Sentry wiring for webhook errors

**Blocks:** Phase 4 (lesson page needs `purchases.status='succeeded'` to test access)
**Unblocked by:** Phase 2 (need payment flow to test)

**Risk flag for roadmapper:** webhook signature verification specifics for ЮKassa (no HMAC; IP allowlist) need a research spike before Phase 3 — flag for `/gsd:plan-phase` deeper research.

### Phase 4 — Video Player + Lesson Access (week 4-5)

**Goal:** Owner can watch lessons; non-owners get redirected/blocked.

**Vertical slice:** `/dashboard` → click course → `(app)/courses/[slug]` (full module tree, deep links) → click lesson → `/lessons/[id]` plays Kinescope video. Non-owner gets `notFound()`.

**Deliverables:**
- `lessons` table: paid-access RLS policy (added to M1 migration as `lessons_owner_select_policy`)
- `src/lib/kinescope/{client,sign,types}.ts`
- `src/server/queries/lessons.ts` — `getLessonForViewing`
- `(app)/courses/[slug]/page.tsx`
- `(app)/lessons/[id]/page.tsx`
- `src/components/lessons/LessonPlayer.tsx` (iframe + sandbox + referrerPolicy)
- `src/components/lessons/LessonNav.tsx` (prev/next)
- Seed: 1 Kinescope private video, 3-5 lessons to demonstrate

**Blocks:** Phase 5 (progress writes happen during playback)
**Unblocked by:** Phase 3 (need owned-purchase to test access; need Kinescope account/secret token)

**Risk flag:** Kinescope private signed URL JWT claim shape — verify against current Kinescope docs before Phase 4. Flag for research.

### Phase 5 — Progress + Polish + Ship (week 5-6)

**Goal:** Dashboard shows "% complete" per course; user can delete account (152-ФЗ).

**Vertical slice:** Watch lesson → progress saves → return to `/dashboard` → see "3 of 12 lessons completed (25%)". `/profile` → "Удалить аккаунт" → soft-delete + logout.

**Deliverables:**
- `lesson_progress` table (added in M1 migration up-front; just wire it now)
- `src/server/actions/progress.ts`
- `useLessonProgress` hook (debounced postMessage from iframe)
- Dashboard progress aggregation
- `(app)/profile/page.tsx` (RO data + delete-account action with confirmation)
- `src/server/actions/profile.ts` — `deleteAccountAction` (soft-delete profile, schedule hard-delete; out-of-scope for cron in M1 — just soft-delete)
- Playwright E2E: full smoke test (register → buy → watch → progress → dashboard)
- Sentry production wiring
- Deploy to Vercel + production env vars
- Production ЮKassa shop registration + receipt config (54-ФЗ)

**Blocks:** nothing (this is the ship)
**Unblocked by:** Phase 4 (need lesson playback for progress)

### Dependency Graph

```
Phase 1 (auth + marketing)
   │
   ▼
Phase 2 (catalog + payment redirect)
   │
   ▼
Phase 3 (webhook + access)  ──── research spike: ЮKassa webhook auth model
   │
   ▼
Phase 4 (video player)      ──── research spike: Kinescope private URL signing
   │
   ▼
Phase 5 (progress + ship)
```

### Why This Order

- **Auth before payment** — payment is the one feature where security cost of skipping rate-limits is highest; can't even test the buy flow without `requireUser`.
- **Payment before access** — access (RLS, video signing) requires real `purchases` rows; faking them in tests works but real ЮKassa integration surfaces the IP-allowlist gotcha early.
- **Webhook (P3) before video (P4)** — until the webhook works, no user has `status='succeeded'`, so the lesson page has nothing to render. Could be parallel with a hardcoded test row, but the bug surface is smaller when sequential.
- **Progress last** — it's the only feature where "good enough" is genuinely fine; cutting it does not block ship.

### Cut Lines (if behind schedule)

| Cut | Cost | Recover in |
|---|---|---|
| Phase 5 progress UI (still save to DB) | Dashboard shows "Owned" not "% done" | M2 week 1 |
| Phase 5 delete-account | 152-ФЗ requires manual support process for 30 days post-launch | M2 |
| Phase 3 refund webhook handler | Manual SQL update for refunds (single course, low volume) | M2 |
| Phase 2 multi-tier price (one fixed price only) | Already the M1 plan; do not re-expand | — |

---

## 13. Integration Points (M1)

### External Services

| Service | Pattern | Notes |
|---|---|---|
| Supabase (Postgres + Auth) | `@supabase/ssr` clients (existing). Service-role via NEW `admin.ts` for webhooks. | Frankfurt region — confirm 152-ФЗ posture with lawyer before launch (per `.claude/skills/security/SKILL.md` §7). |
| ЮKassa | Wrapper at `src/lib/yookassa/`. Basic auth (SHOP_ID:SECRET). `Idempotence-Key` = `purchase.id`. Test mode key swap via env var. Webhook auth = IP allowlist + path-secret. | No HMAC signature on webhooks (provider limitation as of 2026). IP allowlist updates rare — hard-code with env override. |
| Kinescope | Wrapper at `src/lib/kinescope/`. JWT-signed embed URLs, 4h TTL, watermark with user email. | Iframe embed only. No direct video element. Confirm JWT claims vs. current docs in Phase 4. |
| Yandex SmartCaptcha | Client widget + server verify endpoint. | On register, login, forgot-password forms. |
| Vercel KV / Upstash | Rate limiting backing store (`@upstash/ratelimit`). | M1 can ship with single-instance in-memory limiter; KV when going to prod or 2+ instances. |
| Sentry | DSN env var; wire `Sentry.init` in `src/instrumentation.ts` (Next.js 14 native) and `sentry.{client,server,edge}.config.ts`. | Phase 5; do NOT skip for "MVP". Webhook errors invisible without it. |

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| Client Component ↔ Server Action | Function call (Next.js RSC RPC). Returns `{ ok, ... }` union. | Never direct fetch. |
| Server Component ↔ Server Query | Direct import + await. | Both in Node, no serialization concerns. |
| Server Action ↔ External API | Through wrapper in `src/lib/<service>/client.ts`. | Never `fetch()` external API inline. |
| Webhook ↔ Database | Service-role client. Wrapped in transaction-shaped functions in `src/server/payments/handler.ts`. | RLS bypassed; rely on idempotency + amount-verify. |
| Lesson Player iframe ↔ Parent page | `postMessage` (Kinescope-defined protocol). | Origin-checked: only `https://kinescope.io` accepted. |

---

## 14. Open Risks & Research Flags

| Risk | Phase | Mitigation |
|---|---|---|
| ЮKassa webhook authentication (no HMAC) | Phase 3 | Path-secret + IP allowlist; document explicitly. **Research spike before P3.** |
| Kinescope private URL JWT claim structure may drift from training data | Phase 4 | Read current Kinescope private API docs first thing in P4. **Research spike before P4.** |
| 152-ФЗ Frankfurt-region data residency | Phase 5 (pre-launch) | Legal sign-off. Out of dev scope. |
| Supabase Free tier limits (500MB DB, 1GB storage, 2GB bandwidth) | Phase 5 | Move to Pro before public launch (~$25/mo). |
| Vercel function timeout (10s on Hobby) for webhook | Phase 3 | Webhook is < 1s in happy path. Cron/long jobs go to Supabase Edge Functions later. |
| Captcha + Server Action interaction (token must round-trip) | Phase 1 | Include captcha token in form schema; verify in action before `signUp`/`signInWithPassword`. |
| Test mode vs. production ЮKassa keys | Phase 3-5 | Env-var based, `.env.local` vs Vercel env. Document switch in deploy runbook. |

---

## 15. Sources & Cross-References

**In-repo (HIGH confidence — these are the source of truth):**
- `/Users/tkestkes/Desktop/repo/.planning/PROJECT.md` — product scope, constraints
- `/Users/tkestkes/Desktop/repo/.planning/codebase/ARCHITECTURE.md` — current architecture
- `/Users/tkestkes/Desktop/repo/.planning/codebase/STRUCTURE.md` — directory conventions
- `/Users/tkestkes/Desktop/repo/.claude/skills/api-conventions/SKILL.md` — Server Actions / Route Handlers / Queries rules
- `/Users/tkestkes/Desktop/repo/.claude/skills/database/SKILL.md` — migrations, RLS, soft-delete, naming
- `/Users/tkestkes/Desktop/repo/.claude/skills/security/SKILL.md` — secrets, payments, webhooks, 152-ФЗ
- `/Users/tkestkes/Desktop/repo/supabase/migrations/20260522000001_init_base_tables.sql` — existing schema baseline
- `/Users/tkestkes/Desktop/repo/src/lib/auth/require.ts` — auth guards
- `/Users/tkestkes/Desktop/repo/src/middleware.ts` + `src/lib/supabase/middleware.ts` — session refresh

**External (MEDIUM confidence — verify in implementation phases):**
- ЮKassa API docs (`yookassa.ru/developers`) — confirm webhook auth model, payment object shape, `Idempotence-Key` semantics
- Kinescope private API docs — confirm JWT claim names, signing algorithm, TTL bounds
- `@supabase/ssr` v0.5+ docs — cookie API stable
- Next.js 14 App Router docs — Server Actions, `revalidatePath`, route groups, Route Handlers — stable

**Pattern references (HIGH — codified in scaffold):**
- Discriminated-union Server Action result: `.claude/skills/api-conventions/SKILL.md` lines 41-46, 80-103
- Webhook idempotency table: `.claude/skills/security/SKILL.md` lines 167-191
- RLS EXISTS-join pattern: `supabase/migrations/20260522000001_init_base_tables.sql` lines 96-102
- `import 'server-only'` boundary: Next.js docs (App Router)

---

*Architecture research for: paid online courses (LMS), VideoEdit Academy M1*
*Researched: 2026-05-24*
