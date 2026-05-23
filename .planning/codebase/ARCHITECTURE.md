<!-- refreshed: 2026-05-23 -->
# Architecture

**Analysis Date:** 2026-05-23

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser / Client                           │
│  React 18 Server + Client Components, Tailwind, shadcn/ui, Zustand   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS · cookies (Supabase session)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Next.js 14 App Router (Node)                     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Middleware  `src/middleware.ts`                              │   │
│  │  → refreshes Supabase session via `updateSession()`           │   │
│  │    (`src/lib/supabase/middleware.ts`)                         │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             ▼                                        │
│  ┌──────────────────┐  ┌───────────────────┐  ┌─────────────────┐  │
│  │ Route Groups     │  │ Route Handlers    │  │ Server Actions  │  │
│  │ `src/app/`       │  │ `src/app/api/`    │  │ `src/server/`   │  │
│  │ (marketing)      │  │ webhooks, OAuth   │  │  actions/       │  │
│  │ (app)            │  │ POST/GET handlers │  │ ('use server')  │  │
│  │ (admin)          │  │                   │  │                 │  │
│  └────────┬─────────┘  └─────────┬─────────┘  └────────┬────────┘  │
│           │                      │                      │           │
│           ▼                      ▼                      ▼           │
│  ┌──────────────────┐  ┌───────────────────┐  ┌─────────────────┐  │
│  │ Server Queries   │  │ Auth helpers      │  │ External API    │  │
│  │ `src/server/     │  │ `src/lib/auth/    │  │ wrappers        │  │
│  │  queries/`       │  │  require.ts`      │  │ `src/lib/<svc>/`│  │
│  └────────┬─────────┘  └─────────┬─────────┘  └────────┬────────┘  │
│           │                      │                      │           │
│           └──────────────────────┼──────────────────────┘           │
│                                  ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Supabase SSR clients  `src/lib/supabase/`                    │   │
│  │  · `server.ts`  → Server Components / Actions / Queries       │   │
│  │  · `client.ts`  → Client Components (`'use client'`)          │   │
│  │  · `middleware.ts` → middleware session refresh               │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ @supabase/ssr (anon key + cookies)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│   Supabase (Postgres + Auth + Storage)                               │
│   · Tables protected by Row-Level Security                           │
│   · Migrations in `supabase/migrations/`                             │
│   · Generated TS types in `src/types/database.ts`                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│   External providers (server-only): Kinescope · YooKassa ·           │
│   CloudPayments · Unisender · Yandex SmartCaptcha · Yandex/VK OAuth  │
│   Called only through wrappers in `src/lib/<service>/`               │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root layout | Global `<html>`/`<body>`, fonts (Inter cyrillic), `<Toaster>` (sonner) | `src/app/layout.tsx` |
| Home page | Landing placeholder (Server Component) | `src/app/page.tsx` |
| Edge middleware | Refresh Supabase session on every request | `src/middleware.ts` |
| Middleware helper | Cookie sync + `supabase.auth.getUser()` | `src/lib/supabase/middleware.ts` |
| Server Supabase client | Read cookies via `next/headers`, used in Server Components / Actions / Queries | `src/lib/supabase/server.ts` |
| Browser Supabase client | Anon-keyed client for Client Components | `src/lib/supabase/client.ts` |
| Auth guards | `requireUser()` / `requireRole(...)` throw `UnauthorizedError` / `ForbiddenError` | `src/lib/auth/require.ts` |
| Server Actions | Form mutations, validated by Zod, return discriminated union | `src/server/actions/` (empty scaffold) |
| Server Queries | Read-only access for Server Components | `src/server/queries/` (empty scaffold) |
| Route Handlers | Webhooks, OAuth callbacks | `src/app/api/` (empty scaffold) |
| External wrappers | YooKassa, Kinescope, Unisender API clients | `src/lib/yookassa/`, `src/lib/kinescope/`, `src/lib/unisender/` (empty scaffolds) |
| UI primitives | shadcn/ui components | `src/components/ui/` (empty scaffold) |
| Feature components | Module-scoped UI: lessons, admin, marketing, shared | `src/components/{lessons,admin,marketing,shared}/` (empty scaffolds) |
| Client state | Zustand stores | `src/stores/` (empty scaffold) |
| Hooks | Reusable React hooks | `src/hooks/` (empty scaffold) |
| DB types | Supabase-generated table/enum types | `src/types/database.ts` |
| Utilities | `cn()` (class merge), `formatPrice()` (RUB) | `src/lib/utils.ts` |

