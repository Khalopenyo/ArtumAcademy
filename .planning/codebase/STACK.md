# Technology Stack

**Analysis Date:** 2026-05-23

## Languages

**Primary:**
- TypeScript ^5.6.2 — All application code under `src/` (`.ts`, `.tsx`); strict mode enabled in `tsconfig.json`
- SQL (PostgreSQL dialect) — Supabase migrations under `supabase/migrations/` and `supabase/seed.sql`

**Secondary:**
- JavaScript — Build/runtime configs only (`next.config.js`, `postcss.config.js`)
- CSS — Tailwind entry at `src/app/globals.css`

## Runtime

**Environment:**
- Node.js >= 20.0.0 (declared in `package.json` `engines` field)
- Next.js 14.2.15 dev/build runtime (App Router; React Server Components + Server Actions)
- Browser target: ES2022 (per `tsconfig.json` `target`)

**Package Manager:**
- npm (lockfile `package-lock.json` is present at repo root, 401KB)
- No alternative lockfiles (no `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`)

## Frameworks

**Core:**
- `next` 14.2.15 — Full-stack framework (App Router under `src/app/`, Server Actions enabled in `next.config.js` with `bodySizeLimit: '5mb'`)
- `react` ^18.3.1 / `react-dom` ^18.3.1 — UI runtime
- `tailwindcss` ^3.4.13 — Utility-first styling, configured in `tailwind.config.ts` (dark mode via `class`, container max-width `1400px`)

**Testing:**
- `vitest` ^2.1.2 — Unit test runner, configured in `vitest.config.ts` (jsdom environment, `tests/unit/setup.ts` for `@testing-library/jest-dom/vitest`)
- `@vitest/coverage-v8` ^2.1.2 — Coverage provider
- `@testing-library/react` ^16.0.1 / `@testing-library/jest-dom` ^6.5.0 / `@testing-library/user-event` ^14.5.2 — Component testing
- `@playwright/test` ^1.48.0 — End-to-end tests, configured in `playwright.config.ts` (`chromium` + `mobile-chrome` projects, baseURL `http://localhost:3000`, `webServer` runs `npm run dev` outside CI)
- `jsdom` ^25.0.1 — DOM implementation for Vitest

**Build/Dev:**
- `typescript` ^5.6.2 — Type checking only (`noEmit: true` in `tsconfig.json`)
- `eslint` ^8.57.1 with `eslint-config-next` 14.2.15 and `eslint-config-prettier` ^9.1.0 — Linting via `.eslintrc.json`
- `prettier` ^3.3.3 with `prettier-plugin-tailwindcss` ^0.6.8 — Formatting via `.prettierrc.json`
- `postcss` ^8.4.47 + `autoprefixer` ^10.4.20 — CSS pipeline (see `postcss.config.js`)
- `husky` ^9.1.6 + `lint-staged` ^15.2.10 — Pre-commit hooks; `lint-staged` config inline in `package.json` (`*.{ts,tsx,js,jsx}` → eslint+prettier, `*.{json,md,css}` → prettier)
- `@vitejs/plugin-react` ^4.3.2 — React JSX transform for Vitest
- `supabase` ^1.200.3 — Supabase CLI (dev dependency, used for migrations and codegen)

## Key Dependencies

**UI primitives & styling:**
- `@radix-ui/react-dialog` ^1.1.2, `@radix-ui/react-dropdown-menu` ^2.1.2, `@radix-ui/react-label` ^2.1.0, `@radix-ui/react-slot` ^1.1.0 — Headless primitives used by shadcn/ui
- `lucide-react` ^0.451.0 — Icon set
- `class-variance-authority` ^0.7.0 — Variant API for component styles
- `clsx` ^2.1.1 + `tailwind-merge` ^2.5.3 — Combined in `src/lib/utils.ts` as `cn()`
- `tailwindcss-animate` ^1.0.7 — Animation utilities (loaded in `tailwind.config.ts` plugins)
- `sonner` ^1.5.0 — Toast notifications (mounted in `src/app/layout.tsx`)
- `framer-motion` ^11.11.1 — Animations

**Data & state:**
- `@supabase/supabase-js` ^2.45.4 — Supabase JS SDK
- `@supabase/ssr` ^0.5.1 — Cookie-aware Supabase clients for App Router (used in `src/lib/supabase/*.ts`)
- `@tanstack/react-query` ^5.59.0 — Server-state cache on the client
- `zustand` ^4.5.5 — Client-side state stores (target dir `src/stores/`)

**Forms & validation:**
- `react-hook-form` ^7.53.0 — Form state
- `@hookform/resolvers` ^3.9.0 — Schema-resolver bridge
- `zod` ^3.23.8 — Schema validation (used for Server Action input + form schemas)

## Configuration

**TypeScript (`tsconfig.json`):**
- `target: ES2022`, `lib: ["dom", "dom.iterable", "esnext"]`
- `strict: true`, plus extra strictness: `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`
- `module: esnext`, `moduleResolution: bundler`, `jsx: preserve`, `noEmit: true`, `incremental: true`
- Path alias: `@/*` → `./src/*` (also mirrored in `vitest.config.ts` via `resolve.alias`)
- `plugins: [{ name: 'next' }]` enables Next.js TS plugin

**ESLint (`.eslintrc.json`):**
- Extends `next/core-web-vitals` + `prettier`
- Rules: `@typescript-eslint/no-unused-vars` error with `argsIgnorePattern: ^_`; `no-console` warn (only `console.error` / `console.warn` allowed); `react/no-unescaped-entities` off

**Prettier (`.prettierrc.json`):**
- `semi: true`, `singleQuote: true`, `trailingComma: all`, `tabWidth: 2`, `printWidth: 100`
- Plugins: `prettier-plugin-tailwindcss` (auto class sorting)

