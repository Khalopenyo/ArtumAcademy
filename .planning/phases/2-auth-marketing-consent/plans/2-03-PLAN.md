---
plan: 03-landing-page
phase: 2
wave: 2
type: execute
maps_to: [LAND-01, LAND-05]
depends_on: [01-shadcn-and-design-system]
autonomous: true
mode: mvp
estimated_tasks: 3
files_modified:
  - src/app/(marketing)/page.tsx
  - src/components/marketing/Hero.tsx
  - src/components/marketing/ProgramOutline.tsx
  - src/components/marketing/PricingBlock.tsx
  - src/components/marketing/FaqAccordion.tsx
  - src/lib/constants/course.ts
  - src/app/page.tsx
  - tests/e2e/landing.spec.ts
requirements: [LAND-01, LAND-05]
must_haves:
  truths:
    - "Anonymous user opens / and sees Hero (H1 + lead + CTA), ProgramOutline (5 bullets), PricingBlock (price 19 900 ₽ + CTA), FaqAccordion (7 questions), Footer (from plan-01)"
    - "Hero CTA «Подробнее о курсе» links to /courses/<MVP_SLUG> (resolves once plan-04 ships)"
    - "Pricing CTA «Купить» links to /register?next=/courses/<MVP_SLUG> for anonymous (signed-in handling deferred to P3)"
    - "FAQ accordion expands one item at a time (Radix type='single' collapsible)"
    - "All sections semantic: <section aria-labelledby> with one <h1> on the page (Hero display heading)"
    - "Mobile-first: H1 text-4xl on mobile → text-5xl md+ → text-6xl lg+ per UI-SPEC §6.2"
    - "E2E smoke: page loads, all 4 section headings present, FAQ first item is clickable and expands"
  artifacts:
    - path: src/app/(marketing)/page.tsx
      provides: "GET / — renders Hero + ProgramOutline + PricingBlock + FaqAccordion. Replaces the existing src/app/page.tsx placeholder."
    - path: src/components/marketing/Hero.tsx
      provides: "Hero section (H1 display + lead + primary CTA)"
    - path: src/components/marketing/ProgramOutline.tsx
      provides: "«Что вы освоите» — 5 bullets with check icons"
    - path: src/components/marketing/PricingBlock.tsx
      provides: "«Стоимость курса» — Card with price + features + CTA (uses formatPrice util)"
    - path: src/components/marketing/FaqAccordion.tsx
      provides: "FAQ section using shadcn Accordion (CC), 7 Russian Q&A from UI-SPEC §4.1"
    - path: src/lib/constants/course.ts
      provides: "MVP_COURSE_SLUG + MVP_COURSE_PRICE_MINOR — single source of truth shared with plan-04 seed"
  key_links:
    - from: src/app/(marketing)/page.tsx
      to: src/components/marketing/{Hero,ProgramOutline,PricingBlock,FaqAccordion}.tsx
      via: import
      pattern: "from '@/components/marketing/"
    - from: src/components/marketing/Hero.tsx + PricingBlock.tsx
      to: /courses/<MVP_COURSE_SLUG>
      via: Next.js Link
      pattern: "href.*MVP_COURSE_SLUG"
    - from: src/components/marketing/PricingBlock.tsx
      to: /register?next=/courses/<MVP_COURSE_SLUG>
      via: Next.js Link
      pattern: "register\\?next="
---

<objective>
First demo-ready milestone: a real Russian landing page that loads in the browser and shows what we're selling. After this plan, `npm run dev` and opening `http://localhost:3000` shows the actual marketing site (not the P1 placeholder).

Purpose: LAND-01 is the front door of the funnel. UI-SPEC §4.1 fully specifies the screen with Russian copy + ASCII layout — we faithfully implement that spec. LAND-05 is the footer requirement, already satisfied structurally in plan-01 — but this plan completes it by linking from CTAs back to legal pages (via shared chrome).

