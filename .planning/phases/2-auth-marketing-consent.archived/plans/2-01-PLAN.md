---
plan: 01-shadcn-and-design-system
phase: 2
wave: 1
type: execute
maps_to: []
depends_on: []
autonomous: true
mode: mvp
estimated_tasks: 3
files_modified:
  - components.json
  - src/components/ui/button.tsx
  - src/components/ui/input.tsx
  - src/components/ui/label.tsx
  - src/components/ui/form.tsx
  - src/components/ui/checkbox.tsx
  - src/components/ui/card.tsx
  - src/components/ui/skeleton.tsx
  - src/components/ui/accordion.tsx
  - src/components/ui/alert.tsx
  - src/components/ui/dialog.tsx
  - src/components/shared/Logo.tsx
  - src/components/marketing/Header.tsx
  - src/components/marketing/Footer.tsx
  - src/app/(marketing)/layout.tsx
  - src/app/(auth)/layout.tsx
  - src/app/(app)/layout.tsx
  - src/app/globals.css
  - tailwind.config.ts
  - package.json
requirements: []
must_haves:
  truths:
    - "All shadcn primitives listed in UI-SPEC §2.1 exist in src/components/ui/"
    - "Marketing layout renders header + footer chrome on any page under (marketing)/"
    - "Auth layout renders minimal header + centered card slot"
    - "App layout placeholder exists (auth gate added in plan-08; chrome added in plan-10)"
    - "Logo + Header + Footer components compile and render real Russian copy"
    - "Tailwind typography plugin works for /privacy + /oferta in plan-02"
  artifacts:
    - path: components.json
      provides: "shadcn bootstrap config — default style, slate base, CSS vars yes (already configured in globals.css)"
    - path: src/components/ui/button.tsx
      provides: "shadcn Button primitive (CVA-based variants)"
    - path: src/components/ui/form.tsx
      provides: "RHF + shadcn integration (FormField, FormItem, FormControl, FormLabel, FormMessage, FormDescription)"
    - path: src/components/marketing/Header.tsx
      provides: "Public marketing header with Logo + Войти/Регистрация links (hamburger on mobile)"
    - path: src/components/marketing/Footer.tsx
      provides: "Footer with /privacy + /oferta links + email + Telegram + ИП placeholder"
    - path: src/app/(marketing)/layout.tsx
      provides: "Server Component layout: <Header />{children}<Footer />"
    - path: src/app/(auth)/layout.tsx
      provides: "Minimal header + centered <main> for auth forms"
  key_links:
    - from: src/app/(marketing)/layout.tsx
      to: src/components/marketing/{Header,Footer}.tsx
      via: import
      pattern: "import .* from '@/components/marketing/(Header|Footer)'"
    - from: src/components/marketing/Footer.tsx
      to: "/privacy and /oferta routes"
      via: Next.js Link
      pattern: "href=\"/privacy\"|href=\"/oferta\""
---

<objective>
Bootstrap the shadcn/ui primitive library and ship the three route-group layouts (marketing, auth, app) plus the brand chrome (Logo, Header, Footer). This is the foundation every subsequent Phase 2 plan builds on — no UI work in plans 02-10 can proceed without these primitives in place.

Purpose: Eliminate UI scaffolding burden from feature plans. After this plan, ALL feature plans import `<Button>`, `<Card>`, `<Form*>`, `<Input>`, `<Checkbox>`, `<Accordion>`, `<Dialog>`, `<Skeleton>`, `<Alert>` directly without thinking about installation. The three layouts make `(marketing)/`, `(auth)/`, `(app)/` routes Just Work.

Output:
- 9 shadcn primitives under `src/components/ui/`
- 3 brand components (`Logo`, `Header`, `Footer`) under `src/components/{shared,marketing}/`
- 3 route-group layouts (`(marketing)`, `(auth)`, `(app)`) under `src/app/`
- `components.json` bootstrap config
- Tailwind typography plugin enabled (needed for plan-02 `/privacy` + `/oferta` `prose` styling)
- New deps added to package.json: `@radix-ui/react-accordion`, `@radix-ui/react-checkbox`, `@tailwindcss/typography`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/2-auth-marketing-consent/PLAN.md
@.planning/phases/2-auth-marketing-consent/UI-SPEC.md
@.planning/phases/2-auth-marketing-consent/RESEARCH.md
@.planning/codebase/STRUCTURE.md
@.claude/skills/ui-conventions/SKILL.md
@src/app/layout.tsx
@src/app/globals.css
@tailwind.config.ts
@package.json
</context>

