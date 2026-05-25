---
plan: 02-legal-pages-and-security-headers
phase: 2
wave: 1
type: execute
maps_to: [LEGAL-01, LEGAL-02, LEGAL-03]
depends_on: []
autonomous: true
mode: mvp
estimated_tasks: 3
files_modified:
  - src/lib/legal/policy-version.ts
  - src/content/privacy.tsx
  - src/content/oferta.tsx
  - src/components/shared/LegalDocPage.tsx
  - src/app/(marketing)/privacy/page.tsx
  - src/app/(marketing)/oferta/page.tsx
  - next.config.js
  - tests/e2e/legal-pages.spec.ts
  - tests/e2e/security-headers.spec.ts
requirements: [LEGAL-01, LEGAL-02, LEGAL-03]
must_haves:
  truths:
    - "GET /privacy returns 200 with Russian draft of 152-ФЗ policy"
    - "GET /oferta returns 200 with Russian draft of публичная оферта"
    - "Both pages display version label '1.0-draft' and [TODO: юрист-ревью] markers inline"
    - "policy_version constant is single source of truth, importable from src/lib/legal/policy-version.ts"
    - "Response headers on any path include HSTS + X-Frame-Options DENY + X-Content-Type-Options nosniff + Referrer-Policy strict-origin-when-cross-origin + Permissions-Policy"
    - "E2E smoke test asserts both pages render + all 5 security headers present"
  artifacts:
    - path: src/lib/legal/policy-version.ts
      provides: "export const LEGAL_POLICY_VERSION = '1.0-draft'; — single source of truth used by privacy.tsx + oferta.tsx + plan-07's registerAction consent insertion"
    - path: src/content/privacy.tsx
      provides: "Privacy_v1_0_draft component (Russian, 152-ФЗ structure, [TODO] markers)"
    - path: src/content/oferta.tsx
      provides: "Oferta_v1_0_draft component (Russian, оферта structure, [TODO] markers)"
    - path: src/app/(marketing)/privacy/page.tsx
      provides: "Route /privacy — renders Privacy_v1_0_draft inside LegalDocPage"
    - path: src/app/(marketing)/oferta/page.tsx
      provides: "Route /oferta — renders Oferta_v1_0_draft inside LegalDocPage"
    - path: next.config.js
      provides: "Permissions-Policy header added to existing security headers block"
  key_links:
    - from: src/lib/legal/policy-version.ts
      to: plan-07 registerAction
      via: import (used to write to user_consents.policy_version)
      pattern: "LEGAL_POLICY_VERSION"
    - from: src/app/(marketing)/privacy/page.tsx
      to: src/content/privacy.tsx
      via: import + render
      pattern: "Privacy_v1_0_draft"
    - from: src/components/marketing/Footer.tsx (plan-01)
      to: /privacy, /oferta
      via: Link href
      pattern: "href=\"/(privacy|oferta)\""
---

<objective>
Ship 152-ФЗ + offer drafts as renderable Russian pages with clearly-marked [TODO: юрист-ревью] inline markers, hardened with the final missing security header (`Permissions-Policy`). After this plan, the Footer links from plan-01 actually resolve, and `/register` (plan-07) can legally reference live policy URLs in consent labels.

Purpose: LEGAL-01/02/03 are non-negotiable for ANY user-facing form per ROADMAP Phase 2 success criterion #1 ("видит footer с /privacy + /oferta (драфты, текст содержит TODO-маркеры)"). Drafts now → юрист sign-off in P7 → final wording → bump `policy_version` constant.

Output:
- `policy_version` constant module (single source of truth)
- Privacy + oferta versioned components in `src/content/`
- `/privacy` + `/oferta` route pages
- `LegalDocPage` wrapper with Tailwind `prose` typography
- `next.config.js` updated with `Permissions-Policy`
- E2E smoke tests for both pages + all 5 security headers
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
@.claude/skills/security/SKILL.md
@next.config.js
</context>