Output:
- 4 marketing section components (Hero, ProgramOutline, PricingBlock, FaqAccordion)
- `/` route page that renders them under marketing chrome
- Old `src/app/page.tsx` placeholder REMOVED (route now resolves through `(marketing)/page.tsx`)
- Shared constants module for MVP course slug + price
- Playwright E2E smoke
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
@.claude/skills/ui-conventions/SKILL.md
@src/app/page.tsx
@src/lib/utils.ts
</context>

<interfaces>
From src/components/ui/* (plan-01 shadcn primitives):
```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
```

From src/lib/utils.ts (P1):
```typescript
export function formatPrice(value: number): string;  // ru-RU RUB, no kopecks → "19 900 ₽"
export function cn(...inputs: ClassValue[]): string;
```

From src/app/(marketing)/layout.tsx (plan-01):
Wraps {children} with Header + Footer; main has flex-1.

From lucide-react (P1 already in package.json):
```
import { ArrowRight, Check } from 'lucide-react';
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Constants module + Hero + ProgramOutline + PricingBlock</name>
  <files>src/lib/constants/course.ts, src/components/marketing/Hero.tsx, src/components/marketing/ProgramOutline.tsx, src/components/marketing/PricingBlock.tsx</files>
  <action>
1. **`src/lib/constants/course.ts`** — single source of truth for MVP course identity (referenced by Hero CTA, Pricing CTA, plan-04 seed, plan-04 query):
```typescript
/**
 * MVP-фаза: один курс. Финальный slug — на executor этапе (UI-SPEC §10.8).
 * Тот же slug используется в Hero CTA + PricingBlock CTA + supabase/seed.sql (plan-04).
 * Цена тоже синхронизирована с seed для consistency (real source of truth — БД, но MVP жёстко привязан).
 */
export const MVP_COURSE_SLUG = 'videoedit-mvp';
export const MVP_COURSE_PRICE_MINOR = 1_990_000; // 19 900 ₽ in копейках
```

2. **`src/components/marketing/Hero.tsx`** (Server Component, no `'use client'`). Per UI-SPEC §4.1 + §6.2 mobile-first sizing:
- `<section aria-labelledby="hero-title" className="bg-background py-16 md:py-24 lg:py-32">`
- Container max-w-4xl
- `<h1 id="hero-title" className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">Профессиональный монтаж видео — за 8 недель</h1>`
- Lead paragraph: `<p className="mt-6 text-lg text-muted-foreground max-w-2xl">Авторский курс с разбором реальных проектов. DaVinci Resolve, цветокор, звук и графика — от первого реза до экспорта.</p>`
- CTA: `<div className="mt-8"><Button asChild size="lg"><Link href={`/courses/${MVP_COURSE_SLUG}`}>Подробнее о курсе <ArrowRight className="ml-2 size-4" /></Link></Button></div>`
- Text-only hero — no illustration (UI-SPEC §10.6)

3. **`src/components/marketing/ProgramOutline.tsx`** (Server Component). Per UI-SPEC §4.1 program section copy:
- `<section aria-labelledby="program-title" className="bg-background py-12 md:py-16">`
- Container
- `<h2 id="program-title" className="text-2xl font-semibold tracking-tight md:text-3xl">Что вы освоите</h2>`
- Below: `<ul className="mt-6 space-y-3 max-w-2xl">` with 5 `<li className="flex items-start gap-3 text-base">` items, each starting with `<Check className="size-5 mt-0.5 shrink-0 text-primary" aria-hidden="true" />` + text:
  1. «DaVinci Resolve с нуля — установка, интерфейс, рабочий процесс»
  2. «Цветокоррекция и грейдинг для разных типов видео»
  3. «Звук: чистка, эквалайзер, музыкальное сопровождение»
  4. «Графика, титры и базовый motion-дизайн»
  5. «Экспорт под YouTube, Reels, TikTok и заказчиков»