<interfaces>
<!-- Already-shipped primitives the layouts depend on (from P1). DO NOT recreate. -->

From src/app/layout.tsx (root layout, P1):
```typescript
// Inter font with cyrillic subset already loaded:
const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });
// <Toaster position="top-right" richColors /> already mounted — DO NOT add a second one
// <html lang="ru"> already set
```

From src/app/globals.css (CSS vars, P1):
```css
/* All shadcn HSL vars present for light + dark themes (--background, --foreground, --primary, ...) */
/* --radius: 0.5rem; */
/* Tailwind base/components/utilities layers; @layer base sets border-border + bg-background body */
```

From src/lib/utils.ts (P1):
```typescript
export function cn(...inputs: ClassValue[]): string;     // clsx + tailwind-merge
export function formatPrice(value: number): string;       // Intl.NumberFormat ru-RU RUB without копейки
```

From package.json (P1 — already installed, DO NOT re-add):
```
"@radix-ui/react-dialog": "^1.1.2",
"@radix-ui/react-dropdown-menu": "^2.1.2",
"@radix-ui/react-label": "^2.1.0",
"@radix-ui/react-slot": "^1.1.0",
"class-variance-authority": "^0.7.0",
"clsx": "^2.1.1",
"lucide-react": "^0.451.0",
"sonner": "^1.5.0",
"tailwind-merge": "^2.5.3",
"tailwindcss-animate": "^1.0.7",
"react-hook-form": "^7.53.0",
"@hookform/resolvers": "^3.9.0",
"zod": "^3.23.8",
```

From tailwind.config.ts (P1):
```
// Container: max-width 1400px at 2xl, padding 2rem (32px)
// `tailwindcss-animate` plugin already enabled
// Content globs include src/app/**/*.{ts,tsx} and src/components/**/*.{ts,tsx}
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Initialize shadcn + install all P2 primitives + Tailwind typography plugin</name>
  <files>components.json, src/components/ui/button.tsx, src/components/ui/input.tsx, src/components/ui/label.tsx, src/components/ui/form.tsx, src/components/ui/checkbox.tsx, src/components/ui/card.tsx, src/components/ui/skeleton.tsx, src/components/ui/accordion.tsx, src/components/ui/alert.tsx, src/components/ui/dialog.tsx, tailwind.config.ts, src/app/globals.css, package.json</files>
  <action>
1. Bootstrap shadcn — non-interactive: create `components.json` at repo root with the canonical config matching the existing globals.css setup:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```
Do NOT run `npx shadcn-ui@latest init` (it would prompt). The file above IS the equivalent of having run init.

2. Install all P2 shadcn primitives (each adds a file under `src/components/ui/` and may add Radix transitive deps):
```bash
npx shadcn@latest add button input label form checkbox card skeleton accordion alert dialog --yes --overwrite
```
This installs `@radix-ui/react-accordion`, `@radix-ui/react-checkbox` (NEW additions — slopcheck was unavailable per RESEARCH §Package Legitimacy Audit; both are extensions of the already-installed Radix family so are approved-ASSUMED without a separate checkpoint in plan-01). `@radix-ui/react-dialog`, `react-dropdown-menu`, `react-label`, `react-slot` are already in package.json so they are upgraded in-place if shadcn pulls newer ranges.

3. Install Tailwind typography plugin (needed by plan-02 `/privacy` + `/oferta` `prose` classes):
```bash
npm install -D @tailwindcss/typography@^0.5.15
```

4. Edit `tailwind.config.ts` — add `require('@tailwindcss/typography')` to the `plugins` array (keep existing `tailwindcss-animate` plugin). DO NOT change anything else.

