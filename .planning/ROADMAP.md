# Roadmap: VideoEdit Academy (M1 — v1.0-mvp)

**Created:** 2026-05-24
**Last revised:** 2026-05-24 (6 → 7 phases, dev-first / prod-last restructure)
**Milestone:** M1 (v1.0-mvp) — first shippable MVP, ~4–6 недель соло разработки + ~1–1.5 недели production prep (внешние lead-times)
**Granularity:** standard
**Project mode:** mvp (every phase is a vertical slice through DB → server → client → test)
**Core Value:** Купивший пользователь должен иметь возможность смотреть оплаченный курс без перебоев и без возможности скачать видео.

> **Restructure rationale (2026-05-24):** Original 6-phase roadmap blocked dev work on внешние lead-time'ы (юрист 1-2 недели, ЮKassa регистрация 1-3 дня, DNS-пропагация 24-48ч, RKN-форма, Mail.ru deliverability evidence). Restructured into **7 phases: P1–P6 = feature-complete продукт на dev-стенде** (Supabase free, ЮKassa sandbox, Supabase default SMTP, vercel.app preview URLs); **P7 = Production Launch Prep** (Pro tier, custom domain + DNS, ЮKassa prod, custom SMTP, RKN, юрист sign-off, financial smoke test). Это снимает блокировку и позволяет демонстрировать рабочий продукт (друзьям, бета-тестерам, инвестору) уже после P6, пока внешние треки идут параллельно.

> Phase structure derived from `.planning/research/SUMMARY.md §3 Build Order` and validated against `.planning/research/ARCHITECTURE.md §12` + `.planning/research/PITFALLS.md` HIGH-severity phase mapping. Seven phases cover the critical revenue path; every v1 requirement maps to exactly one phase.

---

## Phases

- [ ] **Phase 1: Dev Foundations** — Минимально-достаточная локальная инфраструктура (env Zod-парсер, server-only boundary, pino, audit_log, Sentry SDK с dev-DSN, RLS test harness) на Supabase free — без production-grade gates
- [ ] **Phase 2: Auth + Marketing Shell + 152-ФЗ Consent (dev SMTP)** — Лендинг, юридические страницы (драфт), регистрация/логин/сброс + капча + rate limit + согласие на ПДн с evidence-полями; email через Supabase default SMTP на тестовые ящики
- [ ] **Phase 3: Catalog + Payment Redirect (ЮKassa sandbox)** — Страница курса, commerce-миграция (purchases / webhook_events / audit_log / price_minor), Server Action `createCoursePayment` с server-side price, редирект на ЮKassa sandbox, success/failure страницы
- [ ] **Phase 4: Webhook + Access Grant + Refund (sandbox)** — Идемпотентный обработчик `payment.succeeded` / `canceled` / `refund.succeeded` против ЮKassa sandbox, IP-allowlist + path-secret, amount-verify, выдача доступа, owned-courses dashboard *(pre-phase research spike: ЮKassa webhook auth model)*
- [ ] **Phase 5: Video Player + Lesson Access Control (Kinescope test)** — Kinescope private signed URL (JWT, TTL 4h, watermark по email), `assertCourseAccess` на каждом серверном endpoint, sandboxed iframe без download, threat-model doc *(pre-phase research spike: Kinescope JWT claim shape)*
- [ ] **Phase 6: Progress + Profile + E2E + Feature Complete (dev)** — `lesson_progress` пишется и агрегируется, профиль с soft-delete + pg_cron hard-delete, CSP enforce, Playwright E2E против превью-деплоя, CI green, rollback runbook draft. **На выходе: feature-complete продукт на dev-стенде, демонстрируемый через preview-URL**
- [ ] **Phase 7: Production Launch Prep** — Финальная фаза (в основном чек-лист, не код): Supabase Pro+PITR, Vercel fra1, custom domain + DNS (SPF/DKIM/DMARC), custom SMTP wiring + deliverability evidence, ЮKassa prod switch, 152-ФЗ юрист sign-off, RKN notification, prod deploy, secret-leak grep, manual security checklist, financial smoke test (реальная покупка на 1₽)

**Estimated total effort:**
- **Разработка (P1–P6):** ~4–6 недель соло
  - P1: ~2 дня, P2: ~неделя, P3: ~неделя, P4: ~неделя + spike, P5: 1–1.5 недели + spike, P6: ~неделя
