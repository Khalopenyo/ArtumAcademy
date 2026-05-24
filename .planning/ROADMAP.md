# Roadmap: VideoEdit Academy (M1 — v1.0-mvp)

**Created:** 2026-05-24
**Milestone:** M1 (v1.0-mvp) — first shippable MVP, 4–6 недель соло
**Granularity:** standard
**Project mode:** mvp (every phase is a vertical slice through DB → server → client → test)
**Core Value:** Купивший пользователь должен иметь возможность смотреть оплаченный курс без перебоев и без возможности скачать видео.

> Phase structure derived from `.planning/research/SUMMARY.md §3 Build Order` and validated against `.planning/research/ARCHITECTURE.md §12` + `.planning/research/PITFALLS.md` HIGH-severity phase mapping. Six phases cover the critical revenue path; every v1 requirement maps to exactly one phase.

---

## Phases

- [ ] **Phase 1: Foundations & Compliance Setup** — Infrastructure, secrets boundary, audit/observability scaffolding, и 152-ФЗ архитектурное решение (без которых дальнейшие фазы небезопасны)
- [ ] **Phase 2: Auth + Marketing Shell + 152-ФЗ Consent** — Лендинг, юридические страницы, регистрация/логин/сброс + капча + rate limit + согласие на ПДн с evidence-полями
- [ ] **Phase 3: Catalog + Payment Redirect** — Страница курса, commerce-миграция (purchases / webhook_events / audit_log / price_minor), Server Action `createCoursePayment` с server-side price, редирект на ЮKassa, success/failure страницы
- [ ] **Phase 4: Webhook + Access Grant + Refund** — Идемпотентный обработчик `payment.succeeded` / `canceled` / `refund.succeeded`, IP-allowlist + path-secret, amount-verify, выдача доступа, owned-courses dashboard *(pre-phase research spike: ЮKassa webhook auth model)*
- [ ] **Phase 5: Video Player + Lesson Access Control** — Kinescope private signed URL (JWT, TTL 4h, watermark по email), `assertCourseAccess` на каждом серверном endpoint, sandboxed iframe без download, threat-model doc *(pre-phase research spike: Kinescope JWT claim shape)*
- [ ] **Phase 6: Progress + Profile + Ship & Compliance Gates** — `lesson_progress` пишется и агрегируется, профиль с soft-delete + pg_cron hard-delete, продовый деплой, RKN-уведомление, юрист sign-off, ЮKassa production switch, CSP enforce, manual security checklist

**Estimated total effort:** 4–6 weeks solo (P1: ~3 дня, P2: ~неделя, P3: ~неделя, P4: ~неделя + spike, P5: 1–1.5 недели + spike, P6: ~неделя)

---

## Pre-Phase Research Spikes

Two integration surfaces have documentation conflicts that require a 0.5–1 day spike **before** the phase starts. These are non-negotiable — without them the phase will block on undocumented behaviour.

