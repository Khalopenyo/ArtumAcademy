---
phase: 2
slug: auth-marketing-consent
status: draft
shadcn_initialized: false
shadcn_planned: true
preset: manual (Radix + CVA already in package.json; components.json bootstrap deferred to first execute step)
created: 2026-05-24
audience: "Российская/СНГ аудитория, начинающие→практикующие видеомонтажёры, 22–40 лет"
ui_language: ru
quality_bar: "adequate (solo MVP), не premium"
---

# Phase 2 — UI Design Contract: Auth + Marketing Shell + 152-ФЗ Consent

> Контракт визуала и взаимодействия для 11 экранов фазы 2. Источник правды для `gsd-planner`, `gsd-executor`, `gsd-ui-checker`. Mobile-first, RU UI, light + dark theme. Lighthouse mobile-perf ≥ 80.

> **Локализация решений:** все pre-existing pieces (Inter cyrillic font в `src/app/layout.tsx`, Toaster от sonner, shadcn CSS-variables в `globals.css`, Tailwind config с container 1400px max) сохраняются. Этот документ их **доуточняет**, а не заменяет.

---

## 0. Глоссарий и условные обозначения

- **CTA** — primary call-to-action button (one per screen максимум).
- **Token** — design token, mapped on Tailwind utility или CSS variable из `globals.css`.
- **RHF** — React Hook Form. **Zod** — общая схема для client + server валидации.
- **SC** — Server Component (no `'use client'`). **CC** — Client Component (с `'use client'`).
- **Touch target** — минимум 44×44px для интерактивных элементов на мобильном (WCAG 2.5.5).
- **Drafts marker** — в `/privacy` и `/oferta` все места требующие юриста-ревью в P7 помечены `[TODO: юрист-ревью]` inline (видны разработчику, не скрыты от пользователя — это часть compliance evidence).

---

## 1. Design tokens

### 1.1 Шрифты

| Role | Family | Source | Subsets |
|------|--------|--------|---------|
| Sans (UI + body) | **Inter** | `next/font/google` (уже в `layout.tsx`) | `latin`, `cyrillic` |
| Mono (опц., в коде ошибок) | system mono | `font-mono` от Tailwind defaults | — |

> Без второго шрифта. Один Inter покрывает все начертания (regular 400, semibold 600). Заголовки и body отличаются только размером + весом — не семейством.

### 1.2 Type scale (4 размера, 2 веса)

| Token | Tailwind | Size | Line-height | Weight | Usage |
|-------|----------|------|-------------|--------|-------|
| body | `text-base` | 16px | 1.5 (24px) | 400 | Основной текст параграфов, формы, body карточек |
| label | `text-sm` | 14px | 1.5 (21px) | 600 | Лейблы форм, метки, секции FAQ, footer |
| heading | `text-2xl` (mobile) / `text-3xl` (md+) | 24/30px | 1.2 | 600 | H2 секций, заголовки FAQ items, заголовки auth-карточек |
| display | `text-4xl` (mobile) / `text-5xl` (md+) / `text-6xl` (lg+) | 36/48/60px | 1.1 | 600 | Только hero на `/` (H1 страницы) |

**Exceptions:**
- В footer `text-xs` (12px) допустим только для copyright-строки и тонких юридических подписей. Не для интерактивных ссылок.
- `text-lg` (18px) разрешён только для lead-параграфа под H1/display (один на странице).

### 1.3 Spacing scale (8-point + 4px microspacing)

| Token | Tailwind | px | Usage |
|-------|----------|----|-------|
| xs | `1` | 4 | Gaps между иконкой и текстом в кнопке/чекбоксе |
| sm | `2` | 8 | Gap между подписью и инпутом, padding в badge/chip |
| md | `4` | 16 | Default gap элементов формы, padding карточки на мобильном |
| lg | `6` | 24 | Padding карточки на десктопе, vertical gap между form-блоками |
| xl | `8` | 32 | Section padding (top/bottom внутри секции) |
| 2xl | `12` | 48 | Major break между секциями лендинга |
| 3xl | `16` | 64 | Hero top/bottom padding на mobile, между hero и первой секцией |
| 4xl | `24` | 96 | Hero top/bottom padding на desktop (lg+) |

**Exceptions:**
- `min-h-[44px]` (44px) для всех touch targets — продиктовано WCAG, не вписывается в 8-point, но обязательно.
- Container max-width: 1400px (наследуется из `tailwind.config.ts`), padding `px-4 md:px-6 lg:px-8`.

### 1.4 Color palette

**60/30/10 split, на основе существующих shadcn-vars в `globals.css`:**

| Role | Light HSL | Dark HSL | Reserved for |
|------|-----------|----------|--------------|
| **Dominant (60%) — background** | `0 0% 100%` (`#FFFFFF`) | `240 10% 3.9%` (≈ `#0A0A0B`) | Основной фон страниц, body карточек |
| **Secondary (30%) — secondary/muted** | `240 4.8% 95.9%` (≈ `#F3F3F5`) | `240 3.7% 15.9%` (≈ `#27272A`) | Carded blocks (FAQ items, форма-обёртка), nav, footer, accordion panels |
| **Accent (10%) — primary** | `240 5.9% 10%` (≈ `#1A1A1F`) | `0 0% 98%` (≈ `#FAFAFA`) | **Только**: primary CTA buttons («Купить», «Зарегистрироваться», «Войти», «Сбросить пароль»), active form-submit, active link state в навигации |
| **Destructive (semantic 2)** | `0 84.2% 60.2%` (≈ `#EF4444`) | `0 62.8% 30.6%` (≈ `#7F1D1D`) | **Только**: inline form-errors, error toast, banner про unverified email, иконка предупреждения |
| **Border** | `240 5.9% 90%` | `240 3.7% 15.9%` | Все рамки (форм, карточек, дивайдеров) |
| **Ring (focus)** | `240 5.9% 10%` | `240 4.9% 83.9%` | `focus-visible:ring-2 ring-ring` — НЕ убирать |

**Accent reserved-for list (явно):**
1. Кнопка «Купить» на `/courses/[slug]`
2. Кнопка «Зарегистрироваться» на `/register`
3. Кнопка «Войти» на `/login`
4. Кнопка «Отправить ссылку» на `/forgot-password`
5. Кнопка «Сбросить пароль» на `/reset-password`
6. Кнопка «Каталог» в empty state `/dashboard`
7. CTA в hero `/` («Подробнее о курсе» — ведёт на `/courses/[slug]`)

**Forbidden:**
- Не использовать accent (primary color) для второстепенных кнопок («Назад», «Отменить», «Закрыть») — для них `variant="outline"` или `variant="ghost"`.
- Не использовать destructive для cancel buttons. Destructive только для реально деструктивных действий (логаут — это не деструктив, это `variant="ghost"`; delete account — это деструктив, но он в Phase 6).
- Не вводить третий semantic color (success-green, warning-yellow) в P2. Подтверждение успеха — sonner success toast (зелёный — встроен в библиотеку, не наш token).

### 1.5 Border radius

| Token | Tailwind | Value | Usage |
|-------|----------|-------|-------|
| sm | `rounded-sm` | 2px | Чекбоксы, мелкие badges |
| md | `rounded-md` | 6px | Кнопки, инпуты, FAQ items |
| lg | `rounded-lg` | 8px | Карточки (форма-обёртка, hero-карточка курса) |
| full | `rounded-full` | 9999px | Avatar placeholder, статус-индикатор |

Радиус — наследуется из `--radius: 0.5rem` в `globals.css`. Не переопределять.

### 1.6 Shadow

Минимум shadow. Solo MVP — без layered depth.

| Token | Tailwind | Usage |
|-------|----------|-------|
| none | `shadow-none` | Default — большинство элементов |
| sm | `shadow-sm` | Hover state карточек курса, primary CTA |
| md | `shadow-md` | Только модалки (dialog) |

**Forbidden:**
- `shadow-2xl`, `shadow-inner`, custom box-shadows — overengineering для MVP.
- Glow / colored shadows — это premium design, не наш квалитет.

### 1.7 Z-index layers

| Layer | z-index | Usage |
|-------|---------|-------|
| base | `z-0` | Контент страницы |
| sticky-header | `z-30` | Header `sticky top-0` |
| banner | `z-40` | Email-verification banner (above header? — no, под header) |
| dialog-backdrop | `z-50` | Radix Dialog overlay (наследуется из shadcn) |
| toast | `z-50+` | Sonner toaster (управляется библиотекой) |

---

## 2. Component inventory

### 2.1 shadcn primitives (install order, P2 первая команда executor)

```bash
npx shadcn-ui@latest init  # bootstrap components.json (выбрать: Default style, slate base, CSS vars yes — уже есть)

# Form & input primitives (LAND + AUTH)
npx shadcn-ui@latest add button input label form checkbox

# Layout & feedback
npx shadcn-ui@latest add card skeleton

# Interactive (FAQ)
npx shadcn-ui@latest add accordion

# Verification banner / inline notes
npx shadcn-ui@latest add alert

# Email-verification banner CTA "Отправить заново" → confirm modal
npx shadcn-ui@latest add dialog

# Footer email + Telegram dropdown (опц.)
# Sonner уже подключён в layout.tsx — НЕ переустанавливать
```

