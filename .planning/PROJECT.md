# VideoEdit Academy

## What This Is

Онлайн-платформа курсов по монтажу видео для рынка РФ и СНГ. Пользователь приходит на лендинг, регистрируется, оплачивает курс через ЮKassa и смотрит уроки через защищённый плеер Kinescope. Стек: Next.js 14 (App Router) + TypeScript + Supabase (БД/auth/storage) + Tailwind/shadcn.

## Core Value

**Купивший пользователь должен иметь возможность смотреть оплаченный курс без перебоев и без возможности скачать видео.** Если этот путь не работает — нет смысла во всём остальном (это путь, который генерирует выручку и который защищает контент).

## Requirements

### Validated

<!-- Уже реализовано в существующем каркасе (см. .planning/codebase/). Это не «доказано рынком», это «доказано что код существует и компилируется». -->

- ✓ Каркас Next.js 14 App Router + TypeScript strict + Tailwind + shadcn-готовность — existing scaffold
- ✓ Supabase-клиенты (`src/lib/supabase/{client,server,middleware}.ts`) — existing scaffold
- ✓ Helpers авторизации `requireUser`, `requireRole` (`src/lib/auth/require.ts`) — existing scaffold
- ✓ Базовая миграция БД с RLS-политиками: `profiles`, `user_roles`, `courses`, `modules`, `lessons` (`supabase/migrations/20260522000001_init_base_tables.sql`) — existing scaffold
- ✓ Seed-данные для разработки (`supabase/seed.sql`) — existing scaffold
- ✓ Конфиги: ESLint, Prettier, Vitest, Playwright, PostCSS, PWA-манифест — existing scaffold
- ✓ Скиллы для Claude по конвенциям проекта (`.claude/skills/{videoedit-academy,database,api-conventions,ui-conventions,security,testing,workflow}`) — existing scaffold
- ✓ Карта кодовой базы (`.planning/codebase/`) — added 2026-05-23

### Active

<!-- Milestone 1 (v1.0-mvp) — 4–6 недель соло. Цель: рабочий путь «зашёл → купил → смотрит». -->

**Лендинг (M1):**
- [ ] Главная страница с hero, описанием курса, тарифом, FAQ, футером — адаптивная
- [ ] Публичная страница курса (превью, программа модулей, цена, CTA «Купить»)

**Авторизация (M2 из ТЗ):**
- [ ] Регистрация по email + пароль с подтверждением email
- [ ] Логин с сохранением сессии между перезагрузками
- [ ] Восстановление пароля по email-ссылке
- [ ] Логаут с любой страницы
- [ ] Защищённый layout личного кабинета (редирект неавторизованных на `/login`)
- [ ] Согласие на обработку перс. данных по 152-ФЗ на форме регистрации

**Каталог и доступ к курсу:**
- [ ] Структура «курс → модули → уроки» в БД (расширить существующие таблицы)
- [ ] Страница каталога (1 курс в MVP, но архитектура под несколько)
- [ ] Страница урока с защищённым плеером Kinescope (private signed URL, без download-кнопок)
- [ ] Проверка доступа на сервере: только купивший видит уроки
- [ ] Прогресс просмотра (отметка «урок начат / завершён»)

**Платежи (ЮKassa):**
- [ ] Создание платежа через серверный action (без service_role на клиенте)
- [ ] Редирект на платёжную страницу ЮKassa
- [ ] Webhook-обработчик `payment.succeeded` с проверкой подписи и идемпотентностью
- [ ] Webhook-обработчик `payment.canceled` / `refund.succeeded`
- [ ] Запись о покупке в `purchases` таблицу, выдача доступа к курсу
- [ ] Страницы success / failure после оплаты

**Личный кабинет (мини-версия):**
- [ ] `/dashboard` со списком моих купленных курсов и прогрессом
- [ ] Профиль (имя, email — readonly, кнопка «Удалить аккаунт» по 152-ФЗ)

**Безопасность и compliance:**
- [ ] RLS-политики на всех таблицах с пользовательскими данными
- [ ] Rate limiting на auth/payment endpoints
- [ ] Audit log платежей (создание, успех, ошибка, рефанд)
- [ ] Политика обработки персональных данных (`/privacy`) + согласие при регистрации
- [ ] Защита от download видео: Kinescope в private режиме, без MediaSource API, без правого клика

**Эксплуатация:**
- [ ] Smoke-тесты критического пути (E2E Playwright: регистрация → покупка → просмотр)
- [ ] Деплой в production (Vercel или аналог)
- [ ] Мониторинг ошибок (Sentry или аналог — решить в research)

### Out of Scope

<!-- Перенесено в Milestone 2 или позже. Каждое исключение с причиной, чтобы не возвращать без обсуждения. -->

