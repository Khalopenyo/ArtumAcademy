# Coding Conventions

**Analysis Date:** 2026-05-23

> The repository is in early scaffold state: most feature directories under
> `src/components/`, `src/server/actions/`, `src/server/queries/`, `src/stores/`,
> and `src/hooks/` are empty. The conventions below are authoritative — they are
> declared as project skills under `.claude/skills/` (treated as mandatory rules
> by both Claude Code and human contributors) and matched by the few real
> source files that already exist. Cite the skill rule when no implementation
> file exists yet.

## Naming Patterns

**Files:**
- React components (server or client): `PascalCase.tsx`
  - Example: future `src/components/lessons/SubmitForm.tsx` (referenced in
    `.claude/skills/testing/SKILL.md:92`).
- Utilities, hooks, schemas, server modules: `camelCase.ts`
  - Real example: `src/lib/utils.ts`, `src/lib/auth/require.ts`,
    `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`.
- Tests: `<Name>.test.ts(x)` colocated next to source.
  - Real example: `src/lib/utils.test.ts` sits next to `src/lib/utils.ts`.
- Integration tests: `<Name>.integration.test.ts` (skill rule,
  `.claude/skills/testing/SKILL.md:142`).
- Supabase migrations: `YYYYMMDDHHMMSS_short_description.sql`
  - Real example: `supabase/migrations/20260522000001_init_base_tables.sql`.

**Functions:**
- `camelCase`. Verbs preferred for actions and queries.
  - Server queries must start with a verb: `getCourseBySlug`,
    `listSubmissionsByUser`, `findActivePromo`
    (`.claude/skills/api-conventions/SKILL.md:185`).
  - Auth helpers in `src/lib/auth/require.ts:21,35` follow `requireUser`,
    `requireRole`.

**Variables:**
- `camelCase` for locals and params.
- Constants that represent immutable external endpoints in SCREAMING_SNAKE:
  `YOOKASSA_API` (`.claude/skills/api-conventions/SKILL.md:198`).

**Types:**
- `PascalCase` for interfaces and types.
- Component prop bags use `interface` (not `type`) so they can `extends` HTML
  element props (`.claude/skills/ui-conventions/SKILL.md:113`).
- Discriminated-union result types use `{ ok: true; ... } | { ok: false; error }`
  for Server Actions (`.claude/skills/api-conventions/SKILL.md:42`).
- Database row types pulled from generated
  `Database['public']['Tables']['<table>']['Row']`
  (`.claude/skills/api-conventions/SKILL.md:167`).

## Code Style

**Formatting (`.prettierrc.json`):**
- `semi: true`
- `singleQuote: true`
- `trailingComma: 'all'`
- `tabWidth: 2`, spaces only (`useTabs: false`)
- `printWidth: 100`
- Plugin: `prettier-plugin-tailwindcss` (auto-sorts Tailwind classes).
- Format command: `npm run format`
  (runs `prettier --write "src/**/*.{ts,tsx,js,jsx,json,md}"`, `package.json:15`).

**Linting (`.eslintrc.json`):**
- Extends `next/core-web-vitals` and `prettier` (disables formatting rules to
  defer to Prettier).
- `@typescript-eslint/no-unused-vars: error` with
  `argsIgnorePattern: "^_"` — prefix unused args with `_` to silence.
- `no-console: warn` — only `console.error` and `console.warn` are allowed.
  `console.log` must not ship to production
  (`.claude/skills/api-conventions/SKILL.md:88`).
- `react/no-unescaped-entities: off` (apostrophes/quotes allowed inline in JSX —
  needed for Cyrillic copy).
- Commands: `npm run lint`, `npm run lint:fix`.

**TypeScript (`tsconfig.json`):**
- `strict: true` plus explicit `noImplicitAny`, `strictNullChecks`,
  `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`.
- Target `ES2022`, `module: esnext`, `moduleResolution: bundler`,
  `jsx: preserve`, `isolatedModules: true`.
- Path alias: `@/*` → `./src/*` (use it everywhere; deep `../../../` imports
  are forbidden by `.claude/skills/ui-conventions/SKILL.md:268`).
- Typecheck command: `npm run typecheck` (`tsc --noEmit`).
- **No `any`, no `// @ts-ignore`** without ticket-linked justification — use
  `unknown` + type guards instead
  (`.claude/skills/videoedit-academy/SKILL.md:52`).

**Pre-commit (Husky + lint-staged, `package.json:76-84`):**
- `*.{ts,tsx,js,jsx}` → `eslint --fix` then `prettier --write`.
- `*.{json,md,css}` → `prettier --write`.
- `npm run prepare` installs the Husky hook.

**Editor (`.vscode/settings.json`):**
- Format on save with Prettier; ESLint `source.fixAll` on save.
- Tailwind IntelliSense is taught to recognise `cn(...)` and `cva(...)` calls.