### 2.2 Custom feature components

Создаются в эту фазу. Каждый — named export, `interface Props`, без `default export`.

**`src/components/marketing/`:**
- `Header.tsx` (CC — нужен для sticky logic + theme toggle опц.) — public layout header (logo + Войти / Регистрация на десктопе, hamburger на мобильном)
- `Footer.tsx` (SC) — копирайт, ссылки на `/privacy`, `/oferta`, email mailto, Telegram link
- `Hero.tsx` (SC) — заголовок + sub + CTA для `/`
- `ProgramOutline.tsx` (SC) — описание программы курса (без access — public preview из `getCourseBySlug`)
- `PricingBlock.tsx` (SC) — одна карточка с ценой курса, CTA «Купить» (для аноним → `/register?next=...`)
- `FaqAccordion.tsx` (CC — `'use client'` нужен для Radix Accordion state) — обёртка над shadcn Accordion с массивом QA из props
- `EmailVerificationBanner.tsx` (CC) — горизонтальная alert-полоса под header, видна только если `user && !user.email_confirmed_at`
- `CoursePreviewCard.tsx` (SC) — карточка курса на `/courses/[slug]` (обложка, длительность, модули список без lessons)

**`src/components/auth/`** (новая папка — добавить в `STRUCTURE.md` neighbors):
- `RegisterForm.tsx` (CC) — RHF + Zod, два чекбокса согласий, SmartCaptcha
- `LoginForm.tsx` (CC) — RHF + Zod, email + password + «Забыли пароль?» link
- `ForgotPasswordForm.tsx` (CC) — email + SmartCaptcha
- `ResetPasswordForm.tsx` (CC) — new password + confirm
- `ConsentCheckboxes.tsx` (CC) — два чекбокса (privacy + oferta) с встроенными ссылками и evidence-полями
- `SmartCaptchaWidget.tsx` (CC) — обёртка над Yandex SmartCaptcha script (загрузка через `next/script` strategy="lazyOnload")
- `AuthLayout.tsx` (SC) — центрированная карточка-обёртка для всех auth страниц (max-w-md)

**`src/components/shared/`:**
- `Logo.tsx` (SC) — словесный логотип «VideoEdit Academy» (без SVG до момента когда будет brand identity)
- `LegalDocPage.tsx` (SC) — обёртка для рендера MDX/markdown `/privacy` + `/oferta` (типография `prose prose-neutral dark:prose-invert`)

### 2.3 Иконки

Только `lucide-react`. Размер: `size-4` (16px) inline в кнопках/тексте, `size-5` (20px) в нав-элементах, `size-6` (24px) в hero/empty states, `size-12` (48px) в больших empty states.

**Иконки используемые в P2:**
- `LogIn` — header «Войти» icon (опц. рядом с текстом на десктопе)
- `UserPlus` — header «Регистрация» icon (опц.)
- `Menu` / `X` — hamburger toggle на мобильном
- `Mail` — footer email link, email verification banner
- `MessageCircle` — footer Telegram link (нет иконки Telegram в lucide; используем `Send` или `MessageCircle`)
- `Send` — footer Telegram (рекомендую `Send`, читается как «отправить сообщение»)
- `AlertCircle` — `destructive` alert (form errors, banner)
- `CheckCircle2` — success states (опц., sonner сам рендерит)
- `Loader2` — `animate-spin` на кнопках во время `pending` (вместе с текстом)
- `Eye` / `EyeOff` — toggle password visibility (опц., полезно для мобильного)
- `ChevronDown` — accordion expand indicator (shadcn вшит)
- `ExternalLink` — рядом с consent ссылками `/privacy` `/oferta` (намёк что откроется в новом табе)
- `BookOpen` — empty state иконка для пустого `/dashboard`
- `ArrowRight` — CTA внутри hero (опц., после текста)

### 2.4 Animation library usage

`framer-motion` уже в package.json. **Budget строгий** — см. §8.

---

## 3. Layout patterns

### 3.1 Route group layouts (Next.js App Router)

**`src/app/(marketing)/layout.tsx`** (new — public, для `/`, `/courses/[slug]`, `/privacy`, `/oferta`):
- Server Component
- Структура: `<Header /> {children} <Footer />`
- Background: `bg-background text-foreground`
- Без auth gate

**`src/app/(auth)/layout.tsx`** (new route group `(auth)` — отдельно от `(marketing)`):
- Server Component
- Структура: `<MinimalHeader /> <main className="container max-w-md py-12">{children}</main>`
- Без footer (минимизируем отвлечение от формы)
- Routes внутри: `/register`, `/login`, `/forgot-password`, `/reset-password`

> **Rationale разделения marketing vs auth:** auth-страницы — focused conversion path, не нуждаются в hero-навигации и full footer. Это **отдельный route group** для clear separation, без влияния на URL.

**`src/app/(app)/layout.tsx`** (new — auth-gated, для `/dashboard`):
- Server Component с `requireUser()` (см. `src/lib/auth/require.ts`)
- Редирект на `/login?next=<current-path>` если no user
- Структура: `<AppHeader user={user} /> <main className="container py-8">{children}</main>`
- Сохраняет `<Footer />` минимальный — только copyright + privacy/oferta links

### 3.2 Header pattern

**Public Header (marketing):**

```
Mobile (< md):
┌──────────────────────────────────┐
│ [Logo]              [☰ Menu]    │  ← sticky top-0, h-14, border-b, bg-background/95 backdrop-blur
└──────────────────────────────────┘

When menu open:
┌──────────────────────────────────┐
│ [Logo]              [✕ Close]   │
├──────────────────────────────────┤
│ Войти                            │  ← stacked links, py-3 each (touch target ≥ 44)
│ Зарегистрироваться (accent CTA)  │
└──────────────────────────────────┘
```

```
Desktop (md+):
┌──────────────────────────────────────────────┐
│ [Logo]            [Войти] [Зарегистрироваться]│  ← h-16, container, ghost + primary
└──────────────────────────────────────────────┘
```

**Auth Header (minimal):**

```
┌──────────────────────────────────┐
│       [Logo]                     │  ← centered logo only, h-14
└──────────────────────────────────┘
```

> Logo на mobile = текст «VideoEdit Academy» (без иконки до brand assets); на desktop ровно тот же текст. Click → `/`.

**App Header** (dashboard):
- Logo (left) + email (truncated на mobile, full на desktop) + «Выйти» button (right)
- Email-verification banner — рендерится ВНУТРИ `(app)/layout.tsx` сразу под header, если применимо

### 3.3 Footer pattern

```
Mobile:
┌──────────────────────────────────────┐
│  © 2026 VideoEdit Academy            │
│                                      │
│  Политика конфиденциальности         │  ← link
│  Публичная оферта                    │  ← link
│                                      │
│  [📧] hello@videoedit.example        │  ← mailto, lucide Mail icon
│  [➤] @videoedit_support              │  ← https://t.me/..., lucide Send icon
│                                      │
│  ИП ФИО, ИНН ХХХХХХХХХХ              │  ← `text-xs text-muted-foreground`
│  [TODO: юрист-ревью]                 │  ← visible draft marker
└──────────────────────────────────────┘

Desktop (md+):
┌──────────────────────────────────────────────────────────────────────┐
│ © 2026 VideoEdit Academy           [Privacy] [Oferta] [📧] [➤]      │
│ ИП ФИО, ИНН ХХХХХХХХХХ [TODO: юрист-ревью]                          │
└──────────────────────────────────────────────────────────────────────┘
```

Background `bg-secondary` (30% color), `py-8` mobile / `py-12` desktop, `border-t border-border`.

### 3.4 Section pattern (для `/`)

Каждая секция лендинга:
```
<section className="py-12 md:py-16 lg:py-24">
  <div className="container">
    <h2 className="text-2xl md:text-3xl font-semibold">Заголовок</h2>
    <div className="mt-6 md:mt-8">...content...</div>
  </div>
</section>
```

Чередование background: hero `bg-background`, program `bg-background`, pricing `bg-secondary`, FAQ `bg-background`. **Без gradients, без full-bleed images** — solo MVP.

### 3.5 Form card pattern (auth)

```
<Card className="mx-auto max-w-md">
  <CardHeader>
    <CardTitle>Зарегистрироваться</CardTitle>
    <CardDescription>Создайте аккаунт за минуту</CardDescription>
  </CardHeader>
  <CardContent>
    <Form>...fields...</Form>
  </CardContent>
  <CardFooter className="flex justify-between text-sm">
    <span className="text-muted-foreground">Уже есть аккаунт?</span>
    <Link href="/login" className="font-medium underline-offset-4 hover:underline">Войти</Link>
  </CardFooter>
</Card>
```

---

## 4. Per-screen specs

> **Convention:** для каждого экрана указаны: route, layout, цель экрана, ASCII-layout, components used, copy (Russian!), states (loading/empty/error/success/disabled), interactions, accessibility notes.

### 4.1 `/` — Landing page

**Route:** `(marketing)/page.tsx` (replaces existing `src/app/page.tsx` placeholder — переместить в route group)

**Layout:** `(marketing)/layout.tsx`

