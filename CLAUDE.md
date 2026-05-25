# CLAUDE.md

> Корневой контекст-файл проекта. Читай первым в каждой новой сессии. Полные документы — в `.planning/` и `.claude/skills/`.

<!-- GSD:project-start source:.planning/PROJECT.md -->
## Project

**Artum Academy** — образовательная онлайн-платформа с курсами по 7 направлениям: AI/нейросети, фотография, видеосъёмка, монтаж, дизайн, визуал, копирайтинг. Тёмная тема, фиолетовый акцент `#A855F7`.

**Pivot history:** этот репо стартовал как `VideoEdit Academy` (single-course MVP). После Phase 1 (Dev Foundations) проект развёрнут в Artum по новому ТЗ `docs/ARTUM_Academy_TZ.docx`. Phase 1 инфраструктура переиспользуется как есть; Phase 2 (VideoEdit) архивирован в `.planning/phases/2-auth-marketing-consent.archived/`.

**Core Value:** студент покупает курс на красивой тёмной платформе и проходит уроки до конца, получая PDF-сертификат. Конверсионная воронка каталог → покупка → просмотр → сертификат генерирует выручку.

**Текущая стадия:** этап 1 ТЗ §9 — **скелет сайта** (вёрстка всех 6 страниц, навигация, адаптив). Без реального бэкенда, auth, оплаты, сертификатов PDF и админки — это следующие этапы по ТЗ §9.

**Полный контекст:** `.planning/PROJECT.md` (validated/active/out-of-scope, ключевые решения, ограничения).

<!-- GSD:project-end -->

<!-- GSD:stack-start source:.planning/codebase/STACK.md + .planning/research/STACK.md -->
## Technology Stack

**Locked core** (зафиксировано, не менять без явного решения):

- **Runtime:** Next.js 14.2.x App Router + React 18.3 + TypeScript strict + Node 20+
- **DB / Auth / Storage:** Supabase (Postgres 15 + `@supabase/ssr` 0.5, `@supabase/supabase-js` 2.45)
- **UI:** Tailwind 3.4 + shadcn/ui (Radix) + lucide-react + framer-motion + sonner
- **State:** TanStack Query 5 (серверный кэш) + Zustand 4 (UI/wizard state)
- **Forms:** React Hook Form 7 + Zod 3.23 (валидация) + `@hookform/resolvers`
- **Tests:** Vitest 2 + Testing Library 16 + Playwright 1.48 + MSW 2 (HTTP mocks)
- **Внешние сервисы:** Kinescope (private видео) + ЮKassa (платежи, 54-ФЗ) + Unisender (email — M2)

**Additive в M1** (см. `.planning/research/STACK.md` для версий и обоснований):

- `@kinescope/react-kinescope-player` — официальный React-плеер
- `@a2seven/yoo-checkout` — единственный поддерживаемый ЮKassa Node SDK
- `@sentry/nextjs` ^8 + self-hosted GlitchTip/Bugsink (Sentry SaaS заблокирован для РФ)
- `pino` + `pino-pretty` — структурированное JSON-логирование (парный с таблицей `audit_log`)

**Запрещено / sanctions-affected:** Stripe / Paddle / PayPal / Lemon Squeezy (платежи), Resend / Mailgun / Postmark / Sendgrid / AWS SES (email), Sentry SaaS / Rollbar / Bugsnag (errors), Cloudflare Images (assets).

**Полный stack:** `.planning/codebase/STACK.md` (existing scaffold) + `.planning/research/STACK.md` (планируемые добавки).

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:.planning/codebase/CONVENTIONS.md -->
## Conventions