## Pattern Overview

**Overall:** Next.js 14 App Router with Server-first rendering, Server Actions for mutations, Route Handlers for webhooks/OAuth, and Supabase as the single backend (Postgres + Auth + Storage) protected by Row-Level Security.

**Key Characteristics:**
- Server Components are the default; Client Components are opt-in with `'use client'` and pushed as deep as possible in the tree.
- Mutations flow through Server Actions in `src/server/actions/<module>.ts` (Zod-validated, return `{ ok: true | false, ... }`).
- Reads from Server Components flow through `src/server/queries/<module>.ts` (no Supabase calls inline in pages).
- Webhooks and OAuth callbacks are the only "REST-shaped" endpoints, living under `src/app/api/<path>/route.ts`.
- Authentication is cookie-based Supabase Auth; the middleware refreshes it for every request.
- Authorization is enforced server-side in two layers: `requireUser`/`requireRole` helpers in every Action/Query, plus RLS policies in Postgres.
- External integrations (YooKassa, Kinescope, Unisender, etc.) are always wrapped — never called from components or Actions directly.

## Layers

**Edge / Middleware:**
- Purpose: Refresh Supabase auth cookies before any route resolves.
- Location: `src/middleware.ts` (delegates to `src/lib/supabase/middleware.ts`).
- Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `manifest.json`, and image asset paths.
- Depends on: `@supabase/ssr` `createServerClient` with request/response cookie bridging.

**Presentation (App Router):**
- Purpose: Render pages, layouts, error/loading boundaries.
- Location: `src/app/`.
- Three route groups planned: `(marketing)` public landing, `(app)` authenticated dashboard, `(admin)` role-gated admin panel — currently empty scaffolds. The only realized routes today are `src/app/layout.tsx` and `src/app/page.tsx`.
- Server Components are the default. Layout-level auth gating (e.g., `(app)/layout.tsx` redirecting to `/login`) is the prescribed pattern per `.claude/skills/security/SKILL.md`.

**HTTP boundary (Route Handlers):**
- Purpose: Inbound webhooks (`/api/webhooks/yookassa`, `/api/webhooks/cloudpayments`, `/api/webhooks/kinescope`) and OAuth callbacks (`/api/auth/callback/[provider]`).
- Location: `src/app/api/<path>/route.ts` (directory exists, no handlers yet).
- Must verify HMAC signature, parse body, deduplicate via `webhook_events` table, and return `2xx` quickly.

**Server Actions (mutations):**
- Purpose: Form submissions and authenticated UI mutations.
- Location: `src/server/actions/<module>.ts`, each file begins with `'use server'`.
- Contract: Zod schema → `requireUser()`/`requireRole()` → Supabase write → `revalidatePath()` → return discriminated union `{ ok: true, ... } | { ok: false, error }`.

**Server Queries (reads):**
- Purpose: Typed reads for Server Components.
- Location: `src/server/queries/<module>.ts`.
- Naming verb-first: `getCourseBySlug`, `listSubmissionsByUser`, `findActivePromo`.
- Uses `Database['public']['Tables'][T]['Row']` types from `src/types/database.ts`.

**Lib / Wrappers:**
- Purpose: Encapsulate Supabase SSR clients, auth guards, external API clients, and shared utilities.
- Location: `src/lib/`.
- Submodules: `supabase/`, `auth/`, `kinescope/`, `yookassa/`, `unisender/` (only `supabase/`, `auth/`, and `utils.ts` are populated).

**Data layer (Supabase):**
- Purpose: Postgres tables, RLS policies, Auth, Storage.
- Migrations: `supabase/migrations/` (single file today: `20260522000001_init_base_tables.sql` creates `profiles`, `user_roles`, `courses`, `modules`, `lessons` with RLS + `handle_new_user` and `touch_updated_at` triggers).
- Seed: `supabase/seed.sql` populates demo courses/modules/lessons.
- Types: regenerated into `src/types/database.ts` via `npm run db:types`.

## Data Flow

### Read flow — Server Component renders DB data

1. Browser requests a route (e.g. `/courses`).
2. `src/middleware.ts` runs `updateSession()` → `supabase.auth.getUser()` rotates cookies via `request.cookies.set()` and `supabaseResponse.cookies.set()` (`src/lib/supabase/middleware.ts:16-23`).
3. App Router resolves the matching `page.tsx` (Server Component, e.g. would live at `src/app/(marketing)/courses/page.tsx`).
4. The page calls a query in `src/server/queries/<module>.ts`, which constructs a per-request server client via `createServerSupabase()` (`src/lib/supabase/server.ts:4`).
5. Supabase JS hits Postgres with the user's anon-keyed session cookie; RLS filters rows.
6. Query returns typed rows; the page renders them in the Server Component tree streamed to the browser.

