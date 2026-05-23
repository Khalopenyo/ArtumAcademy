# Requirements: VideoEdit Academy (M1 — MVP)

**Defined:** 2026-05-24
**Milestone:** M1 (v1.0-mvp, 4–6 недель соло)
**Core Value:** Купивший пользователь должен иметь возможность смотреть оплаченный курс без перебоев и без возможности скачать видео.

> Объём M1 разбит на 6 категорий и ~70 проверяемых требований. Все основаны на `.planning/PROJECT.md` (Active section) и подтверждены `.planning/research/SUMMARY.md`. Каждое требование атомарно, user-centric и проверяемо. Phase-маппинг во второй части — заполняется роадмаппером.

---

## v1 Requirements (M1 — обязательные к запуску)

### Foundations & Compliance Setup (FOUND)

> P0: настройка, без которой нельзя надёжно делать дальнейшие фазы.

- [ ] **FOUND-01**: Supabase проект развёрнут в регионе ближайшем к РФ (Frankfurt `eu-central-1`), Pro tier с включённым PITR
- [ ] **FOUND-02**: Все секреты валидируются через Zod-парсер `src/env.ts` при старте приложения (`SUPABASE_SERVICE_ROLE_KEY`, `YOOKASSA_*`, `KINESCOPE_*`, `SMTP_*`, `SENTRY_DSN`, etc.); приложение падает на старте при невалидных env
- [ ] **FOUND-03**: `src/lib/supabase/admin.ts` начинается с `import 'server-only'`; service_role клиент создаётся только здесь; запрещён через ESLint-правило импорт этого файла в client-компонентах
- [ ] **FOUND-04**: Структурированный JSON-логгер на pino (`src/lib/logger.ts`); все Server Actions и Route Handlers логируют start/end/error через него
- [ ] **FOUND-05**: Таблица `audit_log(id, user_id, action, entity, entity_id, payload, ip, ua, created_at)` и helper `auditLog()` для записи событий (payment, access grant, account delete)
- [ ] **FOUND-06**: Self-hosted error monitoring (GlitchTip/Bugsink) развёрнут; `@sentry/nextjs` ^8 подключён с DSN, тестовый Sentry-event виден в дашборде
- [ ] **FOUND-07**: Деплой на Vercel с регионом `fra1` (зафиксировано в `vercel.json`); preview-деплои настроены на PR
- [ ] **FOUND-08**: Custom domain (`*.your-domain.ru`) подключён к Vercel; DNS записи на SMTP-провайдера (SPF, DKIM, DMARC `p=quarantine adkim=s aspf=s`) пропагированы и валидируются `mxtoolbox`/`mail-tester`
- [ ] **FOUND-09**: 152-ФЗ архитектурное решение задокументировано в `docs/compliance/152fz-architecture.md` (dual-write `profiles_pii` на RU-Postgres vs миграция на Yandex Cloud vs documented risk acceptance) с подписью юриста
- [ ] **FOUND-10**: RLS test harness (`tests/integration/rls/`) умеет логиниться от двух разных пользователей и проверять что cross-user select/update запрещены; шаблон теста зафиксирован

### Legal & Marketing (LEGAL + LAND)

- [ ] **LEGAL-01**: Страница `/privacy` (Политика обработки персональных данных) с версией политики, перечнем обрабатываемых данных, целей, сроков хранения, и реквизитами оператора (ИП ФИО, ИНН, ОГРНИП, контакты)
- [ ] **LEGAL-02**: Страница `/oferta` (Публичная оферта) с реквизитами ИП, описанием услуги, ценой, условиями возврата, юрисдикцией; согласована юристом
- [ ] **LEGAL-03**: HTTPS-only (HSTS-заголовок), security-заголовки (`X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy`) в `next.config.js`
- [ ] **LEGAL-04**: CSP-заголовок (Content-Security-Policy) с `frame-src 'self' https://kinescope.io https://*.kinescope.io` и без `'unsafe-inline'` для scripts; включается в production (P5)
- [ ] **LAND-01**: Главная страница лендинга `/` — hero с УТП, описание программы курса, отзывы (если есть) или маркеры доверия, ценовой блок, FAQ, футер с Telegram + email контактами
- [ ] **LAND-02**: Страница курса `/courses/[slug]` (превью): обложка, длительность, цена, программа модулей (без доступа к урокам), CTA «Купить» (для неавторизованных — ведёт на `/register?next=/courses/[slug]`)
- [ ] **LAND-03**: Адаптивная вёрстка (mobile-first, >= 320px): лендинг и страница курса проходят Lighthouse mobile-perf >= 80
- [ ] **LAND-04**: SEO baseline: уникальные `<title>` и meta-description на лендинге и странице курса; `robots.txt`; `sitemap.xml`; OpenGraph-картинка
- [ ] **LAND-05**: Footer с обязательными ссылками: `/privacy`, `/oferta`, контакты (email + Telegram), copyright оператора

