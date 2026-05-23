# Codebase Structure

**Analysis Date:** 2026-05-23

## Directory Layout

```
repo/
├── .claude/
│   └── skills/                         # Claude Code project skills (read before coding)
│       ├── README.md
│       ├── videoedit-academy/SKILL.md  # Master skill — project rules + stack
│       ├── api-conventions/SKILL.md    # Server Actions, Route Handlers, queries
│       ├── database/SKILL.md           # Migrations, RLS, queries
│       ├── security/SKILL.md           # Secrets, auth, payments, 152-ФЗ
│       ├── testing/SKILL.md            # Vitest, Testing Library, Playwright
│       ├── ui-conventions/SKILL.md     # Server/Client Components, Tailwind, shadcn
│       └── workflow/SKILL.md           # Plan → approve → implement cycle
├── .planning/
│   └── codebase/                       # GSD codebase maps (this directory)
├── .vscode/
│   ├── extensions.json                 # Recommended VS Code extensions
│   └── settings.json                   # Workspace settings
├── docs/
│   └── ТЗ_VideoEdit_Academy.docx       # Full product spec (Russian)
├── node_modules/                       # Installed npm packages (gitignored)
├── public/
│   ├── manifest.json                   # PWA manifest (name, icons, theme)
│   └── robots.txt                      # Allow /, disallow /api/ and /admin/
├── src/
│   ├── app/                            # Next.js App Router root
│   │   ├── (admin)/                    # Admin/curator panel route group (empty)
│   │   ├── (app)/                      # Authenticated dashboard route group (empty)
│   │   ├── (marketing)/                # Public landing route group (empty)
│   │   ├── api/                        # Route Handlers (webhooks, OAuth) (empty)
│   │   ├── globals.css                 # Tailwind layers + shadcn CSS variables
│   │   ├── layout.tsx                  # Root <html>/<body>, fonts, Toaster
│   │   └── page.tsx                    # Home page placeholder ('/')
│   ├── components/
│   │   ├── admin/                      # Admin-panel feature components (empty)
│   │   ├── lessons/                    # Lesson player, lists, navigation (empty)
│   │   ├── marketing/                  # Hero, pricing, FAQ, footer (empty)
│   │   ├── shared/                     # Cross-feature reusable widgets (empty)
│   │   └── ui/                         # shadcn/ui primitives (Button, Input...) (empty)
│   ├── hooks/                          # Reusable React hooks (empty)
│   ├── lib/
│   │   ├── auth/
│   │   │   └── require.ts              # requireUser, requireRole + error classes
│   │   ├── kinescope/                  # Kinescope API wrapper (empty)
│   │   ├── supabase/
│   │   │   ├── client.ts               # createBrowserSupabase()
│   │   │   ├── middleware.ts           # updateSession() for edge middleware
│   │   │   └── server.ts               # createServerSupabase() with cookies
│   │   ├── unisender/                  # Unisender email wrapper (empty)
│   │   ├── yookassa/                   # YooKassa payments wrapper (empty)
│   │   ├── utils.test.ts               # Vitest tests for cn / formatPrice
│   │   └── utils.ts                    # cn() Tailwind merge + formatPrice() (RUB)
│   ├── middleware.ts                   # Next.js edge middleware → updateSession
│   ├── server/
│   │   ├── actions/                    # Server Actions ('use server') (empty)
│   │   └── queries/                    # Server Queries for Server Components (empty)
│   ├── stores/                         # Zustand client stores (empty)
│   └── types/
│       └── database.ts                 # Generated Supabase TS types (stub)
├── supabase/
│   ├── migrations/
│   │   └── 20260522000001_init_base_tables.sql   # profiles, roles, courses, modules, lessons + RLS
│   └── seed.sql                        # Demo courses / modules / lessons
├── tests/
│   ├── e2e/                            # Playwright specs (empty)
│   ├── integration/                    # Vitest integration suite (empty)
│   └── unit/
│       └── setup.ts                    # jest-dom matchers + cleanup()
├── .env.example                        # Env var template (no values)
├── .eslintrc.json                      # next/core-web-vitals + prettier + custom rules
├── .gitignore                          # Node, Next.js, env, Supabase, VS Code
├── .prettierrc.json                    # 100-col, single quotes, semi, trailing commas
├── README.md                           # Project overview + bootstrap steps (Russian)
├── next.config.js                      # Image domains, server-action body limit, security headers
├── package-lock.json
├── package.json                        # Scripts, deps (Next 14.2.15, React 18, Supabase, Zustand, Zod)
├── playwright.config.ts                # E2E config, chromium + mobile-chrome projects
├── postcss.config.js                   # Tailwind + autoprefixer
├── tailwind.config.ts                  # shadcn theme tokens (CSS vars), container, animate plugin
├── tsconfig.json                       # strict + noUncheckedIndexedAccess + @/* alias
└── vitest.config.ts                    # jsdom, globals, @/ alias, excludes e2e/integration
```