### Write flow — Form submission via Server Action

1. Client Component (`'use client'`) form built with React Hook Form + `zodResolver` calls a Server Action from `src/server/actions/<module>.ts` inside `useTransition()`.
2. Action file starts with `'use server'`; runs `schema.safeParse(input)` and returns `{ ok: false, error }` on invalid input.
3. `requireUser()` (or `requireRole(...)`) from `src/lib/auth/require.ts` enforces auth/role; throws `UnauthorizedError` / `ForbiddenError` for system errors.
4. `createServerSupabase()` opens a per-request server client; performs `.insert(...)`/`.update(...)`/`.delete(...)`; errors are logged via `console.error` and returned as `{ ok: false, error: '<user-facing message>' }`.
5. `revalidatePath('/...')` or `revalidateTag(...)` invalidates cached Server Component output.
6. Client receives the discriminated union, shows a `sonner` toast, and may `router.push(...)`.

### Auth flow — login/session

1. User submits `/login` form → Server Action calls `supabase.auth.signInWithPassword(...)`.
2. Supabase sets `sb-*` cookies on the response.
3. On every subsequent request, `src/middleware.ts` → `updateSession()` calls `supabase.auth.getUser()`, which transparently refreshes the access token cookie when near expiry.
4. Protected route groups (e.g., `src/app/(app)/layout.tsx`) re-check via `createServerSupabase().auth.getUser()` and `redirect('/login')` if no user.
5. Role-gated routes (e.g., `src/app/(admin)/...`) additionally call `requireRole('admin', ...)` from `src/lib/auth/require.ts`, which queries `user_roles` and throws `ForbiddenError` if absent.

### Webhook flow — incoming payment event

1. Provider POSTs to `src/app/api/webhooks/<provider>/route.ts`.
2. Handler reads raw body, verifies HMAC signature from `x-<provider>-signature` header against `<PROVIDER>_SECRET_KEY` env var.
3. On valid signature, parse JSON, attempt insert into `webhook_events` keyed by `(provider, external_id)` — Postgres unique-violation (`code === '23505'`) means duplicate → return `200` with no work done.
4. Otherwise dispatch to handler logic (price lookup from DB by id — never trust client amounts), update `purchases`/`subscriptions`, write to `audit_log`.
5. Return `200` quickly; long-running work goes to background queue.

**State management:**
- Server data: TanStack Query v5 on the client (planned; package not yet installed), Server Components for first paint.
- Client UI state: Zustand stores in `src/stores/`.
- Form state: React Hook Form, schema-shared with Server Actions via Zod.

## Key Abstractions