**Goal:** Анонимный посетитель за 30 сек понимает что продают (курс по монтажу), кому (начинающим/практикующим монтажёрам), за сколько, что входит, как купить.

**Sections (top → bottom):**
1. Hero (`<Hero />`)
2. Program outline (`<ProgramOutline />`)
3. Pricing (`<PricingBlock />`)
4. FAQ (`<FaqAccordion />`)
5. Footer (in layout)

**ASCII layout (mobile):**

```
┌──────────────────────────────────┐
│ HEADER (sticky)                  │
├──────────────────────────────────┤
│                                  │
│  Профессиональный монтаж         │  ← H1 display-size, 2-3 lines max
│  видео — за 8 недель             │
│                                  │
│  Авторский курс с разбором       │  ← lead, text-lg muted
│  реальных проектов               │
│                                  │
│  [Подробнее о курсе →]           │  ← primary CTA (accent)
│                                  │
├──────────────────────────────────┤
│         Что вы освоите           │  ← H2
│                                  │
│  ✓ DaVinci Resolve с нуля        │  ← list items, check icon
│  ✓ Цветокоррекция и грейдинг     │
│  ✓ Звук: чистка, эквалайзер,...  │
│  ✓ Графика, титры, motion        │
│  ✓ Экспорт под YouTube/Reels/... │
│                                  │
├──────────────────────────────────┤
│      Стоимость курса             │  ← H2, bg-secondary section
│                                  │
│   ┌─────────────────────────┐    │
│   │   Полный курс           │    │
│   │                         │    │
│   │   19 900 ₽              │    │  ← display-size price
│   │   единоразово           │    │  ← muted small
│   │                         │    │
│   │   ✓ 24 урока (≈ 12ч)    │    │
│   │   ✓ Доступ навсегда     │    │
│   │   ✓ Чек по 54-ФЗ        │    │
│   │                         │    │
│   │   [Купить]              │    │  ← primary CTA → /register?next=/courses/...
│   └─────────────────────────┘    │
│                                  │
├──────────────────────────────────┤
│       Частые вопросы             │  ← H2
│                                  │
│  ▸ Сколько длится курс?          │  ← FAQ items, accordion
│  ▸ Какое нужно ПО?               │
│  ▸ Как происходит оплата?        │
│  ▸ Можно вернуть деньги?         │
│  ▸ Получу ли я сертификат?       │  ← [TODO: юрист-ревью] если нет лицензии
│  ▸ Можно скачать уроки?          │
│  ▸ С какого устройства смотреть? │
│                                  │
├──────────────────────────────────┤
│ FOOTER                           │
└──────────────────────────────────┘
```

**Copy (RU, экзамплы):**

| Element | Copy |
|---------|------|
| H1 (display) | «Профессиональный монтаж видео — за 8 недель» |
| Lead | «Авторский курс с разбором реальных проектов. DaVinci Resolve, цветокор, звук и графика — от первого реза до экспорта.» |
| Hero CTA | «Подробнее о курсе» |
| Program H2 | «Что вы освоите» |
| Program items | (см. ASCII выше — 5 bullet points) |
| Pricing H2 | «Стоимость курса» |
| Pricing CTA | «Купить» |
| Pricing sub | «Единоразово, без подписок и автосписаний» |
| FAQ H2 | «Частые вопросы» |
| FAQ Q1 | «Сколько длится курс и сколько уделять времени?» / A: «24 урока ≈ 12 часов видео. В удобном темпе 1-2 часа в неделю — за 8 недель пройдёте полностью.» |
| FAQ Q2 | «Какое нужно ПО?» / A: «DaVinci Resolve — бесплатная версия покрывает 95% курса. Платный Studio только если планируете коммерческий монтаж.» |
| FAQ Q3 | «Как происходит оплата?» / A: «Через ЮKassa: карты Мир/Visa/Mastercard и СБП. Чек по 54-ФЗ приходит на email сразу после оплаты.» |
| FAQ Q4 | «Можно вернуть деньги?» / A: «Да, в течение 14 дней, если урок ещё не начат. Подробности в [Публичной оферте](/oferta).» |
| FAQ Q5 | «Получу ли я сертификат?» / A: «В MVP-версии — нет. Это образовательный контент, не лицензированная программа. [TODO: юрист-ревью wording]» |
| FAQ Q6 | «Можно скачать уроки?» / A: «Нет — видео защищены и доступны только в плеере на сайте после покупки. Это защищает контент и сохраняет цену курса для всех.» |
| FAQ Q7 | «С какого устройства смотреть?» / A: «С любого: телефон, планшет, ноутбук. Сайт адаптирован под мобильный.» |

**States:**
- **Loading:** SC, нет client loading. SSG/SSR полностью.
- **Empty:** не применимо (статика).
- **Error:** `(marketing)/error.tsx` — fallback с текстом «Что-то пошло не так. Перезагрузите страницу.» + кнопка «Попробовать снова».

**Interactions:**
- FAQ: один открытый item за раз (Accordion `type="single" collapsible`).
- Pricing CTA: для аноним — `Link href="/register?next=/courses/<seeded-slug>"`. Для залогиненного (если попал случайно) — `Link href="/courses/<seeded-slug>"`.
- Hero CTA: `Link href="/courses/<seeded-slug>"`.

**Accessibility:**
- H1 один на странице (display).
- Все секции — `<section aria-labelledby="hero-title">` etc.
- Accordion от Radix даёт ARIA из коробки.

### 4.2 `/courses/[slug]` — Course preview

**Route:** `(marketing)/courses/[slug]/page.tsx`

**Layout:** `(marketing)/layout.tsx`

**Goal:** Конкретное preview одного курса (обложка, длительность, цена, программа модулей без access). CTA «Купить» для аноним → `/register?next=...`; для залогиненного — Server Action `createCoursePayment` (Phase 3, в P2 — заглушка, ведёт на `/dashboard`).

**ASCII layout (desktop, mobile стакает вертикально):**

```
┌────────────────────────────────────────────────────────────────────┐
│ HEADER                                                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────┐   Монтаж видео в DaVinci Resolve                 │
│  │              │   (H1 heading-size)                              │
│  │   обложка    │                                                  │
│  │  курса       │   ⏱ 24 урока · ≈ 12 часов                       │
│  │ (16:9 ratio) │   📚 6 модулей                                   │
│  │              │                                                  │
│  │              │   19 900 ₽                                       │
│  │              │   [Купить]   ← primary CTA, accent              │
│  └──────────────┘                                                  │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                 Программа курса                                    │
│                                                                    │
│  ▼ Модуль 1 — Введение в DaVinci Resolve                          │  ← module heading
│     • Урок 1.1 — Установка и интерфейс                            │  ← lesson list, no links
│     • Урок 1.2 — Импорт материалов                                │
│     • Урок 1.3 — Первый монтаж                                    │
│                                                                    │
│  ▼ Модуль 2 — Базовый монтаж                                      │
│     • Урок 2.1 — Резка и склейка                                  │
│     • Урок 2.2 — Транзишены                                       │
│     • ...                                                          │
│                                                                    │
│  (для аноним: уроки без часов, без access. Только список.)        │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ FOOTER                                                             │
└────────────────────────────────────────────────────────────────────┘
```

**Copy:**
- H1: course title из БД (`courses.title`)
- Метрики: «{N} уроков · ≈ {N}ч» (вычисляется server-side, на основе `lessons.duration_seconds` если есть; в MVP — hardcoded в seed)
- Price: `formatPrice(course.price_minor / 100)` через утилиту из `src/lib/utils.ts` — выдаёт «19 900 ₽» с `ru-RU` locale, без копеек
- CTA: «Купить» (для аноним) или «Перейти к оплате» (для залогиненного с unverified email — disabled с tooltip «Подтвердите email для покупки»)
- Module heading: «Модуль {N} — {title}»
- Lesson item: «Урок {N.M} — {title}» (без кликов на URL, не активен — это preview)

**States:**
- **Loading:** `(marketing)/courses/[slug]/loading.tsx` — skeleton: обложка (`Skeleton h-64`), 4 строки текста (`Skeleton h-4 w-3/4`), кнопка (`Skeleton h-11 w-32`).
- **Empty:** course not found → `(marketing)/courses/[slug]/not-found.tsx` — «Курс не найден» + ссылка на `/`.
- **Error:** `error.tsx` — «Не удалось загрузить курс» + Retry.
- **Anonymous:** видит preview + CTA `Link → /register?next=/courses/[slug]`.
- **Authenticated but unverified email:** видит CTA disabled с inline-подсказкой «Подтвердите email — мы отправили письмо при регистрации».
- **Authenticated + verified:** CTA активен; в P3 ведёт на Server Action; в P2 — заглушка `Link → /dashboard` (placeholder UX).

**Interactions:**
- CTA hover: `hover:bg-primary/90`
- CTA loading state (в P3): `<Loader2 className="mr-2 size-4 animate-spin" /> Обрабатываем...`

**Accessibility:**
- `<Image>` от `next/image` с alt = course title
- Module/lesson list — `<ul>` semantic
- CTA — `<button>` или `<a>` (для P2 ссылка `Link`)

### 4.3 `/register` — Registration form

**Route:** `(auth)/register/page.tsx`

**Layout:** `(auth)/layout.tsx`