- **Админ-панель курсов/уроков** — перенесено в M2. В MVP курс создаётся напрямую через миграцию + seed. Админка — самостоятельный CRUD-проект на 2+ недели, не на критическом пути доходов.
- **Email-рассылки через Unisender** — перенесено в M2. В MVP достаточно транзакционных писем от Supabase Auth (подтверждение, сброс пароля).
- **Сертификаты после прохождения курса** — отложено до подтверждения спроса. Не критично для первой продажи.
- **Промокоды и сложные тарифы** — отложено. ЮKassa поддерживает скидки через цену, ручная скидка достаточна для пилотной продажи.
- **Несколько курсов / мульти-тариф** — архитектура поддерживает, но в v1 продаём один курс.
- **Аналитика воронки и метрики** — после первых продаж смотрим Vercel Analytics + ЮKassa-дашборд. Свой dashboard — позже.
- **OAuth-логины (Google, VK, Apple)** — отложено. Email/password покрывает 99% сценариев в РФ.
- **Мобильное приложение** — никогда (платформа адаптивна, web-first).
- **Скачивание уроков offline** — никогда (противоречит Core Value: защита контента).

## Context

**Кодовая база (brownfield):** свежий скаффолд по ТЗ. Архитектура и конвенции уже описаны в `.claude/skills/videoedit-academy/SKILL.md` и подскиллах (`database`, `api-conventions`, `ui-conventions`, `security`, `testing`, `workflow`). Все агенты планирования должны читать эти скиллы как первоисточник правил.

**Карта кода:** `.planning/codebase/` создана 2026-05-23 — 7 документов: STACK, INTEGRATIONS, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, CONCERNS. CONCERNS.md фиксирует основные риски на текущей точке (отсутствие реализаций, не каркаса).

**ТЗ:** `docs/ТЗ_VideoEdit_Academy.docx` — основной первоисточник по фичам. Запросы F-XX.XX в требованиях ссылаются на этот документ.

**Рынок:** РФ/СНГ. Это диктует выбор платёжной системы (ЮKassa, без Stripe), видео-хостинга (Kinescope или RuTube, не YouTube/Vimeo), правовых требований (152-ФЗ, явное согласие, право на удаление).

**Команда:** соло-разработчик + Claude Code. Поэтому приоритет: меньше движущихся частей, проверенные паттерны, агрессивная нарезка scope.

**Брендинг и UX:** дизайн-система пока не определена — будет проработана в фазе UI (см. `/gsd:ui-phase`).

## Constraints

- **Tech stack**: Next.js 14 App Router + TypeScript strict + Supabase + Tailwind + shadcn/ui — зафиксировано. Не менять без явного решения.
- **Видео-хостинг**: Kinescope (private режим) — упомянут в проекте, альтернативы только при существенной экономии.
- **Платежи**: ЮKassa (РФ-only). Stripe / Paddle / иные — out of scope.
- **Email**: Unisender (РФ-only) для маркетинговых. Транзакционные — Supabase Auth по умолчанию.
- **Compliance**: 152-ФЗ (хранение перс. данных, право на удаление, явное согласие, локализация на территории РФ если возможно).
- **Timeline (M1)**: 4–6 недель соло. Мягкий дедлайн. Сигнал к резке scope, если фаза начинает выходить за расчётное время.
- **Безопасность видео**: download должен быть программно затруднён (Kinescope private + отсутствие нативных download-кнопок). Полная защита от записи экрана недостижима — это известный компромисс.
- **Бюджет**: минимальный (стартап одного человека). Supabase free → pro по необходимости, Vercel hobby/pro, Kinescope тариф под нагрузку. Без дорогих SaaS-зависимостей.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Разбить продукт на 2 milestone'а: M1 (MVP) и M2 (полная админка/email/кабинет) | «Полный v1 за 4–6 недель соло» нереалистично (реально 12–16). Разбиение даёт shippable MVP в дедлайн без overpromise. | — Pending |
| Vertical MVP (per-phase mode = mvp) | Соло + дедлайн + критический путь оплаты = нужны end-to-end слайсы, не горизонтальные слои. | — Pending |
| Quality (Opus) model profile для планирующих агентов | Сложный продукт с compliance- и security-чувствительными частями. Дороже, но риск-аппетит низкий. | — Pending |
| Все workflow-агенты включены (research + plan_check + verifier) | Соло-разработчик = одна пара глаз. Подстраховочные агенты компенсируют отсутствие code-review партнёра. | — Pending |
| Зафиксировать ЮKassa как единственный платёжный провайдер | РФ-рынок, без альтернатив для приёма карт RU. Stripe/Paddle не работают с РФ. | — Pending |
| Зафиксировать Kinescope как видео-хостинг | Упомянут в ТЗ, поддерживает private signed URL, хостится в РФ. RuTube как fallback если Kinescope станет дорог. | — Pending |
| Адмика курсов — не в MVP, временно через миграции + seed | Админка = 2+ недели CRUD. Один курс в MVP можно создать через SQL. Высвобождает 2 недели на критический путь. | — Pending |
| Email-рассылки Unisender — не в MVP | Достаточно транзакционных писем Supabase Auth для регистрации/сброса. Маркетинговые рассылки начинаются после первых клиентов. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-24 after initialization*