**Supabase clients (three flavors):**
- Purpose: One client factory per execution context to keep cookies/keys correct.
- Files: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`.
- Pattern: All three use `@supabase/ssr`; only `server.ts` and `middleware.ts` bridge cookies. None imports `SUPABASE_SERVICE_ROLE_KEY` — that key, when added, must stay in server-only modules and never be imported transitively into Client Components.

**Auth guards (`requireUser` / `requireRole`):**
- Purpose: Centralized auth/role checks for Server Actions and queries.
- File: `src/lib/auth/require.ts`.
- Pattern: Throws `UnauthorizedError` / `ForbiddenError` (named subclasses of `Error`) — callers either let them propagate to Next.js error boundaries (Route Handlers translate to HTTP 401/403) or convert to `{ ok: false, error }` for Server Actions.

**Server Action result type:**
- Purpose: Uniform response shape for UI consumers.
- Pattern: Discriminated union `{ ok: true; ... } | { ok: false; error: string }` (documented in `.claude/skills/api-conventions/SKILL.md`).

**Zod schema as the contract:**
- Purpose: Single source of truth for input validation, reused between RHF resolver on the client and `safeParse` on the server.
- Pattern: `export const fooSchema = z.object({...})` and `export type FooInput = z.infer<typeof fooSchema>` co-located with the Server Action.

**Generated DB types:**
- Purpose: Typed reads/writes without hand-written models.
- File: `src/types/database.ts` (currently a stub; regenerated by `npm run db:types` after each migration).
- Pattern: `type Course = Database['public']['Tables']['courses']['Row']`.

## Entry Points

**`src/middleware.ts`:**
- Location: `src/middleware.ts`
- Triggers: Every request matching `'/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'`.
- Responsibilities: Refresh Supabase auth cookies via `updateSession()`.

**`src/app/layout.tsx` (root layout):**
- Location: `src/app/layout.tsx`
- Triggers: Every request to a page route.
- Responsibilities: Sets `<html lang="ru">`, Inter font (latin + cyrillic subsets), global metadata/viewport, mounts `<Toaster position="top-right" richColors />` from `sonner`, imports `globals.css`.

**`src/app/page.tsx` (`/`):**
- Location: `src/app/page.tsx`
- Triggers: GET `/`.
- Responsibilities: Static landing placeholder (Server Component) with links to `/courses` and `/program`.

**Planned route group entries (directories exist, files not yet authored):**
- `src/app/(marketing)/` — public landing pages (`/`, `/courses`, `/program`, `/pricing`, `/about`, ...).
- `src/app/(app)/` — authenticated dashboard; the group's `layout.tsx` is the auth gate (`redirect('/login')` if no user).
- `src/app/(admin)/` — admin/curator UI; layout calls `requireRole('admin', 'curator', 'content_manager')`.
- `src/app/api/` — Route Handlers (webhooks `/api/webhooks/<provider>/route.ts`, OAuth `/api/auth/callback/[provider]/route.ts`, signed-file delivery `/api/download/...`).

## Architectural Constraints

- **Threading:** Single Node.js event loop per request (Next.js App Router). No worker threads. Long jobs go to Supabase Edge Functions (planned at `supabase/functions/<name>/`).
- **Global state:** None at module scope. Supabase clients are instantiated per request inside factory functions — never cache them across requests (cookies would leak between users).
- **Service-role key:** `SUPABASE_SERVICE_ROLE_KEY` must only appear in modules that never reach the client bundle (Server Actions, Route Handlers, Edge Functions). It is not yet imported anywhere in code. Any future helper that uses it must be co-located with server-only code and never re-exported from a Client Component file.
- **`NEXT_PUBLIC_` boundary:** Only env vars prefixed `NEXT_PUBLIC_` are bundled into the client. The `.env.example` clearly separates server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `YOOKASSA_SECRET_KEY`, `KINESCOPE_API_TOKEN`, `UNISENDER_API_KEY`, `*_OAUTH_CLIENT_SECRET`, `YANDEX_CAPTCHA_SERVER_KEY`, `TELEGRAM_BOT_TOKEN`, `SENTRY_DSN`) from public ones (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, analytics IDs).
- **Server Actions body limit:** Raised to `5mb` in `next.config.js` (`experimental.serverActions.bodySizeLimit`). Anything larger must use Supabase Storage signed-URL uploads directly from the client.
- **Image domains:** Only `*.supabase.co` and `*.kinescope.io` are allowed in `next.config.js` → `images.remotePatterns`. Add a new entry there before using `<Image src="https://other-host/...">`.
- **Security headers:** `next.config.js` sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` on every response.
- **TypeScript strictness:** `tsconfig.json` enables `strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `isolatedModules`. No `any` / `// @ts-ignore` without a ticket reference (rule 6 in `.claude/skills/videoedit-academy/SKILL.md`).
- **Path alias:** `@/*` → `./src/*` (configured in `tsconfig.json` and mirrored in `vitest.config.ts`). Relative `../../...` imports are forbidden by convention.
- **Circular imports:** None observed in the current minimal codebase.

## Anti-Patterns

### Inline Supabase queries in pages/components

**What happens:** A Server Component imports `createServerSupabase` and runs `supabase.from('...').select('...')` directly in its body.
**Why it's wrong:** Couples rendering to data fetching, makes the query untestable in isolation, and bypasses the naming/typing conventions for queries.
**Do this instead:** Define `getThing()` in `src/server/queries/<module>.ts` (verb-first name, typed via `Database['public']['Tables'][...]['Row']`) and call it from the page. Example contract documented in `.claude/skills/api-conventions/SKILL.md`.

### Trusting client-provided prices or roles

**What happens:** A Server Action accepts `{ planId, amount }` from the form and forwards `amount` to YooKassa, or reads `role` from a hidden form field.
**Why it's wrong:** A user can edit the form payload and pay 1₽ for any plan, or escalate to admin.
**Do this instead:** Accept only `planId` (or `userId`), look up `price` / role server-side from Postgres. See rule 5 in `.claude/skills/videoedit-academy/SKILL.md` and `.claude/skills/security/SKILL.md` section 4.