**Goal:** Email + password + 2 consent checkboxes + Yandex SmartCaptcha → server action `signUp`.

**ASCII layout:**

```
┌──────────────────────────────────┐
│ MINIMAL HEADER (logo only)       │
├──────────────────────────────────┤
│                                  │
│  ┌────────────────────────────┐  │
│  │  Зарегистрироваться        │  │  ← CardTitle (heading)
│  │  Создайте аккаунт за       │  │  ← CardDescription (muted)
│  │  минуту                    │  │
│  │                            │  │
│  │  Email                     │  │  ← FormLabel
│  │  [you@example.com_______]  │  │  ← Input type="email"
│  │                            │  │
│  │  Пароль                    │  │
│  │  [••••••••••__________👁]  │  │  ← Input type=password + toggle eye
│  │  Минимум 8 символов и одна │  │  ← FormDescription
│  │  цифра                     │  │
│  │                            │  │
│  │  ☐ Согласен с обработкой   │  │  ← Checkbox + label
│  │    персональных данных     │  │
│  │    [Политика] ↗            │  │  ← external link icon
│  │                            │  │
│  │  ☐ Принимаю условия        │  │  ← Checkbox + label
│  │    публичной оферты ↗      │  │
│  │                            │  │
│  │  [Yandex SmartCaptcha]     │  │  ← embedded widget
│  │                            │  │
│  │  [Зарегистрироваться]      │  │  ← primary CTA, w-full, disabled until both checkboxes + captcha
│  │                            │  │
│  ├────────────────────────────┤  │
│  │ Уже есть аккаунт? [Войти]  │  │  ← CardFooter
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

**Copy:**

| Element | Copy |
|---------|------|
| CardTitle | «Зарегистрироваться» |
| CardDescription | «Создайте аккаунт, чтобы получить доступ к курсу» |
| Email label | «Email» |
| Email placeholder | «you@example.com» |
| Email error (zod: invalid email) | «Введите корректный email» |
| Email error (server: already registered) | «Этот email уже зарегистрирован. [Войти](/login)?» |
| Password label | «Пароль» |
| Password description | «Минимум 8 символов и хотя бы одна цифра» |
| Password error (zod: short) | «Пароль должен содержать минимум 8 символов» |
| Password error (zod: no digit) | «Добавьте хотя бы одну цифру» |
| Consent 1 label | «Я согласен с [обработкой персональных данных](/privacy)» |
| Consent 1 error | «Без согласия мы не можем зарегистрировать аккаунт» |
| Consent 2 label | «Я принимаю условия [публичной оферты](/oferta)» |
| Consent 2 error | «Без принятия оферты регистрация невозможна» |
| Captcha error | «Подтвердите, что вы не робот» |
| Submit (idle) | «Зарегистрироваться» |
| Submit (pending) | «Создаём аккаунт...» |
| Submit (success toast) | «Аккаунт создан. Подтвердите email — мы отправили ссылку на {email}» |
| Submit (error toast) | «Не удалось зарегистрироваться. Попробуйте ещё раз или [напишите нам](mailto:hello@videoedit.example).» |
| CardFooter | «Уже есть аккаунт?» + link «Войти» |

**States:**
- **Idle:** Submit button disabled until: email valid + password valid + both checkboxes checked + captcha solved.
- **Pending:** Submit button shows `Loader2` icon + «Создаём аккаунт...» + all fields disabled.
- **Success:** redirect to `/auth/callback?next=/dashboard` (Supabase confirm flow); toast «Аккаунт создан. Подтвердите email...» persisted via query param.
- **Server error (rate limit 429):** inline alert above form: «Слишком много попыток. Подождите 15 минут или [напишите в поддержку](mailto:...)».
- **Server error (generic):** sonner toast destructive.

**Interactions:**
- Email field: `onBlur` triggers Zod validation; error message under field (`FormMessage`).
- Password: `Eye` / `EyeOff` icon button toggles type between `password` ↔ `text`. Button — `<button type="button">` (no submit).
- Checkboxes: clicking label or checkbox toggles. Disabled state if not yet captcha-solved? — нет, чекбоксы доступны всегда, submit gated.
- SmartCaptcha: lazy load via `next/script` strategy `lazyOnload`; reset on form-submit-error.
- Form submit:
  ```ts
  startTransition(async () => {
    const result = await signUp(values);
    if (!result.ok) { toast.error(...); return; }
    router.push(`/auth/callback-pending?email=${email}`); // или подобный flow
  });
  ```

**Accessibility:**
- All inputs have associated `<FormLabel>` (shadcn Form wraps in `<label htmlFor>`).
- Captcha widget — обёрнут в `<div aria-label="Проверка что вы не робот">`.
- Consent links: `target="_blank" rel="noopener noreferrer"` + `aria-label="Откроется в новой вкладке"` или иконка `ExternalLink size-3`.
- Error messages — `role="alert"` (shadcn FormMessage делает).
- Submit button — `aria-busy={pending}`.

### 4.4 `/login` — Login form

**Route:** `(auth)/login/page.tsx`

**Layout:** `(auth)/layout.tsx`

**Goal:** Email + password → server action `signIn`. Preserves `?next=<path>` query — после успеха редирект туда.

**ASCII layout:**

```
┌──────────────────────────────────┐
│ MINIMAL HEADER                   │
├──────────────────────────────────┤
│                                  │
│  ┌────────────────────────────┐  │
│  │  Войти                     │  │
│  │  Введите email и пароль    │  │
│  │                            │  │
│  │  Email                     │  │
│  │  [_____________________]   │  │
│  │                            │  │
│  │  Пароль          [Забыли?]│  │  ← inline link справа в label-row
│  │  [••••••••••_________👁]  │  │
│  │                            │  │
│  │  [Войти]                   │  │  ← primary CTA, w-full
│  │                            │  │
│  ├────────────────────────────┤  │
│  │ Нет аккаунта? [Регистрация]│  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

**Copy:**

| Element | Copy |
|---------|------|
| CardTitle | «Войти» |
| CardDescription | «Введите email и пароль» |
| Email label | «Email» |
| Password label | «Пароль» |
| Forgot password link | «Забыли пароль?» |
| Generic auth error | «Неверный email или пароль» (не разглашаем какой именно — security) |
| Unconfirmed email error | «Подтвердите email — мы отправили ссылку при регистрации. [Отправить заново]» |
| Rate limit 429 | «Слишком много попыток. Подождите 15 минут.» |
| Submit (idle) | «Войти» |
| Submit (pending) | «Входим...» |
| Submit (success) | redirect to `?next=...` или `/dashboard` |
| CardFooter | «Нет аккаунта? [Регистрация]» |

**States:** аналогично register (idle/pending/success/error).

**Interactions:**
- `?next=<path>` query parameter сохраняется в hidden field или передаётся в Server Action params.
- Successful login → `router.push(searchParams.get('next') ?? '/dashboard')`.
- **Pitfall #20:** `useSearchParams` обязательно wrapped в `<Suspense>` (Next 14 требование). Иначе SSR падает.

**Accessibility:** как register; кнопка eye toggle обязательно `type="button"`.

### 4.5 `/forgot-password` — Email input для сброса

**Route:** `(auth)/forgot-password/page.tsx`

**Layout:** `(auth)/layout.tsx`

**Goal:** Email → server action `requestPasswordReset` → Supabase отправляет ссылку.

**ASCII layout:**

```
┌──────────────────────────────────┐
│  ┌────────────────────────────┐  │
│  │  Восстановление пароля     │  │
│  │  Введите email — мы        │  │
│  │  отправим ссылку для       │  │
│  │  сброса                    │  │
│  │                            │  │
│  │  Email                     │  │
│  │  [_____________________]   │  │
│  │                            │  │
│  │  [Yandex SmartCaptcha]     │  │
│  │                            │  │
│  │  [Отправить ссылку]        │  │  ← primary CTA, w-full
│  │                            │  │
│  ├────────────────────────────┤  │
│  │ Вспомнили? [Войти]         │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

**Copy:**

| Element | Copy |
|---------|------|
| CardTitle | «Восстановление пароля» |
| CardDescription | «Введите email — мы отправим ссылку для сброса» |
| Submit (idle) | «Отправить ссылку» |
| Submit (pending) | «Отправляем...» |
| Success state (replace form) | «Если такой email зарегистрирован, мы отправили на него ссылку для сброса. Проверьте почту (и папку «Спам»).» |
| Footer | «Вспомнили? [Войти]» |

**Important UX (security):** success message не разглашает существует ли email. Тот же текст показывается в любом случае. Это OWASP best practice.

**States:**
- After successful submit: форма заменяется на success message (не toast — это финальное состояние страницы). Кнопка «Попробовать другой email» возвращает к форме.

### 4.6 `/reset-password?token=...` — New password form

**Route:** `(auth)/reset-password/page.tsx`

**Layout:** `(auth)/layout.tsx`

**Goal:** Установить новый пароль по одноразовой ссылке (Supabase token в query).

**ASCII layout:**

```
┌──────────────────────────────────┐
│  ┌────────────────────────────┐  │
│  │  Новый пароль              │  │
│  │  Введите новый пароль      │  │
│  │                            │  │
│  │  Новый пароль              │  │
│  │  [••••••••••_________👁]  │  │
│  │  Минимум 8 символов и одна │  │
│  │  цифра                     │  │
│  │                            │  │
│  │  Подтвердите новый пароль  │  │
│  │  [••••••••••_________👁]  │  │
│  │                            │  │
│  │  [Сбросить пароль]         │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