- **Production prep (P7):** ~1–1.5 недели календарно (включая внешние lead-time'ы; собственного времени соло-разработчика ~3–4 дня)

---

## Pre-Phase Research Spikes

Two integration surfaces have documentation conflicts that require a 0.5–1 day spike **before** the phase starts. These are non-negotiable — without them the phase will block on undocumented behaviour.

| Before Phase | Spike | Why | Default if undecided |
|---|---|---|---|
| **Phase 4** | **ЮKassa webhook auth model** (HMAC vs IP-allowlist vs path-secret) — three docs disagree (SUMMARY.md Open Q #1, PITFALL #2). Read current `yookassa.ru/developers/using-api/webhooks` + ЛК ЮKassa → "Уведомления" tab. Document decision in `docs/research/yookassa-webhook-auth.md`. | Wrong auth = fake `payment.succeeded` from `curl` grants free access (PITFALL #2, HIGH). | Ship all three layers (IP-allowlist + path-secret + HMAC if present). |
| **Phase 5** | **Kinescope private signed-URL JWT claim shape** — exact claim names (`sub`, `video_id`, `watermark.text`, `exp`) need verification against current Kinescope private API docs (SUMMARY.md Open Q #15, ARCHITECTURE.md §4.2). Document in `docs/research/kinescope-jwt-claims.md`. | Wrong claim shape = 403 from Kinescope → no playback → Core Value broken. | Use claim names from ARCHITECTURE.md §4.2 and test against sandbox video. |

---

## Phase Details

### Phase 1: Dev Foundations
**Goal:** Минимально-достаточная локальная инфраструктура: env-парсер падает на старте при невалидных секретах, service_role физически нельзя втянуть в client-bundle, есть структурный лог и audit-таблица, Sentry SDK работает против dev-DSN, RLS test harness готов. Это база, на которой можно безопасно строить P2–P6 без production-grade gates (Supabase Pro / custom domain / 152-ФЗ юрист sign-off отложено в P7).
**Mode:** mvp
**Depends on:** Nothing (existing scaffold — `src/lib/supabase/*`, `src/lib/auth/require.ts`, base migration — treated as immutable foundation)
**Requirements:** FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-10 (6 requirements)
**Success Criteria** (what must be TRUE):
  1. Приложение падает на старте если хотя бы один обязательный секрет (ЮKassa sandbox, Kinescope test, Supabase service_role, Sentry dev DSN) отсутствует или невалиден по Zod
  2. `grep -ri "service_role" src/components/ src/app/(marketing) src/app/(app)` возвращает пусто, и попытка импорта `@/lib/supabase/admin` из client-компонента валит build/lint
  3. Тестовое исключение в Server Action видно в self-hosted Sentry/GlitchTip-дашборде (dev-инстанс) в течение 30 секунд
  4. RLS-test harness (`tests/integration/rls/`) умеет логиниться от двух пользователей и доказывает cross-user denial на shape-таблице
  5. Структурный pino-логгер пишет JSON-строки на старте/конце/ошибке каждого Server Action; audit_log таблица готова и `auditLog()` helper покрыт unit-тестом
**Pitfalls prevented:** #10 (RLS USING/WITH CHECK conventions), #12 (service_role leak — `import 'server-only'` baseline), #21 (server-only discipline), #22 (middleware budget)
**Plans:** TBD

### Phase 2: Auth + Marketing Shell + 152-ФЗ Consent (dev SMTP)
**Goal:** Незалогиненный пользователь может изучить курс на лендинге, прочесть юридические страницы (драфты), зарегистрироваться с явным согласием на ПДн, залогиниться и увидеть пустой `/dashboard`. К началу P3 есть аутентифицированный пользователь, который может что-то купить. Email доставляется через Supabase default SMTP на тестовые ящики (без deliverability-evidence на Mail.ru/Yandex — это отложено в P7).
**Mode:** mvp
**Depends on:** Phase 1 (нужны env-парсер, admin-client, audit_log, RLS-harness)
**Requirements:** LEGAL-01, LEGAL-02, LEGAL-03, LAND-01, LAND-02, LAND-03, LAND-04, LAND-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10 (18 requirements)
**Success Criteria** (what must be TRUE):
  1. Незалогиненный пользователь открывает `/` на мобиле, видит hero + ценовой блок + FAQ + футер с `/privacy` + `/oferta` (драфты, текст содержит TODO-маркеры для финального юриста-ревью в P7), и проходит Lighthouse mobile-perf ≥ 80
  2. Пользователь регистрируется на `/register`, получает welcome-confirm письмо через Supabase default SMTP на тестовый адрес (не проверяется доставка на Mail.ru/Yandex — это для P7), подтверждает email и автоматически попадает в `(app)/dashboard`
  3. Без обеих галочек («согласие ПДн» + «оферта») кнопка «Зарегистрироваться» disabled; после регистрации в `user_consents` появляются две раздельные записи с IP, UA, policy_version и timestamp
  4. Пользователь сбрасывает пароль через email-ссылку (одноразовую, истекающую через 1 час) и логинится новым паролем; сессия сохраняется после закрытия браузера
  5. 6-я и 11-я попытка логина за 15 минут с одного IP отвергается с 429; SmartCaptcha видна на `/register` и `/forgot-password`
**Pitfalls prevented:** #14 (consent capture with evidence), #18 (Auth defaults), #20 (Suspense around useSearchParams on `/login?next=…`)
**Notes:** Privacy и oferta-драфты пишутся в P2 чтобы 152-ФЗ consent text мог ссылаться на live policy URLs; финальное согласование с юристом и подписание акта — в P7 (COMP-02). До P7 текст содержит `[TODO: юрист-ревью]` маркеры в местах, требующих юридической экспертизы (реквизиты ИП, юрисдикция, retention периоды).
**Plans:** 10 plans
- [ ] 2-01-PLAN.md — shadcn + design system foundation (layouts, primitives, brand chrome)
- [ ] 2-02-PLAN.md — legal pages (drafts) + security headers (Permissions-Policy)
- [ ] 2-03-PLAN.md — landing page (Hero + Program + Pricing + FAQ + footer wired)
- [ ] 2-04-PLAN.md — course preview page `/courses/[slug]` + seed
- [ ] 2-05-PLAN.md — SEO baseline (sitemap + robots + metadata + OG) + Lighthouse audit
- [ ] 2-06-PLAN.md — rate-limit + captcha infrastructure (2 migrations + 2 helpers)
- [ ] 2-07-PLAN.md — register + consent + email confirm (biggest plan; AUTH-01/02/03/04/09)
- [ ] 2-08-PLAN.md — login + logout + (app) auth gate (AUTH-05/07/08/10 login bucket)
- [ ] 2-09-PLAN.md — forgot/reset password (AUTH-06 + AUTH-09 second site)
- [ ] 2-10-PLAN.md — empty dashboard + email-verification banner + AppHeader
**UI hint:** yes

### Phase 3: Catalog + Payment Redirect (ЮKassa sandbox)
**Goal:** Авторизованный пользователь видит публичную страницу курса, нажимает «Купить» и оказывается на странице ЮKassa **test-режима** с правильной суммой; в БД появляется `purchases.status='pending'`. Webhook ещё не подключён — но «outbound» половина платёжного surface полностью работает против sandbox и тестируется в изоляции. ЮKassa sandbox credentials бесплатны и не требуют ИП/оферты, поэтому регистрация production-shop отложена в P7.
**Mode:** mvp
**Depends on:** Phase 2 (нужен залогиненный пользователь с подтверждённым email)
**Requirements:** CRSE-01, CRSE-02, CRSE-03, CRSE-04, CRSE-05, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07 (11 requirements)
**Success Criteria** (what must be TRUE):
  1. На `/courses/[slug]` авторизованный пользователь видит превью, программу, цену в ₽ (форматированную `Intl.NumberFormat('ru-RU')`), и кнопку «Купить»; анонима кнопка ведёт на `/register?next=…`
  2. Server Action `createCoursePayment(courseId)` отвергает любой `amount` в теле запроса; цена берётся ТОЛЬКО из `courses.price_minor`; пользователь перенаправляется на `confirmation.confirmation_url` ЮKassa sandbox
  3. После клика «Купить» в `purchases` появляется ровно одна строка со `status='pending'`, `idempotence_key` (UUIDv4) и `external_payment_id` от ЮKassa sandbox; повторный клик с тем же `purchase.id` НЕ создаёт дубликата на стороне ЮKassa (Idempotence-Key соблюдён)
  4. В ЛК ЮKassa sandbox → «Платежи» появляется запись с email покупателя, суммой и `vat_code=2` (USN) в receipt-полях; финальная фискальная проверка через реальный чек — в P7 (COMP-03)
  5. На `/payment/success?orderId=…` пользователь видит индикатор «Платёж обрабатывается» с polling раз в 2 сек; на `/payment/failure?…` — понятную причину и кнопки «Попробовать снова» / «Связаться»
**Pitfalls prevented:** #3 (server-side price, never trust client), #4 (54-ФЗ receipt payload готов; production-валидация в P7), #5 (one-time, no `save_payment_method`), #20 (Suspense на `/payment/*` страницах с `?orderId=`), #25 (commerce миграция через файл, без DROP)
**Plans:** TBD
**UI hint:** yes

### Phase 4: Webhook + Access Grant + Refund (sandbox)
**Goal:** Test-платёж через ЮKassa sandbox проходит полный цикл `create → webhook → succeeded`; пользователь видит купленный курс в `/dashboard`. Idempotent для retry, защищён от подделки, поддерживает refund. Это первая фаза где «купивший» официально существует. Всё против sandbox webhook'ов; переключение на prod credentials — в P7.
**Mode:** mvp
**Depends on:** Phase 3 (нужны `purchases` rows со `status='pending'` для теста)
**Pre-phase spike:** ЮKassa webhook auth model — см. таблицу выше; ОБЯЗАТЕЛЬНО до начала кодинга
**Requirements:** HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, HOOK-06, HOOK-07, HOOK-08, DASH-01, DASH-02, DASH-03, DASH-04 (12 requirements)
**Success Criteria** (what must be TRUE):
  1. ЮKassa sandbox test-платёж проходит полный цикл `createPayment → webhook → status='succeeded'`; на `/dashboard` авторизованный покупатель видит купленный курс с обложкой, прогресс-плейсхолдером (0 %) и кнопкой «Продолжить»
  2. Повторная доставка того же `webhook_event.id` (симуляция через ручной POST) НЕ создаёт второй покупки — `webhook_events.UNIQUE(provider, external_id)` ловит дубль, обработчик возвращает 200, в `purchases` остаётся одна строка
  3. POST на webhook URL с правильным path-secret но неправильным source IP отвергается 403; POST с правильным IP но без path-secret — тоже 403; обе попытки попадают в `audit_log` с `action='webhook.auth_failed'`
  4. Webhook с подменённой суммой (`event.object.amount.value` ≠ `purchases.amount_minor`) отвергается 200+audit-mismatch+Sentry alert и НЕ выдаёт доступ; полный `refund.succeeded` отзывает доступ (следующая загрузка урока видит `status='refunded'` → 403), partial refund — НЕ отзывает
  5. У пользователя без покупки `/dashboard` показывает пустое состояние с CTA «Каталог курсов»; `/dashboard/orders` показывает историю с датой, суммой, статусом и ссылкой на чек ЮKassa (sandbox UI)
**Pitfalls prevented:** #1 (webhook double-delivery via `INSERT … ON CONFLICT DO NOTHING`), #2 (signature/IP/path-secret verify before parse), #6 (refund handler shipped in same phase as payment), #23 (E2E sandbox test in CI)
**Plans:** TBD
**UI hint:** yes

### Phase 5: Video Player + Lesson Access Control (Kinescope test)
**Goal:** Купивший пользователь нажимает «Смотреть» и видит урок в защищённом плеере с watermark на свой email; не-купивший получает 404. Это самая дорогая по Core Value фаза — здесь защищается контент. Kinescope аккаунт регистрируется на старте P5 (бесплатно, test-режим, без KYC); production domain whitelist настраивается в P7.
**Mode:** mvp
**Depends on:** Phase 4 (нужен `purchases.status='succeeded'` для теста access path; нужен Kinescope аккаунт + private video uploaded)
**Pre-phase spike:** Kinescope private JWT claim shape — см. таблицу выше; ОБЯЗАТЕЛЬНО до начала кодинга
**Requirements:** PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PLAY-06, PLAY-07, PLAY-08 (8 requirements)
**Success Criteria** (what must be TRUE):
  1. Купивший пользователь открывает `/learn/[courseSlug]/[lessonId]` и видит видео в Kinescope iframe с водяным знаком его email поверх; signed URL генерируется заново на каждый рендер страницы (TTL = 4 часа) и НЕ попадает в localStorage / sessionStorage / React Query cache / Sentry breadcrumbs
  2. Не-купивший пользователь, попробовавший прямой URL на чужой урок, получает 404 (RLS отсеивает строку до того, как сервер успевает её срендерить); integration-тест в `tests/integration/rls/lessons.test.ts` это подтверждает для двух пользователей
  3. В iframe Kinescope нет нативной кнопки download, контекстное меню поверх плеера отключено (CSS pointer-events на overlay-слое), `sandbox="allow-scripts allow-same-origin"`, `referrerpolicy="strict-origin"`; домен-whitelist в Kinescope ЛК содержит preview/production-домен (`*.vercel.app` для dev, реальный prod-домен добавляется в P7)
  4. На странице урока работает навигация (prev/next в модуле), кнопка «Завершить урок» (опц.) пишет `lesson_progress.completed_at`; название курса/модуля видно в хлебных крошках
  5. `docs/security/video-protection.md` явно перечисляет защищённые векторы (DevTools download, прямой URL, account sharing — последний раскрывается watermark) и нерезаемые (запись экрана) — для управления ожиданиями автора курса
**Pitfalls prevented:** #7 (signed URL persistence — server-built per render, no client storage), #8 (no right-click theatre — real protections enumerated), #9 (Kinescope domain whitelist + referrer-policy), #11 (`(select auth.uid())` in lessons RLS for scale), #32 (assertCourseAccess on every endpoint)
**Plans:** TBD
**UI hint:** yes

### Phase 6: Progress + Profile + E2E + Feature Complete (dev)
**Goal:** Дашборд показывает реальный % прохождения; пользователь может удалить аккаунт по 152-ФЗ (soft + pg_cron hard); CSP enforced; полный Playwright E2E зелёный на каждом PR; CI работает; rollback runbook задокументирован. **На выходе: feature-complete продукт на dev-стенде**, демонстрируемый через preview-URL и ЮKassa sandbox. Можно показывать друзьям, бета-тестерам, инвестору. **Production-prep (Supabase Pro, custom domain, custom SMTP, ЮKassa prod, RKN, юрист sign-off, prod deploy) — в P7.**
**Mode:** mvp
**Depends on:** Phase 5 (нужен рабочий плеер для прогресса)
**Requirements:** LEGAL-04, PROF-01, PROF-02, PROF-03, PROF-04, PROG-01, PROG-02, PROG-03, PROG-04, OPS-01, OPS-02, OPS-03, OPS-05 (13 requirements)
**Success Criteria** (what must be TRUE):
  1. Пользователь смотрит урок → debounced `upsertLessonProgress` пишет `seconds_watched` раз в 5 сек; событие «ended» проставляет `completed_at`; на `/dashboard` процент завершения курса (`completed / total`) обновляется на следующей загрузке (< 50 мс при 1000×50 уроков)
  2. Пользователь на `/profile` нажимает «Удалить аккаунт», подтверждает email, логаутится; через 30 дней pg_cron-джоб обнуляет PII в `profiles` и `user_consents`, сохраняя `purchases` с `user_id = NULL` (402-ФЗ retention); audit_log запись присутствует
  3. Полный Playwright smoke-тест (`tests/e2e/critical-path.spec.ts`: register → email confirm → ЮKassa sandbox purchase → webhook → watch first lesson → progress recorded) проходит на каждом PR в CI; CI запускает lint + typecheck + test + build на каждый push, E2E на каждый PR против preview-deploy
  4. CSP-заголовок enforced (не report-only) на preview-deploy и не ломает Kinescope iframe + Yandex SmartCaptcha; CSP-конфиг готов к переносу в prod без правок
  5. Rollback runbook (`docs/runbooks/rollback.md`) задокументирован: как сделать `vercel rollback` за < 5 минут + как откатить миграцию через downgrade-script; **на выходе фазы продукт можно показать через preview-URL: register → buy (sandbox) → watch → progress → delete account — все шаги работают end-to-end**
**Pitfalls prevented:** #11 (progress query performance index), #15 (hard-delete cron + retained anonymised purchases), #19 (no Realtime overspend — polling on visit only), #23 (E2E + rollback runbook), #24 (no over-build — admin/marketing/etc deferred to M2)
**Notes:** OPS-04 (production deploy на Vercel prod) и OPS-06 (PITR + restore test) **отложены в P7** — здесь только preview-deploys и dev-stenв. Sentry verify через dev-DSN.
**Plans:** TBD
**UI hint:** yes

### Phase 7: Production Launch Prep
**Goal:** Перевести feature-complete dev-продукт в production: Supabase Pro+PITR, Vercel fra1, custom domain + DNS records (SPF/DKIM/DMARC), custom SMTP с deliverability evidence на Mail.ru/Yandex/Rambler, ЮKassa shop в production с реальной 1₽-покупкой и 54-ФЗ чеком, 152-ФЗ юрист sign-off + RKN notification, prod deploy, secret-leak grep, manual security checklist. После прохождения всех гейтов — переключение env-переменных, DNS cutover, financial smoke test. **После P7 продукт публично запускается.**
**Mode:** mvp (success criteria — ops-чеклист, не пользовательские сценарии: «пройдена проверка X» вместо «пользователь видит Y»)
**Depends on:** Phase 6 (feature-complete продукт на dev-стенде)
**Requirements:** FOUND-01, FOUND-07, FOUND-08, FOUND-09, EMAIL-01, EMAIL-02, EMAIL-03, PAY-01, OPS-04, OPS-06, COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06 (16 requirements)
**Success Criteria** (what must be TRUE — ops-чеклист):
  1. **Инфраструктура переведена на production**: Supabase upgrade на Pro tier с включённым PITR (FOUND-01); тестовое восстановление БД из PITR snapshot выполнено и зафиксировано в `docs/runbooks/db-restore-test.md` (OPS-06); Vercel deploy указывает регион `fra1` через `vercel.json` (FOUND-07); custom domain подключён к Vercel и резолвится через HTTPS (FOUND-08); DNS records SPF + DKIM + DMARC `p=quarantine adkim=s aspf=s` пропагированы и валидированы `mxtoolbox` (FOUND-08)
  2. **Email доставляется в РФ inbox**: custom SMTP (Unisender RU или Selectel Mail) подключён к Supabase Auth → Project Settings → SMTP (EMAIL-01); шаблоны welcome-confirm / magic-link / recovery / email-change локализованы на русский с реквизитами оператора + ссылками на `/privacy`+`/oferta` (EMAIL-02); тестовые письма приходят в **inbox (не spam)** на Mail.ru, Yandex, Rambler, Gmail; mail-tester score ≥ 9/10; скриншоты сохранены как evidence в `docs/compliance/email-deliverability/` (EMAIL-03)
  3. **ЮKassa в production + 54-ФЗ чек**: магазин ЮKassa зарегистрирован в production с offerta URL, ИП реквизитами, получены prod `shopId` + `secretKey` (PAY-01); env-переменные переключены с sandbox на prod credentials; сделана реальная покупка на 1₽ с собственного аккаунта; фискальный чек 54-ФЗ виден в ЛК ЮKassa → «Чеки» с email покупателя и `vat_code=2` (COMP-03)
  4. **152-ФЗ + RKN compliance gates закрыты**: уведомление в РКН по форме «Уведомление об обработке ПДн» подано и подтверждение сохранено в `docs/compliance/rkn-notification.pdf` (COMP-01); юрист подписал акт ревью `/privacy`, `/oferta`, account-deletion flow — копия акта в `docs/compliance/legal-review-acceptance.pdf` (COMP-02); архитектурное решение по 152-ФЗ data localisation задокументировано в `docs/compliance/152fz-architecture.md` (dual-write / Yandex Cloud / accepted risk) с подписью юриста (FOUND-09)
  5. **Production deploy + security gates**: `main` → автодеплой на Vercel prod (OPS-04); `grep -ri "service_role" .next/static/` возвращает пусто на production build (COMP-04); CSP enforced на production без поломок Kinescope + SmartCaptcha (валидируется в Network panel + Lighthouse) (COMP-05); manual security checklist пройден (COMP-06): попытка купить чужой курс через прямой URL → 403, попытка скачать урок через DevTools Network → no direct file URL, попытка SQL inject через формы регистрации/профиля → отвергнуто, account-share через шеринг куки → лесон-watermark показывает email шерящего; **production cutover завершён**: DNS переключён на prod, env-переменные на prod credentials (ЮKassa, Sentry self-hosted prod DSN, SMTP)
**Pitfalls prevented:** #4 (54-ФЗ receipt — реальный чек проверен в ЛК), #12 (pre-launch service_role grep on `.next/static/`), #13 (152-ФЗ data localisation legal sign-off), #16+17 (RU email deliverability — DNS + custom SMTP + evidence на Mail.ru/Yandex), #23 (PITR backups + Sentry prod-DSN + rollback runbook validated)
**Notes:** P7 — в основном чек-лист (не код). Кодовых изменений минимум: переключение env-переменных, опциональные конфиг-правки (Vercel region, CSP report-only → enforced, Supabase SMTP URL). Большую часть времени занимают **внешние lead-time'ы**, идущие параллельно: РКН-форма (~1-3 дня обработки), юрист (~1-2 недели — драфты privacy/oferta из P2 идут на ревью в начале P6, чтобы к P7 уже был sign-off), ЮKassa production одобрение (~1-3 дня), DNS-пропагация (~24-48ч), Mail.ru deliverability-tuning. Рекомендуется параллельно запускать эти треки уже на старте P5 чтобы не блокировать ship.
**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Dev Foundations | 0/0 | Not started | — |
| 2. Auth + Marketing Shell + 152-ФЗ Consent (dev SMTP) | 0/10 | Planned (PLAN.md ready) | — |
| 3. Catalog + Payment Redirect (ЮKassa sandbox) | 0/0 | Not started | — |
| 4. Webhook + Access Grant + Refund (sandbox) | 0/0 | Not started | — |
| 5. Video Player + Lesson Access Control (Kinescope test) | 0/0 | Not started | — |
| 6. Progress + Profile + E2E + Feature Complete (dev) | 0/0 | Not started | — |
| 7. Production Launch Prep | 0/0 | Not started | — |

---

## Coverage

**Total v1 requirements:** 84
**Mapped:** 84/84 (100% ✓)
**Unmapped:** 0
**Duplicates:** 0

Breakdown by phase:

| Phase | Requirements count | Categories represented |
|-------|--------------------|-----------------------|
| 1 | 6 | FOUND (6 of 10 — dev-only) |
| 2 | 18 | LEGAL (×3 of 4), LAND, AUTH |
| 3 | 11 | CRSE, PAY (×6 of 7 — without PAY-01 prod registration) |
| 4 | 12 | HOOK, DASH |
| 5 | 8 | PLAY |
| 6 | 13 | LEGAL (×1 of 4 — CSP), PROF, PROG, OPS (×4 of 6 — dev-only) |
| 7 | 16 | FOUND (×4 of 10 — prod-only), EMAIL (full), PAY (×1 of 7 — prod registration), OPS (×2 of 6 — prod deploy + PITR test), COMP (full) |
| **Total** | **84** | All 14 categories covered |

### Per-category split FOUND → P1 / P7

FOUND splits into dev-stenв (P1) vs prod-prep (P7):

| FOUND req | Phase | Why this phase |
|---|---|---|
| FOUND-01 (Supabase Pro+PITR) | **P7** | Pro tier = $25/mo paid resource, нужен только для prod-launch; dev на Supabase free |
| FOUND-02 (env Zod parser) | P1 | Нужен с первой строки кода |
| FOUND-03 (server-only boundary) | P1 | Security baseline для всех фаз |
| FOUND-04 (pino logger) | P1 | Observability baseline |
| FOUND-05 (audit_log table) | P1 | Нужна с первой Server Action |
| FOUND-06 (Sentry SDK + dev DSN) | P1 | SDK с dev-DSN; **self-hosted prod instance** — env-переключение в P7 |
| FOUND-07 (Vercel fra1 region) | **P7** | Region setting — production deploy concern |
| FOUND-08 (custom domain + DNS) | **P7** | Custom domain нужен только для prod-launch; preview-deploys работают на `*.vercel.app` |
| FOUND-09 (152-ФЗ юрист sign-off) | **P7** | Юрист = внешний lead-time 1-2 недели; нужен только для prod-launch (RKN notification зависит) |
| FOUND-10 (RLS test harness) | P1 | Нужен для каждой миграции в P2+ |

### Per-category split PAY → P3 / P7

| PAY req | Phase | Why this phase |
|---|---|---|
| PAY-01 (ЮKassa prod shop registration) | **P7** | Production регистрация требует ИП-оферту, юрист sign-off, ~1-3 дня обработки |
| PAY-02..07 | P3 | Sandbox credentials бесплатны и достаточны для разработки + sandbox E2E |

### Per-category split OPS → P6 / P7

| OPS req | Phase | Why this phase |
|---|---|---|
| OPS-01 (Sentry verify) | P6 | Dev-DSN verify; prod-DSN switch — в P7 |
| OPS-02 (Playwright E2E) | P6 | Против preview-deploy и ЮKassa sandbox |
| OPS-03 (CI pipeline) | P6 | Lint + typecheck + test + build + E2E на preview |
| OPS-04 (production deploy) | **P7** | Триггерится после прохождения всех P7-gates |
| OPS-05 (rollback runbook) | P6 | Draft в P6; **validated** в P7 (тестовый rollback на prod) |
| OPS-06 (DB backup PITR test) | **P7** | PITR доступен только на Pro tier (FOUND-01) — оба в P7 |

### Per-category note EMAIL → P7

Все три EMAIL-требования смещены в P7:
- **EMAIL-01** (custom SMTP wiring) — требует custom domain DNS (FOUND-08) и provider account (Unisender) с лидом
- **EMAIL-02** (RU-локализованные шаблоны с реквизитами) — реквизиты ИП утверждаются юристом (FOUND-09 / COMP-02)
- **EMAIL-03** (deliverability evidence на Mail.ru/Yandex/Rambler) — требует уже работающего DKIM (FOUND-08 → 24-48ч DNS propagation), и evidence-test делается на финальной DNS-конфигурации

В P2 регистрация работает через Supabase default SMTP (rate-limited 3-30/hr, без deliverability-проверки) — достаточно для тестирования флоу с собственным dev-email.

### Per-category note COMP → P7

Все 6 compliance gates кластеризованы в P7 как release-gate:
- COMP-01 (RKN), COMP-02 (юрист sign-off), COMP-03 (ЮKassa prod + 1₽ чек) — внешние lead-time'ы
- COMP-04 (service_role grep), COMP-05 (CSP enforce), COMP-06 (manual security checklist) — проверяются на production build, после deploy

### LEGAL split

- **LEGAL-01/02/03** → **P2**: privacy/oferta-драфты + security-headers нужны до первой регистрации (152-ФЗ consent text ссылается на live policy URL). Драфты содержат TODO-маркеры для юрист-ревью.
- **LEGAL-04** → **P6**: CSP enforce на preview-deploy (валидируется что не ломает Kinescope + SmartCaptcha), готов к переносу в prod в P7

---

## Release Gates (Phase 7 — non-negotiable)

Эти 6 требований (COMP-01..06) + production cutover (OPS-04 + PAY-01 + EMAIL-* + FOUND-01/07/08/09 + OPS-06) — release-gate. **Без всех зелёных production switch не флипается.**

| Gate | What | Owner | Lead-time |
|---|---|---|---|
| COMP-01 | RKN «Уведомление об обработке ПДн» подано + подтверждение сохранено | Solo dev + юрист | 1-3 дня обработки |
| COMP-02 | Юрист подписал акт ревью `/privacy` + `/oferta` + flow удаления | Юрист | 1-2 недели (старт в P5) |
| COMP-03 | ЮKassa shop в production + реальная 1₽ покупка + 54-ФЗ чек | Solo dev | После PAY-01 |
| COMP-04 | `grep -ri "service_role" .next/static/` без матчей | CI + manual | Минуты |
| COMP-05 | CSP enforced на prod без поломок Kinescope/SmartCaptcha | Solo dev | Часы |
| COMP-06 | Manual security checklist (4 проверки) | Solo dev | Часы |

---

## Cut Lines (if behind schedule)

Per `.planning/research/ARCHITECTURE.md §12`, adjusted for dev-first/prod-last restructure:

| Cut | Cost | Recover in |
|---|---|---|
| Phase 6 progress UI (still save to DB) | Dashboard shows «Owned» not «% done» | M2 week 1 |
| Phase 6 hard-delete cron (keep soft-delete) | 152-ФЗ requires manual support process for 30 days post-launch | M2 |
| Phase 4 refund webhook handler | Manual SQL update for refunds (single course, low volume) | M2 |
| Phase 3 multi-tier price (one fixed price only) | Already the M1 plan; do not re-expand | — |
| Phase 7 EMAIL-03 evidence (skip Rambler/exotic providers) | Deliverability undocumented for niche RU mail providers | Within first week post-launch |

**Do not cut:** Phase 1 (security foundations), Phase 4 webhook auth (Pitfall #2), Phase 5 signed URL hygiene (Pitfall #7), **all of Phase 7** (compliance + prod gates are release-blockers — cutting them means publishing illegally).

---

## Dependency Graph

```
Phase 1 (dev foundations: env, server-only, audit, RLS-harness, Sentry-dev)
   │
   ▼
Phase 2 (auth + marketing + consent + drafts; Supabase default SMTP)
   │
   ▼
Phase 3 (catalog + payment redirect; ЮKassa sandbox)
   │
   ▼
[spike: ЮKassa webhook auth]
   │
   ▼
Phase 4 (webhook + access grant + refund; sandbox)
   │
   ▼
[spike: Kinescope JWT claim shape]
   │
   ▼
Phase 5 (video player + lesson access; Kinescope test mode)
   │
   ▼
Phase 6 (progress + profile + E2E + CSP)
   │   ← feature-complete на dev-стенде; продукт демонстрируется через preview-URL
   │
   │   ⟂ Параллельно (старт уже на P5): запуск юриста на ревью драфтов
   │     privacy/oferta, заявка в ЮKassa на production регистрацию,
   │     RKN-форма, выбор custom SMTP provider, покупка домена
   │
   ▼
Phase 7 (production launch prep: Pro tier, custom domain + DNS, custom SMTP +
         evidence, ЮKassa prod + 1₽ чек, RKN, юрист sign-off, prod deploy,
         security checklist, financial smoke test → public launch)
```

P1–P6 sequential (one critical path: register → buy → watch). P7 — это release-gate phase: большинство задач могут быть инициированы параллельно во время P5/P6 (юрист, ЮKassa-заявка, домен, RKN), но финальное переключение happens только после feature-complete (P6).

---

*Roadmap created: 2026-05-24*
*Last updated: 2026-05-24 — restructure from 6 phases to 7 phases (dev-first / prod-last) to unblock development from external lead-times*
