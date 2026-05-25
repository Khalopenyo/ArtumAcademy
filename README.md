# Artum Academy

Образовательная онлайн-платформа с курсами по 7 направлениям: AI/нейросети, фотография, видеосъёмка, монтаж, дизайн, визуал, копирайтинг. Тёмная тема, фиолетовый акцент `#A855F7`.

**ТЗ:** `docs/ARTUM_Academy_TZ.docx` (версия 1.0, 2026-05-24).
**Стадия:** этап 1 ТЗ §9 — скелет сайта (вёрстка всех страниц, навигация, адаптив). Без реального бэкенда / auth / платежей.

**Стек:** Next.js 14 App Router + TypeScript + Supabase (БД и auth, позже) + Tailwind + shadcn/ui.

---

## Project pivot history

Этот репозиторий начинал жизнь как `VideoEdit Academy` (одно-курсовая MVP по монтажу видео). После Phase 1 (Dev Foundations) и частичного Phase 2 проект развёрнут в Artum Academy — мульти-курсовую платформу по новому ТЗ.

**Что переиспользуется из VideoEdit:**
- Phase 1 инфраструктура (`src/env.ts`, `src/lib/supabase/admin.ts`, `src/lib/logger.ts`, `src/lib/audit-log.ts`, миграции `audit_log` / `user_consents` / `rate_limit_log`, RLS-тест-харнесс, Sentry SDK)
- shadcn/ui setup и ~12 примитивов
- Универсальные helpers: `rate-limit`, `captcha/verify`, `headers/client-ip`

**Что выброшено:**
- VideoEdit брендинг, лендинг, копия, цены
- Phase 2 planning (архивирован в `.planning/phases/2-auth-marketing-consent.archived/`)

См. `.planning/PROJECT.md` для деталей.

---

## Запуск локально

```bash
npm install
cp .env.example .env.local       # заполни SUPABASE_*, опционально SENTRY_DSN
npm run dev                      # http://localhost:3000
```

Проверки:

```bash
npm run lint
npm run typecheck
npm run test:ci
```

Supabase локально (нужен Docker):

```bash
supabase start
npm run db:reset                 # применит миграции + seed
npm run db:types                 # сгенерирует src/types/database.ts
```

---

## Этапы ТЗ §9

1. **Скелет сайта** — вёрстка всех страниц, навигация, адаптив ← **СЕЙЧАС**
2. Авторизация — Supabase Auth + Google OAuth + восстановление пароля
3. Курсы и уроки — каталог + видеоплеер + прогресс из БД
4. Оплата — провайдер TBD (Stripe vs ЮKassa) + страница тарифов
5. Сертификаты — генерация PDF + страница верификации
6. Админ-панель — CRUD курсов + drag-drop уроков + статистика
7. Тестирование + запуск

---

## Структура

```
src/
├── app/
│   ├── (marketing)/     ← публичный лендинг (дашборд) + страницы курсов
│   ├── (app)/           ← залогиненная зона (личный кабинет, уроки)
│   └── (auth)/          ← /login, /register, /forgot-password
├── components/
│   ├── ui/              ← shadcn примитивы
│   ├── shared/          ← Logo и общее
│   └── artum/           ← фичевые компоненты (CategoryPill, CourseCard, …)
├── lib/                 ← rate-limit, captcha, logger, audit, supabase, mock-данные
├── server/actions/      ← Server Actions (на этапе 2+)
└── types/               ← TypeScript-типы БД (hand-patched на этапе скелета)
supabase/
├── migrations/          ← SQL миграции (3 шт. из Phase 1+P2-archived)
└── seed.sql             ← локальные тестовые данные (будет переписан под Artum)
docs/
├── ARTUM_Academy_TZ.docx  ← актуальное ТЗ
└── ТЗ_VideoEdit_Academy.docx  ← старое ТЗ (исторический контекст)
```
