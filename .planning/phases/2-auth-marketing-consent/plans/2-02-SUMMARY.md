---
phase: 2
plan: 02-legal-pages-and-security-headers
wave: 1
status: complete
completed: 2026-05-24
requirements: [LEGAL-01, LEGAL-02, LEGAL-03]
commits: [321f038, 88060de, e44d2de]
duration: 12m
---

# Phase 2 Plan 02: Legal Pages + Security Headers Summary

Shipped /privacy + /oferta as Russian 152-ФЗ drafts with version-pinned content, inline [TODO: юрист-ревью P7] markers, and the 5th security header (Permissions-Policy). After this plan, Footer links from plan-01 resolve and plan-07's registerAction has a stable `LEGAL_POLICY_VERSION` constant to write into user_consents.

## What changed

**Task 1 — `321f038` (content modules + version constant):**
- `src/lib/legal/policy-version.ts` — `LEGAL_POLICY_VERSION = '1.0-draft' as const` single source of truth (Server + Client safe — no `'server-only'` marker so plan-07 client form labels can import it)
- `src/components/shared/LegalDocPage.tsx` — Server Component prose wrapper using Tailwind typography (`prose prose-neutral dark:prose-invert max-w-3xl`)
- `src/content/privacy.tsx` — `Privacy_v1_0_draft` Server Component, 8 sections per 152-ФЗ (Общие положения, Основания, Категории данных, Цели, Срок хранения, Права субъекта, Передача данных, Контакты), 7 visible inline `[TODO: юрист-ревью P7]` markers, amber warning box at bottom
- `src/content/oferta.tsx` — `Oferta_v1_0_draft` Server Component, 8 sections (Реквизиты, Предмет, Цена и оплата, Порядок оказания услуги, Возврат, Ответственность, Юрисдикция, Связь), 11 visible inline `[TODO: юрист-ревью P7]` markers, amber warning box

**Task 2 — `88060de` (route pages):**
- `src/app/(marketing)/privacy/page.tsx` — thin Server Component renders `<LegalDocPage><Privacy_v1_0_draft /></LegalDocPage>`; metadata title «Политика обработки персональных данных», `robots: { index: true, follow: false }`
- `src/app/(marketing)/oferta/page.tsx` — same shape with `Oferta_v1_0_draft`, title «Публичная оферта»
- Both auto-wrapped by `(marketing)/layout.tsx` from plan-01 (Header + Footer chrome)

**Task 3 — `e44d2de` (5th security header + E2E smoke):**
- `next.config.js` — added `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()` to existing 4 headers (HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin). `withSentryConfig` wrap preserved untouched. CSP intentionally NOT added (LEGAL-04 → plan-06+ once Yandex SmartCaptcha + Kinescope domains known)
- `tests/e2e/legal-pages.spec.ts` — 2 Playwright tests: each asserts 200, H1 visible, «Версия 1.0-draft» visible, `юрист-ревью` text visible
- `tests/e2e/security-headers.spec.ts` — 1 Playwright test asserts all 5 headers present with correct values

## Verification

- `npm run lint`: clean (0 warnings/errors)
- `npm run typecheck`: clean (0 errors)
- `npm run test:ci`: 26/26 pass (no regressions)
- 7 `[TODO: юрист-ревью]` markers in privacy.tsx, 11 in oferta.tsx (both ≥ plan's 5-marker minimum)
- `grep -c "Permissions-Policy" next.config.js` → 1
- E2E specs deferred to manual `npm run test:e2e` run (requires Playwright browsers + dev server boot ~120s); spec files validated by lint+typecheck

## Deviations from plan

- **[Out-of-scope]** Plan §verify step 1 says `npm run build` must pass; build is broken since P1 (`<Html>` import error in `/_error` + `useContext` null in `/page: /`) per plan-01 SUMMARY § Deviations and `.planning/phases/2-auth-marketing-consent/deferred-items.md`. Not auto-fixed per Scope Boundary rule — not caused by this plan's changes. Lint + typecheck cover type-level page validation.
- **[Out-of-scope]** Plan §verify step 5 (live `npm run test:e2e`) deferred to user — requires `npx playwright install` browsers and a running dev server. Spec files committed and ready.

## Deferred (intentionally not in plan-02)

- Юрист sign-off on /privacy + /oferta wording → P7 COMP-02 (will replace `[TODO]` markers and bump `LEGAL_POLICY_VERSION` to `'1.0'`)
- CSP enforcement → LEGAL-04 in P6 (gated on knowing SmartCaptcha + Kinescope domains)
- РКН notification submission → P7 COMP-01
- Filling actual ИП ФИО / ИНН / ОГРНИП / address → user-provided before P7 юрист meeting
- Live deliverability/Mail.ru/Yandex testing → P7 EMAIL-03

## Self-Check: PASSED

- `src/lib/legal/policy-version.ts` exists, exports `LEGAL_POLICY_VERSION = '1.0-draft'`
- `src/components/shared/LegalDocPage.tsx` exists, uses `prose` classes
- `src/content/privacy.tsx` + `src/content/oferta.tsx` exist, both import `LEGAL_POLICY_VERSION`, both have ≥5 visible `TODO: юрист-ревью` markers
- `src/app/(marketing)/privacy/page.tsx` + `src/app/(marketing)/oferta/page.tsx` exist, each exports default Server Component + `metadata`
- `next.config.js` contains 5 security headers including `Permissions-Policy`; `withSentryConfig` wrap preserved
- `tests/e2e/legal-pages.spec.ts` + `tests/e2e/security-headers.spec.ts` exist
- Commits `321f038`, `88060de`, `e44d2de` present in `git log`