- **Server vs Client:** `'use client'` ставится только когда нужен (форма, интерактивный плеер, Zustand). По умолчанию — Server Component.
- **Server Actions для мутаций, server queries для чтений, Route Handlers (`/app/api/*`) для вебхуков и OAuth callback.** Никаких client-side fetch к собственному API.
- **Supabase:** Anon-клиент работает под RLS на сервере и клиенте; **service_role** только в файлах с `import 'server-only'` на первой строке (`src/lib/supabase/admin.ts`). Никогда не импортировать `admin.ts` в client-компоненты.
- **Формы:** React Hook Form + Zod-схема, общая на client (валидация) и server (re-валидация в Server Action). Zod-схемы — в `src/lib/schemas/`.
- **Стили:** Tailwind utility-classes, базовые компоненты — shadcn/ui в `src/components/ui/`, фичевые компоненты — в `src/components/<feature>/`.
- **Error handling:** Server Actions возвращают `{ ok: true, data } | { ok: false, error }` (не throw). Client отображает ошибки через `sonner` toast или inline.
- **Логирование:** `pino` logger в `src/lib/logger.ts`. Все Server Actions/Route Handlers логируют start/end/error. Чувствительные события (платежи, доступ, удаление аккаунта) — дополнительно в таблицу `audit_log`.
- **Тесты:** к каждой фиче. Unit — Vitest для чистых функций (Zod-схемы, утилиты). Integration — Vitest + локальная Supabase (RLS-политики, Server Actions). E2E — Playwright для критических путей (регистрация → покупка → просмотр).

**Полные правила:** `.claude/skills/ui-conventions/SKILL.md`, `.claude/skills/api-conventions/SKILL.md`, `.claude/skills/database/SKILL.md`, `.claude/skills/testing/SKILL.md`, `.claude/skills/security/SKILL.md`.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:.planning/codebase/ARCHITECTURE.md + .planning/research/ARCHITECTURE.md -->
## Architecture

**Слои (snapshot, упрощённо):**

```
src/app/                     Next.js App Router (routes, layouts)
├── (marketing)/             публичные страницы (лендинг, /courses/[slug], /privacy, /oferta)
├── (app)/                   защищённая зона (/dashboard, /learn, /profile) — auth gate
├── (admin)/                 зарезервировано на M2
└── api/                     Route Handlers (webhooks, OAuth callback)
src/server/
├── actions/                 Server Actions (мутации из форм)
└── queries/                 server-only функции чтения (с RLS)
src/lib/
├── supabase/{client,server,middleware,admin}.ts   ← admin.ts has 'server-only'
├── auth/require.ts          requireUser / requireRole helpers
├── yookassa/                ЮKassa SDK wrapper + verify
├── kinescope/               signed-URL генерация
├── rate-limit/              Postgres-backed wrapper
└── logger.ts                pino
src/components/{ui,<feature>}/, src/hooks/, src/stores/ (Zustand), src/types/
src/middleware.ts            Supabase auth cookie refresh + auth gate
supabase/migrations/         SQL-миграции (только append-only в проде)
```

**Data flow (request → response):**

1. Request → `src/middleware.ts` (refresh auth cookie)
2. Route или Server Action → `requireUser()` или `assertCourseAccess(userId, courseId)` → server query
3. Server query → `createServerClient()` под RLS → Postgres
4. Mutations возвращают `{ ok, data | error }`; `revalidatePath` если нужно

**Boundaries (что НЕ ходит куда):**

- Client → service_role: **запрещено** (ESLint + `import 'server-only'`)
- Client → внешние API напрямую: **запрещено** (только через Server Action / Route Handler)
- Webhook handler → service_role: **разрешено** (нужно для записи под полным правом)
- Lesson page → Kinescope URL: signed server-side, **никогда не кэшируется** в localStorage/React Query/Sentry breadcrumbs

**Build order (этапы ТЗ §9):** (1) Скелет сайта ← **СЕЙЧАС** → (2) Авторизация Supabase + Google OAuth → (3) Курсы и уроки с БД → (4) Оплата (провайдер TBD: Stripe vs ЮKassa) → (5) Сертификаты PDF → (6) Админ-панель → (7) Тестирование + запуск.