4. **`src/components/marketing/PricingBlock.tsx`** (Server Component). Per UI-SPEC §4.1 pricing block:
- `<section aria-labelledby="pricing-title" className="bg-secondary/30 py-12 md:py-16">`
- Container
- `<h2 id="pricing-title" className="text-2xl font-semibold tracking-tight md:text-3xl text-center">Стоимость курса</h2>`
- Centered single Card (max-w-md mx-auto mt-8):
  - CardHeader: `<CardTitle>Полный курс</CardTitle>` + `<CardDescription>Единоразовый платёж — без подписок и автосписаний</CardDescription>`
  - CardContent: large price `<div className="text-4xl font-semibold">{formatPrice(MVP_COURSE_PRICE_MINOR / 100)}</div>` (renders "19 900 ₽"); below `<ul className="mt-6 space-y-2 text-sm">` with three check-prefixed items: «24 урока · около 12 часов видео» / «Доступ навсегда» / «Фискальный чек по 54-ФЗ»
  - CardFooter: `<Button asChild className="w-full" size="lg"><Link href={`/register?next=/courses/${MVP_COURSE_SLUG}`}>Купить</Link></Button>`
- Caption below card: `<p className="mt-4 text-center text-sm text-muted-foreground">Оплата через ЮKassa — карты Visa, Mastercard, Мир и СБП.</p>`
- Note: for authed users the link still resolves (plan-08 middleware will see authenticated user hitting `/register` and redirect them to the `next=` URL via the auth-gate logic; phase-3 will replace this CTA with a Server Action). In P2 the link is universal.
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && grep -q "MVP_COURSE_SLUG" src/lib/constants/course.ts && grep -q "MVP_COURSE_SLUG" src/components/marketing/Hero.tsx && grep -q "MVP_COURSE_SLUG" src/components/marketing/PricingBlock.tsx && grep -q "Полный курс" src/components/marketing/PricingBlock.tsx && grep -q "Что вы освоите" src/components/marketing/ProgramOutline.tsx && grep -q "Профессиональный монтаж" src/components/marketing/Hero.tsx</automated>
  </verify>
  <done>Constants module + 3 SC files created; Hero has single H1 (`hero-title`); Program + Pricing have H2 with aria-labelledby; all CTAs use `<Button asChild><Link>` pattern; MVP_COURSE_SLUG + MVP_COURSE_PRICE_MINOR defined and reused across components.</done>
</task>

<task type="auto">
  <name>Task 2: FaqAccordion (Client Component) + (marketing)/page.tsx + remove root page.tsx</name>
  <files>src/components/marketing/FaqAccordion.tsx, src/app/(marketing)/page.tsx, src/app/page.tsx</files>
  <action>
1. **`src/components/marketing/FaqAccordion.tsx`** — Client Component (`'use client';` first line) because Radix Accordion uses React state. Per UI-SPEC §4.1 Q1-Q7. Use the `Accordion type="single" collapsible` mode so one item open at a time. Each `AccordionItem` has unique `value` (e.g. `q-0`, `q-1`). All Russian copy verbatim from UI-SPEC table. Q5 keeps the `[TODO: юрист-ревью wording]` marker inline (intentional — visible juridical placeholder per spec convention). Final FAQ contains 7 items:
   - Q1: «Сколько длится курс и сколько уделять времени?» → «24 урока — около 12 часов видео. В удобном темпе 1-2 часа в неделю — за 8 недель пройдёте полностью.»
   - Q2: «Какое нужно ПО?» → «DaVinci Resolve — бесплатная версия покрывает 95% курса. Платный Studio только если планируете коммерческий монтаж.»
   - Q3: «Как происходит оплата?» → «Через ЮKassa: карты Мир, Visa, Mastercard и СБП. Фискальный чек по 54-ФЗ приходит на email сразу после оплаты.»
   - Q4: «Можно вернуть деньги?» → «Да, в течение 14 дней, если урок ещё не начат. Подробности — в Публичной оферте.»
   - Q5: «Получу ли я сертификат?» → «В MVP-версии — нет. Это образовательный контент, не лицензированная программа. [TODO: юрист-ревью wording]»
   - Q6: «Можно скачать уроки?» → «Нет — видео защищены и доступны только в плеере на сайте после покупки. Это защищает контент и сохраняет цену курса для всех.»
   - Q7: «С какого устройства смотреть?» → «С любого: телефон, планшет, ноутбук. Сайт адаптирован под мобильный.»

