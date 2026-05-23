# VideoEdit Academy

Онлайн-платформа курсов по монтажу видео для рынка РФ и СНГ.

**Стек:** Next.js 14 (App Router) + TypeScript + Supabase + Tailwind + shadcn/ui

---

## 📦 Что уже сделано в этом репо

- ✅ Структура папок по проектным конвенциям
- ✅ Все конфиги (TypeScript strict, ESLint, Prettier, Tailwind, Playwright, Vitest)
- ✅ Базовые клиенты Supabase (server, client, middleware)
- ✅ Хелперы авторизации (`requireUser`, `requireRole`)
- ✅ Утилиты (`cn`, `formatPrice`) с тестами
- ✅ Первая миграция БД (profiles, user_roles, courses, modules, lessons) с RLS-политиками
- ✅ Seed-данные для разработки
- ✅ Заглушка лендинга
- ✅ PWA-манифест
- ✅ Скиллы для Claude в `.claude/skills/`
- ✅ ТЗ в `docs/`

---

## 🚀 Что делать дальше — пошагово

### Шаг 1. Инициализировать Git и положить в GitHub

```bash
cd /путь/к/распакованной/папке
git init
git add .
git commit -m "chore: initial project setup"

# Создай пустой репозиторий на GitHub (без README/gitignore — у нас уже есть)
git remote add origin https://github.com/YOUR_USERNAME/videoedit-academy.git
git branch -M main
git push -u origin main
```

### Шаг 2. Установить зависимости

Требуется Node.js 20+:

```bash
node --version  # должно быть >= 20
npm install
```

Если выпадет ошибка про `husky` — это нормально, выполни:
```bash
npm run prepare
```

### Шаг 3. Установить Supabase CLI

**macOS:**
```bash
brew install supabase/tap/supabase
```

**Windows (через Scoop):**
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Linux / другие:** https://supabase.com/docs/guides/cli/getting-started

Проверка:
```bash
supabase --version
```

### Шаг 4. Создать проект Supabase

1. Зайди на https://supabase.com → Sign up / Sign in
2. New project → выбери регион **eu-central-1 (Frankfurt)** или ближайший к РФ
3. Сохрани **Database password** в надёжное место (понадобится для миграций)
4. Дождись развёртывания (~2 минуты)

### Шаг 5. Скопировать ключи Supabase

В дашборде проекта Supabase → **Project Settings → API**. Скопируй:
- Project URL → в `NEXT_PUBLIC_SUPABASE_URL`
- `anon` `public` ключ → в `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` `secret` ключ → в `SUPABASE_SERVICE_ROLE_KEY`

Создай `.env.local` из шаблона:
```bash
cp .env.example .env.local
```

Открой `.env.local` и вставь скопированные значения. Остальные переменные пока пусть остаются пустыми — заполнишь по мере подключения сервисов.

### Шаг 6. Прогнать первую миграцию

Связать локальный проект с удалённым Supabase:
```bash
supabase login                                    # авторизация
supabase link --project-ref YOUR_PROJECT_REF      # ID из URL Supabase
```

Применить миграции и сгенерировать TypeScript-типы:
```bash
supabase db push
npm run db:types
```

После этого в `src/types/database.ts` появятся типы всех таблиц.

### Шаг 7. Запустить локально

```bash
npm run dev
```

Открой http://localhost:3000 — должна открыться заглушка лендинга.

### Шаг 8. Проверить, что всё собирается и тесты проходят

```bash
npm run lint
npm run typecheck
npm run test:ci
npm run build
```

Все четыре команды должны пройти без ошибок. Если что-то падает — это место для первой задачи Claude Code.

### Шаг 9. Запустить Claude Code

В терминале в корне репо:
```bash
claude
```

Claude Code автоматически увидит файлы `.claude/skills/` и подгрузит мастер-скилл `videoedit-academy`.

Первая команда — попроси Claude осмотреться:
```
Прочитай мастер-скилл проекта и краткое содержание ТЗ из docs/.
Расскажи коротко, что ты понял про проект и какие у тебя следующие шаги.
```

После того, как убедился, что Claude в курсе проекта — давай первое задание.

---

## 🎯 Рекомендованный первый спринт работы с Claude Code

Согласно ТЗ, спринты 1–2 — это «Фундамент»:

### Задача 1. Подключить shadcn/ui
```
Установи shadcn/ui по инструкции с https://ui.shadcn.com/docs/installation/next.
Используй наши настройки tailwind.config.ts и globals.css — не перетирай их.
Добавь базовые компоненты: button, input, label, form, dialog, dropdown-menu, card, skeleton, sonner.
```

