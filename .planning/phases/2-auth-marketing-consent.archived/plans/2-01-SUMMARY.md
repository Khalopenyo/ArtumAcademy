---
phase: 2
plan: 01-shadcn-and-design-system
wave: 1
status: complete
completed: 2026-05-24
requirements: []
commits: [bad9da8, d75607b, 43ca121]
duration: 10m
---

# Phase 2 Plan 01: shadcn + Design System Summary

Bootstrapped shadcn/ui primitive library (10 components) + Tailwind typography plugin + brand chrome (Logo / Header / Footer) + three route-group layouts ((marketing) / (auth) / (app)). Foundation for all Phase 2 UI work.

## What changed

**Task 1 — `bad9da8` (shadcn bootstrap + 10 primitives + typography plugin):**
- `components.json` — canonical shadcn config (style=default, baseColor=slate, cssVariables=true, alias `@/components/ui`)
- `src/components/ui/` — 10 files via `npx shadcn@latest add`: `accordion alert button card checkbox dialog form input label skeleton`
- `tailwind.config.ts` — shadcn auto-injected accordion-down/up keyframes + animations (Radix Accordion); added `require('@tailwindcss/typography')` to plugins (needed by plan-02 `/privacy` + `/oferta` `prose` classes)
- `package.json` new deps: `@radix-ui/react-accordion ^1.2.12`, `@radix-ui/react-checkbox ^1.3.3`, `@tailwindcss/typography ^0.5.15`. Caret-compatible bumps within locked majors: `@hookform/resolvers 3.9 → 3.10`, `react-hook-form 7.53 → 7.76`, `zod 3.23 → 3.25`, `@radix-ui/react-{dialog,label,slot}` minor bumps

**Task 2 — `d75607b` (brand components):**
- `src/components/shared/Logo.tsx` (SC) — wordmark «VideoEdit Academy» wrapped in `<Link href="/">` (no SVG yet, UI-SPEC §10.1)
- `src/components/marketing/Header.tsx` (CC) — sticky h-14/h-16 nav, desktop: Logo + Войти (ghost) + Регистрация (primary), mobile: Menu/X hamburger toggle with stacked panel (min-h-11 touch targets per WCAG 2.5.5)
- `src/components/marketing/Footer.tsx` (SC) — three-column grid: brand + ИП placeholder with `[TODO: юрист-ревью P7]` inline marker, Документы (/privacy + /oferta), Контакты (mailto:support@videoedit-academy.ru + t.me/videoedit_academy)

**Task 3 — `43ca121` (three route-group layouts):**
- `src/app/(marketing)/layout.tsx` — Header + main flex-1 + Footer chrome for /, /courses/[slug], /privacy, /oferta, and auth pages (per RESEARCH §Recommended File Structure)
- `src/app/(auth)/layout.tsx` — future-proof slot with same Header chrome + centered max-w-md main; currently no routes attached (auth lives under (marketing)/)
- `src/app/(app)/layout.tsx` — minimal passthrough stub; plan-08 adds requireUser gate, plan-10 adds AppHeader + EmailVerificationBanner

## Verification

- `npm run lint`: clean
- `npm run typecheck`: clean (still 0 errors from plan-00 baseline)
- `npm run test:ci`: 26/26 pass (no regressions)
- `npm run dev`: clean start in 3.5s
- `ls src/components/ui/ | wc -l`: 10
- All three route-group layouts present, Footer has «Политика конфиденциальности» + «Публичная оферта»

## Deviations from plan

- **[Rule 3 - Blocking]** Plan §UI-SPEC §3.1 originally proposed a separate `MinimalHeader` for `(auth)/`. Adjusted per plan-01 instructions to reuse `<Header />` from marketing (consistent with Supabase Next.js docs example + RESEARCH §Recommended File Structure). Documented in `(auth)/layout.tsx` doc comment.
- **[Out-of-scope]** `npm run build` fails on `/_error: /404 + /500` and `/page: /` with `<Html>` import error + `useContext` null. Reproduced on fresh clone at commit `4368987` (before plan-01) — pre-existing from P1's `withSentryConfig` wrap (commit `d8d46be`). Logged to `.planning/phases/2-auth-marketing-consent/deferred-items.md`. Not auto-fixed per Scope Boundary rule.

## Deferred (not in plan-01)

- shadcn `sonner` (already in P1 `layout.tsx` — DO NOT re-add)
- shadcn `dropdown-menu` (already in `@radix-ui/react-dropdown-menu` from P1)
- Brand SVG logo (UI-SPEC §10.1 defers to M2 once brand identity exists)
- Theme toggle UI (UI-SPEC §10.4 defers to M2; OS-level `prefers-color-scheme` handles dark mode)

## Self-Check: PASSED

- `components.json` present at repo root
- 10 shadcn primitives in `src/components/ui/`
- `@tailwindcss/typography ^0.5.15` in `devDependencies`
- `tailwind.config.ts` has typography plugin in `plugins` array
- `src/components/shared/Logo.tsx`, `src/components/marketing/{Header,Footer}.tsx` exist
- All three route-group layouts exist
- Commits `bad9da8`, `d75607b`, `43ca121` present in `git log`