## Import Organization

Skill-mandated order (`.claude/skills/ui-conventions/SKILL.md:267-275`):

1. External packages — `react`, `next/*`, `zod`, `react-hook-form`, etc.
2. Internal libs — `@/lib/...`, `@/server/...`.
3. Components — `@/components/...`.
4. Types — `@/types/...`.

**Path aliases:** only `@/` (configured in `tsconfig.json:28` and aliased
identically in `vitest.config.ts:14-16`). No relative parent imports.

**Real example mirroring the order**
(`src/lib/auth/require.ts:1`):
```ts
import { createServerSupabase } from '@/lib/supabase/server';
```
The Server Action template in `.claude/skills/api-conventions/SKILL.md:25-30`
demonstrates the full block:
```ts
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/require';
```

## Component Patterns

**Server vs Client Components**
(`.claude/skills/ui-conventions/SKILL.md:8-22`):
- Server Components are the default. Use them for any page that reads from the
  DB and has no interactivity.
- `'use client'` is required for: forms with local state, modals/tabs/dropdowns,
  React Query / Zustand / Framer Motion usage, and any `window`/`localStorage`
  access.
- Keep client boundaries as deep as possible. Do not slap `'use client'` on a
  whole page when only one widget is interactive — extract the widget.
- Real Server Component example: `src/app/page.tsx` (no directive, pure JSX).
- Real Server Component layout: `src/app/layout.tsx:27-36` (renders `<Toaster>`
  from `sonner`, which is itself a client component, without leaking client
  scope upward).

**Component Rules (`.claude/skills/ui-conventions/SKILL.md:106-114`):**
1. Named export, never `default` (App Router pages are the only exception —
   `src/app/page.tsx:3`, `src/app/layout.tsx:27`).
2. Props typed via `interface` so they can extend HTML element props.
3. Always accept optional `className?: string` so callers can extend styling.
4. Merge classes with `cn()` from `@/lib/utils` (`src/lib/utils.ts:4`).
5. No `any`. Pull domain types from `@/types/database`.
6. No `React.FC` — write plain typed function components.
7. Don't write components > 250 lines — split
   (`.claude/skills/ui-conventions/SKILL.md:316`).

**Component template** (`.claude/skills/ui-conventions/SKILL.md:55-90`):
```tsx
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return <button className={cn('...', className)} {...props} />;
}
```

**Where components live** (`.claude/skills/ui-conventions/SKILL.md:36-40`):
- shadcn/ui primitives → `src/components/ui/` (add via
  `npx shadcn-ui@latest add <name>`).
- Reusable cross-feature → `src/components/shared/`.
- Feature-scoped → `src/components/<module>/`
  (e.g. `src/components/lessons/VideoPlayer.tsx`).
- One-off page widgets → next to the page in
  `src/app/(group)/<page>/components/`.

## Form Handling

Stack: **React Hook Form + Zod + `@hookform/resolvers/zod` + shadcn `Form`
components**. Full pattern in
`.claude/skills/ui-conventions/SKILL.md:118-204`.

Required rules
(`.claude/skills/ui-conventions/SKILL.md:206-212`):
1. Reuse the Zod schema exported from the Server Action — do not duplicate it
   on the client (`.claude/skills/api-conventions/SKILL.md:233-249`).
2. Use `useTransition` for pending state, never a separate `useState`.
3. Disable the submit button while pending.
4. Show feedback via `sonner` (`toast.success` / `toast.error`).
5. Redirect on success with `useRouter().push(...)`.

Canonical form skeleton (excerpt of
`.claude/skills/ui-conventions/SKILL.md:147-203`):
```tsx
'use client';
const form = useForm<SubmitAssignmentInput>({
  resolver: zodResolver(submitAssignmentSchema),
  defaultValues: { assignmentId, videoUrl: '', comment: '' },
});

const onSubmit = (values: SubmitAssignmentInput) => {
  startTransition(async () => {
    const result = await submitAssignment(values);
    if (!result.ok) { toast.error(result.error); return; }
    toast.success('Работа отправлена на проверку');
    router.push(`/submissions/${result.submissionId}`);
  });
};
```

## Styling

**Tailwind CSS + shadcn/ui** is the only allowed styling layer
(`.claude/skills/ui-conventions/SKILL.md:42-52`). No CSS-in-JS,
no `.module.css`, no inline styles (rare exception: dynamic `transform`).

- Tailwind config: `tailwind.config.ts` — content globs cover
  `./src/app/**/*.{ts,tsx}` and `./src/components/**/*.{ts,tsx}`.
- Dark mode: `class` strategy (`tailwind.config.ts:4`); shadcn HSL variables in
  `src/app/globals.css:5-50` (`:root` + `.dark`).