### Authentication & Consent (AUTH)

- [ ] **AUTH-01**: Пользователь создаёт аккаунт по email + паролю на `/register`; пароль валидируется (мин. 8 символов, хотя бы одна цифра)
- [ ] **AUTH-02**: При регистрации обязательны два чекбокса: «Согласен с обработкой персональных данных» (со ссылкой на `/privacy`) и «Принимаю условия публичной оферты» (со ссылкой на `/oferta`); без них submit-кнопка disabled
- [ ] **AUTH-03**: Согласие фиксируется в таблице `user_consents(user_id, purpose, policy_version, ip, user_agent, accepted_at)` — раздельные записи для privacy и oferta; помогает доказать согласие RKN
- [ ] **AUTH-04**: Пользователь подтверждает email по ссылке из welcome-письма (без подтверждения доступ к покупке заблокирован); кнопка «отправить заново»
- [ ] **AUTH-05**: Пользователь логинится по email + паролю на `/login`; сессия сохраняется между перезагрузками вкладки и закрытием браузера (Supabase Auth cookie через `@supabase/ssr`)
- [ ] **AUTH-06**: Пользователь восстанавливает пароль по email-ссылке (`/forgot-password` → email → `/reset-password?token=…`); ссылка одноразовая и истекает через 1 час
- [ ] **AUTH-07**: Пользователь логаутится с любой страницы; сессия инвалидируется на сервере (cookies очищаются)
- [ ] **AUTH-08**: Middleware `src/middleware.ts` обновляет auth-cookie на каждом запросе; `(app)` layout редиректит неавторизованных на `/login?next=<path>`
- [ ] **AUTH-09**: Yandex SmartCaptcha (или аналог, доступный в РФ) на формах `/register` и `/forgot-password` для защиты от ботов
- [ ] **AUTH-10**: Rate limiting на auth-endpoints (`/login`, `/register`, `/forgot-password`): max 5 попыток / 15 минут / IP+email; реализация через `src/lib/rate-limit/index.ts` с Postgres-fallback если Upstash недоступен из РФ

### Catalog & Course Schema (CRSE)

- [ ] **CRSE-01**: Миграция расширяет существующие таблицы `courses`/`modules`/`lessons` под коммерцию: `courses.price_minor INT NOT NULL` (цена в копейках), `courses.currency TEXT DEFAULT 'RUB'`, `courses.is_published BOOLEAN DEFAULT false`, `courses.slug TEXT UNIQUE`, `lessons.kinescope_video_id TEXT`, `lessons.position INT NOT NULL`
- [ ] **CRSE-02**: RLS-политики: `courses` — `SELECT` доступен анонимам только если `is_published = true`; `modules` и `lessons` — `SELECT` только для пользователей с подтверждённой покупкой родительского курса (см. ACCESS-RLS)
- [ ] **CRSE-03**: Seed-скрипт создаёт один опубликованный курс с 2 модулями и ~6 уроками для разработки и demo; в проде создаётся вручную через миграцию (админка — M2)
- [ ] **CRSE-04**: Server query `getCourseBySlug(slug)` возвращает курс + модули + уроки (с пометкой `isAccessible` на каждом уроке) для авторизованного пользователя; для анонима возвращает только preview-поля
- [ ] **CRSE-05**: Индексы: `lessons(module_id, position)`, `modules(course_id, position)`, `courses(slug)`, `courses(is_published)`

### Payments (PAY) — ЮKassa

> Самая чувствительная зона; все требования non-negotiable.

