# Artum Academy — статус проекта и память рабочей сессии

> Хендофф-документ: что за проект, что сделано, что осталось, ключевые технические решения.
> Составлен по итогам большой сессии разработки. Дата: **2026-06-09**.
> ⚠️ Реальные значения ключей/паролей сюда НЕ внесены намеренно (чтобы не плодить утечку) — см. раздел «Безопасность».

---

## 1. О проекте

**Artum Academy** — онлайн-платформа видеокурсов по 7 направлениям (AI/нейросети, фотография, видеосъёмка, монтаж, дизайн, визуал, копирайтинг). Тёмная «космическая» тема, фиолетовый акцент `#A855F7`.

- **Прод:** https://artumacademy.ru (VPS Timeweb)
- **Реквизиты продавца (самозанятый/НПД):** Абдулкадыров Ясин Дагаевич, ИНН `201302285050`, `support@artumacademy.ru`, `+7 938 994 45 99` (страница `/requisites`, оферта).
- **Воронка:** каталог → страница курса → покупка (ЮKassa) → просмотр уроков → PDF-сертификат.

### Стек
- Next.js 14.2 App Router · React 18.3 · TypeScript strict · Node 20+
- Supabase (Postgres 15 + Auth + Storage), `@supabase/ssr`
- Tailwind 3.4 + shadcn/ui (Radix) + framer-motion + sonner + lucide
- **Kinescope** — приватное видео (`@kinescope/react-kinescope-player`)
- **ЮKassa** — оплата 54-ФЗ (`@a2seven/yoo-checkout`)
- **TipTap v3** — визуальный редактор контента уроков
- `sanitize-html` — санитизация HTML уроков (НЕ isomorphic-dompurify — см. §7)
- `jsPDF` + PT Sans (сабсет) — сертификаты
- pino (логи), @sentry/nextjs (стаб DSN)

---

## 2. Инфраструктура и деплой

- **Деплой:** `./deploy.sh` → rsync на сервер (исключая node_modules/.next/.git/.planning/.env.local) → `npm ci` → `npx next build` → `pm2 restart artum`. Хост `root@5.42.100.106:/var/www/artum`, ключ `~/.ssh/artum_deploy`.
- **БД:** Supabase, project ref `bcidlpwrlclmdzupxazh`. Миграции применяются вручную через **Management API** (`POST https://api.supabase.com/v1/projects/{ref}/database/query`) или SQL-editor — **не** через `supabase db push` (история не синхронизирована).
- **Секреты:** только в `.env.local` на сервере (в гит/rsync не уходит). `next build` сам читает `.env.local` на сервере.
- **Оплата:** прод сейчас в **ТЕСТОВОМ режиме ЮKassa** (тестовый магазин `1380615`). Тестовая карта: `5555 5555 5555 4477`, срок `12/30`, CVC `123`.
- **Вебхук ЮKassa** настроен в тестовом магазине → `https://artumacademy.ru/api/webhooks/yookassa/<секрет>` (секрет в `.env.local`, `YOOKASSA_WEBHOOK_PATH_SECRET`).

---

## 3. Что сделано в этой сессии (всё в проде)

### 🎬 Видео — Kinescope
- Официальный плеер `@kinescope/react-kinescope-player` (`KinescopePlayer.tsx`), lazy-load, прогресс/resume через события, **водяной знак с email зрителя** (анти-пиратство).
- `LessonPlayer.tsx` — диспетчер: Kinescope ID / mp4-URL / плейсхолдер (`parseLessonVideo` в `src/lib/kinescope/video-ref.ts`, юнит-тесты).
- **Загрузка видео из админки:** кнопка «Загрузить» у урока → стрим на `/api/admin/videos` → `uploader.kinescope.io` (токен серверный). `src/lib/kinescope/upload.ts`, `KinescopeUploadButton.tsx`.
- Защита: видео привязано к домену (project privacy в кабинете Kinescope) + server-side гейт доступа к уроку.

### 💳 Оплата — ЮKassa (реальный поток, тест-режим)
- Поток: `buyCourseAction`/`buySubscriptionAction` → `startCheckout` → создаётся **pending** платёж → `createPayment` в ЮKassa (с чеком 54-ФЗ, `vat_code:1`) → редирект на `confirmation_url`.
- **Вебхук** `src/app/api/webhooks/yookassa/[secret]/route.ts`: путь-секрет (constant-time) + авторитетный `getPayment` (статус/сумма берутся оттуда, не из тела) + идемпотентность (`webhook_events`) + сверка суммы → доступ выдаётся в `src/server/payments/fulfillment.ts`.
- **Возвраты:** `refundPaymentAction` (кнопка «Вернуть» в `/admin/payments`) → refund в ЮKassa + статус `refunded` + отзыв доступа.
- Промокод списывается атомарно (`decrement_promocode` RPC) только при успешной оплате (фикс TOCTOU-гонки).
- Возврат-страница `/payment/return` поллит статус.