- Class merging: `cn()` in `src/lib/utils.ts:4` wraps `clsx` + `tailwind-merge`.
- Use `cva` (class-variance-authority) when a component has 15+ class tokens
  (`.claude/skills/ui-conventions/SKILL.md:50`).
- Mobile-first: write base classes for mobile, then `md:`/`lg:` prefixes.
- No magic numbers — stay on Tailwind spacing scale
  (`mt-9`, not `mt-[37px]`).
- **Never** hardcode `bg-white` / `text-black`. Use semantic shadcn tokens —
  `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `bg-destructive`, etc.
  — so dark mode works automatically
  (`.claude/skills/ui-conventions/SKILL.md:94-103`).
- The Prettier Tailwind plugin auto-sorts class strings; do not manually
  re-order.

**Images:** only `next/image`. External hosts must be whitelisted in
`next.config.js:5-15` (currently `*.supabase.co`, `*.kinescope.io`).

**Fonts:** `Inter` from `next/font/google` with `latin` + `cyrillic` subsets,
exposed as the `--font-sans` CSS variable
(`src/app/layout.tsx:6`).

## State Management

**Client state — Zustand** (`src/stores/`, currently empty). Forbidden
alternatives: Redux, MobX, Recoil
(`.claude/skills/ui-conventions/SKILL.md:313`).

**Server data — TanStack Query v5** (`@tanstack/react-query` in
`package.json:36`). Do not use `useEffect` to fetch data, do not roll a custom
fetch client, and do not store server data in `useState`
(`.claude/skills/ui-conventions/SKILL.md:309-311`).

**Pages Router APIs are banned:** no `getServerSideProps`,
`getStaticProps`, or custom `_app.tsx`
(`.claude/skills/ui-conventions/SKILL.md:312`). Data fetching happens directly
inside Server Components via server queries.

## Data Fetching

**Reads** live in `src/server/queries/<module>.ts` (currently empty). Pattern
(`.claude/skills/api-conventions/SKILL.md:163-181`):
```ts
import { createServerSupabase } from '@/lib/supabase/server';
import { Database } from '@/types/database';

type Course = Database['public']['Tables']['courses']['Row'];