**Tailwind (`tailwind.config.ts`):**
- `darkMode: ['class']`
- Content globs: `./src/app/**/*.{ts,tsx}`, `./src/components/**/*.{ts,tsx}`
- Theme tokens read from CSS variables (`hsl(var(--*))`) defined in `src/app/globals.css` — shadcn/ui color system (`border`, `input`, `ring`, `background`, `foreground`, `primary`, `secondary`, `destructive`, `muted`, `accent`, `popover`, `card`)
- Container centered, `2xl` breakpoint at `1400px`
- Border-radius mapped to `--radius` token
- Plugins: `tailwindcss-animate`

**Next.js (`next.config.js`):**
- `reactStrictMode: true`, `poweredByHeader: false`
- `images.remotePatterns` whitelists `*.supabase.co` and `*.kinescope.io`
- `experimental.serverActions.bodySizeLimit: '5mb'`
- Global security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

**PostCSS (`postcss.config.js`):**
- Plugins: `tailwindcss`, `autoprefixer`

**Vitest (`vitest.config.ts`):**
- `environment: jsdom`, `globals: true`
- `setupFiles: ['./tests/unit/setup.ts']` (registers jest-dom matchers + `cleanup()` `afterEach`)
- `exclude`: `node_modules`, `.next`, `tests/e2e`, `tests/integration`
- Alias: `@` → `./src`

**Playwright (`playwright.config.ts`):**
- `testDir: ./tests/e2e`, timeout 30s, `fullyParallel: true`
- CI: `forbidOnly`, `retries: 2`, `workers: 1`, reporter `github`; local: reporter `html`
- Projects: `chromium` (Desktop Chrome), `mobile-chrome` (Pixel 5)
- `webServer` (local only): `npm run dev` on `http://localhost:3000`, reuse existing, 120s startup timeout
- `trace: on-first-retry`, `screenshot: only-on-failure`
- `baseURL` overridable via `PLAYWRIGHT_BASE_URL` env

**Environment:**
- Required at runtime: see `.env.example` (Supabase, ЮKassa, Kinescope, Unisender, Yandex/VK OAuth, SmartCaptcha, Telegram, Sentry, analytics, `NEXT_PUBLIC_APP_URL`)
- `.env`, `.env.local`, `.env.*.local` git-ignored (`.gitignore`)
- Local dev expected to use `.env.local` copied from `.env.example`

**VS Code (`/.vscode/`):**
- `settings.json` and `extensions.json` present (committed via `.gitignore` allowlist)

**Editor:**
- No `.editorconfig` detected; formatting governed by Prettier

## Scripts (`package.json`)

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Local dev server on port 3000 |
| `build` | `next build` | Production build |
| `start` | `next start` | Run production build |
| `lint` | `next lint` | ESLint via Next wrapper |
| `lint:fix` | `next lint --fix` | ESLint with autofix |
| `typecheck` | `tsc --noEmit` | TypeScript type check |
| `format` | `prettier --write "src/**/*.{ts,tsx,js,jsx,json,md}"` | Format sources |
| `test` | `vitest` | Unit tests, watch mode |
| `test:ci` | `vitest run` | Unit tests, single run |
| `test:coverage` | `vitest run --coverage` | Coverage report (v8) |
| `test:integration` | `vitest run --config vitest.integration.config.ts` | Integration tests (config file not yet present) |
| `test:e2e` | `playwright test` | E2E tests |
| `test:e2e:ui` | `playwright test --ui` | Playwright UI mode |
| `db:migrate` | `supabase db push` | Apply migrations to linked project |
| `db:reset` | `supabase db reset` | Reset DB + replay migrations + seed |
| `db:types` | `supabase gen types typescript --local > src/types/database.ts` | Regenerate `src/types/database.ts` |
| `db:migration:new` | `supabase migration new` | Scaffold a new SQL migration |
| `prepare` | `husky` | Install git hooks |

Pre-commit recipe per `README.md`: `npm run lint && npm run typecheck && npm run test:ci` (also enforced by `lint-staged`).

## Platform Requirements

**Development:**
- Node.js >= 20
- npm (lockfile committed)
- Supabase CLI installed locally (`brew install supabase/tap/supabase` per `README.md`) — required for `db:migrate`, `db:reset`, `db:types`, `db:migration:new`
- `.env.local` populated with Supabase keys (minimum: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Playwright browsers installed on demand (`npx playwright install`)

**Production:**
- Hosting target not declared in repo, but `.gitignore` lists `.vercel` — Vercel is the assumed deployment surface
- Supabase project (region `eu-central-1`/Frankfurt recommended in `README.md`) for Postgres + Auth + Storage
- HTTPS mandatory (HSTS header set in `next.config.js`; security skill `.claude/skills/security/SKILL.md` lists it as a launch requirement)

## Skill-Defined Stack Constraints

Per `.claude/skills/videoedit-academy/SKILL.md` the stack is fixed and must not be changed without approval:

- Framework: Next.js 14 (App Router) — no Pages Router
- TypeScript strict mode — no `any`, no `// @ts-ignore` without ticketed justification (use `unknown` + type guards)
- UI: React 18 + Tailwind + shadcn/ui (shadcn primitives go in `src/components/ui/`)
- Client state: Zustand only (`src/stores/`)
- Server state on client: TanStack Query v5
- Forms: React Hook Form + Zod
- Animations: Framer Motion
- Icons: Lucide React
- Backend: Supabase (Postgres + Auth + Storage)
- Video: Kinescope
- Payments: ЮKassa primary, CloudPayments fallback
- Email: Unisender
- Captcha: Yandex SmartCaptcha
- Unit tests: Vitest; E2E: Playwright

---

*Stack analysis: 2026-05-23*