- [ ] **PAY-01**: Зарегистрирован магазин в ЮKassa (ИП + offerta URL); получены `shopId` и `secretKey`; webhook URL зарегистрирован
- [ ] **PAY-02**: SDK-обёртка `src/lib/yookassa/client.ts` поверх `@a2seven/yoo-checkout` (или прямой REST-вызов); все вызовы инициализируются единым клиентом с timeout 10s + retry-on-network-error
- [ ] **PAY-03**: Server Action `createCoursePayment(courseId)` — принимает ТОЛЬКО `courseId` (не цену); подгружает `price_minor` из БД; формирует Idempotence-Key (UUIDv4) и сохраняет его до вызова API; вызывает ЮKassa `createPayment` с `amount`, `confirmation.return_url`, `metadata.{user_id,course_id}`, `receipt.{customer.email,items[{description,quantity,amount,vat_code:2}]}` (54-ФЗ)
- [ ] **PAY-04**: После создания платежа: запись в `purchases(id, user_id, course_id, amount_minor, currency, status='pending', external_payment_id, idempotence_key, created_at)`; пользователь редиректится на `confirmation.confirmation_url` ЮKassa
- [ ] **PAY-05**: Страница `/payment/success?orderId=…` показывает статус-poller (раз в 2 сек первые 30 сек) и сообщает результат; если webhook ещё не пришёл — показывает «Платёж обрабатывается»
- [ ] **PAY-06**: Страница `/payment/failure?orderId=…&reason=…` показывает причину отказа и кнопки «Попробовать снова» / «Связаться с поддержкой»
- [ ] **PAY-07**: Все вызовы к ЮKassa API логируются (without secrets) в `audit_log`: `yookassa.create_payment.request`, `yookassa.create_payment.response`

### Webhook & Access Grant (HOOK)

- [ ] **HOOK-01**: Route Handler `app/api/webhooks/yookassa/route.ts` принимает POST; URL содержит секретный path-segment (`/api/webhooks/yookassa/<random-32-char>`), проверяемый против env
- [ ] **HOOK-02**: До парсинга тела вебхук проверяет: (1) source IP из allowlist ЮKassa (актуальный список из их docs), (2) корректность path-secret; на любую ошибку — 403 + лог в `audit_log`
- [ ] **HOOK-03**: Таблица `webhook_events(provider TEXT, external_id TEXT, payload JSONB, received_at TIMESTAMPTZ, processed_at TIMESTAMPTZ, UNIQUE(provider, external_id))`; вставка через `INSERT … ON CONFLICT DO NOTHING` гарантирует идемпотентность; ровно одна обработка вне зависимости от количества доставок
- [ ] **HOOK-04**: Обработчик события `payment.succeeded`: проверяет что `purchases.amount_minor == event.object.amount.value * 100` (защита от подмены), обновляет `purchases.status='succeeded'`, `purchases.paid_at`, пишет `audit_log('payment.succeeded')`
- [ ] **HOOK-05**: Обработчик события `payment.canceled`: обновляет `purchases.status='canceled'`, `purchases.canceled_reason`, пишет audit
- [ ] **HOOK-06**: Обработчик события `refund.succeeded`: создаёт запись в `refunds(purchase_id, amount_minor, reason, created_at)`; если полный refund — обновляет `purchases.status='refunded'`; partial refund не отзывает доступ (политика); audit-log
- [ ] **HOOK-07**: Все side-effects (purchase update + audit + access grant) обёрнуты в одну Postgres-транзакцию через service_role клиент; ошибка любого шага откатывает всё
- [ ] **HOOK-08**: E2E-тест против ЮKassa sandbox: создаётся test-платёж → симулируется webhook (через ЮKassa test-инструмент или ручной POST) → проверяется что `purchases.status='succeeded'` и пользователь видит курс в `/dashboard`

### Video Player & Lesson Access Control (PLAY)