**Copy:**

| Element | Copy |
|---------|------|
| CardTitle | «Новый пароль» |
| CardDescription | «Введите новый пароль для входа в аккаунт» |
| Password label | «Новый пароль» |
| Confirm label | «Подтвердите новый пароль» |
| Mismatch error | «Пароли не совпадают» |
| Invalid/expired token error (full-card replacement) | «Ссылка истекла или уже использована. [Запросить новую](/forgot-password)» |
| Submit (idle) | «Сбросить пароль» |
| Submit (pending) | «Меняем пароль...» |
| Success | toast «Пароль обновлён. Войдите с новым паролем.» + redirect `/login` |

**Validation:**
- Token validation — в Server Action (через `supabase.auth.exchangeCodeForSession` или `verifyOtp` — финальное решение от Supabase SSR conventions).
- Zod: оба пароля min 8, ≥ 1 digit, и `password === confirmPassword`.

**States:**
- **Invalid/expired token:** карточка полностью заменяется на error state с CTA «Запросить новую ссылку».

### 4.7 `/privacy` — Privacy Policy

**Route:** `(marketing)/privacy/page.tsx`

**Layout:** `(marketing)/layout.tsx`

**Goal:** Юридический документ. Server Component, рендерит plain markdown или MDX. Версионирование через `policy_version` поле визуально в начале документа.

**ASCII layout:**

```
┌──────────────────────────────────┐
│ HEADER                           │
├──────────────────────────────────┤
│  container max-w-3xl             │
│                                  │
│  Политика обработки              │  ← H1 heading
│  персональных данных             │
│                                  │
│  Версия 1.0 от 24.05.2026        │  ← muted small
│  [TODO: юрист-ревью]             │  ← visible inline draft marker
│                                  │
│  ## 1. Оператор обработки        │  ← H2 prose
│                                  │
│  ИП [TODO: ФИО]                  │
│  ИНН [TODO: 12 цифр]             │
│  ОГРНИП [TODO: 15 цифр]          │
│  Email: hello@videoedit.example  │
│                                  │
│  ## 2. Перечень обрабатываемых   │
│     данных                       │
│                                  │
│  При регистрации:                │
│  • Email                         │
│  • Пароль (в зашифрованном виде) │
│                                  │
│  При покупке курса:              │
│  • Email (для чека по 54-ФЗ)     │
│  • IP-адрес (для безопасности)   │
│                                  │
│  ## 3. Цели обработки            │
│  ...                             │
│                                  │
│  ## 4. Срок хранения             │
│  ...                             │
│                                  │
│  ## 5. Права субъекта данных     │
│  ...                             │
│                                  │
│  ## 6. Удаление аккаунта         │
│  ...                             │
│                                  │
├──────────────────────────────────┤
│ FOOTER                           │
└──────────────────────────────────┘
```

**Typography:**
- Use Tailwind's `prose prose-neutral dark:prose-invert max-w-none` (требует `@tailwindcss/typography` plugin — добавить если ещё нет).
- Container `max-w-3xl` для читаемости (75 ch ≈ 65-75 chars/line).

**Implementation:**
- Plain markdown в `src/content/legal/privacy.md` рендерится через `react-markdown` или MDX через `@next/mdx`.
- Простейший вариант для MVP: TSX страница с `<article className="prose">...HTML inline...</article>`. Не вводим MDX-инфраструктуру если не критично.

**Versioning:**
- В начале документа: «Версия {N} от {DD.MM.YYYY}» — берётся из constant `LEGAL_POLICY_VERSION` (например `'1.0-draft'`). Эта же константа пишется в `user_consents.policy_version` при регистрации.

**Draft markers:**
- `[TODO: юрист-ревью]` — inline, видны разработчику и пользователю. Это часть compliance evidence: при юрист-sign-off в P7 markers убираются и `policy_version` инкрементируется до `1.0`.

### 4.8 `/oferta` — Public offer

**Route:** `(marketing)/oferta/page.tsx`

**Layout:** `(marketing)/layout.tsx`

**Goal:** Договор-оферта. Структура аналогична `/privacy` (та же типография, тот же template-компонент `<LegalDocPage>`).

**Sections required (минимум):**
1. Реквизиты продавца (ИП ФИО, ИНН, ОГРНИП, адрес регистрации) — `[TODO: юрист-ревью]`
2. Предмет договора (доступ к видеокурсу)
3. Цена и порядок оплаты
4. Порядок оказания услуги
5. Возврат денежных средств (14 дней по ЗоЗПП)
6. Ответственность сторон
7. Юрисдикция (РФ, [TODO: уточнить регион])
8. Реквизиты для связи

**Versioning:** аналогично privacy.

### 4.9 `/auth/callback` — Email confirmation redirect

**Route:** `(auth)/auth/callback/page.tsx` или `app/api/auth/callback/route.ts` (зависит от Supabase SSR pattern)

**Goal:** Server-side обработка confirm-link токена → редирект на `/dashboard` (или `?next=...`).

**UI:** none — это серверный redirect. Если по какой-то причине рендерится UI (между обработкой и редиректом), показать только:

```
┌──────────────────────────────────┐
│                                  │
│       [⟳] Подтверждаем email...  │  ← centered, Loader2 + text
│                                  │
└──────────────────────────────────┘
```

**Error case:** если token invalid → редирект на `/login?error=confirmation-failed&email=<email>`; страница `/login` показывает inline alert: «Ссылка подтверждения истекла. [Отправить заново](/...)»

### 4.10 `(app)/dashboard` — Empty placeholder (Phase 2 version)

**Route:** `(app)/dashboard/page.tsx`

**Layout:** `(app)/layout.tsx` (auth-gated)

**Goal (P2):** Доказать что auth gate работает и пользователь после регистрации видит что-то осмысленное. **В P4 переписывается** на реальный список купленных курсов.

**ASCII layout:**

```
┌──────────────────────────────────┐
│ APP HEADER (logo, email, выйти)  │
├──────────────────────────────────┤
│ [Email verification banner — if  │  ← если !email_confirmed_at
│  user.email_confirmed_at is null]│
├──────────────────────────────────┤
│                                  │
│                                  │
│         [📖]                     │  ← BookOpen size-12 muted
│                                  │
│   Привет, {имя или email}!       │  ← H2 heading
│                                  │
│   У вас пока нет купленных       │  ← body text muted, centered
│   курсов                         │
│                                  │
│   [Каталог]                      │  ← primary CTA → '/'
│                                  │
│                                  │
└──────────────────────────────────┘
```

**Copy:**

| Element | Copy |
|---------|------|
| Greeting (auth verified) | «Привет, {user.email или derived name}!» |
| Empty body | «У вас пока нет купленных курсов» |
| CTA | «Каталог» |

> Greeting использует email если нет отдельного `display_name` поля (в P2 нет — оно появляется в Phase 6 profile). Для visual cleanness — берём `email.split('@')[0]` как fallback display, или просто «Привет!» без имени.

**States:**
- **Email unverified:** banner показывается, dashboard content тот же (empty).
- **Verified, no purchases:** см. ASCII выше.
- **(After P4):** список курсов.

**Accessibility:**
- H1 на странице — «Личный кабинет» (visually-hidden? — нет, видимый, но subdued).
- Empty state иконка — `aria-hidden="true"`, текст несёт смысл.

### 4.11 Email verification banner (cross-cutting component)

**Component:** `EmailVerificationBanner.tsx`

**Visibility rule:** Рендерится в `(app)/layout.tsx` сразу под header **только если** `user.email_confirmed_at IS NULL`.

> **Решение:** В P2 баннер показывается **только в auth-gated зоне** `(app)/`. На лендинге и страницах курса — не нужен (пользователь там в роли посетителя, не клиента; и баннер только если залогинен). Это упрощает архитектуру: один layout = одна проверка.

**ASCII (desktop):**

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚠ Подтвердите email для покупки курса.                              │
│   Мы отправили ссылку на {user.email}. [Отправить заново]           │
└──────────────────────────────────────────────────────────────────────┘
```

**Mobile:** wraps на 2-3 строки.

**Styling:**
- `bg-destructive/10 border-l-4 border-destructive text-destructive-foreground` — soft destructive (не bright red, иначе слишком агрессивно).
- Padding: `py-3 px-4 md:px-6`.
- Icon `AlertCircle size-4` слева.

**Copy:**

| Element | Copy |
|---------|------|
| Heading inline | «Подтвердите email для покупки курса» |
| Body | «Мы отправили ссылку на {email}» |
| CTA | «Отправить заново» |
| Resend pending | «Отправляем...» |
| Resend success toast | «Письмо отправлено. Проверьте почту.» |
| Resend error toast | «Не удалось отправить. Попробуйте через минуту.» |
| Resend rate limited | «Подождите минуту перед повторной отправкой.» |

**Interaction:**
- «Отправить заново» — client-side button, calls Server Action `resendConfirmationEmail`. Rate-limited на сервере (max 1 / 60 sec / user).
- Banner не dismissable (если email не подтверждён — мы хотим напоминать постоянно).

---

## 5. Form patterns

### 5.1 Стандартный паттерн (продолжение `ui-conventions/SKILL.md`)

Каждая форма — это:
1. Zod-схема из Server Action (импорт)
2. `useForm<InferType<typeof schema>>` + `zodResolver`
3. `useTransition` для pending state
4. `sonner` toast для success/error

**Канонический пример (RegisterForm):**

```tsx
'use client';

import { useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form, FormControl, FormDescription, FormField, FormItem,
  FormLabel, FormMessage,
} from '@/components/ui/form';

import { signUp, signUpSchema, type SignUpInput } from '@/server/actions/auth';

export function RegisterForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      consentPrivacy: false,
      consentOferta: false,
      captchaToken: '',
    },
    mode: 'onBlur',
  });

  const onSubmit = (values: SignUpInput) => {
    startTransition(async () => {
      const result = await signUp(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/auth/check-email?email=${encodeURIComponent(values.email)}`);
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Email field */}
        {/* Password field with eye toggle */}
        {/* Two consent checkboxes */}
        {/* SmartCaptcha widget — sets form value captchaToken */}
        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {pending ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
        </Button>
      </form>
    </Form>
  );
}
```

### 5.2 Inline error display rules

- Errors показываются **под полем** через `<FormMessage />` (Radix-aware, role="alert").
- Errors появляются **на blur** (mode `onBlur`), не на каждое keystroke. Исключение: confirm password — `onChange` для немедленной обратной связи о mismatch.
- Server errors (например «email already registered») — выводятся через `form.setError('email', { message: '...' })` после получения ответа от Server Action. Это вешает их в тот же `FormMessage` слот.
- Generic server errors (network, 500) — `toast.error('Что-то пошло не так. Попробуйте ещё раз.')`.

### 5.3 Submit button state machine

| State | Trigger | Visual |
|-------|---------|--------|
| Disabled | Form invalid OR submitting OR captcha not solved | `disabled`, opacity 50% |
| Idle | Form valid + не submitting + (captcha solved if applicable) | Normal accent CTA |
| Pending | `pending=true` from useTransition | Loader2 spinner + text «Создаём аккаунт...» + disabled |
| Error | После toast.error | Возврат в idle, форма остаётся заполненной |
| Success | После toast.success / router.push | Кнопка может остаться pending до redirect (UX continuity) |

### 5.4 Sonner toast usage

| Variant | When | Example |
|---------|------|---------|
| `toast.success(...)` | Successful action (rare in P2 — обычно redirect делает работу) | Resend email banner |
| `toast.error(...)` | Server action failed, generic error | «Не удалось зарегистрироваться» |
| `toast.warning(...)` | Не используем в P2 |
| `toast.info(...)` | Не используем в P2 |
| `toast.message(...)` | Не используем в P2 |

**Position:** `top-right` (set in `layout.tsx`, не менять).
**Duration:** default 4 sec. Errors — `duration: 6000`.
**Rich colors:** включено (по умолчанию `<Toaster richColors />` в layout).

---

## 6. Mobile-first responsive rules

### 6.1 Breakpoints (Tailwind defaults — не переопределять)

| Token | Min-width | Target |
|-------|-----------|--------|
| (default) | 0 | Mobile (320px+) |
| `sm:` | 640px | Large phone / small tablet portrait |
| `md:` | 768px | Tablet landscape, small laptop |
| `lg:` | 1024px | Desktop |
| `xl:` | 1280px | Large desktop |
| `2xl:` | 1400px | Container max (наследуется из `tailwind.config.ts`) |

### 6.2 Что меняется на каждом breakpoint

**Hero `/`:**
- mobile: H1 `text-4xl` (36px), CTA `w-full`, vertical stack
- md+: H1 `text-5xl` (48px), CTA `w-auto`, по-прежнему vertical
- lg+: H1 `text-6xl` (60px), 2-column layout (текст слева, иллюстрация справа — но в MVP без иллюстрации, single column)

**Header:**
- mobile (< md): hamburger menu, drawer slide-down при tap
- md+: inline nav links

**Footer:**
- mobile: stacked vertically (4 секции: copyright, legal links, contacts, ИП реквизиты)
- md+: horizontal — copyright left, links + contacts right

**Forms (auth):**
- mobile: `Card` без shadow, `border-0`, padding `p-6`, full-width
- md+: `Card` с `shadow-sm`, `border`, padding `p-8`, `max-w-md mx-auto`

**Course preview `/courses/[slug]`:**
- mobile: обложка сверху, метрики/цена/CTA снизу (single column)
- md+: обложка слева (4/12 grid), правая колонка с метриками + CTA (8/12 grid)
- Программа модулей всегда single column

**FAQ:**
- mobile: single column, full-width accordion items
- md+: max-w-3xl centered

### 6.3 Touch targets

**Все interactive elements ≥ 44×44px на мобильном:**
- Buttons: `min-h-[44px]` (или `h-11` = 44px). Кнопки `size="sm"` (`h-9`) запрещены на mobile critical paths (форм-submit, header nav). Допустимы только в desktop tabular UI.
- Links в нав-меню: `py-3` (48px effective с padding).
- Checkbox + label: label обёрнут вокруг checkbox с `flex items-start gap-3 py-2` — большая зона tap.
- Hamburger toggle: `size-11` (44px square).
- FAQ accordion trigger: padded `py-4 px-4` для каждого item.

### 6.4 Image sizing

`next/image` с `sizes` атрибутом:
```tsx
<Image
  src={course.cover_url}
  alt={course.title}
  fill
  className="object-cover rounded-lg"
  sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw"
/>
```

Aspect ratio для обложки: 16:9 mobile, 4:3 desktop (mobile приоритизирует video preview look).

### 6.5 Container padding

| Breakpoint | container padding |
|------------|-------------------|
| mobile | `px-4` (16px) |
| md+ | `px-6` (24px) |
| lg+ | `px-8` (32px) — inherited from `tailwind.config.ts` `container.padding: '2rem'` |

---

## 7. Accessibility checklist

### 7.1 Keyboard navigation
- [ ] Tab order логичен: header → main → footer.
- [ ] Все интерактивные элементы фокусируются (`<button>`, `<a>`, `<input>`, custom через `tabIndex={0}` only if needed).
- [ ] `focus-visible:ring-2 ring-ring` на всех кнопках/инпутах (наследуется из shadcn). **Никогда** `outline-none` без замены.
- [ ] Enter/Space submits formы (default browser behavior).
- [ ] Esc закрывает Dialog/Drawer (Radix handles).

### 7.2 Screen readers
- [ ] Все `<button>` без видимого текста имеют `aria-label` (hamburger toggle, eye toggle, close X).
- [ ] Form labels связаны с inputs через `htmlFor` (shadcn FormLabel делает).
- [ ] Errors помечены `role="alert"` (FormMessage делает).
- [ ] Loading state кнопки — `aria-busy={pending}`.
- [ ] Decorative icons (lucide рядом с текстом) — `aria-hidden="true"`.

### 7.3 Semantic HTML
- [ ] H1 один на странице (на `/` — display hero; на `/courses/[slug]` — course title; на auth — CardTitle).
- [ ] Sections wrapped in `<section>` with `aria-labelledby` или `aria-label`.
- [ ] Navigation — `<nav aria-label="Основная навигация">` в header.
- [ ] Footer — `<footer>` semantic.
- [ ] Lists — `<ul>` / `<ol>` для programs и lessons (не `<div>`).

### 7.4 Color contrast (WCAG AA)
- Body text on background: HSL `240 10% 3.9%` on `0 0% 100%` = ratio ~14:1 ✓
- Muted text: HSL `240 3.8% 46.1%` on background = ratio ~5.5:1 ✓ AA Large text passes; **acceptable for muted UI hints** but не для critical body.
- Accent button: primary `240 5.9% 10%` on background — ratio 17:1 (white text on near-black) ✓
- Destructive: HSL `0 84.2% 60.2%` on background — ratio ~3.5:1 — pass for non-text use; для body text внутри destructive alert использовать `text-destructive` (более тёмный) или белый текст на solid `bg-destructive`.

### 7.5 Forms
- [ ] Каждый `<Input>` имеет `<FormLabel>` (shadcn enforces).
- [ ] Required fields отмечены... [REC: добавить `*` после label для required, или явный «обязательно» — но не блокирующее, форма проверится Zod-ом]. Решение для P2: **без визуальной звёздочки** — все P2-формы имеют только required fields, лишний noise.
- [ ] `autocomplete` атрибуты:
  - Register email: `autocomplete="email"`
  - Register password: `autocomplete="new-password"`
  - Login email: `autocomplete="email"`
  - Login password: `autocomplete="current-password"`
  - Reset new password: `autocomplete="new-password"`
- [ ] Email inputs: `type="email"` + `inputmode="email"`.
- [ ] Password inputs: `type="password"`; eye toggle переключает на `type="text"`.

### 7.6 Images
- [ ] Все `<Image>` имеют `alt`. Decorative → `alt=""`.
- [ ] Logo: `alt="VideoEdit Academy"`.
- [ ] Course cover: `alt={course.title}`.

### 7.7 Links
- [ ] External links (`/privacy`, `/oferta` в consent labels): `target="_blank" rel="noopener noreferrer"` + visual indicator (`ExternalLink` icon size-3) + `aria-label="Откроется в новой вкладке"` (Politely — пользователь не теряет регистрацию).
- [ ] Внутренние links (footer, nav) — без target.

---

## 8. Animation budget

> Solo MVP. Минимум, чтобы не перегружать.

### 8.1 Allowed

| Animation | Where | Implementation |
|-----------|-------|----------------|
| Hover на CTA buttons | All primary buttons | `transition-colors hover:bg-primary/90` (Tailwind class) |
| Focus ring fade-in | All inputs/buttons | `focus-visible:ring-2 ring-ring transition-shadow` |
| Accordion expand/collapse | FAQ items | shadcn Accordion (Radix), animate height/opacity via `tailwindcss-animate` |
| Dialog/Drawer slide-in | Modals (если будут) | shadcn Dialog defaults |
| Toast slide-in | Sonner | Default sonner animations |
| Skeleton shimmer | Loading states | shadcn Skeleton with `animate-pulse` |
| Loader2 spinner | Submit pending | `animate-spin` Tailwind |
| Subtle fade-in для секции при scroll | На `/` для hero, program, pricing, FAQ | **Опционально через framer-motion** `<motion.section initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.4 }}>` — **строго один такой паттерн**, не разные на разных секциях |

### 8.2 NOT allowed

- ❌ Page transitions между routes (Next.js не имеет built-in; framer-motion AnimatePresence на App Router — overengineering для MVP).
- ❌ Parallax scroll, sticky animations, scroll-jacking.
- ❌ Per-element entrance animations (каждый bullet point fly-in) — отвлекает, ломает perception производительности.
- ❌ Continuous animations (pulsing dot, breathing icon) — premium territory.
- ❌ Hover на карточках с transform scale — не нужно, простой shadow change OK.
- ❌ Gradient animation, color-shifting backgrounds — premium.
- ❌ Loading spinners везде — skeletons предпочтительны (см. `ui-conventions/SKILL.md`).

### 8.3 Performance constraint

- Lighthouse mobile-perf ≥ 80 — заявлен в success criteria фазы. Анимации не должны блокировать main thread.
- `framer-motion` lazy import только в компоненты которые её используют (не глобально).
- `prefers-reduced-motion: reduce` — респектить через `motion-safe:` / `motion-reduce:` Tailwind утилиты для всех framer-motion блоков.

---

## 9. 152-ФЗ + legal UI specifics

### 9.1 Consent checkboxes (`/register`)

**Two separate checkboxes**, в строгом порядке:

1. ☐ «Я согласен с обработкой персональных данных» + link «[Политика](/privacy)»
2. ☐ «Я принимаю условия публичной оферты» + link «[Оферта](/oferta)»

**Server-side evidence capture (для AUTH-03):**

При успешной регистрации в таблицу `user_consents` пишутся **две раздельные строки**:

```sql
INSERT INTO user_consents (user_id, purpose, policy_version, ip, user_agent, accepted_at) VALUES
  ($1, 'pdn_processing', $2, $3, $4, now()),
  ($1, 'public_oferta', $2, $3, $4, now());
```

Где `policy_version` берётся из constant в коде (например `'1.0-draft'`) — соответствует версии в шапке `/privacy` + `/oferta`.

**UI rules:**
- Чекбоксы НЕ pre-checked (закон 152-ФЗ требует explicit affirmative action).
- Submit button disabled пока **оба** не checked.
- Каждая ссылка открывается в **новой вкладке** (`target="_blank"`) — пользователь не теряет введённые данные формы.
- Иконка `ExternalLink size-3` после слова Политика / Оферта — визуальный hint.
- Если пользователь снимает чекбокс после первого checkmark — submit снова disabled (live state).

**Copy с ссылками (React):**

```tsx
<label className="flex items-start gap-3 cursor-pointer">
  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
  <span className="text-sm leading-5">
    Я согласен с{' '}
    <Link
      href="/privacy"
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline underline-offset-4 hover:text-primary"
    >
      обработкой персональных данных
      <ExternalLink className="inline ml-1 size-3" aria-label="откроется в новой вкладке" />
    </Link>
  </span>
</label>
```

### 9.2 Email verification banner (см. §4.11)

Принципиально показывается **только в `(app)/` зоне** и **только** если `email_confirmed_at IS NULL`. Это часть AUTH-04: «без подтверждения доступ к покупке заблокирован».

### 9.3 Account deletion CTA (forward compat для Phase 6)

В Phase 2 страница `/profile` не реализуется (это Phase 6). Но **архитектура `(app)/layout.tsx` должна позволять**:
- Будущая ссылка «Профиль» в app header (в P2 — placeholder, выводится но без действия или ведёт на `/dashboard`).
- Resource path `/profile` зарезервирован.

**В P2 не требуется UI для удаления аккаунта.** Это PROF-02 в Phase 6. Этот пункт здесь только чтобы дизайн **не загораживал** будущее размещение.

### 9.4 Footer legal compliance

Footer должен содержать **на каждой странице**:
- Email mailto: для обратной связи
- Telegram link (контакт поддержки)
- Ссылки на `/privacy` и `/oferta`
- Реквизиты ИП (ФИО, ИНН — минимум; ОГРНИП опц., но рекомендуется юристом)
- Copyright «© 2026 [ИП ФИО]»

Все эти поля в P2 содержат `[TODO: юрист-ревью]` markers где требуются реквизиты ИП — юрист в P7 даст финальные значения.

### 9.5 Cookie banner — НЕ в P2

Решение: **cookie banner не реализуется в M1**. Это decision из upstream:
- Supabase Auth cookies — strictly necessary (для функционирования сайта), не требуют consent по GDPR/152-ФЗ в strict reading.
- Analytics cookies в M1 не используются (Vercel Analytics — server-side, без client cookies).
- Если в M2 добавим аналитику с client cookies — добавим banner тогда.

В UI-SPEC явно фиксируется: **no cookie banner**. Если юрист в P7 потребует — добавим в P7 как hotfix.

---

## 10. Open questions / TODOs

> Эти вопросы НЕ блокируют старт фазы — для каждого зафиксирован sensible default. Но они станут важны до P5–P7 production prep.

### 10.1 Brand identity (DEFER until first sales)

- **Brand color:** в P2 используем shadcn defaults (near-black `240 5.9% 10%` primary). После первых продаж — провести brand exercise, добавить custom HSL token. Изменение — точечная правка `globals.css` без ломки layouts.
- **Logo:** в P2 — только wordmark текстом «VideoEdit Academy». Иконка/SVG-логотип — когда будет brand identity. Текущее место в Header.tsx позволяет drop-in замены `<Logo />` компонента.
- **OG image:** в P2 — статика `public/og-image.png` (1200×630). Содержание: wordmark + tagline на ярком фоне. Один файл для всех страниц. Динамические OG (`@vercel/og`) — M2.
- **Hero illustration:** в P2 — нет (text-only hero). Кастомная иллюстрация / фото монтажёра — M2 или после первых продаж.

### 10.2 Email templates (DEFER to P7)

- Welcome confirm / magic-link / recovery / email-change шаблоны от Supabase Auth — **по умолчанию английские, через Supabase SMTP supabase.co домен**. В P2 это OK (тестовые ящики разработчика).
- Локализация на русский + custom domain SMTP — в P7 (EMAIL-01..03).
- В UI-SPEC: не требуется, поскольку шаблоны письма не часть Next.js приложения (управляются в Supabase Dashboard).

### 10.3 SmartCaptcha integration choices

- **Provider:** Yandex SmartCaptcha (упомянуто в требованиях AUTH-09). Альтернатива: hCaptcha (доступен в РФ), reCAPTCHA (Google — частично работает в РФ, рекомендация — не использовать).
- **Loading strategy:** `next/script` strategy `lazyOnload` — captcha видна сразу как форма прокручивается в viewport.
- **Test mode:** Yandex даёт sandbox keys для local dev. В CI — mock через `MSW` или env-флаг `DISABLE_CAPTCHA=true`.
- **Decision (default):** Yandex SmartCaptcha. Если не блокирующий — оставить как есть.

### 10.4 Theme toggle

- **Should we ship a dark/light toggle in P2?**
  - Pro: project supports dark theme; some users prefer dark
  - Con: extra component, extra state, не критично для MVP conversion
- **Default:** **respect `prefers-color-scheme`** (system theme), no manual toggle. Реализация: добавить `<script>` в `<head>` который ставит `dark` class на html based on `localStorage` ?? `prefers-color-scheme`. Toggle UI — defer to M2.

### 10.5 FAQ content — final answers

- FAQ копи в §4.1 — **drafts**. Финальный текст:
  - Q5 (сертификат) — может потребовать юр-ревью wording
  - Q7 (устройства) — может потребовать упоминания iOS Safari / Android Chrome support
- **Decision:** drafts стартуют, финальный pass — перед P7.

### 10.6 Hero image / video

- ТЗ упоминает «можно видео-приветствие автора». **Решение P2:** text-only hero. Видео — M2.
- Если позже добавим — обязательное условие: **без autoplay со звуком** (см. PITFALLS / FEATURES.md anti-feature).

### 10.7 Footer copy — финальные реквизиты

- Все `[TODO: юрист-ревью]` markers в footer (ИП ФИО, ИНН, ОГРНИП) — placeholder до P7 sign-off. UI-структура зафиксирована, content поправляется.

### 10.8 Course slug for MVP

- В MVP — один курс. Slug fixed (через seed): рекомендую `videoedit-mvp` или `monteur-osnovy`. **Финальный slug — на executor этапе** (Phase 2 не блокируется).
- Hero CTA + Pricing CTA на `/` hardcode-ссылаются на `/courses/{slug}` — нужно зафиксировать в одной env-константе или в коде.

### 10.9 SEO meta

- В `layout.tsx` уже есть default title + template + description (uniform).
- Per-page metadata через `export const metadata: Metadata = { ... }` в каждом `page.tsx`. Решение: Hero `/` + `/courses/[slug]` обязательно с unique title и description. Auth-страницы (`/register`, `/login`) — можно generic.
- OpenGraph image: статика в `public/og-image.png` (см. 10.1).

### 10.10 Performance budget

- Bundle: target ≤ 200KB First Load JS для hero страницы (Lighthouse mobile-perf ≥ 80 success criteria).
- Что помогает:
  - Server Components для всего возможного (hero, program, pricing, FAQ wrapper SC, accordion CC)
  - `next/image` обязательно для всех изображений
  - Font subset `cyrillic` уже настроен в layout.tsx
  - Lazy load SmartCaptcha widget
- **Не блокирующее** для P2 ship — измерим через Lighthouse после первой версии.

---

## 11. Component Inventory Summary (for planner)

> Этот раздел — quick reference для `gsd-planner` при разбиении на tasks.

### 11.1 shadcn primitives to install (Task 0)

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input label form checkbox card skeleton accordion alert dialog
```

(Sonner уже подключён.)

### 11.2 New custom components (atomic, ready for parallel tasks)

| Component | Path | Type | Depends on | Used by |
|-----------|------|------|------------|---------|
| `Logo` | `src/components/shared/Logo.tsx` | SC | — | Header, MinimalHeader, AppHeader, Footer |
| `Header` | `src/components/marketing/Header.tsx` | CC | Logo | `(marketing)/layout.tsx` |
| `MinimalHeader` | `src/components/auth/MinimalHeader.tsx` (или в `(auth)/layout.tsx`) | SC | Logo | `(auth)/layout.tsx` |
| `AppHeader` | `src/components/shared/AppHeader.tsx` | CC | Logo, signOut action | `(app)/layout.tsx` |
| `Footer` | `src/components/marketing/Footer.tsx` | SC | — | `(marketing)/layout.tsx`, `(app)/layout.tsx` (minimal version) |
| `Hero` | `src/components/marketing/Hero.tsx` | SC | — | `(marketing)/page.tsx` |
| `ProgramOutline` | `src/components/marketing/ProgramOutline.tsx` | SC | — | `(marketing)/page.tsx` |
| `PricingBlock` | `src/components/marketing/PricingBlock.tsx` | SC | formatPrice utility | `(marketing)/page.tsx` |
| `FaqAccordion` | `src/components/marketing/FaqAccordion.tsx` | CC | shadcn Accordion | `(marketing)/page.tsx` |
| `CoursePreviewCard` | `src/components/marketing/CoursePreviewCard.tsx` | SC | next/image, formatPrice | `(marketing)/courses/[slug]/page.tsx` |
| `EmailVerificationBanner` | `src/components/shared/EmailVerificationBanner.tsx` | CC | resendConfirmationEmail action | `(app)/layout.tsx` |
| `AuthCard` | `src/components/auth/AuthCard.tsx` | SC | shadcn Card | All auth forms |
| `RegisterForm` | `src/components/auth/RegisterForm.tsx` | CC | RHF, Zod schema, signUp, SmartCaptchaWidget, ConsentCheckboxes | `(auth)/register/page.tsx` |
| `LoginForm` | `src/components/auth/LoginForm.tsx` | CC | RHF, Zod, signIn | `(auth)/login/page.tsx` |
| `ForgotPasswordForm` | `src/components/auth/ForgotPasswordForm.tsx` | CC | RHF, Zod, requestPasswordReset, SmartCaptchaWidget | `(auth)/forgot-password/page.tsx` |
| `ResetPasswordForm` | `src/components/auth/ResetPasswordForm.tsx` | CC | RHF, Zod, completePasswordReset | `(auth)/reset-password/page.tsx` |
| `ConsentCheckboxes` | `src/components/auth/ConsentCheckboxes.tsx` | CC | shadcn Checkbox, links | RegisterForm |
| `SmartCaptchaWidget` | `src/components/auth/SmartCaptchaWidget.tsx` | CC | next/script | RegisterForm, ForgotPasswordForm |
| `LegalDocPage` | `src/components/shared/LegalDocPage.tsx` | SC | Tailwind typography | `/privacy`, `/oferta` |

### 11.3 New routes

| Route | File | Layout |
|-------|------|--------|
| `/` | `src/app/(marketing)/page.tsx` (move from root) | `(marketing)/layout.tsx` |
| `/courses/[slug]` | `src/app/(marketing)/courses/[slug]/page.tsx` + `loading.tsx` + `not-found.tsx` + `error.tsx` | `(marketing)/layout.tsx` |
| `/privacy` | `src/app/(marketing)/privacy/page.tsx` | `(marketing)/layout.tsx` |
| `/oferta` | `src/app/(marketing)/oferta/page.tsx` | `(marketing)/layout.tsx` |
| `/register` | `src/app/(auth)/register/page.tsx` | `(auth)/layout.tsx` |
| `/login` | `src/app/(auth)/login/page.tsx` | `(auth)/layout.tsx` |
| `/forgot-password` | `src/app/(auth)/forgot-password/page.tsx` | `(auth)/layout.tsx` |
| `/reset-password` | `src/app/(auth)/reset-password/page.tsx` | `(auth)/layout.tsx` |
| `/auth/callback` | `src/app/(auth)/auth/callback/page.tsx` или `src/app/api/auth/callback/route.ts` | TBD by Supabase pattern |
| `/auth/check-email` | `src/app/(auth)/auth/check-email/page.tsx` | `(auth)/layout.tsx` |
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` | `(app)/layout.tsx` |

### 11.4 New layouts

| Layout | File | Note |
|--------|------|------|
| Marketing | `src/app/(marketing)/layout.tsx` | Header + Footer wrap |
| Auth | `src/app/(auth)/layout.tsx` | MinimalHeader + centered main |
| App | `src/app/(app)/layout.tsx` | requireUser + AppHeader + EmailVerificationBanner + content + minimal footer |

---

## 12. Checker Sign-Off (UI-checker fills these)

- [ ] Dimension 1 Copywriting: PASS — все ключевые элементы (CTA, empty, error, destructive) явно прописаны на русском
- [ ] Dimension 2 Visuals: PASS — иконки только lucide, изображения через next/image, animation budget зафиксирован
- [ ] Dimension 3 Color: PASS — 60/30/10 split явный, accent reserved-for list содержит 7 конкретных элементов, нет lava-lamp gradients
- [ ] Dimension 4 Typography: PASS — 4 размера, 2 веса (400/600), один шрифт (Inter), line-heights указаны
- [ ] Dimension 5 Spacing: PASS — 8-point scale с одним документированным exception (44px touch target)
- [ ] Dimension 6 Registry Safety: N/A в P2 — third-party реестры не используются, только shadcn official

**Approval:** pending

---

## 13. Source of decisions (audit trail)

| Field | Source |
|-------|--------|
| Font (Inter) | Pre-existing `src/app/layout.tsx`; не меняется |
| Color tokens (60/30/10) | Pre-existing `src/app/globals.css` shadcn defaults; mapped to roles в этом документе |
| Typography scale | Recommended defaults from `ui-conventions/SKILL.md` («один шрифт, mobile-first») |
| Spacing scale (8pt + 44px touch) | Standard mobile design (WCAG 2.5.5 touch target) |
| shadcn primitives list | Required by per-screen specs in §4 |
| Russian copy | REQUIREMENTS.md LEGAL-01..03, AUTH-01..10, LAND-01..05 |
| Two consent checkboxes | REQUIREMENTS.md AUTH-02, AUTH-03; PITFALL #14 |
| Email verification banner | REQUIREMENTS.md AUTH-04 |
| SmartCaptcha placement | REQUIREMENTS.md AUTH-09 |
| Layout split (marketing/auth/app) | STRUCTURE.md `src/app/(marketing|app|admin)` convention extended |
| Animation budget | `ui-conventions/SKILL.md` («framer-motion для tasteful animations»); solo MVP quality bar |
| No cookie banner | Decision in §9.5 — может быть пересмотрено в P7 если юрист потребует |
| Theme toggle deferred | Solo MVP — `prefers-color-scheme` only |
| Brand color / logo deferred | Solo MVP — text wordmark + shadcn defaults until first sales |

---

*UI-SPEC draft for Phase 2 — created 2026-05-24*
*Next: gsd-ui-checker validation → status: approved → consumed by gsd-planner for plan generation*