5. Verify each generated UI file starts with the standard shadcn pattern (named exports, `cn()` from `@/lib/utils`, `cva` for variants where applicable). Spot-check `button.tsx` and `form.tsx` to ensure shadcn used the `New York` or default style consistent with our `components.json`. If shadcn's output uses default `style: "default"` (slate base) — keep as-is.

6. globals.css — NO EDIT needed (shadcn primitives use the HSL vars already present from P1). If shadcn writes extra vars, accept them.

7. Confirm with `ls src/components/ui/` — should list all 9-10 primitive files (button.tsx, input.tsx, label.tsx, form.tsx, checkbox.tsx, card.tsx, skeleton.tsx, accordion.tsx, alert.tsx, dialog.tsx).
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && ls src/components/ui/ | wc -l | grep -E '^\s*(9|10|11)$'</automated>
  </verify>
  <done>components.json exists at repo root; all 10 shadcn primitives under src/components/ui/; `@tailwindcss/typography` in devDependencies; tailwind.config.ts has typography plugin in plugins array; npm run lint + typecheck clean; primitives importable (e.g., `import { Button } from '@/components/ui/button'` would resolve).</done>
</task>

<task type="auto">
  <name>Task 2: Brand components (Logo, Header, Footer)</name>
  <files>src/components/shared/Logo.tsx, src/components/marketing/Header.tsx, src/components/marketing/Footer.tsx</files>
  <action>
Create three components per UI-SPEC §2.2 + §3.2 + §3.3. All Russian copy. All use `cn()` from `@/lib/utils`. All accept optional `className?: string`. Named exports only.

**Logo.tsx (Server Component, simple wordmark):**
- Path: `src/components/shared/Logo.tsx`
- Props: `interface LogoProps { className?: string }`
- Renders `<Link href="/">` wrapping `<span className="font-bold tracking-tight">VideoEdit Academy</span>`
- No image until brand identity exists (UI-SPEC §10.1)
- Accepts `className` and merges via `cn()` so callers can size it (e.g., `text-lg` in Header, `text-base` in AuthLayout)

**Header.tsx (Client Component — needs `useState` for hamburger toggle on mobile, per UI-SPEC §3.2):**
- Path: `src/components/marketing/Header.tsx`
- `'use client';` first line
- Imports: `useState` from react, `Link` from next/link, `Menu`, `X` from lucide-react, `Logo` from `@/components/shared/Logo`, `cn` from `@/lib/utils`, `Button` from `@/components/ui/button`
- Layout: `<header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">`
- Inner `<nav className="container mx-auto flex h-14 items-center justify-between md:h-16">`
- Logo on the left
- Right side (desktop: `hidden md:flex gap-3`): two links — `<Link href="/login">Войти</Link>` (ghost style) + `<Link href="/register">Регистрация</Link>` (primary CTA style)
- Mobile hamburger: `<button className="md:hidden size-11" aria-label="Меню" onClick={() => setOpen(o => !o)}>` with `Menu` icon when closed, `X` when open
- When `open` is true on mobile: render an absolutely-positioned panel below header with the two links stacked (py-3 each, touch target ≥ 44)
- Russian copy: «Войти», «Регистрация», «Меню»

**Footer.tsx (Server Component — no interactivity needed; UI-SPEC §3.3 + §9.4):**
- Path: `src/components/marketing/Footer.tsx`
- Imports: `Link` from next/link, `Mail`, `Send` from lucide-react
- `<footer className="border-t bg-secondary/30 mt-auto">`
- Container with `container mx-auto grid gap-6 py-8 md:grid-cols-3 md:py-10`
- Three columns (stack on mobile, 3-col on md+):
  1. Brand block: `<Logo />`, then `<p>` with «© 2026 VideoEdit Academy»; below: `<p className="text-xs text-muted-foreground">ИП ФИО · ИНН ХХХХХХХХХХХХ · ОГРНИП ХХХХХХХХХХХХХХХ {/* [TODO: юрист-ревью P7 — реквизиты ИП] */}</p>` (per RESEARCH §Code Examples §Footer + UI-SPEC §3.3)
  2. Documents block: `<div className="text-sm font-semibold">Документы</div>` + `<ul className="mt-2 space-y-1 text-sm">` with two `<li><Link>` entries: «Политика конфиденциальности» → `/privacy`, «Публичная оферта» → `/oferta`
  3. Contacts block: `<div className="text-sm font-semibold">Контакты</div>` + `<ul>` with `<li>` Mail icon + `mailto:support@videoedit-academy.ru` and `<li>` Send icon + `https://t.me/videoedit_academy` (target=_blank rel=noreferrer noopener)