### Bare-string `throw` for business errors in Server Actions

**What happens:** A Server Action throws `new Error('Тариф не найден')` for an expected business condition.
**Why it's wrong:** Next.js converts the throw into a generic error boundary; the form can't show the message; logs fill with non-errors.
**Do this instead:** `return { ok: false, error: 'Тариф не найден' }`. Reserve `throw` for system failures (`UnauthorizedError`, `ForbiddenError`, DB outage).

### Calling external APIs from components or Actions directly

**What happens:** A Server Action `fetch`es `https://api.yookassa.ru/v3/payments` inline.
**Why it's wrong:** Duplicates auth headers, timeouts, idempotency-key handling, and retry logic across call sites; impossible to mock cleanly in tests.
**Do this instead:** Add a wrapper in `src/lib/<service>/client.ts` with `AbortSignal.timeout(5000)`, `Idempotence-Key`, and centralized error handling.

### Disabling RLS on a public table for convenience

**What happens:** A developer runs `ALTER TABLE foo DISABLE ROW LEVEL SECURITY` to "make a query work".
**Why it's wrong:** Any authenticated client can now read/write every row.
**Do this instead:** Use the service-role key in a server-only module to bypass RLS for legitimate admin tasks. Never disable RLS on tables the browser touches.

### Using `<img>` instead of `next/image`

**What happens:** Direct `<img src={...}>` for course covers or avatars.
**Why it's wrong:** No optimization, no lazy loading, no responsive `srcset`, and external hosts aren't validated.
**Do this instead:** `import Image from 'next/image'` and add the host to `next.config.js` → `images.remotePatterns`.

## Error Handling

**Strategy:** Two-tier — system errors throw, business errors return.

**Patterns:**
- Server Actions return `{ ok: true, ... } | { ok: false, error }` for predictable failures (validation, "not found", "already exists"). Client checks `result.ok` and shows `toast.error(result.error)` via `sonner`.
- `requireUser()` / `requireRole(...)` throw `UnauthorizedError` / `ForbiddenError` (`src/lib/auth/require.ts:3-15`); Route Handlers catch and map to 401/403, Server Actions propagate to a route-level `error.tsx` boundary.
- Route Handlers log with `console.error` and return `NextResponse.json({ error: '...' }, { status })`. `dynamic = 'force-dynamic'` is used to prevent caching of dynamic webhook responses.
- Page-level errors live in `src/app/**/error.tsx` (Client Component with `reset()` button) — pattern documented in `.claude/skills/ui-conventions/SKILL.md`.
- Sentry is planned (`SENTRY_DSN` env vars exist in `.env.example`); not yet wired up.

## Cross-Cutting Concerns

**Logging:**
- Allowed in code: `console.error` and `console.warn` only (ESLint rule: `"no-console": ["warn", { "allow": ["error", "warn"] }]` in `.eslintrc.json`).
- Sensitive data (passwords, tokens, full card numbers, session cookies) must never appear in logs.
- Audit log table for admin/curator actions is planned (schema in `.claude/skills/security/SKILL.md` section 6).

**Validation:**
- All inbound data (Server Actions, Route Handler bodies) validated with Zod via `schema.safeParse(input)`. Error messages are in Russian for direct user display.
- Schemas are exported alongside the Action and reused on the client through `zodResolver` from `@hookform/resolvers`.

**Authentication:**
- Supabase Auth via `httpOnly` cookies, refreshed by `src/middleware.ts`.
- Server-side checks via `requireUser()` in every Action/Query that touches user data.
- Layout-level redirects (`(app)/layout.tsx`, `(admin)/layout.tsx`) are the first gate before any page in a protected group renders.

**Authorization:**
- Two layers: (1) `requireRole(...)` in server code, (2) Postgres RLS policies on every table accessed by the browser. The first migration (`supabase/migrations/20260522000001_init_base_tables.sql`) enables RLS on `profiles`, `user_roles`, `courses`, `modules`, `lessons` with explicit policies.

**Caching / Revalidation:**
- App Router's default Server Component caching is in effect. Mutations call `revalidatePath('/...')` or `revalidateTag(...)` from `next/cache` to invalidate downstream pages.

**Internationalization:**
- Single locale: `ru-RU`. Root `<html lang="ru">`, Inter font loaded with `subsets: ['latin', 'cyrillic']`, `formatPrice` uses `Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' })` (`src/lib/utils.ts:8-14`).

---

*Architecture analysis: 2026-05-23*
