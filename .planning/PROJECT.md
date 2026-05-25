# Artum Academy

## What This Is

**Artum Academy** — образовательная онлайн-платформа с курсами по 7 направлениям: нейросети/AI, фотография, видеосъёмка, монтаж, дизайн, визуал, копирайтинг. Студент покупает курс (или подписку), смотрит видеоуроки, отслеживает прогресс, получает PDF-сертификат при 100% прохождении.

Стек: Next.js 14 App Router + TypeScript + Supabase + Tailwind + shadcn/ui. Тёмная тема по умолчанию с фиолетовым акцентом `#A855F7`.

## Project Pivot — 2026-05-24

Этот репозиторий начинал жизнь как **VideoEdit Academy** (одно-курсовая MVP по монтажу видео). После прохождения Phase 1 (Dev Foundations) и частичного Phase 2 (skeleton чёрного по белому лендинга) проект развернут в **Artum Academy** — мульти-курсовую платформу по ТЗ `docs/ARTUM_Academy_TZ.docx`.

**Что сохраняется из VideoEdit:**
- Вся Phase 1 инфраструктура: env-parser, server-only boundary, pino logger, audit_log, Sentry SDK, RLS test harness, миграции (audit_log, user_consents, rate_limit_log, базовые courses/modules/lessons).
- Базовая разметка скаффолда (Next.js App Router, route groups, shadcn-готовность).
- Utility helpers: rate-limit wrapper, captcha verify, headers/client-ip.

**Что выбрасывается:**
- VideoEdit-specific брендинг (название, цвета, копия лендинга).
- VideoEdit landing page + Hero/Programme/Pricing/FAQ.
- VideoEdit privacy/oferta тексты.
- VideoEdit Phase 2 планы (архивированы как `.planning/phases/2-auth-marketing-consent.archived/`).

## Core Value

**Студент покупает курс на тёмной красивой платформе и проходит уроки до конца, получая PDF-сертификат.** Это конверсионная воронка (каталог → покупка → просмотр → сертификат), которая генерирует выручку.

## Requirements

### Validated

<!-- Инфраструктура из Phase 1 (VideoEdit-период, переиспользуется как есть). -->

- ✓ Env Zod parser с fail-fast при невалидных секретах (`src/env.ts`, `src/instrumentation.ts`) — Phase 1
- ✓ `server-only` boundary на `src/lib/supabase/admin.ts` + ESLint rule + ESLint API smoke test — Phase 1
- ✓ pino structured logger с redact (`src/lib/logger.ts`) — Phase 1
- ✓ `audit_log` Postgres миграция + `auditLog()` helper с IP/UA capture — Phase 1
- ✓ `@sentry/nextjs` ^8 wired (server/client/edge configs + scripts/sentry-test.ts) — Phase 1
- ✓ RLS test harness (Vitest + Supabase local + 2-user cross-deny canary) — Phase 1
- ✓ user_consents + rate_limit_log миграции + helper `rateLimit()` + `verifySmartCaptchaToken()` — Phase 2 plan-06 (универсальная инфра, переиспользуется в Artum)
- ✓ shadcn/ui setup + ~10 примитивов (button, card, input, label, form, dialog, dropdown-menu, skeleton, sonner, accordion, checkbox, alert, tabs) — Phase 2 plan-01

### Active (Artum Скелет — этап 1 ТЗ §9)

**Цель:** «вёрстка всех страниц, навигация, адаптив». Бэкенд / оплата / админка — последующие этапы.

- [ ] **Дашборд** (`/`): хедер, слоган, 8 фильтров-пилюль (Все + 7 категорий), сетка карточек курсов 3 в ряд, блок статистики
- [ ] **Карточка курса**: превью + цветной тег категории + название + метаданные (уроки/длительность/студенты) + прогресс-бар + ховер-фиолет
- [ ] **Страница курса** (`/courses/[slug]`): обложка + описание + список уроков с галочками пройденных + общий прогресс + кнопка Начать/Продолжить
- [ ] **Страница урока** (`/learn/[courseSlug]/[lessonId]`): видеоплеер placeholder + название + предыдущий/следующий + отметка пройденного
- [ ] **Личный кабинет** (`/profile`): аватар + имя + купленные курсы + сертификаты + история оплат + настройки
- [ ] **Страница сертификатов** (`/certificates`): список полученных + ссылка на PDF (заглушка)
- [ ] **Авторизация** (`/login`, `/register`): email/пароль + Google OAuth заглушка + восстановление пароля
- [ ] Тёмная тема по умолчанию, цветовая палитра из ТЗ §2
- [ ] Адаптивная вёрстка (десктоп + мобила)
- [ ] Навигация работает между всеми страницами (кнопки не "битые")