### 📝 Уроки с контентом (текст + картинки + видео)
- Визуальный редактор **TipTap** (`LessonContentEditor.tsx`): жирный/курсив/заголовки/списки/ссылки/картинки. Кнопка «Контент» у урока → модалка.
- **Загрузка картинок** → `/api/admin/lesson-images` → Supabase Storage (публичный бакет `lesson-content`, создаётся лениво).
- HTML **санитизируется на сервере** (`sanitize-html`, строгий allowlist) в `createLessonAction`/`updateLessonAction`, хранится в `lessons.content`.
- Показ на странице урока (`LessonPageClient.tsx`) с типографикой `prose`. **Видео опционально** — текстовый урок не показывает плеер-заглушку.

### 🛠 Админка
- Страница **платежей** `/admin/payments` (фильтр по статусам, возвраты).
- **Пользователи** `/admin/users` (⚙️): назначить/снять админа, выдать/отозвать доступ к курсу вручную.
- Курсы: **публикация/черновик** (переключатель + бейдж; админ-запросы видят черновики через service_role — `getAllCoursesForAdmin`, `getCourseBySlugForAdmin`).
- Загрузка видео + контент-редактор у уроков (см. выше).

### 🔐 152-ФЗ и безопасность
- **Удаление аккаунта + экспорт данных** (`src/server/actions/account.ts`, danger-zone в профиле). Каскадное удаление, audit-trail.
- **Согласие при регистрации** теперь обязательно на сервере и пишется в `user_consents` (версия политики, IP, UA).
- CSP с доменами Kinescope/Supabase/ЮKassa/captcha.

### 📄 Прочее
- Сертификат **печатает кириллицу** (встроенный PT Sans, сабсет ~84 КБ) — `src/lib/pdf/certificate.ts` + `src/lib/pdf/fonts/pt-sans.ts`.
- Проверка сертификата `/verify` + `/verify/[number]`.
- **Живые уведомления** (поллинг колокольчика ~30с).
- Бейдж «безопасная оплата» у кнопок покупки.
- SEO: JSON-LD (Organization/WebSite/Course), OG-картинка, sitemap, robots.
- FAQ `/faq`, страница реквизитов `/requisites`, корп. почта `support@artumacademy.ru`.
- Email-OTP при регистрации (код на почту, Supabase SMTP).

### 🧹 Очистка каталога
- Демо-каталог был **сильно замусорен** (909 уроков, 175 дублей от многократного прогона сида, демо-видео). По решению — **полностью удалён** (курсы/уроки/тест-покупки/платежи). Аккаунты сохранены. **Каталог сейчас пустой** — заводить реальные курсы через `/admin/courses`.

### 🐞 Багфиксы
- **Создание курса падало** — из-за `isomorphic-dompurify` (тянет jsdom, ломается в server-бандле Next). Заменено на `sanitize-html`. ✅ проверено E2E.
- `/dashboard` (битая ссылка после подписки) → каталог `/`.
- Невалидный `pattern` у поля slug (console-error) → исправлен.

### ✅ Тестирование (E2E, реальный браузер)
Пройдено: 12 публичных страниц (0 ошибок консоли), гейты доступа, SEO/API, **создание курса**, редактор контента + загрузка картинки + показ, оплата подписки → доходит до ЮKassa, админ-страницы, удаление курса.

---

## 4. Что осталось — ТВОИ шаги (для боевого запуска)

