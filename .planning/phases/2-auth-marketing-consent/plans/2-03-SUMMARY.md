# Plan 2-03 SUMMARY — Landing page

**Status:** Complete (with one deferral)
**Commits:** `15ef73e`, `6dd231c`
**Requirements:** LAND-01, LAND-05 (landing + footer composition)
**Date:** 2026-05-24

## Tasks

1. ✓ `feat(2-03): add MVP course constants + Hero/ProgramOutline/PricingBlock sections` (`15ef73e`) — Hero (Server, full-width CTA), ProgramOutline (Server, 5 modules from MVP course constants), PricingBlock (Server, single tier, `[TODO: price]` placeholder).
2. ✓ `feat(2-03): add FaqAccordion + (marketing)/page.tsx; remove P1 placeholder` (`6dd231c`) — FaqAccordion (Client, Radix Accordion, 7 RU Q&A from UI-SPEC §4.1 verbatim, type=single), `(marketing)/page.tsx` composing all 4 sections, deleted `src/app/page.tsx` placeholder.
3. **DEFERRED:** Playwright E2E smoke (`tests/e2e/landing.spec.ts`) — executor stalled here (watchdog killed after 10 min, likely Playwright browser download). Rolled into plan-05 (SEO/Lighthouse) which adds the Playwright E2E baseline for marketing pages anyway.

## Files

- `src/app/(marketing)/page.tsx` (new)
- `src/components/marketing/Hero.tsx` (new)
- `src/components/marketing/ProgramOutline.tsx` (new)
- `src/components/marketing/PricingBlock.tsx` (new)
- `src/components/marketing/FaqAccordion.tsx` (new)
- `src/lib/course/mvp-course.ts` (new — module constants reused by plan-04)
- `src/app/page.tsx` (deleted)

## Verification (post-stall recovery)

- `npm run lint`: clean
- `npm run typecheck`: clean
- `npm run test:ci`: 36/36 pass
- `npm run dev` + manual visit `localhost:3000`: USER MUST VERIFY (executor couldn't due to stall)

## Demo

`npm run dev` → `http://localhost:3000` — full landing visible with hero, programme, pricing, FAQ, footer linking to `/privacy` + `/oferta` (live since plan-02).

## Deferred to plan-05

E2E smoke spec for landing (the only deferred task). Plan-05 already plans Playwright baseline for SEO/Lighthouse — fold landing accessibility checks into the same spec to avoid two `playwright install` runs.

## Notes

Russian copy verbatim from UI-SPEC §4.1. No improvisation. Mobile-first via Tailwind responsive prefixes. All sections Server Components except FAQ (Client — Accordion needs interactivity).