- All [TODO] markers are INLINE comments visible in source AND visually present in the page (per UI-SPEC §0 — drafts marker rule)
- Email/Telegram values are PLACEHOLDERS — user can override before launch. They're in Russian-domain reality (`support@videoedit-academy.ru`, `@videoedit_academy`).
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && grep -l 'Политика конфиденциальности' src/components/marketing/Footer.tsx && grep -l 'Публичная оферта' src/components/marketing/Footer.tsx && grep -l "href=\"/privacy\"" src/components/marketing/Footer.tsx && grep -l "href=\"/oferta\"" src/components/marketing/Footer.tsx && grep -l 'use client' src/components/marketing/Header.tsx</automated>
  </verify>
  <done>Three component files exist with correct path; Logo is SC, Header is CC, Footer is SC; Footer contains links to /privacy + /oferta + email mailto + Telegram + ИП placeholder; Header has both desktop nav (md+) and mobile hamburger panel (md:hidden); lint + typecheck clean.</done>
</task>

<task type="auto">
  <name>Task 3: Three route-group layouts ((marketing), (auth), (app))</name>
  <files>src/app/(marketing)/layout.tsx, src/app/(auth)/layout.tsx, src/app/(app)/layout.tsx</files>
  <action>
Per UI-SPEC §3.1. All Server Components. All real (no placeholders).

**`src/app/(marketing)/layout.tsx`:**
- Server Component (no `'use client'`)
- `import { Header } from '@/components/marketing/Header';`
- `import { Footer } from '@/components/marketing/Footer';`
- Default export `MarketingLayout({ children }: { children: React.ReactNode })` returning:
```
<div className="flex min-h-screen flex-col bg-background text-foreground">
  <Header />
  <main className="flex-1">{children}</main>
  <Footer />
</div>
```
- No auth gate (this layout wraps public pages: `/`, `/courses/[slug]`, `/privacy`, `/oferta`, `/login`, `/register`, `/forgot-password`, `/reset-password`)

> Naming note: UI-SPEC §3.1 originally proposed a separate `(auth)` route group with its own `MinimalHeader`. To minimise complexity and keep auth pages discoverable under marketing chrome (consistent with Supabase docs Next.js example), we put `/login`, `/register`, `/forgot-password`, `/reset-password` under `(marketing)/` per RESEARCH §Recommended File Structure. The auth-specific minimal header is therefore not needed; the marketing Header is reused. This is the canonical decision used throughout plans 07-09. **Adjustment to UI-SPEC:** the `(auth)` route group is still created for future-proofing but uses the SAME marketing Header for now.

**`src/app/(auth)/layout.tsx`:**
- Server Component
- Returns the same chrome as marketing (re-uses Header):
```
import { Header } from '@/components/marketing/Header';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="container mx-auto max-w-md py-12 flex-1">{children}</main>
    </div>
  );
}
```
- This layout is currently NOT USED by any route in plan-01 (auth pages live under `(marketing)/` per the naming-note above). It exists as a future-proof slot — if plan-07 or later decides to route `/login` under `(auth)/`, this layout is ready. For now it has zero routes attached and adds zero overhead.