- 🔑 **Сменить пароль** `khalid@mail.ru` и **перевыпустить засветившиеся ключи** (см. §6).
- 💰 **Переключить ЮKassa на боевые ключи** (когда сам прогонишь оплату тест-картой и будешь готов принимать деньги). Прислать боевые `shopId` + `live_...` ключ — пропишу на сервере + настрою вебхук в боевом магазине.
- 📹 **Залить реальные видео** в Kinescope и **завести курсы** (каталог пустой).
- 📊 **Аналитика** — прислать ID Яндекс.Метрики / VK-пикселя (встрою).
- 🔓 **OAuth** (Google/Яндекс/VK) — нужны creds приложений.
- 📄 **Контент** для `/about` и `/cases` (тексты, фото, реальные отзывы).
- ⚖️ **РКН** — подать уведомление оператора ПДн на [pd.rkn.gov.ru](https://pd.rkn.gov.ru/operators-registry/notification/) (обязательно по 152-ФЗ, штраф 100–300 тыс ₽ за неподачу с 30.05.2025).

---

## 5. Что осталось — технические задачи (по мере поступления данных)

- Встроить аналитику (по ID) + цели/события на кнопки покупки.
- OAuth-вход (по creds) + callback-роут.
- Наполнить `/about` (могу написать черновик) и `/cases` (нужны реальные отзывы — фейки делать нельзя).
- **Kinescope DRM-токен** (signed playback) — сейчас защита только по домену; для усиления можно добавить серверную выписку токена.
- **Unisender** (email на масштаб) — сейчас письма авторизации идут через Supabase SMTP (лимиты на больших объёмах).
- Опционально: блог (SEO-трафик), отдельный `/courses` индекс, страница поиска, страницы преподавателей.
- Мелочи: soft-404 на несуществующем курсе (200 вместо 404).

---

## 6. ⚠️ Безопасность — сделать обязательно

Засветились в переписке → **перевыпустить/сменить**:
- **Kinescope API-токен** (Настройки → API-токены → удалить старый, создать новый).
- **Боевой ключ ЮKassa** (`live_...`) — пока не использовался на сервере, но засветился.
- **Пароль** `khalid@mail.ru`.

Также:
- **Временный Supabase Management-токен** лежит в `.env.local` (`SUPABASE_ACCESS_TOKEN`) — **удалить** после завершения работ с БД.
- Боевые секреты живут только в `.env.local` на сервере (в гит не коммитятся). При замене ключей — обновить там же.

---

## 7. Ключевые технические решения (память для разработчика)

- **Санитизация HTML:** только `sanitize-html` (чистый JS). **НЕ использовать `isomorphic-dompurify`** — он тянет jsdom и падает в серверном бандле Next (именно это ломало создание курса).
- **Вебхук ЮKassa:** ЮKassa НЕ подписывает вебхуки HMAC → защита = неугадываемый путь-секрет + перезапрос `getPayment` (авторитетный статус) + идемпотентность (`webhook_events`, ключ `event:payment_id`) + сверка суммы. Выдача доступа идемпотентна (claim по `status='pending'`).
- **Доступ выдаётся вебхуком**, не синхронно при checkout (промокод/подписка тоже).
- **Чек 54-ФЗ:** `vat_code: 1` (самозанятый, без НДС), `payment_subject: service`, в `createPayment`.
- **Контент урока:** TipTap → `getHTML()` → `sanitize-html` (server, при сохранении) → `lessons.content` (TEXT). На рендере доверяем сохранённому (всё пишется только через санитизирующий Server Action).
- **Картинки уроков:** Supabase Storage, публичный бакет `lesson-content`, путь `{userId}/{ts}-{rand}.ext`. Создаётся лениво в upload-роуте.
- **Сертификат:** jsPDF + PT Sans сабсет (Latin+Cyrillic+₽) в `src/lib/pdf/fonts/pt-sans.ts` (base64), иначе кириллица = пустые квадраты.
- **Применённые миграции (через Management API):** `notifications`, `yookassa_payments` (таблица `webhook_events` + колонки к `payments` + функция `decrement_promocode`), `lesson_content` (колонка `lessons.content`). Файлы — в `supabase/migrations/`.
- **Server Actions vs модули:** функции, которые НЕ должны быть публичными RPC (напр. `fulfillYookassaPayment`), лежат в `server-only` модулях (`src/server/payments/`), а не в `'use server'` файлах.
- **Гейтинг прод-операций:** деплой/правки прод-БД/прод-env требуют явного «деплой»/согласия пользователя (классификатор безопасности). Применение миграций и правки `.env.local` на сервере — только с явного подтверждения.

---

## 8. Карта ключевых файлов

```
src/lib/kinescope/        video-ref.ts (парсер), upload.ts (загрузка)
src/components/artum/      KinescopePlayer, LessonPlayer, KinescopeUploadButton,
                           LessonContentEditor (TipTap), CourseForm, SortableLessonList
src/lib/yookassa/          client.ts (createPayment/getPayment/refund), verify.ts, types.ts
src/server/payments/       fulfillment.ts (выдача доступа, server-only)
src/server/actions/        commerce.ts (checkout), account.ts (152-ФЗ),
                           auth.ts (регистрация+согласие), admin/{courses,users,payments}.ts
src/app/api/               webhooks/yookassa/[secret], admin/videos, admin/lesson-images
src/app/(app)/learn/...    LessonPageClient.tsx (плеер + контент)
src/app/(admin)/admin/     courses, users, payments, promocodes
src/lib/pdf/               certificate.ts + fonts/pt-sans.ts
supabase/migrations/       SQL-миграции (append-only)
```
