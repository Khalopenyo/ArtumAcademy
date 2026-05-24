---
plan: 00-typecheck-baseline
phase: 2
wave: 0
type: execute
maps_to: []
depends_on: []
autonomous: true
mode: mvp
estimated_tasks: 1
files_modified:
  - src/lib/supabase/server.ts
  - src/lib/supabase/middleware.ts
  - src/lib/supabase/admin.lint.test.ts
  - package.json
requirements: []
must_haves:
  truths:
    - "npm run typecheck exits 0 from a clean checkout — zero pre-existing baseline errors"
    - "src/lib/supabase/server.ts cookies.setAll has explicit param type (no TS7006/TS7031)"
    - "src/lib/supabase/middleware.ts cookies.setAll has explicit param type (no TS7006/TS7031)"
    - "src/lib/supabase/admin.lint.test.ts imports resolve (no TS7016 for 'eslint'; no TS7006 for callback param)"
  artifacts:
    - path: src/lib/supabase/server.ts
      provides: "Typed setAll(cookiesToSet) — explicit @supabase/ssr cookie shape"
    - path: src/lib/supabase/middleware.ts
      provides: "Typed setAll(cookiesToSet) — explicit @supabase/ssr cookie shape"
    - path: src/lib/supabase/admin.lint.test.ts
      provides: "Typed ESLint result callbacks via @types/eslint"
    - path: package.json
      provides: "@types/eslint added to devDependencies (peer of eslint v8)"
  key_links:
    - from: src/lib/supabase/server.ts
      to: "@supabase/ssr"
      via: import type { CookieOptions }
      pattern: "CookieOptions"
    - from: src/lib/supabase/middleware.ts
      to: "@supabase/ssr"
      via: import type { CookieOptions }
      pattern: "CookieOptions"
---

<objective>
Zero out the 13 pre-existing TypeScript errors that ship as the Phase 1 → Phase 2 baseline so that every subsequent Phase 2 plan's `npm run typecheck` verify gate is meaningful (not pre-poisoned).

Purpose: `npm run typecheck` currently exits 1 from clean main HEAD (verified 2026-05-24, 13 errors: 10 implicit-any in supabase cookie handlers, 3 missing-types in admin.lint.test.ts). Plan-01 Task 1 specifies `npm run typecheck` as its `<verify>` gate — without this Wave 0 fix, the gate fails before any plan-01 code is even written, masking real errors that plan-01 itself might introduce.