<interfaces>
<!-- From plan-01 (Wave 1 — may not be merged when plan-02 starts; if so, this plan can safely run because its files don't overlap). plan-02 imports from plan-01 ONLY for the optional LegalDocPage wrapper — easy to bypass with direct prose article. -->

From src/app/(marketing)/layout.tsx (plan-01):
```typescript
// MarketingLayout wraps {children} with Header + Footer
// /privacy and /oferta are routed under (marketing)/ → automatically receive the chrome
```

From tailwind.config.ts (plan-01 adds `@tailwindcss/typography` plugin):
```
// `prose prose-neutral dark:prose-invert` classes available
```

From next.config.js (P1 — already has 4 of 5 required security headers):
```javascript
// Current headers array (in async headers() returning [{ source: '/(.*)', headers: [...] }]):
//   - X-Frame-Options: DENY                                          ✓
//   - X-Content-Type-Options: nosniff                                ✓
//   - Referrer-Policy: strict-origin-when-cross-origin               ✓
//   - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload  ✓
// MISSING (LEGAL-03 requires):
//   - Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: policy-version constant + LegalDocPage wrapper + Privacy + Oferta content modules</name>
  <files>src/lib/legal/policy-version.ts, src/components/shared/LegalDocPage.tsx, src/content/privacy.tsx, src/content/oferta.tsx</files>
  <action>
1. Create `src/lib/legal/policy-version.ts` (server + client safe, no `'server-only'` because the constant is used by client labels in plan-07 + server-side `registerAction`):
```typescript
/**
 * Single source of truth for legal document version.
 *
 * Bumped when /privacy or /oferta wording changes substantively.
 * Used by:
 *   - src/content/privacy.tsx + src/content/oferta.tsx (header label)
 *   - src/server/actions/auth.ts (plan-07) — written to user_consents.policy_version
 *
 * Format: <major>.<minor>[-<status>]
 *   - '1.0-draft': initial P2 ship (TODO markers visible, юрист sign-off pending)
 *   - '1.0':       after P7 COMP-02 юрист sign-off (drop -draft suffix)
 *   - '1.1':       patch wording (typo, contact email change)
 *   - '2.0':       substantive change (new data category, new purpose)
 *
 * NEVER mutate a row in user_consents — re-consent on bump creates a new row.
 */
export const LEGAL_POLICY_VERSION = '1.0-draft' as const;

export type PolicyVersion = typeof LEGAL_POLICY_VERSION;
```

2. Create `src/components/shared/LegalDocPage.tsx` — Server Component wrapper for prose articles. Uses Tailwind typography plugin (enabled by plan-01):
```tsx
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface LegalDocPageProps {
  children: ReactNode;
  className?: string;
}

export function LegalDocPage({ children, className }: LegalDocPageProps) {
  return (
    <article
      className={cn(
        'prose prose-neutral dark:prose-invert mx-auto max-w-3xl px-4 py-12 md:py-16',
        'prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-10',
        className
      )}
    >
      {children}
    </article>
  );
}
```

3. Create `src/content/privacy.tsx` — versioned content module. Use the FULL skeleton from RESEARCH §Code Examples lines 1162-1244 (Privacy_v1_0_draft). Copy the structure verbatim with these adjustments:
- Import `LEGAL_POLICY_VERSION` from `@/lib/legal/policy-version`
- Use `{LEGAL_POLICY_VERSION}` in the «Версия» line (do NOT hardcode '1.0-draft')
- All section content in Russian per RESEARCH (8 sections: Общие положения, Основания обработки, Категории персональных данных, Цели обработки, Срок хранения, Права субъекта, Способы передачи данных, Контактная информация)
- Every `[TODO: юрист-ревью P7]` marker MUST appear as visible inline text (NOT just JSX comment) — per UI-SPEC §0 these are deliberately visible to both developer and user as compliance evidence
- Operator placeholder: «ИП [ФИО]», «ИНН [ИНН]», «ОГРНИП [ОГРНИП]» — to be filled by user before P7 юрист meeting
- Email: `support@videoedit-academy.ru` (matches footer)
- Bottom amber warning box: «⚠ Внимание: данная версия Политики — драфт, подлежит юридическому ревью в Phase 7 (COMP-02). Финальная редакция будет опубликована перед production-запуском.»
- Named export `Privacy_v1_0_draft` (Server Component, no `'use client'`)

4. Create `src/content/oferta.tsx` — mirror structure with offer-specific sections per UI-SPEC §4.8 + RESEARCH §1247-1249:
- Import `LEGAL_POLICY_VERSION`
- 8 sections: Реквизиты продавца ([TODO]), Предмет договора (доступ к видеокурсу), Цена и порядок оплаты, Порядок оказания услуги, Возврат денежных средств ([TODO: 14-day window per ЗоЗПП — confirm with юрист]), Ответственность сторон, Юрисдикция ([TODO: уточнить регион РФ]), Реквизиты для связи
- Same `[TODO: юрист-ревью P7]` markers visible inline at every legal-requirements-driven blank
- Named export `Oferta_v1_0_draft`
- Same bottom amber warning box (replace «Политики» with «Оферты»)

Russian-language quality is important — use natural legal phrasing, not literal translations. If unsure of exact юрист-grade phrasing for a section, leave a `[TODO: юрист-ревью — формулировка]` marker.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && grep -c "LEGAL_POLICY_VERSION" src/content/privacy.tsx src/content/oferta.tsx | grep -v ':0$' && grep -c "TODO: юрист-ревью" src/content/privacy.tsx | awk -F: '{if($2<5) exit 1}' && grep -c "TODO: юрист-ревью" src/content/oferta.tsx | awk -F: '{if($2<5) exit 1}'</automated>
  </verify>
  <done>policy-version.ts exports LEGAL_POLICY_VERSION = '1.0-draft'; LegalDocPage uses prose classes; Privacy_v1_0_draft and Oferta_v1_0_draft are Server Components with 8 sections each, both import LEGAL_POLICY_VERSION, both have at least 5 visible [TODO: юрист-ревью] markers; lint + typecheck clean.</done>
</task>

<task type="auto">
  <name>Task 2: /privacy and /oferta route pages with metadata</name>
  <files>src/app/(marketing)/privacy/page.tsx, src/app/(marketing)/oferta/page.tsx</files>
  <action>
Two thin route pages — Server Components, each renders its respective content component wrapped in LegalDocPage. Per UI-SPEC §4.7 + §4.8 + RESEARCH §1161-1173.

**`src/app/(marketing)/privacy/page.tsx`:**
```tsx
import type { Metadata } from 'next';
import { LegalDocPage } from '@/components/shared/LegalDocPage';
import { Privacy_v1_0_draft } from '@/content/privacy';

export const metadata: Metadata = {
  title: 'Политика обработки персональных данных',
  description:
    'Политика обработки персональных данных VideoEdit Academy в соответствии с Федеральным законом 152-ФЗ',
  robots: { index: true, follow: false },
};

export default function PrivacyPage() {
  return (
    <LegalDocPage>
      <Privacy_v1_0_draft />
    </LegalDocPage>
  );
}
```

**`src/app/(marketing)/oferta/page.tsx`:** mirror structure with title «Публичная оферта», description «Публичная оферта VideoEdit Academy — условия предоставления доступа к платным образовательным курсам», renders `Oferta_v1_0_draft`.

Both pages are automatically wrapped by `(marketing)/layout.tsx` (plan-01) which adds Header + Footer. No additional chrome needed.

> Plan-05 may further refine `metadata` for SEO — that's fine; this plan ships baseline metadata so the pages render correctly NOW.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run build</automated>
  </verify>
  <done>Both page files exist; each exports a default Server Component + `metadata`; rendering uses LegalDocPage + respective content component; `npm run build` succeeds (Next.js validates page structure at build time).</done>
</task>

<task type="auto">
  <name>Task 3: Add Permissions-Policy header + E2E smoke tests</name>
  <files>next.config.js, tests/e2e/legal-pages.spec.ts, tests/e2e/security-headers.spec.ts</files>
  <action>
1. **next.config.js** — add the missing 5th security header to the existing `headers()` array. Edit ONLY the headers array inside `headers()`. DO NOT touch `withSentryConfig` or any other config:
```javascript
{
  key: 'Permissions-Policy',
  value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
}
```
Per RESEARCH §Security Headers Verification (lines 1252-1267) — this is the only missing header. The other 4 (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) are already there per `next.config.js` head -40 verification. Per RESEARCH note: CSP enforcement is LEGAL-04 → P6 and is NOT added here (premature CSP would break Yandex SmartCaptcha + Kinescope embeds before we know their domains).

2. **`tests/e2e/legal-pages.spec.ts`** — Playwright smoke. One test per page. Each:
   - Navigates via `page.goto('/privacy')` / `/oferta`
   - Asserts `page.getByRole('heading', { name: /Политика обработки персональных данных/i })` visible for /privacy
   - Asserts `page.getByRole('heading', { name: /Публичная оферта/i })` visible for /oferta
   - Asserts page contains text `Версия 1.0-draft` (proves LEGAL_POLICY_VERSION wired)
   - Asserts page contains text `юрист-ревью` (proves drafts marked)
   - Asserts response status 200

3. **`tests/e2e/security-headers.spec.ts`** — Playwright header assertion smoke. Single test fetches `GET /` and asserts all 5 headers present with correct values:
```typescript
import { test, expect } from '@playwright/test';

test('homepage response includes all required security headers (LEGAL-03)', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
  const h = res.headers();
  expect(h['strict-transport-security']).toContain('max-age=63072000');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['permissions-policy']).toContain('camera=()');
});
```

Both files use the existing Playwright config (`playwright.config.ts` from P1).
  </action>
  <verify>
    <automated>npm run lint && grep -c "Permissions-Policy" next.config.js | grep -v '^0$' && ls tests/e2e/legal-pages.spec.ts tests/e2e/security-headers.spec.ts</automated>
  </verify>
  <done>next.config.js has the new Permissions-Policy entry alongside the existing 4 headers (5 total); two new Playwright spec files exist with the assertions described; `npm run lint` clean (Playwright tests have their own ESLint config tolerance).</done>
</task>

</tasks>

<verification>
After all 3 tasks:
1. `npm run lint && npm run typecheck && npm run build` — must pass
2. `npm run dev`, then in another shell `curl -I http://localhost:3000/` — response must include all 5 security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
3. Open http://localhost:3000/privacy in browser — should render Russian draft with «Версия 1.0-draft» visible at top, [TODO: юрист-ревью] markers visible inline, ИП placeholders visible, amber warning box at bottom
4. Open http://localhost:3000/oferta — same structure, оферта content
5. `npm run test:e2e -- tests/e2e/legal-pages.spec.ts tests/e2e/security-headers.spec.ts` — must pass (requires Playwright browsers installed; if not, install with `npx playwright install` first)
6. Confirm Footer links from plan-01 resolve: click «Политика конфиденциальности» in Footer → land on /privacy with content
</verification>