- [ ] **PLAY-01**: Зарегистрирован Kinescope аккаунт; получены `KINESCOPE_PROJECT_ID` и `KINESCOPE_PRIVATE_API_TOKEN`; в Kinescope включена опция «private video» для всех видео курса; домен-whitelist настроен на production-домен (alpha-домен может быть `*.vercel.app`)
- [ ] **PLAY-02**: Server query `assertCourseAccess(userId, courseId)` — проверяет существование `purchases(user_id, course_id, status='succeeded')`; кидает исключение если доступа нет; используется на ВСЕХ серверных endpoints, отдающих контент урока
- [ ] **PLAY-03**: RLS на `lessons`: `SELECT` разрешён только если `EXISTS (SELECT 1 FROM modules JOIN courses ON modules.course_id = courses.id JOIN purchases ON purchases.course_id = courses.id WHERE modules.id = lessons.module_id AND purchases.user_id = auth.uid() AND purchases.status = 'succeeded')`; политика покрыта integration-тестом из FOUND-10
- [ ] **PLAY-04**: Server query `getLessonSignedUrl(lessonId)` — после `assertCourseAccess`, генерирует Kinescope JWT signed URL с TTL = 4 часа и watermark = `<user.email>`; URL генерируется заново на каждый рендер страницы урока, не кэшируется
- [ ] **PLAY-05**: Страница `/learn/[courseSlug]/[lessonId]` — рендерится только при наличии доступа; передаёт signed URL в `<LessonPlayer>` как render-prop; signed URL НЕ попадает в localStorage, sessionStorage, React Query cache, Sentry breadcrumbs
- [ ] **PLAY-06**: Компонент `<LessonPlayer>` — iframe Kinescope с атрибутами `sandbox="allow-scripts allow-same-origin"` и `referrerpolicy="strict-origin"`; нет нативной download-кнопки; нет нативного контекстного меню над плеером (через CSS pointer-events); watermark с email видим на видео
- [ ] **PLAY-07**: На странице урока — навигация (предыдущий/следующий урок), название курса/модуля; кнопка «Завершить урок» (опц.) — пишет `lesson_progress.completed_at`
- [ ] **PLAY-08**: Threat-model документ `docs/security/video-protection.md` явно перечисляет что защищается (download через DevTools, прямой URL-доступ, account sharing) и что НЕ защищается (запись экрана) — для управления ожиданиями автора курса

### Dashboard & My Courses (DASH)

- [ ] **DASH-01**: Страница `/dashboard` для авторизованных — список купленных курсов с обложкой, названием, прогрессом (%-завершённых уроков), кнопкой «Продолжить» (ведёт на последний открытый или первый урок)
- [ ] **DASH-02**: Если у пользователя нет купленных курсов — `/dashboard` показывает пустое состояние с CTA «Каталог курсов» (на `/`)
- [ ] **DASH-03**: Страница `/dashboard/orders` — список покупок с датой, суммой, статусом, ссылкой на чек (от ЮKassa, ссылка в `purchases.receipt_url`)
- [ ] **DASH-04**: Страница `/dashboard/orders/[purchaseId]` — детали покупки (для статуса processing — статус-поллер)

### Profile & Account Deletion (PROF)

- [ ] **PROF-01**: Страница `/profile` для авторизованных — отображает email (readonly) и имя (editable inline через Server Action); базовые валидации Zod
- [ ] **PROF-02**: Кнопка «Удалить аккаунт» на `/profile` — модалка-подтверждение с инпутом «введите email для подтверждения»; soft-delete: `profiles.deleted_at = now()`, email замаскирован (`deleted-<uuid>@deleted.local`), пользователь логаутится
- [ ] **PROF-03**: pg_cron job (запускается раз в день) находит `profiles` с `deleted_at < now() - interval '30 days'` и делает hard-delete: удаляются все PII-поля из `profiles`, `user_consents`; запись в `purchases` сохраняется с `user_id = NULL` (для 402-ФЗ 5-year retention) + audit-log
- [ ] **PROF-04**: На любом запросе `(app)` layout проверяет `profiles.deleted_at IS NULL`; soft-deleted пользователь сразу логаутится при попытке вернуться

### Progress Tracking (PROG)

- [ ] **PROG-01**: Таблица `lesson_progress(user_id, lesson_id, seconds_watched INT, completed_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, PRIMARY KEY(user_id, lesson_id))`; RLS: каждый видит и пишет только свои записи
- [ ] **PROG-02**: На странице урока — клиентский хук `useLessonProgress(lessonId)`, который раз в 5 секунд (debounced) отправляет Server Action `upsertLessonProgress(lessonId, seconds)`
- [ ] **PROG-03**: Когда плеер сообщает событие «ended» (через Kinescope JS-API) — `upsertLessonProgress` ставит `completed_at = now()`
- [ ] **PROG-04**: `/dashboard` агрегирует прогресс: для каждого купленного курса считает `count(completed lessons) / count(total lessons)`; запрос < 50ms на тестовых данных (1000 пользователей × 50 уроков)

### Transactional Email (EMAIL)

- [ ] **EMAIL-01**: Подключён custom SMTP-провайдер (Unisender RU или Selectel Mail) к Supabase Auth → Project Settings → SMTP; DNS-записи SPF/DKIM/DMARC прошли проверку mail-tester (score >= 9/10)
- [ ] **EMAIL-02**: Шаблоны Supabase Auth кастомизированы на русский (welcome-confirm, magic-link, recovery, email-change) с реквизитами оператора и ссылками на `/privacy`+`/oferta`
- [ ] **EMAIL-03**: Реальная проверка доставки: тестовые письма приходят в inbox (НЕ spam) на Mail.ru, Yandex, Rambler, Gmail; зафиксированы скриншоты как evidence