### Задача 2. Реализовать модуль авторизации (M2 из ТЗ)
```
Создай страницы /login, /register, /forgot-password, /reset-password по требованиям F-02.01 - F-02.10 из ТЗ.
Используй Supabase Auth с email/password.
Применяй правила из скиллов api-conventions, ui-conventions и security.
К каждой форме напиши unit-тест Zod-схемы и component-тест поведения.
Перед началом — сначала покажи план.
```

### Задача 3. Реализовать защищённый layout личного кабинета
```
Создай layout для группы (app) — это личный кабинет.
Layout редиректит на /login если пользователь не залогинен.
Создай заглушку страницы /dashboard с приветствием.
Используй паттерны из скилла security.
```

### Задача 4. Лендинг (модуль M1)
```
Реализуй главную страницу лендинга — hero, тарифы, FAQ, футер.
Дизайн — в духе ТЗ. Все секции адаптивны.
Используй компоненты shadcn и Tailwind. Если нужно — добавь Framer Motion для анимаций.
```

После каждой задачи прогоняй `/review` чтобы Claude сам себя проверил.

---

## 🛠 Команды проекта

| Команда | Назначение |
|---|---|
| `npm run dev` | dev-сервер на :3000 |
| `npm run build` | продакшн-сборка |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint с автоисправлением |
| `npm run typecheck` | проверка типов TypeScript |
| `npm run format` | форматирование Prettier |
| `npm run test` | Vitest в watch-режиме |
| `npm run test:ci` | Vitest однократно |
| `npm run test:coverage` | тесты с покрытием |
| `npm run test:e2e` | Playwright |
| `npm run db:migrate` | прогон миграций Supabase |
| `npm run db:reset` | сброс БД + seed-данные (только локально!) |
| `npm run db:types` | генерация TS-типов из схемы |
| `npm run db:migration:new <name>` | создать новую миграцию |

---

## 📁 Структура репозитория

```
.
├── .claude/skills/         ← скиллы для Claude (читать перед задачей)
├── docs/                   ← ТЗ и доп. документация
├── src/
│   ├── app/                ← Next.js App Router
│   │   ├── (marketing)/    ← публичный лендинг
│   │   ├── (app)/          ← личный кабинет
│   │   ├── (admin)/        ← админ-панель
│   │   └── api/            ← Route Handlers (вебхуки, OAuth)
│   ├── components/
│   ├── lib/                ← клиенты внешних сервисов
│   ├── hooks/
│   ├── stores/             ← Zustand
│   ├── server/
│   │   ├── actions/        ← Server Actions
│   │   └── queries/        ← серверные запросы
│   └── types/
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── tests/
│   ├── unit/, integration/, e2e/
└── public/
```

---

## 📚 Где искать ответы

- **Архитектурные правила:** `.claude/skills/videoedit-academy/SKILL.md`
- **Как работать с БД:** `.claude/skills/database/SKILL.md`
- **Как писать Server Actions:** `.claude/skills/api-conventions/SKILL.md`
- **Как делать компоненты:** `.claude/skills/ui-conventions/SKILL.md`
- **Безопасность и платежи:** `.claude/skills/security/SKILL.md`
- **Как писать тесты:** `.claude/skills/testing/SKILL.md`
- **Как работать над задачей:** `.claude/skills/workflow/SKILL.md`
- **Полное ТЗ:** `docs/ТЗ_VideoEdit_Academy.docx`

Все скиллы Claude Code читает автоматически — но ты можешь читать сам, если нужно.

---

## ⚠️ Чего НЕ делать

- Не коммить `.env.local`, `.env`, любые файлы с секретами
- Не используй `service_role` ключ Supabase в клиентских компонентах
- Не редактируй уже применённые миграции — только пиши новые
- Не отключай RLS на публичных таблицах
- Не пушь напрямую в `main` — только через ветки и PR
- Не доверяй ценам и правам, пришедшим с клиента — всегда проверяй на сервере

Подробности — в скилле `security`.

---

## 🆘 Если что-то идёт не так

**`npm install` падает** → проверь Node ≥ 20, удали `node_modules` и `package-lock.json`, попробуй снова.

**Supabase CLI не работает** → проверь `supabase --version`, перелогинься через `supabase login`.

**`npm run db:push` ругается на conflict** → возможно миграция уже частично применена. Сделай `supabase db reset` (только если в БД ещё нет важных данных).

**TypeScript показывает "Cannot find module '@supabase/...'"** → убедись что `npm install` завершился успешно, перезапусти TS-сервер в VS Code (`Cmd+Shift+P → TypeScript: Restart TS Server`).

**`npm run dev` падает с ошибкой про env** → проверь что `.env.local` существует и в нём заполнены минимум `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Claude Code не видит скиллы** → проверь что папка называется именно `.claude/skills/` (с точкой), не `claude/skills/`. Перезапусти Claude Code.