## Directory Purposes

**`.claude/skills/`:**
- Purpose: Project-specific skill files Claude reads before performing tasks.
- Contains: One subdirectory per topic (`videoedit-academy` is the master entry point, others are focused sub-skills).
- Key files: `videoedit-academy/SKILL.md` (rules + stack), `api-conventions/SKILL.md`, `database/SKILL.md`, `security/SKILL.md`, `ui-conventions/SKILL.md`, `testing/SKILL.md`, `workflow/SKILL.md`.

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents (STACK, INTEGRATIONS, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, CONCERNS).
- Contains: Markdown maps consumed by `/gsd:plan-phase` and `/gsd:execute-phase`.

**`.vscode/`:**
- Purpose: Editor configuration shared with the team.
- Contains: `extensions.json` (recommended extensions), `settings.json` (workspace settings). Both are explicitly un-ignored in `.gitignore`.

**`docs/`:**
- Purpose: Product documentation outside the codebase.
- Contains: `ТЗ_VideoEdit_Academy.docx` — full Russian technical spec (referenced as the source of truth for sprint planning in `README.md`).

**`public/`:**
- Purpose: Static assets served at the site root.
- Contains: `manifest.json` (PWA), `robots.txt`. Image icons (`favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) are referenced by `src/app/layout.tsx` and `public/manifest.json` but not yet committed.

**`src/app/`:**
- Purpose: Next.js 14 App Router root — every URL maps to a folder under here.
- Contains: Route group directories `(marketing)`, `(app)`, `(admin)`, the `api/` Route Handler tree, the root `layout.tsx`/`page.tsx`, and `globals.css`.
- Key files: `src/app/layout.tsx` (root layout with Inter cyrillic font + `<Toaster>`), `src/app/page.tsx` (home), `src/app/globals.css` (Tailwind + shadcn CSS variables).
- Route group convention: parenthesized names do not appear in URLs — `(marketing)/about/page.tsx` becomes `/about`.

**`src/app/(marketing)/`:**
- Purpose: Public, unauthenticated landing pages.
- Contains: Hero, pricing, FAQ, courses catalogue, about, legal pages. Currently empty.

**`src/app/(app)/`:**
- Purpose: Authenticated user dashboard ("личный кабинет").
- Contains: `layout.tsx` (planned — auth gate that redirects to `/login` when no session), course/lesson/submission pages, profile. Currently empty.

**`src/app/(admin)/`:**
- Purpose: Admin/curator/content-manager panel, role-gated.
- Contains: `layout.tsx` (planned — calls `requireRole('admin', 'curator', 'content_manager')`), submission review queues, course CMS. Currently empty.

**`src/app/api/`:**
- Purpose: Route Handlers (`route.ts` files) for webhooks, OAuth callbacks, and signed-file downloads. The only place "REST-style" endpoints live.
- Contains: planned `webhooks/yookassa/route.ts`, `webhooks/cloudpayments/route.ts`, `webhooks/kinescope/route.ts`, `auth/callback/[provider]/route.ts`, `download/submission/[id]/route.ts`. Currently empty.

**`src/components/ui/`:**
- Purpose: shadcn/ui primitive components (Button, Input, Form, Dialog, Dropdown, Card, Skeleton, etc.).
- Convention: Generated via `npx shadcn-ui@latest add <name>` — never written by hand. Currently empty (shadcn not yet initialized).

**`src/components/{marketing,lessons,admin,shared}/`:**
- Purpose: Feature-scoped React components.
- Naming: `marketing/` for landing widgets, `lessons/` for player/list/navigation, `admin/` for admin-panel UI, `shared/` for cross-feature reusables.
- One-off components used by a single page should live next to that page (e.g., `src/app/(app)/profile/components/AvatarUploader.tsx`), not here.

**`src/hooks/`:**
- Purpose: Reusable React hooks (`useXxx.ts`).
- Naming: `camelCase.ts`, hook name prefixed with `use`.

**`src/lib/`:**
- Purpose: Framework-agnostic utilities, Supabase clients, auth guards, external API wrappers.
- Submodules:
  - `auth/` — server-side auth helpers (`require.ts` is the only file).
  - `supabase/` — three client factories (`server.ts`, `client.ts`, `middleware.ts`).
  - `kinescope/`, `yookassa/`, `unisender/` — external API wrappers (empty scaffolds; each will hold `client.ts`, signature/verify helpers, types).
  - `utils.ts` + `utils.test.ts` at the root for general helpers (`cn`, `formatPrice`).

**`src/middleware.ts`:**
- Purpose: Next.js edge middleware — runs on every matching request before any route resolves.
- Matcher: excludes `_next/static`, `_next/image`, `favicon.ico`, `manifest.json`, and image asset paths.

**`src/server/actions/`:**
- Purpose: Server Actions for form mutations.
- File-per-module convention: `src/server/actions/auth.ts`, `src/server/actions/submissions.ts`, `src/server/actions/payments.ts`. Each begins with `'use server'`.

**`src/server/queries/`:**
- Purpose: Typed read queries for Server Components.
- File-per-module convention mirrors `actions/`: `src/server/queries/courses.ts`, `src/server/queries/lessons.ts`, etc.

**`src/stores/`:**
- Purpose: Zustand client-side stores.
- Naming: `camelCase.ts` (e.g., `playerStore.ts`, `uiStore.ts`).

**`src/types/`:**
- Purpose: Shared TypeScript types.
- Key files: `database.ts` — regenerated by `npm run db:types`, do not edit by hand.

**`supabase/`:**
- Purpose: Supabase CLI workspace.
- Contains: `migrations/` (versioned SQL, forward-only), `seed.sql` (local dev fixtures).
- Planned: `supabase/functions/<name>/` for Edge Functions (cron, long-running jobs) per `.claude/skills/api-conventions/SKILL.md`.

**`tests/`:**
- Purpose: Tests not co-located with source.
- `tests/unit/setup.ts` — Vitest global setup (jest-dom matchers + Testing Library cleanup).
- `tests/integration/` — integration tests against a test Supabase instance (separate Vitest config `vitest.integration.config.ts` referenced in `package.json`, file not yet present).
- `tests/e2e/` — Playwright specs.
- Note: Unit tests for code in `src/` live next to the source file (e.g., `src/lib/utils.test.ts`), not in `tests/unit/`. The `tests/unit/` directory currently holds only the shared setup.

## Key File Locations

**Entry Points:**
- `src/middleware.ts`: Edge middleware refreshing Supabase session on every request.
- `src/app/layout.tsx`: Root layout, fonts, global toaster.
- `src/app/page.tsx`: Home route (`/`).

**Configuration:**
- `next.config.js`: React strict mode, image domains (`*.supabase.co`, `*.kinescope.io`), `serverActions.bodySizeLimit: 5mb`, security headers (X-Frame-Options DENY, HSTS, etc.).
- `tsconfig.json`: Strict mode, `@/* → ./src/*`, `noUncheckedIndexedAccess`.
- `tailwind.config.ts`: Content globs `./src/app/**/*.{ts,tsx}` and `./src/components/**/*.{ts,tsx}`, shadcn CSS-variable color tokens, `tailwindcss-animate` plugin.
- `postcss.config.js`: Tailwind + autoprefixer.
- `vitest.config.ts`: jsdom, globals on, `@/` alias, excludes `tests/e2e/` and `tests/integration/`.
- `playwright.config.ts`: `tests/e2e/` dir, `chromium` + `mobile-chrome` projects, auto-launches `npm run dev` outside CI.
- `.eslintrc.json`: `next/core-web-vitals` + `prettier`, `no-console` (allow `error`/`warn`), unused-vars with `_` prefix.
- `.prettierrc.json`: 100-col, semis, single quotes, trailing commas, `prettier-plugin-tailwindcss`.
- `.env.example`: Names and descriptions for all required env vars (no values).
- `.gitignore`: Excludes `.env*` (except `.env.example`), `node_modules`, `.next`, `coverage`, `playwright-report`, `supabase/.branches`, `supabase/.temp`, `supabase/.env`.

**Core Logic:**
- `src/lib/supabase/server.ts`: `createServerSupabase()` — for Server Components, Actions, Queries.
- `src/lib/supabase/client.ts`: `createBrowserSupabase()` — for Client Components.
- `src/lib/supabase/middleware.ts`: `updateSession()` — used by `src/middleware.ts`.
- `src/lib/auth/require.ts`: `requireUser`, `requireRole`, `UnauthorizedError`, `ForbiddenError`.
- `src/lib/utils.ts`: `cn()` (clsx + tailwind-merge), `formatPrice()` (RUB).
- `src/types/database.ts`: Generated Supabase types (stub — populated by `npm run db:types`).

**Database:**
- `supabase/migrations/20260522000001_init_base_tables.sql`: First migration — `profiles`, `user_roles` (enum `admin`/`curator`/`content_manager`), `courses`, `modules`, `lessons`, RLS policies, `handle_new_user` trigger on `auth.users`, `touch_updated_at` trigger function.
- `supabase/seed.sql`: Three demo courses, modules for "basics", lessons for "Введение в DaVinci Resolve".

**Testing:**
- `tests/unit/setup.ts`: Imports `@testing-library/jest-dom/vitest`, registers `afterEach(cleanup)`.
- `src/lib/utils.test.ts`: Sample co-located test for `formatPrice` / `cn`.

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `VideoPlayer.tsx`, `SubmitAssignmentForm.tsx`).
- Hooks: `camelCase.ts` starting with `use` (e.g., `useLessonProgress.ts`).
- Utilities, server actions, queries, stores, libs: `camelCase.ts` (e.g., `formatPrice.ts`, `submissions.ts`, `playerStore.ts`).
- Route files (App Router): lowercase reserved names — `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`, `template.tsx`.
- Tests: co-located `Foo.test.ts` / `Foo.test.tsx` next to source for unit/component; integration uses `*.integration.test.ts`.
- SQL migrations: `YYYYMMDDHHMMSS_short_snake_case_description.sql` (UTC timestamp prefix; e.g., `20260522000001_init_base_tables.sql`).
- Config files at repo root: lowercase with dot/dash separators (`next.config.js`, `tsconfig.json`, `tailwind.config.ts`, `.eslintrc.json`).

**Directories:**
- App Router route groups: `(group-name)` parenthesized lowercase — e.g., `(marketing)`, `(app)`, `(admin)` (excluded from URL).
- Dynamic segments: `[param]` (e.g., `[provider]`, `[id]`); catch-all `[...slug]`.
- Feature/module directories under `src/components/` and `src/server/`: lowercase (`lessons`, `admin`, `marketing`, `shared`, `actions`, `queries`).
- Lib submodules: lowercase service name (`supabase`, `auth`, `kinescope`, `yookassa`, `unisender`).

**Exports:**
- Named exports only — never `export default` (except for App Router files where Next.js requires `default`: `page.tsx`, `layout.tsx`, `error.tsx`, `loading.tsx`, `not-found.tsx`, and `middleware.ts`).

## Where to Add New Code

**New marketing/public page:**
- Page: `src/app/(marketing)/<segment>/page.tsx` (Server Component).
- Page-only components: `src/app/(marketing)/<segment>/components/<Name>.tsx`.
- Reusable marketing widgets: `src/components/marketing/<Name>.tsx`.

**New authenticated dashboard page:**
- Page: `src/app/(app)/<segment>/page.tsx`.
- Group layout (auth gate): `src/app/(app)/layout.tsx` — must redirect to `/login` when `createServerSupabase().auth.getUser()` returns no user.
- Module components: `src/components/lessons/<Name>.tsx` (or another feature folder).

**New admin page:**
- Page: `src/app/(admin)/<segment>/page.tsx`.
- Group layout (role gate): `src/app/(admin)/layout.tsx` — must `await requireRole('admin', 'curator', 'content_manager')`.
- Admin-only UI: `src/components/admin/<Name>.tsx`.

**New Server Action (form mutation):**
- File: `src/server/actions/<module>.ts` (one file per business module: `auth`, `payments`, `submissions`, `courses`, ...).
- Must begin with `'use server'`. Export the Zod schema, the `Input` type, and the action function.
- Pattern: parse → `requireUser`/`requireRole` → Supabase write → `revalidatePath` → return `{ ok: true | false }`.

**New Server Query (read for Server Component):**
- File: `src/server/queries/<module>.ts`.
- Function naming: verb-first (`getCourseBySlug`, `listSubmissionsByUser`, `findActivePromo`).
- Use generated types: `type Course = Database['public']['Tables']['courses']['Row']`.

**New webhook or OAuth callback:**
- File: `src/app/api/webhooks/<provider>/route.ts` or `src/app/api/auth/callback/[provider]/route.ts`.
- Always export `POST` (or `GET`) async function returning `NextResponse`. Add `export const dynamic = 'force-dynamic'` to prevent caching.
- Verify HMAC signature first. Insert into `webhook_events` for idempotency (unique-violation `23505` → return 200).

**New shadcn primitive:**
- Run `npx shadcn-ui@latest add <component>` — places the file under `src/components/ui/<component>.tsx`. Do not edit by hand unless replacing the primitive entirely.

**New reusable component (used in multiple features):**
- File: `src/components/shared/<Name>.tsx` (`PascalCase`, named export, props via `interface`).
- Accept optional `className?: string` and merge via `cn()` from `src/lib/utils.ts`.

**New feature component (one feature only):**
- File: `src/components/<feature>/<Name>.tsx` where `<feature>` ∈ `{lessons, admin, marketing}`.

**New page-local component (one page only):**
- File: `src/app/(group)/<segment>/components/<Name>.tsx` (co-located with the page).

**New React hook:**
- File: `src/hooks/useXxx.ts`. Named export `useXxx`.

**New Zustand store:**
- File: `src/stores/<name>Store.ts`. Named export of the store hook (`useXxxStore`).

**New Zod schema:**
- Co-locate with the Server Action that consumes it (in the same file as the action under `src/server/actions/<module>.ts`).
- If reused across multiple actions, extract to `src/server/actions/schemas/<module>.ts` (pattern referenced in `.claude/skills/api-conventions/SKILL.md`).

**New DB type:**
- Do not write by hand. Add the migration in `supabase/migrations/`, run `supabase db push` then `npm run db:types`. The generated types land in `src/types/database.ts`.

**New external API wrapper:**
- Directory: `src/lib/<service>/`. Typical files: `client.ts` (raw HTTP), `verify.ts` (signature checks), `types.ts` (request/response shapes).
- Always set `AbortSignal.timeout(5000)`. Use `Idempotence-Key` headers for mutations where the provider supports it. Read secrets only from `process.env`.

**New migration:**
- File: `supabase/migrations/YYYYMMDDHHMMSS_<verb>_<what>.sql` (UTC timestamp from `date -u +%Y%m%d%H%M%S`).
- Include RLS `ENABLE` and policies in the same file as the `CREATE TABLE`. Forward-only — never edit applied migrations.
- After applying, regenerate types: `npm run db:types`.

**New Edge Function (long-running / cron):**
- Directory: `supabase/functions/<name>/` (not present yet; documented in `.claude/skills/api-conventions/SKILL.md`).

**New unit test:**
- Co-locate next to source: `src/lib/billing/calculateUpgrade.test.ts` next to `src/lib/billing/calculateUpgrade.ts`. Suite descriptions in Russian.

**New integration test (Server Action against test Supabase):**
- File: `src/server/actions/<module>.integration.test.ts` (excluded from default Vitest run; covered by `npm run test:integration` → `vitest.integration.config.ts`, config file to be added).

**New E2E test:**
- File: `tests/e2e/<scenario>.spec.ts`. Generate unique emails with `tests/e2e/helpers/email.ts` to keep runs isolated.

**New env variable:**
- Add the name (no value) with a comment to `.env.example`.
- Server-only secrets: no `NEXT_PUBLIC_` prefix.
- Client-readable values: prefix with `NEXT_PUBLIC_`.
- Document in `.claude/skills/security/SKILL.md` section 1 if it carries sensitive data.

**New public asset:**
- Place under `public/` and reference via root-relative path (`/icon-192.png`). Update `public/manifest.json` if it's a PWA icon.

## Special Directories

**`node_modules/`:**
- Purpose: Installed npm packages.
- Generated: Yes (`npm install`).
- Committed: No (gitignored).

**`.next/`:**
- Purpose: Next.js build output and dev cache.
- Generated: Yes (`next dev`, `next build`).
- Committed: No (gitignored).

**`coverage/`, `playwright-report/`, `test-results/`, `playwright/.cache/`:**
- Purpose: Test artifacts.
- Generated: Yes (test runs).
- Committed: No (gitignored).

**`supabase/.branches/`, `supabase/.temp/`, `supabase/.env`:**
- Purpose: Supabase CLI local state and per-developer env.
- Generated: Yes (Supabase CLI).
- Committed: No (gitignored).

**`.vscode/`:**
- Purpose: Editor configuration.
- Generated: No.
- Committed: Selectively — `extensions.json` and `settings.json` are explicitly allowed via `!.vscode/...` in `.gitignore`; other files are ignored.

**`src/app/api/`:**
- Purpose: Only Route Handlers live here, never UI pages. The directory is treated as a hard boundary between server-side HTTP endpoints and the React-rendered app.

**Route groups `(marketing)` / `(app)` / `(admin)`:**
- Purpose: Layout/auth scoping without affecting URLs.
- The group's `layout.tsx` is the single enforcement point for that group's auth/role policy.

---

*Structure analysis: 2026-05-23*