This plan is the FIRST thing executed in Phase 2 (Wave 0 — strictly before Wave 1's plan-01/02/06 trio).

Output:
- `src/lib/supabase/server.ts` — typed `cookies.setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[])`
- `src/lib/supabase/middleware.ts` — typed `cookies.setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[])`
- `@types/eslint` added to `devDependencies` (peer of the ESLint v8 already installed)
- `src/lib/supabase/admin.lint.test.ts` — restored type-clean (callbacks now infer their `m: Linter.LintMessage` parameter via `@types/eslint`)
- Single atomic commit: `chore(2-00): fix pre-existing TS gaps from Phase 1 scaffold`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/2-auth-marketing-consent/PLAN.md
@.planning/phases/1-dev-foundations/VERIFICATION.md
@src/lib/supabase/server.ts
@src/lib/supabase/middleware.ts
@src/lib/supabase/admin.lint.test.ts
@package.json
</context>

<interfaces>
From @supabase/ssr (already in package.json as ^0.5.x — locked tech stack):
```typescript
// Re-exported from @supabase/ssr index.d.ts:
export interface CookieOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  priority?: 'low' | 'medium' | 'high';
  sameSite?: 'lax' | 'strict' | 'none' | boolean;
  secure?: boolean;
}

// createServerClient's cookies.setAll signature accepts:
//   (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => void | Promise<void>
// Source of truth: node_modules/@supabase/ssr/dist/main/types.d.ts (CookieMethodsServer).
```

From eslint v8 + @types/eslint (the latter to be installed by this plan):
```typescript
// @types/eslint exposes Linter.LintMessage with ruleId, severity, message, etc.
// Lint result callbacks: (m: Linter.LintMessage) => boolean
// Without @types/eslint, `import { ESLint } from 'eslint'` is implicit-any → 3 cascading TS7006 errors.
```

Baseline `npm run typecheck` output (verified 2026-05-24 from clean HEAD):
```
src/lib/supabase/admin.lint.test.ts(15,24): error TS7016: Could not find a declaration file for module 'eslint'
src/lib/supabase/admin.lint.test.ts(51,10): error TS7006: Parameter 'm' implicitly has an 'any' type
src/lib/supabase/admin.lint.test.ts(67,10): error TS7006: Parameter 'm' implicitly has an 'any' type
src/lib/supabase/middleware.ts(15,16): error TS7006: Parameter 'cookiesToSet' implicitly has an 'any' type
src/lib/supabase/middleware.ts(16,35): error TS7031: Binding element 'name' implicitly has an 'any' type
src/lib/supabase/middleware.ts(16,41): error TS7031: Binding element 'value' implicitly has an 'any' type
src/lib/supabase/middleware.ts(18,35): error TS7031: Binding element 'name' implicitly has an 'any' type
src/lib/supabase/middleware.ts(18,41): error TS7031: Binding element 'value' implicitly has an 'any' type
src/lib/supabase/middleware.ts(18,48): error TS7031: Binding element 'options' implicitly has an 'any' type
src/lib/supabase/server.ts(15,16): error TS7006: Parameter 'cookiesToSet' implicitly has an 'any' type
src/lib/supabase/server.ts(17,37): error TS7031: Binding element 'name' implicitly has an 'any' type
src/lib/supabase/server.ts(17,43): error TS7031: Binding element 'value' implicitly has an 'any' type
src/lib/supabase/server.ts(17,50): error TS7031: Binding element 'options' implicitly has an 'any' type
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Type-annotate Supabase cookie handlers + install @types/eslint</name>
  <files>src/lib/supabase/server.ts, src/lib/supabase/middleware.ts, src/lib/supabase/admin.lint.test.ts, package.json</files>
  <action>
1. **Install `@types/eslint` as a devDependency** (peer of the existing ESLint v8 installed by P1):
```bash
npm install -D @types/eslint
```
This resolves `src/lib/supabase/admin.lint.test.ts:15` TS7016 (`Could not find a declaration file for module 'eslint'`) and unblocks the 2 cascading TS7006 errors on lines 51 and 67 (callback param `m` now infers `Linter.LintMessage`).

2. **Edit `src/lib/supabase/server.ts`** — add `CookieOptions` import + annotate `setAll`:
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerSupabase() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Игнорируем, если вызвано из Server Component
            // (cookies можно ставить только в Server Action / Route Handler)
          }
        },
      },
    },
  );
}
```
Only the `import` line and the `setAll(cookiesToSet:` annotation change. Preserve every comment.

3. **Edit `src/lib/supabase/middleware.ts`** — same pattern:
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // ВАЖНО: getUser() обновит сессию. Не убирать.
  await supabase.auth.getUser();

  return supabaseResponse;
}
```
Only `import` line + `setAll` signature change. Preserve the existing comment.

4. **Verify `src/lib/supabase/admin.lint.test.ts` is now clean** — once `@types/eslint` is installed, the existing imports `import { ESLint } from 'eslint'` and the two `.filter((m) => ...)` callbacks should typecheck without changes. NO source edits required to admin.lint.test.ts; just rerun `npm run typecheck` to confirm.

5. **Final verification** — run `npm run typecheck` from repo root. Expected output: zero errors. If any persist that are NOT one of the 13 baseline errors above, surface them in the SUMMARY and stop the plan (means something else regressed between research and execution).

6. **Single atomic commit** at task end:
```bash
git add src/lib/supabase/server.ts src/lib/supabase/middleware.ts package.json package-lock.json
git commit -m "chore(2-00): fix pre-existing TS gaps from Phase 1 scaffold"
```
  </action>
  <verify>
    <automated>npm run typecheck && npm run lint && grep -q "CookieOptions" src/lib/supabase/server.ts && grep -q "CookieOptions" src/lib/supabase/middleware.ts && grep -q '"@types/eslint"' package.json</automated>
  </verify>
  <done>`npm run typecheck` exits 0; both supabase cookie handlers have explicit `CookieOptions` type imports + annotated `setAll` signatures; `@types/eslint` listed in `package.json` devDependencies; admin.lint.test.ts requires no source edit; single commit `chore(2-00): fix pre-existing TS gaps from Phase 1 scaffold` lands.</done>
</task>

</tasks>

<verification>
1. `npm run typecheck` — exits 0 with zero diagnostics
2. `npm run lint` — exits 0
3. `git log --oneline -1` shows `chore(2-00): fix pre-existing TS gaps from Phase 1 scaffold`
4. `grep -c "CookieOptions" src/lib/supabase/server.ts src/lib/supabase/middleware.ts` — returns ≥ 2 per file (import + annotation)
5. No source edits to `admin.lint.test.ts` (only its types resolve via the new devDep)
</verification>

<success_criteria>
- 0 baseline TS errors remaining (13 → 0)
- All subsequent Phase 2 plan `npm run typecheck` verify gates are meaningful
- Source changes are minimal and surgical (no formatting churn, no comment loss)
- `@supabase/ssr` `CookieOptions` import is the canonical pattern from `@supabase/ssr` docs (no hand-rolled cookie type)
</success_criteria>

<out_of_scope>
- Any auth/session behavior changes — this is a TYPE-ONLY fix, NO runtime behavior change
- @supabase/ssr version bump — keep at currently-locked range
- Re-running Phase 1 verification — Wave 0 only fixes the 13 listed errors
- New tests — the existing audit-log + admin-lint tests already exercise these files at runtime
</out_of_scope>

<references>
- Phase 1 VERIFICATION.md (deferred TS items / known baseline state)
- @supabase/ssr/dist/main/types.d.ts (CookieMethodsServer canonical shape)
- TypeScript handbook: noImplicitAny / strictNullChecks (project tsconfig already strict)
</references>

<output>
Create `.planning/phases/2-auth-marketing-consent/plans/2-00-SUMMARY.md` when done documenting:
- Pre-fix baseline: 13 TS errors (10 implicit-any in supabase cookie handlers, 3 missing-types in admin.lint.test.ts)
- Post-fix baseline: 0 TS errors
- Files changed: server.ts, middleware.ts, package.json (+ package-lock.json), admin.lint.test.ts UNCHANGED
- Pattern documented for future: @supabase/ssr exports `CookieOptions` — use the typed import, never `any`
- Note: this Wave-0 fix unblocks all subsequent plan verify gates that include `npm run typecheck`
</output>