| Before Phase | Spike | Why | Default if undecided |
|---|---|---|---|
| **Phase 4** | **ЮKassa webhook auth model** (HMAC vs IP-allowlist vs path-secret) — three docs disagree (SUMMARY.md Open Q #1, PITFALL #2). Read current `yookassa.ru/developers/using-api/webhooks` + ЛК ЮKassa → "Уведомления" tab. Document decision in `docs/research/yookassa-webhook-auth.md`. | Wrong auth = fake `payment.succeeded` from `curl` grants free access (PITFALL #2, HIGH). | Ship all three layers (IP-allowlist + path-secret + HMAC if present). |
| **Phase 5** | **Kinescope private signed-URL JWT claim shape** — exact claim names (`sub`, `video_id`, `watermark.text`, `exp`) need verification against current Kinescope private API docs (SUMMARY.md Open Q #15, ARCHITECTURE.md §4.2). Document in `docs/research/kinescope-jwt-claims.md`. | Wrong claim shape = 403 from Kinescope → no playback → Core Value broken. | Use claim names from ARCHITECTURE.md §4.2 and test against sandbox video. |

---

## Phase Details

### Phase 1: Foundations & Compliance Setup
**Goal:** Инфраструктура, секреты, observability и compliance-решения зафиксированы так, что P2–P6 не вынуждены делать архитектурные правки задним числом.
**Mode:** mvp
**Depends on:** Nothing (existing scaffold — `src/lib/supabase/*`, `src/lib/auth/require.ts`, base migration — treated as immutable foundation)
**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10 (10 requirements)
**Success Criteria** (what must be TRUE):
  1. Приложение падает на старте если хотя бы один обязательный секрет (ЮKassa, Kinescope, SMTP, Sentry, Supabase service_role) отсутствует или невалиден по Zod
  2. `grep -ri "service_role" src/components/ src/app/(marketing) src/app/(app)` возвращает пусто, и попытка импорта `@/lib/supabase/admin` из client-компонента валит build/lint
  3. Тестовое исключение в Server Action видно в self-hosted Sentry/GlitchTip-дашборде в течение 30 секунд
  4. RLS-test harness (`tests/integration/rls/`) умеет логиниться от двух пользователей и доказывает cross-user denial на shape-таблице
  5. Архитектурное решение по 152-ФЗ (`docs/compliance/152fz-architecture.md`) задокументировано и подписано юристом — выбрана одна из трёх стратегий (dual-write / Yandex Cloud / accepted risk)
**Pitfalls prevented:** #10 (RLS USING/WITH CHECK conventions), #12 (service_role leak — `import 'server-only'` baseline), #13 (152-ФЗ architecture decision), #21 (server-only discipline), #22 (middleware budget), #23 (Supabase Pro + Sentry from day 1)
**Plans:** TBD

### Phase 2: Auth + Marketing Shell + 152-ФЗ Consent
**Goal:** Незалогиненный пользователь может изучить курс на лендинге, прочесть юридические страницы, зарегистрироваться с явным согласием на ПДн, залогиниться и увидеть пустой `/dashboard` — то есть к началу P3 есть аутентифицированный пользователь, который может что-то купить.
**Mode:** mvp
**Depends on:** Phase 1 (нужны env-парсер, admin-client, audit_log, custom SMTP DNS-записи пропагированы, RKN-форма понятна юристу)
**Requirements:** LEGAL-01, LEGAL-02, LEGAL-03, LAND-01, LAND-02, LAND-03, LAND-04, LAND-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, EMAIL-01, EMAIL-02, EMAIL-03 (21 requirements)
**Success Criteria** (what must be TRUE):
  1. Незалогиненный пользователь открывает `/` на мобиле, видит hero + ценовой блок + FAQ + футер с `/privacy` + `/oferta`, и проходит Lighthouse mobile-perf ≥ 80
  2. Пользователь регистрируется на `/register`, получает welcome-confirm письмо на Mail.ru / Yandex / Gmail в inbox (не spam, mail-tester ≥ 9/10), подтверждает email и автоматически попадает в `(app)/dashboard`
  3. Без обеих галочек («согласие ПДн» + «оферта») кнопка «Зарегистрироваться» disabled; после регистрации в `user_consents` появляются две раздельные записи с IP, UA, policy_version и timestamp
  4. Пользователь сбрасывает пароль через email-ссылку (одноразовую, истекающую через 1 час) и логинится новым паролем; сессия сохраняется после закрытия браузера
  5. 6-я и 11-я попытка логина за 15 минут с одного IP отвергается с 429; SmartCaptcha видна на `/register` и `/forgot-password`
**Pitfalls prevented:** #14 (consent capture with evidence), #16 (Supabase default SMTP throttle), #17 (RU email deliverability with SPF/DKIM/DMARC), #18 (Auth defaults), #20 (Suspense around useSearchParams on `/login?next=…`)
**Plans:** TBD
**UI hint:** yes

### Phase 3: Catalog + Payment Redirect
**Goal:** Авторизованный пользователь видит публичную страницу курса, нажимает «Купить» и оказывается на странице ЮKassa с правильной суммой и 54-ФЗ-чеком; в БД появляется `purchases.status='pending'`. Webhook ещё не подключён — но «outbound» половина платёжного surface полностью работает и тестируется в изоляции.
**Mode:** mvp
**Depends on:** Phase 2 (нужен залогиненный пользователь с подтверждённым email)
**Requirements:** CRSE-01, CRSE-02, CRSE-03, CRSE-04, CRSE-05, PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07 (12 requirements)
**Success Criteria** (what must be TRUE):
  1. На `/courses/[slug]` авторизованный пользователь видит превью, программу, цену в ₽ (форматированную `Intl.NumberFormat('ru-RU')`), и кнопку «Купить»; анонима кнопка ведёт на `/register?next=…`
  2. Server Action `createCoursePayment(courseId)` отвергает любой `amount` в теле запроса; цена берётся ТОЛЬКО из `courses.price_minor`; пользователь перенаправляется на `confirmation.confirmation_url` ЮKassa
  3. После клика «Купить» в `purchases` появляется ровно одна строка со `status='pending'`, `idempotence_key` (UUIDv4) и `external_payment_id` от ЮKassa; повторный клик с тем же `purchase.id` НЕ создаёт дубликата на стороне ЮKassa (Idempotence-Key соблюдён)
  4. В ЛК ЮKassa → «Чеки» (test mode) появляется фискальный чек с email покупателя и `vat_code=2` (USN)
  5. На `/payment/success?orderId=…` пользователь видит индикатор «Платёж обрабатывается» с polling раз в 2 сек; на `/payment/failure?…` — понятную причину и кнопки «Попробовать снова» / «Связаться»
**Pitfalls prevented:** #3 (server-side price, never trust client), #4 (54-ФЗ receipt with email + vat_code), #5 (one-time, no `save_payment_method`), #20 (Suspense на `/payment/*` страницах с `?orderId=`), #25 (commerce миграция через файл, без DROP)
**Plans:** TBD
**UI hint:** yes

### Phase 4: Webhook + Access Grant + Refund
**Goal:** Test-платёж проходит полный цикл `create → webhook → succeeded`; пользователь видит купленный курс в `/dashboard`. Idempotent для retry, защищён от подделки, поддерживает refund. Это первая фаза где «купивший» официально существует.
**Mode:** mvp
**Depends on:** Phase 3 (нужны `purchases` rows со `status='pending'` для теста)
**Pre-phase spike:** ЮKassa webhook auth model — см. таблицу выше; ОБЯЗАТЕЛЬНО до начала кодинга
**Requirements:** HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, HOOK-06, HOOK-07, HOOK-08, DASH-01, DASH-02, DASH-03, DASH-04 (12 requirements)
**Success Criteria** (what must be TRUE):
  1. ЮKassa test-платёж проходит полный цикл `createPayment → webhook → status='succeeded'`; на `/dashboard` авторизованный покупатель видит купленный курс с обложкой, прогресс-плейсхолдером (0 %) и кнопкой «Продолжить»
  2. Повторная доставка того же `webhook_event.id` (симуляция через ручной POST) НЕ создаёт второй покупки — `webhook_events.UNIQUE(provider, external_id)` ловит дубль, обработчик возвращает 200, в `purchases` остаётся одна строка
  3. POST на webhook URL с правильным path-secret но неправильным source IP отвергается 403; POST с правильным IP но без path-secret — тоже 403; обе попытки попадают в `audit_log` с `action='webhook.auth_failed'`
  4. Webhook с подменённой суммой (`event.object.amount.value` ≠ `purchases.amount_minor`) отвергается 200+audit-mismatch+Sentry alert и НЕ выдаёт доступ; полный `refund.succeeded` отзывает доступ (следующая загрузка урока видит `status='refunded'` → 403), partial refund — НЕ отзывает
  5. У пользователя без покупки `/dashboard` показывает пустое состояние с CTA «Каталог курсов»; `/dashboard/orders` показывает историю с датой, суммой, статусом и ссылкой на чек ЮKassa
**Pitfalls prevented:** #1 (webhook double-delivery via `INSERT … ON CONFLICT DO NOTHING`), #2 (signature/IP/path-secret verify before parse), #6 (refund handler shipped in same phase as payment), #23 (E2E sandbox test in CI)
**Plans:** TBD
**UI hint:** yes

### Phase 5: Video Player + Lesson Access Control
**Goal:** Купивший пользователь нажимает «Смотреть» и видит урок в защищённом плеере с watermark на свой email; не-купивший получает 404. Это самая дорогая по Core Value фаза — здесь защищается контент.
**Mode:** mvp
**Depends on:** Phase 4 (нужен `purchases.status='succeeded'` для теста access path; нужен Kinescope аккаунт + private video uploaded)
**Pre-phase spike:** Kinescope private JWT claim shape — см. таблицу выше; ОБЯЗАТЕЛЬНО до начала кодинга
**Requirements:** PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PLAY-06, PLAY-07, PLAY-08 (8 requirements)
**Success Criteria** (what must be TRUE):
  1. Купивший пользователь открывает `/learn/[courseSlug]/[lessonId]` и видит видео в Kinescope iframe с водяным знаком его email поверх; signed URL генерируется заново на каждый рендер страницы (TTL = 4 часа) и НЕ попадает в localStorage / sessionStorage / React Query cache / Sentry breadcrumbs
  2. Не-купивший пользователь, попробовавший прямой URL на чужой урок, получает 404 (RLS отсеивает строку до того, как сервер успевает её срендерить); integration-тест в `tests/integration/rls/lessons.test.ts` это подтверждает для двух пользователей
  3. В iframe Kinescope нет нативной кнопки download, контекстное меню поверх плеера отключено (CSS pointer-events на overlay-слое), `sandbox="allow-scripts allow-same-origin"`, `referrerpolicy="strict-origin"`; домен-whitelist в Kinescope ЛК содержит только production-домен (никаких `*` или `localhost`)
  4. На странице урока работает навигация (prev/next в модуле), кнопка «Завершить урок» (опц.) пишет `lesson_progress.completed_at`; название курса/модуля видно в хлебных крошках
  5. `docs/security/video-protection.md` явно перечисляет защищённые векторы (DevTools download, прямой URL, account sharing — последний раскрывается watermark) и нерезаемые (запись экрана) — для управления ожиданиями автора курса
**Pitfalls prevented:** #7 (signed URL persistence — server-built per render, no client storage), #8 (no right-click theatre — real protections enumerated), #9 (Kinescope domain whitelist + referrer-policy), #11 (`(select auth.uid())` in lessons RLS for scale)
**Plans:** TBD
**UI hint:** yes

### Phase 6: Progress + Profile + Ship & Compliance Gates
**Goal:** Дашборд показывает реальный % прохождения; пользователь может удалить аккаунт по 152-ФЗ; продовый деплой пройден; все release-gate compliance-чеки закрыты. После этой фазы можно открывать продажи.
**Mode:** mvp
**Depends on:** Phase 5 (нужен рабочий плеер для прогресса), Phase 1 (нужны RKN-форма и юрист в очереди готовности)
**Requirements:** LEGAL-04, PROF-01, PROF-02, PROF-03, PROF-04, PROG-01, PROG-02, PROG-03, PROG-04, OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06, COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06 (21 requirements)
**Success Criteria** (what must be TRUE):
  1. Пользователь смотрит урок → debounced `upsertLessonProgress` пишет `seconds_watched` раз в 5 сек; событие «ended» проставляет `completed_at`; на `/dashboard` процент завершения курса (`completed / total`) обновляется на следующей загрузке (< 50 мс при 1000×50 уроков)
  2. Пользователь на `/profile` нажимает «Удалить аккаунт», подтверждает email, логаутится; через 30 дней pg_cron-джоб обнуляет PII в `profiles` и `user_consents`, сохраняя `purchases` с `user_id = NULL` (402-ФЗ retention); audit_log запись присутствует
  3. Полный Playwright smoke-тест (`tests/e2e/critical-path.spec.ts`: register → email confirm → ЮKassa test purchase → webhook → watch first lesson → progress recorded) проходит на каждом PR в CI; production deploy на Vercel `fra1` за < 5 минут rollback по runbook
  4. Уведомление в РКН подано и подтверждение сохранено; юрист подписал акт по `/privacy`, `/oferta`, account-deletion flow; ЮKassa shop переведён в production и реальный 1₽-чек виден в ЛК «Чеки»
  5. `grep -ri "service_role" .next/static/` возвращает пусто; CSP enforced (не report-only) на проде и не ломает Kinescope + Yandex SmartCaptcha; manual security checklist пройден (покупка чужого курса прямым URL → 403, DevTools Network → no direct file URL, SQL inject через формы → отвергнуто, account-share → watermark показывает email шерящего)
**Pitfalls prevented:** #11 (progress query performance index), #12 (pre-launch service_role grep on `.next/static/`), #13 (152-ФЗ data localisation legal sign-off), #15 (hard-delete cron + retained anonymised purchases), #19 (no Realtime overspend — polling on visit only), #23 (PITR backups + Sentry + E2E + rollback runbook), #24 (no over-build — admin/marketing/etc deferred to M2)
**Plans:** TBD
**UI hint:** yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundations & Compliance Setup | 0/0 | Not started | — |
| 2. Auth + Marketing Shell + 152-ФЗ Consent | 0/0 | Not started | — |
| 3. Catalog + Payment Redirect | 0/0 | Not started | — |
| 4. Webhook + Access Grant + Refund | 0/0 | Not started | — |
| 5. Video Player + Lesson Access Control | 0/0 | Not started | — |
| 6. Progress + Profile + Ship & Compliance Gates | 0/0 | Not started | — |

---

## Coverage

**Total v1 requirements:** 84
**Mapped:** 84/84 (100% ✓)
**Unmapped:** 0
**Duplicates:** 0

Breakdown by phase:

| Phase | Requirements count | Categories represented |
|-------|--------------------|-----------------------|
| 1 | 10 | FOUND |
| 2 | 21 | LEGAL (×3 of 4), LAND, AUTH, EMAIL |
| 3 | 12 | CRSE, PAY |
| 4 | 12 | HOOK, DASH |
| 5 | 8 | PLAY |
| 6 | 21 | LEGAL (×1 of 4 — CSP gate), PROF, PROG, OPS, COMP |
| **Total** | **84** | All 14 categories covered |

**Note on LEGAL split:** LEGAL-01/02/03 (privacy/oferta/HSTS+security-headers) ship in Phase 2 because they're required before the first user registers (152-ФЗ consent text needs the policy live). LEGAL-04 (CSP enforce) is deferred to Phase 6 because CSP can break Kinescope + SmartCaptcha and is safest to enable as a final hardening pass once the inventory of frame-src / script-src sources is stable.

---

## Compliance Gates (Phase 6 release-gate, non-negotiable)

These six requirements (COMP-01..06) cluster in Phase 6 as the public-launch gate. Without **all six** green, the production switch does not flip.

| Gate | What | Owner |
|---|---|---|
| COMP-01 | RKN «Уведомление об обработке ПДн» подано + подтверждение сохранено | Solo dev + юрист |
| COMP-02 | Юрист подписал акт ревью `/privacy` + `/oferta` + flow удаления | Юрист |
| COMP-03 | ЮKassa shop переведён в production + реальный 1₽-чек 54-ФЗ виден в ЛК «Чеки» | Solo dev |
| COMP-04 | `grep -ri "service_role" .next/static/` без матчей | CI + manual |
| COMP-05 | CSP enforced (не report-only) на production без поломок Kinescope/SmartCaptcha | Solo dev |
| COMP-06 | Manual security checklist пройден (4 проверки: чужой курс / DevTools / SQL inject / account share) | Solo dev |

---

## Cut Lines (if behind schedule)

Per `.planning/research/ARCHITECTURE.md §12`:

| Cut | Cost | Recover in |
|---|---|---|
| Phase 6 progress UI (still save to DB) | Dashboard shows «Owned» not «% done» | M2 week 1 |
| Phase 6 hard-delete cron (keep soft-delete) | 152-ФЗ requires manual support process for 30 days post-launch | M2 |
| Phase 4 refund webhook handler | Manual SQL update for refunds (single course, low volume) | M2 |
| Phase 3 multi-tier price (one fixed price only) | Already the M1 plan; do not re-expand | — |

**Do not cut:** Phase 1 (security foundations), Phase 4 webhook auth (Pitfall #2), Phase 5 signed URL hygiene (Pitfall #7), Phase 6 COMP-01..06 (release gates).

---

## Dependency Graph

```
Phase 1 (foundations)
   │
   ▼
Phase 2 (auth + marketing + consent)
   │
   ▼
Phase 3 (catalog + payment redirect)
   │
   ▼
[spike: ЮKassa webhook auth]
   │
   ▼
Phase 4 (webhook + access grant + refund)
   │
   ▼
[spike: Kinescope JWT claim shape]
   │
   ▼
Phase 5 (video player + lesson access)
   │
   ▼
Phase 6 (progress + profile + ship + compliance gates)
```

Each phase is sequential — none can be parallelised meaningfully for a solo dev because Core Value runs through one critical path (register → buy → watch).

---

*Roadmap created: 2026-05-24*
*Last updated: 2026-05-24*