**Полная архитектура:** `.planning/codebase/ARCHITECTURE.md` (текущая) + `.planning/research/ARCHITECTURE.md` (целевая M1, 1050 строк, включая RLS-политики, payment flow, video access flow).

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:.claude/skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| `videoedit-academy` | Главный скилл — обязательное чтение перед любой задачей. Стек, структура, ограничения, ссылки на подскиллы. | `.claude/skills/videoedit-academy/SKILL.md` |
| `database` | Работа с Supabase Postgres: миграции, RLS, soft-delete, индексы, RPC-функции, типы БД. | `.claude/skills/database/SKILL.md` |
| `api-conventions` | Server Actions, Route Handlers, server queries, Zod-валидация, идемпотентность вебхуков. | `.claude/skills/api-conventions/SKILL.md` |
| `ui-conventions` | Server/Client компоненты, Tailwind + shadcn, формы React Hook Form + Zod, loading/empty/error состояния. | `.claude/skills/ui-conventions/SKILL.md` |
| `security` | RLS, секреты, ЮKassa-вебхуки, 152-ФЗ, защита контента, audit log, rate limiting. **Critical: нарушение = потеря денег или регуляторные проблемы.** | `.claude/skills/security/SKILL.md` |
| `testing` | Unit (Vitest), component (Testing Library), integration (real test DB), E2E (Playwright). Тесты к каждой фиче. | `.claude/skills/testing/SKILL.md` |
| `workflow` | Цикл «понять → план → согласовать → сделать → проверить → коммитить» для задач больше одного файла. | `.claude/skills/workflow/SKILL.md` |

<!-- GSD:skills-end -->

<!-- GSD:planning-start source:.planning/ -->
## GSD Planning Artifacts

Все артефакты планирования живут в `.planning/`. Читай их вместо того, чтобы изобретать решения заново.

| Артефакт | Назначение |
|----------|-----------|
| `.planning/PROJECT.md` | Project identity, M1 scope, validated/active/out-of-scope, ключевые решения, ограничения |
| `.planning/REQUIREMENTS.md` | 84 атомарных REQ-ID для M1 v1, замаплены на фазы (1–6), v2 deferred, out-of-scope |
| `.planning/ROADMAP.md` | 7 фаз с целями, режимом (mvp), success criteria, REQ-маппингом, pre-phase research spikes (P4 ЮKassa webhook auth, P5 Kinescope JWT); P7 = Production Launch Prep (внешние треки запускать в P5) |
| `.planning/STATE.md` | Текущая фаза, milestone, project reference. Обновляется при transitions |
| `.planning/config.json` | YOLO mode, standard granularity, parallelization, Opus models, все workflow-агенты, MVP-mode |
| `.planning/codebase/` | 7-документная карта существующей кодовой базы (STACK, INTEGRATIONS, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, CONCERNS) |
| `.planning/research/` | Domain research для M1: STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY |

При работе над фазой читай: `PROJECT.md` (контекст) → `ROADMAP.md` (твоя фаза) → `REQUIREMENTS.md` (REQ-IDs фазы) → `research/SUMMARY.md` (общая стратегия) → конкретные `research/*.md` и `codebase/*.md` по необходимости.

<!-- GSD:planning-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Перед использованием `Edit`, `Write` или других tools, изменяющих файлы, начинай работу через GSD-команду — иначе planning-артефакты и контекст исполнения расходятся.

Точки входа:

- `/gsd:plan-phase <N>` — спланировать фазу N перед исполнением (создаёт `phases/<N>/PLAN.md`)
- `/gsd:execute-phase <N>` — исполнить план фазы N (атомарные коммиты, дев-агенты в параллель)
- `/gsd:verify-phase <N>` — проверить что цели фазы достигнуты, requirements удовлетворены
- `/gsd:quick` — мелкие правки, доки, ad-hoc задачи (с GSD-гарантиями, без planning overhead)
- `/gsd:debug` — расследование багов с persistent state
- `/gsd:progress` — посмотреть где мы и что дальше
- `/gsd:transition` — закрыть текущую фазу, перейти к следующей

Не делай прямых правок репо вне GSD-флоу, если пользователь явно не попросил обойти его. Если задача мелкая и очевидная — `/gsd:quick`, не `Edit` напрямую.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` — do not edit manually.

<!-- GSD:profile-end -->