export async function getPublishedCourses(): Promise<Course[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from('courses').select(...).eq('published', true);
  if (error) throw error;
  return data ?? [];
}
```

Rules:
- Query functions named with a verb (`get*`, `list*`, `find*`).
- Return typed results derived from generated `Database` types.
- `.single()` only when exactly one row is required; otherwise
  `.maybeSingle()`.
- All read queries live under `src/server/queries/` — never inline in
  components (`.claude/skills/api-conventions/SKILL.md:188`).

**Server Supabase client** is built per request via `createServerSupabase()` in
`src/lib/supabase/server.ts:4-28`, which bridges `next/headers` cookies into
`@supabase/ssr`. The `setAll` block deliberately swallows errors when called
from a Server Component (only Server Actions / Route Handlers may write
cookies — see comment at `src/lib/supabase/server.ts:21`).

**Browser Supabase client** is `createBrowserSupabase()` in
`src/lib/supabase/client.ts:3`.

**Session refresh** is handled in middleware:
`src/middleware.ts:4-19` delegates to `updateSession()` in
`src/lib/supabase/middleware.ts:4-30`. The `await supabase.auth.getUser()` call
there is **load-bearing** — do not remove it (the inline comment at
`src/lib/supabase/middleware.ts:26` warns about this).

## Server Action Pattern

Server Actions live in `src/server/actions/<module>.ts` (currently empty) and
follow the four-step structure in
`.claude/skills/api-conventions/SKILL.md:23-103`:

1. **`'use server'`** as the first line of the file.
2. **Zod schema** exported alongside the action. Inferred `Input` type also
   exported so the form can type its `useForm<...>()`.
3. **Discriminated union result type**:
   `type Result = { ok: true; ... } | { ok: false; error: string }`.
4. **Function body:**
   - `safeParse(input)` first — return `{ ok: false, error }` on failure.
   - `await requireUser()` / `await requireRole(...)` from
     `src/lib/auth/require.ts:21,35` for auth/authorisation.
   - Call Supabase via `createServerSupabase()`.
   - On DB error: `console.error('<action> failed', error)` and return a
     generic `{ ok: false, error: 'Не удалось...' }` (never leak DB details to
     the client).
   - `revalidatePath(...)` / `revalidateTag(...)` after mutation.
   - Return `{ ok: true, ... }`.

**Throw vs return**: throw only for system failures (DB down, missing
session). Every business-level failure is a returned `{ ok: false }`
(`.claude/skills/api-conventions/SKILL.md:103`).

## Error Handling

- **Server Actions** → discriminated union return values (above). Caller
  branches on `result.ok` and toasts the error
  (`.claude/skills/api-conventions/SKILL.md:91-101`).
- **Server queries** → throw on Supabase error; the surrounding Server
  Component's `error.tsx` catches it
  (`.claude/skills/api-conventions/SKILL.md:178`).
- **Auth helpers** throw typed errors: `UnauthorizedError` and
  `ForbiddenError` defined in `src/lib/auth/require.ts:3-15`. These are
  intended to bubble to error boundaries / route guards.
- **Route Handlers (webhooks)** return JSON `{ ok: true }` on success,
  `{ error: '...' }` with appropriate 4xx/5xx status on failure; log to
  `console.error` and rely on Sentry to surface 500s
  (`.claude/skills/api-conventions/SKILL.md:139-158`).
- **Pages** render an `error.tsx` boundary that is a Client Component with
  `error` and `reset` props
  (`.claude/skills/ui-conventions/SKILL.md:248-262`).
- **Loading UI** uses `<Skeleton>` blocks, not spinners
  (`.claude/skills/ui-conventions/SKILL.md:219-227`).
- **Empty states** include an icon, heading, helper copy, and a clear action
  link (`.claude/skills/ui-conventions/SKILL.md:230-245`).

## Logging

- No logger framework — `console.error` / `console.warn` only (ESLint enforces
  this via `no-console`). `console.log` must not ship.
- Never log secrets: passwords, tokens, full card numbers
  (`.claude/skills/api-conventions/SKILL.md:87`).
- Webhook handlers must log every received event into the `audit_log` table
  for forensics (`.claude/skills/api-conventions/SKILL.md:156`).

## Comments

- JSDoc/TSDoc is used for public helpers when behaviour or invariants are
  non-obvious. See `src/lib/auth/require.ts:17-20,31-34` for the in-repo
  example (Russian, terse, focused on contract not implementation).
- Inline comments explain "why", not "what". The load-bearing comment in
  `src/lib/supabase/middleware.ts:26` ("ВАЖНО: getUser() обновит сессию. Не
  убирать.") is the model.
- No commented-out code in commits
  (`.claude/skills/workflow/SKILL.md:138`).
- Project language for comments and user-facing strings is **Russian**;
  identifiers stay in English.

## Function Design

- Server queries / actions: one verb-named function per concern.
- Auth helpers compose: `requireRole` calls `requireUser` first
  (`src/lib/auth/require.ts:35-49`).
- Validation always uses `safeParse` (never `parse` that throws) inside
  Server Actions so the discriminated union pattern stays intact.
- Prefer narrow argument objects over long positional lists — Server Action
  inputs are always a single object typed from
  `z.infer<typeof schema>`.

## Module Design

- **Named exports only.** Default exports allowed exclusively where Next.js
  requires them (Route Handlers, `page.tsx`, `layout.tsx`, `error.tsx`).
- **No barrel files** in `src/components/ui/` — shadcn primitives are imported
  by direct path (e.g. `@/components/ui/button`).
- **External-service wrappers** live in `src/lib/<service>/` (e.g.
  `src/lib/yookassa/`, `src/lib/kinescope/`, `src/lib/unisender/`,
  `src/lib/supabase/`). Never call a third-party API directly from a
  component or Server Action — go through the wrapper
  (`.claude/skills/api-conventions/SKILL.md:194`).
- **One Zod schema per export.** Schemas are imported by both the Server
  Action and its form
  (`.claude/skills/api-conventions/SKILL.md:233-249`).

## Forbidden Patterns

From `.claude/skills/ui-conventions/SKILL.md:306-317` and
`.claude/skills/videoedit-academy/SKILL.md:43-53`:

- `dangerouslySetInnerHTML` without sanitisation.
- `useEffect` for data fetching.
- `useState` holding server data.
- Custom fetch client (use React Query / Server Actions).
- Pages Router APIs (`getServerSideProps`, `getStaticProps`, `_app.tsx`).
- Redux / MobX / Recoil.
- `<div onClick>` masquerading as a button.
- `key={index}` for list rendering — use stable IDs.
- Components longer than 250 lines.
- `any` and `// @ts-ignore` without a justified ticket reference.
- Hardcoded secrets — `.env.local` only; `.env.example` documents names.
- `service_role` Supabase key on the client — server-side only.
- Disabling RLS on public tables.
- Pushing directly to `main` — feature branches + PR only.
- Trusting prices or roles from the client — re-derive on the server.

## Pre-Commit Quality Gate

Required before any commit
(`.claude/skills/videoedit-academy/SKILL.md:113`,
`.claude/skills/workflow/SKILL.md:119-141`):

```bash
npm run lint
npm run typecheck
npm run test:ci
npm run build
```

`build` is part of the gate because the App Router surfaces SSR-only errors
during `next build` that `next dev` hides.

---

*Convention analysis: 2026-05-23*