### Operations & Observability (OPS)

- [ ] **OPS-01**: Sentry self-hosted получает events от prod-деплоя (тестовый ошибочный коммит проверен)
- [ ] **OPS-02**: Playwright E2E smoke-тест критического пути в `tests/e2e/critical-path.spec.ts`: регистрация → email confirm (через стаб) → покупка через ЮKassa test-режим → webhook симуляция → просмотр первого урока; запускается на каждом PR в CI
- [ ] **OPS-03**: CI на GitHub Actions: на каждый push в feature-ветку — `npm run lint && npm run typecheck && npm run test:ci && npm run build`; на каждый PR — дополнительно `npm run test:e2e` против превью-деплоя
- [ ] **OPS-04**: Production deploy: ветка `main` → автодеплой на Vercel prod (после merge PR); preview deploys на каждый PR
- [ ] **OPS-05**: Runbook `docs/runbooks/rollback.md` — как сделать `vercel rollback` за < 5 минут + как откатить миграцию (через downgrade-script)
- [ ] **OPS-06**: Database backup strategy задокументирован: Supabase Pro daily backup + PITR 7 дней; тестовое восстановление выполнено и зафиксировано

### Final Compliance Gates (COMP)

> Эти требования — release gate. Без них публичный запуск нельзя.

- [ ] **COMP-01**: Уведомление в Роскомнадзор подано (форма «Уведомление об обработке персональных данных» — бесплатно); подтверждение получено и сохранено
- [ ] **COMP-02**: Юрист подписал акт ревью `/privacy`, `/oferta`, флоу удаления аккаунта; копия акта в `docs/compliance/`
- [ ] **COMP-03**: ЮKassa shop переведён из test-режима в production; сделана одна реальная покупка на 1₽ с собственного аккаунта; чек 54-ФЗ виден в ЛК ЮKassa «Чеки»
- [ ] **COMP-04**: Production deploy проходит `grep -ri "service_role" .next/static/` без матчей (защита от утечки секретов в client bundle)
- [ ] **COMP-05**: CSP enforced (не report-only) на production; не блокирует Kinescope, не блокирует Yandex SmartCaptcha
- [ ] **COMP-06**: Manual security checklist пройден: попытка купить чужой курс через прямой URL → 403; попытка скачать урок через DevTools Network → no direct file URL; попытка SQL inject через формы → отвергнуто; account sharing → лесон-watermark показывает email шерящего

---

## v2 Requirements (Milestone 2, отложено)

Перенесено из M1 после решения «разбить на 2 milestones».

### Admin Panel (ADMIN)

- **ADMIN-01**: Защищённая зона `/admin/*` доступна только пользователям с ролью `admin` в `user_roles`
- **ADMIN-02**: CRUD курсов (создание, редактирование, публикация/снятие, удаление с soft-delete)
- **ADMIN-03**: CRUD модулей и уроков (включая загрузку видео в Kinescope из админки)
- **ADMIN-04**: Просмотр списка пользователей, их покупок, прогресса; экспорт в CSV
- **ADMIN-05**: Управление refund'ами (инициирование refund через ЮKassa API из админки)
- **ADMIN-06**: Просмотр audit_log с фильтрами

### Marketing Email (MARKETING)

- **MARKETING-01**: Unisender API-интеграция для рассылок (отдельный отправитель `news@news.<domain>` с собственным DKIM)
- **MARKETING-02**: Триггерные письма: «купите курс» (через 24ч после регистрации без покупки), «вы не открывали урок Х дней», «новый курс»
- **MARKETING-03**: Отписка от рассылок (152-ФЗ требование) — one-click из любого письма
- **MARKETING-04**: Согласие на маркетинг — отдельный чекбокс в `/profile` (не обязательный при регистрации)

### Multi-Course & Pricing (CATALOG-V2)

- **CATALOG-V2-01**: Каталог нескольких курсов с фильтрами и поиском
- **CATALOG-V2-02**: Бандлы курсов (несколько за единую цену)
- **CATALOG-V2-03**: Промокоды (фиксированная или %-я скидка)
- **CATALOG-V2-04**: Подписка (доступ ко всем курсам за месячный/годовой платёж — рекуррентные платежи в ЮKassa)