<success_criteria>
- LEGAL-01 satisfied: `/privacy` renders Russian draft per 152-ФЗ structure with version label, processed data, purposes, retention, оператор placeholder, [TODO] markers
- LEGAL-02 satisfied: `/oferta` renders Russian draft with оферта-required sections, [TODO] markers
- LEGAL-03 satisfied: All 5 security headers present on every response (HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy)
- `LEGAL_POLICY_VERSION` is the single source of truth — bumping it in plan-07's `registerAction` consent-insertion behaves correctly (verified in plan-07 integration test)
- E2E smoke tests cover both pages + all 5 headers
</success_criteria>

<out_of_scope>
- Юрист sign-off / finalised wording — P7 COMP-02
- CSP header — LEGAL-04 → P6 (would break SmartCaptcha + Kinescope embeds prematurely)
- RKN notification submission — P7 COMP-01
- Cookie consent banner — UI-SPEC §9.5 decides NO banner in M1
- MDX-based legal documents — overkill for solo MVP per RESEARCH §Code Examples (TSX inline prose is fine)
- Multiple language versions — PROJECT.md Out of Scope
</out_of_scope>

<references>
- UI-SPEC.md §4.7 (Privacy layout), §4.8 (Oferta layout), §9.4 (Footer legal compliance), §0 (drafts marker convention)
- RESEARCH.md §Code Examples §1161-1244 (Privacy_v1_0_draft full skeleton), §1247-1249 (Oferta structure), §1252-1267 (Security Headers verification — Permissions-Policy is the only missing one)
- REQUIREMENTS.md LEGAL-01/02/03
- security/SKILL.md §1 (secrets), §7 (152-ФЗ)
- ROADMAP.md Phase 2 success criterion #1
</references>

<output>
Create `.planning/phases/2-auth-marketing-consent/plans/2-02-SUMMARY.md` when done documenting:
- LEGAL_POLICY_VERSION constant in `src/lib/legal/policy-version.ts`
- LegalDocPage wrapper component
- Privacy_v1_0_draft + Oferta_v1_0_draft content modules
- /privacy + /oferta route pages with metadata
- Permissions-Policy header added (5/5 LEGAL-03 headers now present)
- E2E smoke tests for both pages + headers
- Deferred to P7: юрист finalised wording, CSP enforce
</output>