**`src/app/(app)/layout.tsx`:**
- Server Component — PLACEHOLDER ONLY in plan-01
- Renders `<>{children}</>` (no gate yet)
- Plan-08 will add `requireUser()` redirect logic
- Plan-10 will add `<AppHeader>` + `<EmailVerificationBanner>`
- Comment at top: `// Auth gate added in plan-08; chrome + banner added in plan-10.`
- This intentionally minimal stub allows plan-10's `/dashboard/page.tsx` to render in dev even before plan-08 hardens the gate
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run build</automated>
  </verify>
  <done>Three layout files exist; (marketing) wraps Header + Footer; (auth) wraps Header + centered max-w-md main; (app) is a stub passthrough with the documented TODO comment; npm run build succeeds (catches App Router config errors at compile time).</done>
</task>

</tasks>

<verification>
After all 3 tasks:
1. `npm run lint && npm run typecheck && npm run test:ci && npm run build` — must all pass
2. `ls src/components/ui/` — should list at least 10 files (button, input, label, form, checkbox, card, skeleton, accordion, alert, dialog)
3. `ls src/app/\(marketing\)/ src/app/\(auth\)/ src/app/\(app\)/` — each contains a `layout.tsx`
4. `grep -l "Политика конфиденциальности" src/components/marketing/Footer.tsx` — confirms Russian copy is in place
5. Dev smoke: `npm run dev`, open http://localhost:3000 — should render existing `src/app/page.tsx` placeholder content WITH new Header + Footer chrome (because root `/` is now under `(marketing)/` after plan-03, but in plan-01 the existing root `page.tsx` is unchanged; chrome only appears once plan-03 moves the page into the group). For plan-01, instead verify by opening http://localhost:3000/_test-marketing — won't exist, but http://localhost:3000 should still show the OLD homepage; that's expected.
</verification>

<success_criteria>
- All 10 shadcn primitives importable from `@/components/ui/*`
- `<Header />` renders Logo + Войти + Регистрация with mobile hamburger
- `<Footer />` renders links to /privacy + /oferta + email + Telegram + ИП placeholder
- `(marketing)/layout.tsx` is the shell every subsequent marketing page uses
- `(auth)/layout.tsx` exists as a future-proof slot (unused in plan-01)
- `(app)/layout.tsx` is a stub (gate added in plan-08, chrome in plan-10)
- `@tailwindcss/typography` plugin enabled (plan-02 will use `prose` classes)
- `npm run build` succeeds (no SSR boundary errors)
</success_criteria>

<out_of_scope>
- ANY page content (`page.tsx` files) — plans 02-10 own those
- AppHeader and EmailVerificationBanner — plan-10
- Auth gate logic in (app)/layout.tsx — plan-08
- `@yandex/smart-captcha` install — plan-06 (separate concern with its own human-verify checkpoint)
- shadcn `dropdown-menu` primitive — already in package.json from P1; only re-added if shadcn upgrades it
- Theme toggle UI — UI-SPEC §10.4 defers to M2; default Tailwind `.dark` class respects `prefers-color-scheme` via OS-level (no JS toggle required)
- Brand logo SVG — UI-SPEC §10.1 defers until brand identity; we ship wordmark only
- OG image — plan-05
</out_of_scope>

<references>
- UI-SPEC.md §2.1 (shadcn primitives install list), §2.2 (custom component inventory), §3.1 (route group layouts), §3.2 (Header pattern), §3.3 (Footer pattern), §11.1+11.4 (component summary tables)
- RESEARCH.md §Recommended File Structure (lines 244-302), §Code Examples §Marketing Layout (lines 988-1011), §Footer with mandatory legal links (lines 1016-1056)
- ui-conventions/SKILL.md §Дизайн-система (shadcn pattern), §Server vs Client Components
- STRUCTURE.md §Where to Add New Code (shared/, marketing/, components/ui/)
</references>

<output>
Create `.planning/phases/2-auth-marketing-consent/plans/2-01-SUMMARY.md` when done documenting:
- shadcn primitives installed (file count + names)
- Tailwind typography plugin added
- Brand components shipped (Logo SC, Header CC, Footer SC)
- Three route-group layouts created
- Any new deps in package.json
- Any deviations from UI-SPEC (e.g., the auth-route-group naming note above)
- Deferred: shadcn `sonner` (already in P1 layout.tsx — DO NOT re-add)
</output>