Container wrapper: `<section aria-labelledby="faq-title" className="container mx-auto py-12 md:py-16">` with `<h2 id="faq-title">Частые вопросы</h2>` and `<Accordion ... className="mt-6 max-w-3xl">` containing the 7 items mapped from a const array.

2. **`src/app/(marketing)/page.tsx`** — the new landing route. Server Component. Imports the 4 sections + renders them in order:
```tsx
import { Hero } from '@/components/marketing/Hero';
import { ProgramOutline } from '@/components/marketing/ProgramOutline';
import { PricingBlock } from '@/components/marketing/PricingBlock';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';

export default function MarketingHomePage() {
  return (
    <>
      <Hero />
      <ProgramOutline />
      <PricingBlock />
      <FaqAccordion />
    </>
  );
}
```
No `metadata` export here — plan-05 owns SEO metadata for `/` and all marketing pages.

3. **DELETE `src/app/page.tsx`** — the P1 placeholder. With `(marketing)/page.tsx` in place, Next.js App Router resolves `/` through the route group. Verify no other reference to the old placeholder exists by `grep -r "Начать обучение" src/ tests/`.

> If you cannot delete via your tool, replace with: `export { default } from './(marketing)/page';` — but DO NOT keep the placeholder content (LAND-01 success criterion #1 requires hero + pricing + FAQ + footer; the placeholder text «Здесь будет лендинг» would fail verification).
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run build && grep -q "'use client'" src/components/marketing/FaqAccordion.tsx && grep -q "Частые вопросы" src/components/marketing/FaqAccordion.tsx && grep -q "type=\"single\"" src/components/marketing/FaqAccordion.tsx && test ! -f src/app/page.tsx -o ! "$(grep -l 'Здесь будет лендинг' src/app/page.tsx 2>/dev/null)" && ls src/app/\(marketing\)/page.tsx</automated>
  </verify>
  <done>FaqAccordion is a CC with 7 Russian Q&A; (marketing)/page.tsx renders all 4 sections in order; old src/app/page.tsx is either deleted or just re-exports the marketing page; npm run build succeeds (Next.js validates route resolution).</done>
</task>

<task type="auto">
  <name>Task 3: Playwright E2E smoke for landing</name>
  <files>tests/e2e/landing.spec.ts</files>
  <action>
Single Playwright spec verifying LAND-01 + LAND-05 success criteria. Use the auto-launched dev server (existing playwright.config.ts launches `npm run dev`).

```typescript
import { test, expect } from '@playwright/test';

test.describe('Landing page (LAND-01, LAND-05)', () => {
  test('renders Hero + Program + Pricing + FAQ + Footer', async ({ page }) => {
    await page.goto('/');
    // Hero H1
    await expect(
      page.getByRole('heading', { level: 1, name: /профессиональный монтаж видео/i })
    ).toBeVisible();
    // Program H2
    await expect(page.getByRole('heading', { level: 2, name: /что вы освоите/i })).toBeVisible();
    // Pricing H2 + price
    await expect(page.getByRole('heading', { level: 2, name: /стоимость курса/i })).toBeVisible();
    await expect(page.getByText(/19\s?900\s?₽/)).toBeVisible();
    // FAQ H2
    await expect(page.getByRole('heading', { level: 2, name: /частые вопросы/i })).toBeVisible();
    // Footer links (LAND-05)
    await expect(page.getByRole('link', { name: /политика конфиденциальности/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /публичная оферта/i })).toBeVisible();
  });

  test('FAQ first item expands when clicked', async ({ page }) => {
    await page.goto('/');
    const firstQ = page.getByRole('button', { name: /сколько длится курс/i });
    await firstQ.click();
    await expect(page.getByText(/24 урока/i)).toBeVisible();
  });

  test('Hero CTA links to /courses/videoedit-mvp', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('link', { name: /подробнее о курсе/i });
    await expect(cta).toHaveAttribute('href', /\/courses\/videoedit-mvp/);
  });

  test('Pricing CTA links to /register with next param', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('link', { name: /^купить$/i });
    await expect(cta).toHaveAttribute('href', /\/register\?next=\/courses\/videoedit-mvp/);
  });
});
```
  </action>
  <verify>
    <automated>npm run lint && ls tests/e2e/landing.spec.ts</automated>
  </verify>
  <done>tests/e2e/landing.spec.ts exists with 4 test cases covering Hero+Program+Pricing+FAQ+Footer rendering, FAQ expand, and both CTA hrefs; lint clean.</done>
</task>

</tasks>

<verification>
After all 3 tasks:
1. `npm run lint && npm run typecheck && npm run test:ci && npm run build` — must pass
2. `npm run dev`, open http://localhost:3000 — should render new landing with all 4 sections + header from plan-01 + footer from plan-01
3. Click FAQ items — accordion works (one open at a time)
4. Click «Подробнее о курсе» → goes to /courses/videoedit-mvp (404 until plan-04, that's fine)
5. Click «Купить» → goes to /register?next=/courses/videoedit-mvp (404 until plan-07, that's fine)
6. Click «Политика конфиденциальности» in footer → goes to /privacy (plan-02 must be merged for this to resolve; if plan-02 not yet shipped, /privacy returns 404 — verify chrome present nevertheless)
7. `npm run test:e2e -- tests/e2e/landing.spec.ts` — passes (requires Playwright browsers installed)
</verification>

<success_criteria>
- LAND-01 satisfied: landing renders Hero (H1 + lead + CTA), ProgramOutline (5 bullets), PricingBlock (price + features + CTA), FaqAccordion (7 Russian Q&A), Footer with Telegram + email
- LAND-05 satisfied: footer contains /privacy + /oferta + email mailto + Telegram link + ИП placeholder (delivered by plan-01 Footer component; this plan verifies it renders on `/`)
- Single H1 on the page (Hero), all sections semantic
- Old P1 placeholder gone — `/` is the real product
- MVP_COURSE_SLUG centralised — plan-04 seed reads from the same constant
</success_criteria>

<out_of_scope>
- LAND-03 (Lighthouse mobile-perf ≥ 80) — plan-05 audits it (this plan's mobile-first Tailwind code IS the implementation, but the AUDIT is in plan-05)
- LAND-04 (SEO baseline + robots/sitemap/OG) — plan-05
- Course preview page `/courses/[slug]` — plan-04
- Animations / framer-motion section fade-ins — UI-SPEC §8.1 makes them optional; skip in P2 (no-cost choice)
- Hero illustration — UI-SPEC §10.6 defers to M2
- Дополнительные секции (reviews, testimonials, instructor bio) — UI-SPEC §10 + REQUIREMENTS exclude from M1
</out_of_scope>

<references>
- UI-SPEC.md §4.1 (full landing spec with ASCII + Russian copy + states + interactions)
- UI-SPEC.md §6.2 (mobile-first sizing per breakpoint)
- UI-SPEC.md §10.8 (MVP course slug decision)
- RESEARCH.md §Code Examples §FAQ Accordion (lines 1131-1156)
- REQUIREMENTS.md LAND-01, LAND-05
- ui-conventions/SKILL.md §Server vs Client Components, §Стилизация (mobile-first), §Доступность
</references>

<output>
Create `.planning/phases/2-auth-marketing-consent/plans/2-03-SUMMARY.md` when done documenting:
- 4 marketing section components (Hero SC, ProgramOutline SC, PricingBlock SC, FaqAccordion CC)
- MVP_COURSE_SLUG + MVP_COURSE_PRICE_MINOR constants in `src/lib/constants/course.ts`
- (marketing)/page.tsx replaces old src/app/page.tsx
- E2E smoke test (4 cases)
- Deferred: animations (UI-SPEC §8.1 optional), Lighthouse audit (plan-05), SEO metadata (plan-05)
</output>