### Certificates & Gamification (CERT)

- **CERT-01**: Генерация PDF-сертификата по завершении курса (>= 90% уроков completed)
- **CERT-02**: Публичная страница верификации сертификата по уникальному ID

### Advanced Dashboard (DASH-V2)

- **DASH-V2-01**: Дашборд с подробной статистикой просмотров (день/неделя/месяц), pause-points в видео
- **DASH-V2-02**: Wishlist курсов / избранное

---

## Out of Scope (никогда или далеко за горизонтом v2)

| Feature | Reason |
|---------|--------|
| OAuth-логины (Google, Apple, VK, Яндекс) | Не критично для РФ-аудитории; email/password покрывает 99%. Google/Apple — sanctions risk. |
| Magic link login | Email-deliverability в РФ сложная; пароли надёжнее. |
| Native mobile app | Web-first, mobile через адаптивную вёрстку. App Store / Play Store dev-аккаунты блокируются для РФ-разработчиков. |
| Offline-просмотр / скачивание уроков | Противоречит Core Value (защита контента). |
| Custom HLS player | Kinescope покрывает все потребности; своё видео-хостинг = дорого + рискованно. |
| Realtime chat | Дорого по разработке и по серверным ресурсам; асинхронные комментарии под уроком (M2+). |
| Stripe / Paddle / PayPal | Не работают с РФ ИП с 2022 года. |
| Lemon Squeezy / Gumroad | Sanctions risk; не выдают чеки 54-ФЗ. |
| Sentry SaaS | Заблокирован для РФ-пользователей с 2024-09-10; используем self-hosted. |
| Mailgun / Postmark / Sendgrid / Resend / AWS SES | US-IP реджектится Mail.ru/Yandex; sanctions risk. |
| Cloudflare Images / R2 | Cloudflare частично работает в РФ; используем Supabase Storage. |
| Real-time комментарии на уроках | Дорого; асинхронные комментарии — рассмотрим в M2 при доказательстве спроса. |
| Налоговый вычет 13% (упоминание в маркетинге) | Требует лицензии Рособрнадзора. Без лицензии — нарушение закона о защите потребителей. |
| Autoplay следующего урока | Рассеивает фокус; UX-исследование рекомендует против. |
| Гейтинг урока «нельзя смотреть пока не закрыл предыдущий» | Раздражает мотивированных учеников; повышает churn. |
| Right-click disable, печать-disable | Theatre security; реальной защиты не даёт. |
| AI-чатбот / GPT-функции | Не core value MVP; добавление LLM-стека = дополнительная сложность. |
| Multi-currency (USD/EUR) | Целевой рынок — РФ/СНГ; ₽ достаточно. |
| Public reviews на платформе | Модерация — отдельный продукт; внешние review-platforms (Otzovik, IRecommend) органичнее. |
| Gamification (баллы, бейджи, лидерборды) | Не на критическом пути обучения монтажу. |

---

## Traceability

> Заполняется `gsd-roadmapper`. Каждое v1 требование должно быть замаппено ровно на одну фазу.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01..10 | — | Pending |
| LEGAL-01..04 | — | Pending |
| LAND-01..05 | — | Pending |
| AUTH-01..10 | — | Pending |
| CRSE-01..05 | — | Pending |
| PAY-01..07 | — | Pending |
| HOOK-01..08 | — | Pending |
| PLAY-01..08 | — | Pending |
| DASH-01..04 | — | Pending |
| PROF-01..04 | — | Pending |
| PROG-01..04 | — | Pending |
| EMAIL-01..03 | — | Pending |
| OPS-01..06 | — | Pending |
| COMP-01..06 | — | Pending |

**Coverage (M1 v1):**
- v1 requirements: ~74 total
- Mapped to phases: 0 (pending roadmapper)
- Unmapped: 74 ⚠️ (roadmapper to resolve)

---

## Definition of Done (per requirement)

Требование считается **Complete**, когда:
- Реализация существует в коде и соответствует описанию (атомарность + user-centric)
- Покрыто тестом нужного уровня (unit / integration / E2E — определяется в PLAN.md фазы)
- Manually checked (если есть UI-составляющая)
- Закоммичено в `main` через PR с прошедшим CI
- Если требование security/compliance — есть соответствующая запись в `audit_log` или документ в `docs/compliance/`

---
*Requirements defined: 2026-05-24*
*Last updated: 2026-05-24 after initial definition*