### Out of Scope (этап 1 — пока скелет, не реализуем)

- **Бэкенд логика и реальный auth** — мокаем currentUser, формы не делают submit (toast "скоро")
- **Реальный видеоплеер** — placeholder `<div>` с заглушкой
- **Платёжная интеграция** — кнопка «Купить» открывает заглушку; провайдер ещё не выбран (Stripe vs ЮKassa)
- **Сертификаты PDF** — список + dummy скачивание
- **Админ-панель** — последний этап ТЗ
- **Геймификация / ДЗ / рассрочка / расписание / офлайн** — явно нет в ТЗ §1.5
- **152-ФЗ полная compliance** — фрагменты есть (privacy/oferta drafts, user_consents таблица), но рынок ещё не выбран → детали потом

## Context

**ТЗ:** `docs/ARTUM_Academy_TZ.docx` — версия 1.0 предварительная от 2026-05-24. После утверждения скелета будут детальные макеты и спецификации.

**Этапы ТЗ §9:**
1. **Скелет сайта** — вёрстка всех страниц, навигация, адаптив ← **МЫ ЗДЕСЬ**
2. Авторизация — реальный auth + Google OAuth
3. Курсы и уроки — каталог + видеоплеер + прогресс из БД
4. Оплата — выбор провайдера + страница тарифов
5. Сертификаты — генерация PDF + страница верификации
6. Админ-панель — CRUD курсов + drag-drop уроков + статистика
7. Тестирование + запуск

**Референсы (ТЗ §1.4):** KF Academy (structure), Skillbox (личный кабинет, каталог), VideoForMe (short courses).

**Категории (ТЗ §6):** Нейросети/AI, Фото, Видео, Монтаж, Дизайн, Визуал, Копирайтинг — каждая со своим цветным тегом.

**Команда:** соло-разработчик + Claude. Из-за этого приоритет: визуальный результат > архитектурная чистота на старте.

## Constraints

- **Тёмная тема обязательна по умолчанию** (ТЗ §2 — палитра жёстко зафиксирована)
- **Стек зафиксирован:** Next.js 14 App Router + TS strict + Supabase + Tailwind + shadcn
- **Платёжная система не выбрана** — решаем после скелета
- **Видео-хостинг не выбран** — Kinescope или Mux или S3+signed URLs или Cloudflare Stream
- **Бюджет:** минимальный (стартап одного человека)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pivot с VideoEdit Academy на Artum Academy | Новый бизнес-вектор: мульти-категория вместо одного курса по монтажу | — Pending (только что сделано) |
| Сохранить Phase 1 инфру | env Zod + server-only + pino + audit_log + Sentry + RLS harness — универсальны для любой EdTech-платформы | ✓ Good |
| Архивировать Phase 2 plans (не удалять) | История планирования полезна для retrospective; ~30% planned components переиспользуются в Artum | ✓ Good |
| Этап 1 (скелет) делаем напрямую, без GSD-фаз | Соло-разработчик хочет видеть UI быстро; GSD-ceremony затратна на этапе вёрстки макетов; вернёмся к ней на этапе 3 (реальные данные) | — Pending |
| Mock auth (фейковый logged-in user) для скелета | Без реального auth дашборд/ЛК/уроки не выглядят как продукт; mock даёт визуальный результат | — Pending |
| Платёжная система отложена до этапа 4 | ТЗ не требует определиться сейчас; решение зависит от рынка (РФ vs мир) | — Pending |

## Evolution

This document evolves at major decisions and stage transitions per ТЗ §9.

**After each ТЗ-stage:**
1. Active → Validated с пометкой stage
2. Out of Scope пересматривается для следующего stage
3. Новые требования из детальных макетов → Active

---
*Last updated: 2026-05-24 after Artum Academy pivot from VideoEdit Academy.*
