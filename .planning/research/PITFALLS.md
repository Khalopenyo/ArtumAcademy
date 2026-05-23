# Pitfalls Research

**Domain:** Paid LMS (online courses) for RU/CIS market — solo dev, 4–6 week MVP deadline
**Project:** VideoEdit Academy (Next.js 14 App Router + Supabase + Kinescope + ЮKassa + Unisender)
**Researched:** 2026-05-24
**Confidence:** HIGH (verified against current 2025–2026 sources for ЮKassa, Supabase RLS CVE-2025-48757, Next.js App Router, Kinescope, 152-ФЗ July 2025 amendments)

## Reading Guide

- **Severity** is graded against **Core Value** ("купивший пользователь смотрит контент без возможности скачать"):
  - **HIGH** — directly breaks payment success, video protection, paid-content access correctness, or causes legal/financial liability (RKN fine, ЮKassa chargeback, mass refund).
  - **MED** — degrades reliability/conversion or creates 1–2 days of rework if hit.
  - **LOW** — annoying but isolated; trivial to fix post-launch.
- **Phase mapping** uses the M1 phase names from `.planning/PROJECT.md`:
  - **P0 — Foundations** (env, types, CI, supabase admin client, audit/webhook_events tables, RLS test harness)
  - **P1 — Auth & consent** (login/register, 152-ФЗ consent, RLS for profiles, rate limit, captcha)
  - **P2 — Catalog & access** (courses/modules/lessons schema, RLS, public landing/course pages)
  - **P3 — Payments (ЮKassa)** (server action, webhook handler, purchases table, success/failure pages)
  - **P4 — Video playback** (Kinescope signed URL, lesson page, progress)
  - **P5 — Dashboard & profile** (мои курсы, удаление аккаунта, /privacy /offer /terms)
  - **P6 — Hardening & launch** (CSP, monitoring, backups, E2E smoke, deploy)

---

## Critical Pitfalls

### Pitfall 1: ЮKassa webhook applied twice → double course grant or double refund

**What goes wrong:**
ЮKassa delivers webhooks **at-least-once**. `payment.succeeded` arrives, your handler inserts a `purchases` row and grants access; the network hiccups, ЮKassa retries 30 seconds later, the handler runs again, the user gets a duplicate row (or, if you have `refund.succeeded` logic, accounting drifts). At scale this also lets a malicious actor replay an old captured payload.

**Why it happens:**
The default mental model is "webhook = synchronous RPC." It isn't. Even the official ЮKassa docs (`yookassa.ru/developers/using-api/webhooks`) explicitly say events must be deduplicated by `event.object.id`, and the project's own `.claude/skills/security/SKILL.md:170-191` mandates a `webhook_events` table with `UNIQUE (provider, external_id)` — but that table does not yet exist (see CONCERNS.md).

**How to avoid:**
1. Create `webhook_events (provider, external_id UNIQUE, payload jsonb, processed_at, created_at)` **in the same migration that introduces the webhook handler** — never in a follow-up.
2. Handler logic: `INSERT … ON CONFLICT DO NOTHING`. If `rowCount === 0`, return `200 OK` immediately (already processed).
3. Wrap the insert + business effect in a single Postgres transaction. If the side-effect (grant access, fire email) is non-transactional (e.g. Unisender send), enqueue it via a row in `outbox` table consumed by a separate worker; otherwise a crash between INSERT and effect produces a "processed but no access" ghost.
4. Reject events whose `event.object.created_at` is older than 7 days (replay protection window).

**Warning signs:**
- Two identical rows in `purchases` for the same `payment_id` in dev.
- Sentry log "duplicate key value violates unique constraint" — that's the *good* path; absence of that log under retry means dedup never fired.
- Users complain "списали дважды" / support tickets about duplicate access emails.

**Phase to address:** P3 (Payments). Non-negotiable before first production payment.

**Severity:** HIGH — directly breaks Core Value (paid-access correctness) and creates 54-ФЗ accounting mismatch.

---

### Pitfall 2: ЮKassa webhook signature not verified → fake payment grants free course

**What goes wrong:**
The webhook endpoint `/api/webhooks/yookassa` is publicly reachable. Anyone with `curl` can POST a JSON body that *looks* like `payment.succeeded` with someone else's `user_id` in `metadata`, and your handler happily grants them access. Even worse: an attacker scrapes a real successful payload from a leaked browser console, replays it with a different `user_id`.

**Why it happens:**
ЮKassa's docs are split between two security models — IP allow-listing (their list of source IPs) and HMAC signature on the body. Many tutorials only mention IP allow-listing; CDNs/proxies (Vercel, Cloudflare) can break IP checks. Developers ship "we'll add signature later," then never do. Note: ЮKassa's webhook signature mechanism is less prominently documented than Stripe's — verify the *exact* current mechanism from `yookassa.ru/developers/using-api/webhooks` and from the Russian-language ЛК ЮKassa, because their "уведомления" UI surfaces a per-shop secret that must be present in your env *and* the handler must compute HMAC with the **raw body bytes**, not the parsed JSON.

**How to avoid:**
1. Two layers, not one: (a) restrict by ЮKassa source IPs at the edge (Vercel firewall or middleware) — this stops casual probes; (b) HMAC verify the raw request body with `YOOKASSA_SECRET_KEY`, constant-time compare.
2. Read the body once as `request.text()` for signature check, then `JSON.parse` — calling `request.json()` first will consume the stream and break verification.
3. On signature mismatch return `401`, log the event metadata (NOT the body — could contain card BIN) to the audit log with `action: 'webhook.signature_failed'`.
4. Unit test: assert that a payload with a tampered amount fails verification.

**Warning signs:**
- Webhook handler has no `crypto.createHmac` call.
- Any "TODO: add signature check" comment in `src/app/api/webhooks/yookassa/route.ts`.
- Logs show `200 OK` for requests from non-ЮKassa IPs.

**Phase to address:** P3 (Payments).

**Severity:** HIGH — turns the entire paid-access model into a giveaway. Direct Core Value breach.

---

### Pitfall 3: Trusting client-supplied price (`amount`) in payment creation

**What goes wrong:**
The "Купить" button POSTs `{ planId, amount: 9900 }` to a Server Action which forwards `amount` to ЮKassa. A user opens devtools, changes `amount` to `1`, pays 1₽, and your webhook (which trusts ЮKassa's reply that "payment for 1₽ succeeded") grants full course access.

**Why it happens:**
Convenience: it's faster to pass `amount` from the cart UI than to look it up server-side. Project's own `security/SKILL.md:147-164` already calls this out explicitly — but with one solo dev, "we'll refactor later" is a real risk.

**How to avoid:**
1. The Server Action accepts **only** `planId` (uuid). It loads the plan from `pricing_plans` table (which must exist — currently no migration creates it), computes price from there.
2. `pricing_plans.price_kopecks BIGINT NOT NULL CHECK (price_kopecks > 0)` — store in kopecks to avoid float arithmetic.
3. Webhook handler **also** re-verifies that `event.object.amount.value` matches the expected price for the `metadata.plan_id`. Mismatch → log + don't grant access, even if amount is *higher* (could be a routing-attack scenario).
4. Unit test: server action ignores any `amount` field in input even if passed.

**Warning signs:**
- Zod schema for create-payment action has an `amount: z.number()` field.
- Any `price` or `amount` value flowing from React → server in network tab.

**Phase to address:** P3 (Payments) — *before* writing the create-payment server action.

**Severity:** HIGH — direct financial loss + reputation. Core Value breach.

---

### Pitfall 4: 54-ФЗ чек (cashier receipt) not generated → tax-authority fine + ЮKassa disable

**What goes wrong:**
ЮKassa requires every successful card payment to be accompanied by a fiscal receipt (54-ФЗ). If your create-payment request omits the `receipt` field (or includes it with wrong VAT code / wrong "товар vs услуга" classification), ЮKassa **either** refuses to process the payment, **or** processes it but stops fiscalization which causes ФНС fines (up to 30k₽ per receipt for IP, more for OOO). Common rookie mistakes: forgetting `customer.email` in receipt block, using VAT `1` (НДС 0%) when the IP is on USN (must be `2` — без НДС), forgetting that one payment can require multiple receipt items.

**Why it happens:**
The project's `security/SKILL.md:196-199` says "ЮKassa отправляет автоматически" — that's only true if (a) the shop has fiscalization enabled in ЛК, **and** (b) you pass a valid `receipt` payload at payment creation. Many tutorials skip this step because it works in sandbox without it.

**How to avoid:**
1. Always include `receipt: { customer: { email }, items: [{ description, quantity: 1, amount: {…}, vat_code: <USN=2 / OSN=1>, payment_subject: 'service', payment_mode: 'full_prepayment' }] }` in the create-payment body.
2. `description` ≤ 128 chars, no emoji, no `<>` — ЮKassa will silently drop or reject.
3. Store the legal entity's tax regime in a config constant; do not hardcode `vat_code`.
4. After first sandbox payment, verify in ЛК ЮKassa → "Чеки" tab that the receipt appears with correct OFD link. Manual gate before going live.
5. Unit test: assembled payload has non-empty `receipt.items[0].description` and a valid `vat_code`.

**Warning signs:**
- Payment status `succeeded` but ЛК "Чеки" tab shows nothing for that payment.
- ЮKassa support emails about "необходимо настроить фискализацию."
- ФНС inspection letter (too late).

**Phase to address:** P3 (Payments) + P6 (manual gate in pre-launch checklist).

**Severity:** HIGH — legal liability + ЮKassa account suspension halts all revenue.

---

### Pitfall 5: Subscription API vs one-time API confusion in ЮKassa

**What goes wrong:**
ЮKassa has two payment flows: (a) single-charge (`POST /payments` with `confirmation.type=redirect`) — what you actually need for a one-shot course purchase, and (b) recurring/saved-card (`payment_method.save: true` + later `payment_method_id` reuse) — for subscriptions. Mixing them produces silent bugs: e.g. setting `save_payment_method: true` without informing the user creates a "stored card" that ЮKassa can charge later, which violates user consent (and 152-ФЗ). Conversely, building the subscription flow when you only sell one-time courses adds a week of complexity for no value.

**Why it happens:**
ЮKassa docs interleave the two flows. Sample code on the internet (often Indian/Stripe-translated tutorials) confuses them. Project plans say "in MVP we sell one course one time" — but copy-paste from a subscription tutorial sneaks `save_payment_method: true` in.

**How to avoid:**
1. Hardcode flow type at the helper level: `createOneTimePayment(planId, userId)` — never accept "subscription mode" parameter in MVP.
2. Explicit assertion in unit test: `expect(payload).not.toHaveProperty('save_payment_method')`.
3. Do not implement `payment_method_id` reuse, autopayments, or `/payments/{id}/capture` two-stage flow in M1. All deferred to M2 if needed.
4. Document this constraint in `src/lib/yookassa/README.md` or a code comment at the top of the helper.

**Warning signs:**
- Any `save_payment_method` token in code.
- Any UI mention of "автопродление" / "recurring" in MVP.

**Phase to address:** P3 (Payments).

**Severity:** MED — wastes time + creates consent issue. Not a direct Core Value breach but consumes scarce dev time.

---

### Pitfall 6: Refund (`refund.succeeded`) accounting drift

**What goes wrong:**
User refunds. ЮKassa fires `refund.succeeded`. Common mistakes: (a) handler only sets `purchases.status='refunded'` but doesn't revoke `course_access` (user keeps watching), (b) handler revokes access but doesn't write to audit log so support can't reconstruct what happened, (c) partial refunds are processed as full refunds and revoke access for users who paid 50%, (d) handler writes a *negative* `purchases` row instead of updating the existing one — accounting reports double-count.

**Why it happens:**
Refund flow is built late, post-launch under pressure, often after the first refund request — there's no clear spec at design time. The "happy path" (`payment.succeeded`) gets all the attention.

**How to avoid:**
1. Design the refund handler **in the same PR** as the payment handler. Don't ship payment without it.
2. Single source of truth: `purchases` table has `status enum('pending','paid','refunded','partially_refunded')` and `refunded_amount_kopecks`. Access query joins on `status IN ('paid')`.
3. Refund handler is also idempotent (uses `webhook_events` table same as payment) — refund events also retry.
4. On every state change: `audit_log.insert({ action: 'purchase.refunded', entity_id: purchase.id, meta: { amount, reason } })`.
5. Unit test: partial refund (50%) does NOT revoke access; full refund DOES.

**Warning signs:**
- "Refund" section missing from webhook handler tests.
- Refunded user can still load `/lessons/[id]` (no revocation propagated).

**Phase to address:** P3 (Payments).

**Severity:** HIGH — financial accuracy + Core Value (access correctness).

---

### Pitfall 7: Kinescope signed URL leak via persistent client-side storage

**What goes wrong:**
Lesson page fetches signed URL, passes it to the player. Developer caches it in React state, localStorage, or — worst — in a URL query param. A few hours later, that user shares "the link" in Telegram. TTL is 4h, so for the next 4 hours anyone with that URL can stream. Or: the URL ends up in browser history, password manager dumps, Sentry breadcrumbs.

**Why it happens:**
"Premature optimization": "let's cache the URL to avoid refetching." Or React Query default of `staleTime: Infinity` accidentally persists the URL across navigations. Or the URL is embedded in `<video src>` and ends up in DevTools / Network tab screenshots posted to support.

**How to avoid:**
1. Signed URL is fetched **server-side** in the lesson page (Server Component or Server Action), passed to the client component as a prop only for the current render. Never persisted.
2. TTL ≤ 4h (per `security/SKILL.md:208`), preferably ≤ 1h for high-value content.
3. Never echo the signed URL into logs, Sentry breadcrumbs (set `beforeSend` to scrub `*kinescope*` URLs), or `console.log`.
4. Player wrapper marked `'use client'` but receives `signedUrl` as prop; do **not** store it in zustand, localStorage, sessionStorage, or React Query cache. Refetch on each lesson load.
5. Watermark every stream with `user.email` (or `user.id` hash) overlay — Kinescope supports per-session watermark; this makes leaked recordings traceable.

**Warning signs:**
- `localStorage.getItem` referencing video URLs.
- React Query / SWR caching the URL.
- URL visible in browser history after navigating away.

**Phase to address:** P4 (Video playback).

**Severity:** HIGH — Core Value (защита контента).

---

### Pitfall 8: "Right-click disable" / MediaSource API illusion of protection

**What goes wrong:**
Developer disables right-click context menu, hides browser controls, and ticks the box "защищено." It isn't. Tools like `kinescope-dl` (publicly on GitHub: `github.com/anijackich/kinescope-dl`) accept a `--referer` flag and download Kinescope videos by speaking the MediaSource Extensions / HLS / DASH protocol directly. Browser DevTools → Network → filter `.ts` segments → `ffmpeg -i playlist.m3u8 out.mp4` works for any non-DRM HLS stream. Disabling DevTools is impossible; disabling right-click annoys legitimate users and stops zero attackers.

**Why it happens:**
Defensive instinct + lack of pen-test reality check. Especially common in solo dev with no security background. Customers/stakeholders demand "защиту" without specifying threat model.

**How to avoid:**
1. **Accept the threat model honestly** (PROJECT.md:109 already does): "Полная защита от записи экрана недостижима — это известный компромисс."
2. **Real protections (cumulative, not single):**
   - Kinescope **private** mode (signed URL + referrer allow-list pinned to your production domain).
   - Per-session email watermark (deters re-distribution because pirates get caught).
   - Short signed-URL TTL (≤1h preferred; max 4h).
   - Account-binding (lessons require login + active purchase, server-checked).
   - Rate-limit on `getSignedUrl` (e.g. 30 req/h per user; abnormal pattern → flag account).
   - If budget allows in M2: Widevine L1 / FairPlay DRM via Kinescope (hardware enforcement blocks screen-capture on iOS Safari + Android L1 + Edge with PlayReady, but NOT on Chrome desktop / Firefox / Linux — see Kinescope's own 2026 piracy guide).
3. **Theatre to remove:** right-click disable, DevTools detection scripts, `oncontextmenu="return false"`, CSS `user-select: none` on player. They are anti-UX with zero security value.
4. Document the threat model in `docs/security-threat-model.md` so future "add right-click block" requests get a documented decision to reject.

**Warning signs:**
- Any `oncontextmenu`, `preventDefault on F12`, or DevTools-detection blob in the codebase.
- Stakeholder asks "why can users still right-click?" — that's a conversation, not a code change.

**Phase to address:** P4 (Video playback) — frame protection layers in the design doc, *not* by adding theatre.

**Severity:** MED for misallocated effort (HIGH if developer believes the theatre works and skips real protections like signed URL TTL).

---

### Pitfall 9: Kinescope referrer-policy bypass + missing domain allow-list

**What goes wrong:**
Kinescope's per-project "разрешённые домены" list is empty or contains `*` → embed works from any site, so an attacker iframes your `/lessons/[id]` from `evil.ru` and proxies the player. Or the project sets a strict CSP `referrer-policy: no-referrer` to "be safe," which causes Kinescope to refuse playback because there's no referrer to validate. Tools like `kinescope-dl` (referenced in research) explicitly include a `--referer` flag to fake the referrer header and download videos.

**Why it happens:**
Two separate settings (Kinescope dashboard + your CSP/referrer policy) that must agree. Easy to set one and forget the other. CSP and Referrer-Policy are easy to copy from a generic security blog post that contradicts Kinescope's requirements.

**How to avoid:**
1. In Kinescope ЛК → project → "Разрешённые домены": list your production domain(s) explicitly, no wildcards beyond your own (`videoedit-academy.ru`, `*.videoedit-academy.ru`). Remove `localhost` before launch (or keep on a separate dev project).
2. Set `Referrer-Policy: strict-origin-when-cross-origin` (the project default in `next.config.js` is already `same-origin` — verify this is compatible with Kinescope; the safe value is `strict-origin-when-cross-origin`).
3. CSP `frame-src https://*.kinescope.io https://kinescope.io` — explicit, not wildcard `*`.
4. Add a Playwright smoke test that loads the lesson page and asserts the iframe loads successfully (catches referrer/CSP regressions).
5. Realize: referrer validation is **defence-in-depth**, not a primary control. `kinescope-dl` bypasses it trivially. The primary control remains signed URLs + watermark + account binding.

**Warning signs:**
- Kinescope domain whitelist contains `*` or `localhost` in production.
- Lesson page logs "blocked by Referrer Policy" in browser console.
- `frame-src 'self'` only — iframe fails to load Kinescope player.

**Phase to address:** P4 (Video playback) + P6 (CSP audit).

**Severity:** MED — easily bypassed (so not a strong control) but missing it removes a deterrent layer.

---

### Pitfall 10: RLS policy with USING but no WITH CHECK → user updates row to escalate

**What goes wrong:**
A naive RLS update policy: `CREATE POLICY ... FOR UPDATE TO authenticated USING (user_id = auth.uid())`. This allows a user to update their own rows — but **without** `WITH CHECK`, they can UPDATE a row they own and **set** `user_id` to someone else's, or set `is_admin = true`, or change `course_id` to point to a paid course. RLS only filters which rows are visible to UPDATE; it does not filter the new row values without `WITH CHECK`.

**Why it happens:**
Postgres RLS docs split USING (row filter) from WITH CHECK (new-value filter). Most tutorials show only USING because INSERT/SELECT only need USING. For UPDATE policies both are needed. CVE-2025-48757 catalogued this exact mistake across 170+ Lovable apps.

**How to avoid:**
1. Every `FOR UPDATE` policy has **both** `USING (...)` and `WITH CHECK (...)` clauses, typically identical.
2. Every `FOR INSERT` policy has `WITH CHECK (...)` (USING is meaningless for INSERT).
3. Never expose user-mutable foreign-key columns (`user_id`, `purchase_id`, `course_id`) in the WITH CHECK predicate as "anything user-owned" — pin them: `WITH CHECK (user_id = auth.uid() AND created_at = OLD.created_at)`.
4. Mandatory cross-user RLS tests in `tests/integration/rls/` — covered by `.claude/skills/database/SKILL.md`. For every mutable table: as user A, try to UPDATE a row to set `user_id = B`. Must fail.
5. **Sensitive columns** (role, balance, granted_until) — never update via Postgres RLS path from client; only via server action with service_role + audit log entry.

**Warning signs:**
- Any `CREATE POLICY ... FOR UPDATE` line lacking `WITH CHECK`.
- `tests/integration/rls/` empty (already flagged HIGH in CONCERNS.md).
- Code uses `supabase.from('purchases').update({ user_id: ... })` from a Client Component.

**Phase to address:** P0 (RLS test harness) + every phase that adds a table (P1, P2, P3).

**Severity:** HIGH — direct privilege escalation + Core Value breach (user grants themselves paid access).

---

### Pitfall 11: `(select auth.uid())` performance trap in RLS at scale

**What goes wrong:**
Policies written as `USING (user_id = auth.uid())` re-evaluate `auth.uid()` per row, which on a 100k-row lesson_progress table during a SELECT scan causes 100k function calls and 30-second queries. Symptom: dev is fast, prod with real data times out, users see white-screen dashboards.

**Why it happens:**
Idiomatic-looking SQL. Supabase's own RLS optimization guide (Z5Jjwv troubleshooting doc) specifically calls out the fix: wrap in subquery to evaluate once per statement.

**How to avoid:**
1. Use `USING (user_id = (select auth.uid()))` — the subquery hoists the call.
2. Same for `auth.jwt()`, `auth.role()`, `(select auth.email())`.
3. Critical for: `lesson_progress`, `purchases`, any table likely to grow to thousands of rows per user.
4. Add an EXPLAIN-based check in `tests/integration/rls/` or a one-off SQL: after seeding 10k rows, `SELECT * FROM lesson_progress WHERE user_id = '...'` should take <50ms.

**Warning signs:**
- Dashboard load time grows linearly with content.
- Supabase logs show `auth.uid()` called thousands of times per query.

**Phase to address:** P0 (RLS conventions) + P4 (lesson_progress migration).

**Severity:** MED — degrades UX at scale; not Core Value breach but kills perceived performance.

---

### Pitfall 12: `service_role` key leaks to client bundle

**What goes wrong:**
Developer adds `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (correct), then imports `createServiceClient` from a module that's also imported by a Client Component (wrong). Next.js bundles the helper — including the key — into the JS sent to browsers. RLS becomes meaningless because anyone reading the bundle has admin DB access. CVE-class incident; multiple 2025 post-mortems of Lovable apps document this exact failure mode.

**Why it happens:**
- Easiest "fix" for an RLS error during development: "let me just use service_role for a sec."
- Single `supabase.ts` file exports both anon and service clients; one component imports both.
- `.env` variable accidentally prefixed `NEXT_PUBLIC_` (auto-bundle).

**How to avoid:**
1. Service role client lives in `src/lib/supabase/admin.ts` with `import 'server-only'` as the first non-comment line — this fails the build if a Client Component transitively imports it.
2. **Never** prefix the key `NEXT_PUBLIC_*`. ESLint rule that forbids `process.env.NEXT_PUBLIC_*SERVICE*` patterns.
3. Centralised env parser (`src/lib/env.ts`) with Zod: server block wrapped in `import 'server-only'`; client block has only public values.
4. Pre-launch: build, then `grep -r "service_role" .next/static/` — must return zero hits.
5. If ever leaked: **rotate immediately** in Supabase ЛК + redeploy + audit access logs for last 30 days for unusual queries.

**Warning signs:**
- Any `NEXT_PUBLIC_SERVICE_ROLE_KEY` in env.
- `service_role` string appears in `.next/static/chunks/*.js` after build.
- Client Component renders without error after importing `supabaseAdmin`.

**Phase to address:** P0 (Foundations).

**Severity:** HIGH — game-over for the entire DB. Core Value breach + 152-ФЗ breach.

---

### Pitfall 13: 152-ФЗ data localisation — Supabase Frankfurt is NOT compliant for primary storage (post 1 July 2025)

**What goes wrong:**
As of 1 July 2025, primary collection of personal data of Russian citizens on databases located outside Russia is **prohibited** (b-152.ru, comply.ru, habr.com/cloud4y/articles/949628). Supabase regions are eu-central-1 (Frankfurt), us-east-1, etc. — none in Russia. Storing user emails, names, phone numbers, IPs there constitutes a violation. RKN can fine (up to 6M₽ per repeat offence for legal entities; for IP smaller but still painful) and block the site.

**Why it happens:**
The project's own `security/SKILL.md:275` says "Допустимо при выполнении условий первичного хранения в РФ. **Уточняй у юриста перед запуском.**" That note is correct — but easy to skip. Solo devs without legal budget often hope "it'll be fine for MVP." It's not fine; the 2025 amendment is enforced.

**How to avoid (options ranked by realism for solo MVP):**
1. **Recommended:** dual-write architecture — primary `profiles_pii (email, phone, name)` table on a Russian Postgres (e.g. Yandex Cloud Managed Postgres, Selectel, beget) collected via a separate `/api/register` endpoint; Supabase stores only `auth.users` with **pseudonymous IDs** + non-PII fields (course progress, purchases by purchase_id). The PII table satisfies "primary storage in RF"; Supabase holds the secondary copy for app-functional access.
2. **Alternative:** migrate auth + data entirely to a Russian provider (Yandex Cloud + their managed Postgres + their Auth) — adds 1–2 weeks; defeats purpose of Supabase choice.
3. **Document the legal opinion:** if going with option 1 or accepting the risk, get a one-page memo from a профильный юрист stating the architecture is compliant; store in `docs/compliance/152fz-architecture.md`. Without legal sign-off, you're personally liable.
4. **Notify RKN** as оператор ПДн (form available at pd.rkn.gov.ru) — free, mandatory regardless of where data lives.
5. **NOT a fix:** "data is encrypted at rest" — irrelevant; the law cares about physical location, not encryption.

**Warning signs:**
- No `docs/compliance/152fz-architecture.md`.
- No RKN registration submitted.
- Project plan assumes "Supabase Frankfurt is fine because GDPR is stricter than 152-ФЗ" — false dichotomy; both apply independently.

**Phase to address:** P0 (architecture decision) + P5 (privacy policy + consent flow that matches actual data location) + P6 (RKN notification before launch).

**Severity:** HIGH — legal liability + site block risk. Not a Core Value technical breach but kills the business.

---

### Pitfall 14: 152-ФЗ consent capture without versioning / IP / proof

**What goes wrong:**
Registration form shows a "Согласен с обработкой ПДн" checkbox. User ticks it. No record is stored — or only a `consented_at` timestamp, no IP, no UA, no policy version. Six months later you update the privacy policy. Users from before never agreed to the new version. RKN asks for proof of consent for user X — you have none.

**Why it happens:**
Developer treats the checkbox as a UI element, not as evidence. The wording is also frequently wrong — generic "I agree to terms" instead of explicit 152-ФЗ-compliant text naming the *operator*, *purposes*, *categories* of data, and *retention period*.

**How to avoid:**
1. `user_consents` table: `(user_id, purpose enum('pdn_processing','marketing','newsletter'), policy_version text, accepted_at, ip inet, user_agent text, PRIMARY KEY(user_id, purpose, policy_version))`.
2. On consent: server action records all five fields; client never writes directly.
3. Privacy policy stored as immutable versioned text (file in repo + version stamp in DB) — when text changes, version bumps, users see "policy updated, please re-confirm" on next login.
4. Wording must explicitly list: оператор (полное юр. наименование), цели обработки, перечень собираемых ПДн, срок хранения, право на отзыв согласия, способ отзыва. Generic checkbox text fails inspections.
5. Separate checkbox for marketing (Unisender M2) — must be opt-in, not bundled with the mandatory ПДн checkbox. Bundling violates law.

**Warning signs:**
- Registration form has one checkbox covering both ПДн and marketing.
- No `user_consents` table in migrations.
- `/privacy` page has no version number or "last updated" date.

**Phase to address:** P1 (Auth & consent) + P5 (privacy policy page).

**Severity:** HIGH — legal liability; also blocks Unisender marketing in M2 if marketing consent wasn't captured cleanly.

---

### Pitfall 15: Account deletion is not a hard delete (152-ФЗ "right to be forgotten")

**What goes wrong:**
"Удалить аккаунт" button just signs out the user, or sets `is_active = false`. User's email, name, phone, course progress, payment history remain. User files complaint with RKN. RKN demands proof of deletion. You can't.

**Why it happens:**
Hard delete is scary (audit trail loss, foreign key cascades). Soft delete is the easy default. But 152-ФЗ requires actual deletion within 30 days of request (or shorter if specified in your policy).

**How to avoid:**
1. Two-stage flow per `security/SKILL.md:265-273`: soft delete (`profiles.deleted_at = now()`) immediately, real delete via cron after 30 days.
2. Real delete: nullify or hash PII columns (email, name, phone, IP) on `profiles`; cascade delete `lesson_progress`; **keep** `purchases` rows with anonymised `user_id` (financial records have separate retention under 402-ФЗ — 5 years).
3. Storage purge: delete user's homework files, profile avatars from Storage in the same cron.
4. Audit log entry: `action: 'account.purged', meta: { reason: 'user_request', user_id_hash: ... }`. Do not log the user's actual identifiers post-deletion.
5. Display in /profile/danger: "Ваши данные будут полностью удалены в течение 30 дней" — sets correct expectation.
6. Provide an /api/profile/export endpoint that returns the user's data as JSON before deletion — 152-ФЗ also grants right to access.

**Warning signs:**
- No `deleted_at` column on profiles.
- No cron job / scheduled function set up (Supabase pg_cron or external).
- Deletion flow doesn't touch Storage.

**Phase to address:** P5 (Dashboard & profile).

**Severity:** HIGH — legal liability; also a Core Value adjacency (trust signal for paying customers).

---

### Pitfall 16: Supabase Auth default email throttle blocks legitimate signups

**What goes wrong:**
First 50 users sign up, all good. Marketing launches Yandex Direct ads, 200 signups in an hour. Supabase Auth's default email throttle (free tier: ~30 emails/hour shared across all auth operations) kicks in. Half the new users never receive their confirmation email. They give up. Refund requests increase because users "didn't get the email after paying."

**Why it happens:**
Supabase Auth uses its own SMTP for confirmation emails on free/pro tier with very tight limits. The limits are documented but easy to miss. Also: Supabase's default sender (`noreply@mail.app.supabase.io`) lands in Mail.ru spam.

**How to avoid:**
1. In Supabase ЛК → Auth → SMTP Settings: configure **custom SMTP** before any traffic. Use Unisender Go / Selectel / Mailgun EU region (not Mailgun US — see Pitfall 17).
2. SPF + DKIM + DMARC for the sender domain (see Pitfall 17 for details).
3. Sender = `noreply@your-domain.ru` (real domain you own), not a Supabase subdomain.
4. Test signup flow specifically with Mail.ru + Yandex + Rambler addresses (the three big RU consumer ones) — they all reject differently. Inbox + spam folder check.
5. Monitor `auth.users` for `email_confirmed_at IS NULL` over time — if a backlog grows, the email pipeline is broken.

**Warning signs:**
- "I didn't get the email" in support inbox.
- Supabase Auth log shows `email send rate exceeded`.
- Confirmation links coming from `*.supabase.co` domain (defaults not overridden).

**Phase to address:** P1 (Auth) — *before* the first real user signs up.

**Severity:** HIGH — converts paying users into refund requests; direct revenue impact.

---

### Pitfall 17: RU email deliverability — Mail.ru / Yandex / Rambler reject without strict SPF+DKIM+DMARC

**What goes wrong:**
You set up Mailgun (US region) or Sendgrid. Emails to `@mail.ru`, `@yandex.ru`, `@rambler.ru`, `@list.ru`, `@inbox.ru`, `@bk.ru` either bounce or land in spam. Mail.ru in particular has very aggressive heuristics against foreign IPs without strict alignment, and Yandex DMARC enforcement is strict. Confirmation emails, password resets, payment receipts all fail.

**Why it happens:**
RU mail providers have stricter requirements than Gmail. They specifically downrank:
- US/foreign sender IPs without established sending reputation.
- Missing DMARC `p=quarantine` or `p=reject` (they treat `p=none` as suspicious).
- DKIM signature domain not aligned with `From:` domain.
- Transactional mail mixed with marketing on the same IP pool.

**How to avoid:**
1. **Use a provider with RU IP pools or recognised RU presence:** Unisender (РФ-based, dedicated transactional IPs), SendPulse, Selectel Mail, Yandex Mail for Business. Avoid Mailgun-US and Sendgrid-US for RU consumer mail.
2. **DNS records (must have all three):**
   - SPF: `v=spf1 include:_spf.unisender.com -all` (or your provider).
   - DKIM: 2048-bit key, selector from provider, RSA key in DNS.
   - DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@your-domain.ru; adkim=s; aspf=s` — strict alignment is critical for Mail.ru.
3. **Separate domains for transactional vs marketing:** e.g. `noreply@mail.your-domain.ru` for confirmations, `news@news.your-domain.ru` for Unisender campaigns (M2). Sharing a domain pollutes reputation.
4. **Warm up sending volume** gradually if using a new IP — don't go 0 → 10k emails in a day.
5. **Monitor:** weekly DMARC report parsing (use postmarkapp.com/dmarc or dmarcian free tier) to catch failures.
6. **Reverse DNS (PTR)** of sender IP must resolve to a valid name on the same domain — for Unisender this is preconfigured; for self-hosted SMTP you must set it.

**Warning signs:**
- Mail.ru / Yandex addresses in `auth.users` with `email_confirmed_at IS NULL` while Gmail users confirm fine.
- Bounces with "DMARC alignment failure" or "550 spam-source".
- Postmaster tools (Yandex postmaster.yandex.ru, Mail.ru postmaster.mail.ru) show low reputation.

**Phase to address:** P1 (Auth — for transactional via Supabase custom SMTP) + M2 (Unisender for marketing). DNS records set in P0 (before any real send).

**Severity:** HIGH — silently breaks the registration → confirmation → purchase funnel.

---

### Pitfall 18: Long-lived JWT TTL leaves stolen sessions usable for weeks

**What goes wrong:**
Supabase Auth default access token TTL is 1 hour, refresh token rotation is automatic. If a developer raises access TTL (e.g. to a week "for convenience") or disables refresh rotation, a stolen JWT (via XSS, malware on a public PC) stays valid for that whole window. Revoking the session in `auth.users` doesn't invalidate JWTs already issued (Supabase JWTs are stateless until they expire).

**Why it happens:**
"Why does the user keep getting logged out?" → raise TTL → forget to lower it. Also: developer doesn't realise that logout only deletes the cookie locally — the JWT itself remains valid until expiry on any other device that copied it.

**How to avoid:**
1. **Do not change Supabase Auth defaults** without security review. Access token = 1h, refresh = 30d with rotation = on.
2. For sensitive operations (delete account, change email, payment confirmation) require **fresh re-auth** — call `supabase.auth.reauthenticate()` or require password re-entry. Don't trust an old session.
3. Cookies: `httpOnly`, `Secure`, `SameSite=Lax`. Already in skill but verify via Playwright test in P6.
4. Logout: call `supabase.auth.signOut({ scope: 'global' })` to invalidate refresh tokens server-side on all devices. Default scope is `local` — only the current device.
5. Periodic audit: monitor `auth.audit_log_entries` for repeated refresh from unusual IP geographies for the same user.

**Warning signs:**
- Anyone proposing "let's make sessions last 30 days, like Instagram."
- Logout doesn't call signOut with `scope: 'global'` and users complain "I'm still logged in on the other tab."

**Phase to address:** P1 (Auth) + P6 (cookie audit).

**Severity:** MED — defence-in-depth; only HIGH if combined with another breach.

---

### Pitfall 19: Realtime subscriptions consume free-tier quota silently

**What goes wrong:**
A "live progress" feature or chat uses Supabase Realtime. Each connected client = one concurrent connection. Free tier: 200 concurrent. Pro tier: 500 default. With 1k users on the dashboard at peak, you blow past quota; new connections silently fail; users see stale data with no error.

**Why it happens:**
Realtime "just works" in dev with 1–2 connections. Quota only hits at scale. Easy to subscribe in a layout (so it persists across every page) without unsubscribing on unmount.

**How to avoid:**
1. **Decide explicitly** what needs Realtime. For MVP: probably nothing. Lesson progress can poll on lesson load — no real-time needed.
2. If used: always `unsubscribe()` in cleanup; use `useEffect` cleanup or `subscription.unsubscribe()` in a `try/finally`.
3. Subscribe at the lowest level where the data is actually rendered, never in root layout.
4. Monitor Supabase ЛК → Realtime → connection graph weekly.
5. If pushing notifications later, prefer Server-Sent Events or per-event webhook → push (Telegram bot etc.) over keeping persistent realtime connections.

**Warning signs:**
- "Realtime" anywhere in M1 spec — push back; it's almost certainly unnecessary.
- Subscriptions in `app/layout.tsx` or other always-mounted component.

**Phase to address:** P4 / P5 if any realtime feature lands; otherwise prevent by not adding it.

**Severity:** LOW for MVP (likely no realtime); MED if added carelessly.

---

### Pitfall 20: `useSearchParams` without Suspense → production build fails or page goes blank

**What goes wrong:**
Login page accepts `?next=/dashboard` redirect param via `useSearchParams()` in a Client Component. Local dev works fine. Production build fails with `Missing Suspense boundary with useSearchParams`, **or** (in some Next.js 14 patch versions) the build succeeds but the entire page becomes client-rendered with a flash of blank content. Users on slow RU mobile networks see a white page for 1–3 seconds before login form appears.

**Why it happens:**
Next.js 14 App Router opts the route into client rendering during static prerender when `useSearchParams` is unboundaried. Documented at `nextjs.org/docs/messages/missing-suspense-with-csr-bailout`. The experimental flag `missingSuspenseWithCSRBailout` does not exist (will error out per Jan 2025 GitHub issue 74494).

**How to avoid:**
1. Always wrap any Client Component that calls `useSearchParams()` in `<Suspense fallback={...}>` at the parent boundary.
2. Better pattern: in a Server Component page, read `searchParams` from props, pass values down to Client Component as plain props. The hook is only needed if the value changes client-side (rare for auth redirects).
3. Move `useSearchParams()` callers into the smallest possible Client Component leaf — not the page root.
4. Build locally with `npm run build` before push to catch the error.

**Warning signs:**
- `npm run build` failure mentioning `useSearchParams` or "CSR bailout."
- Lighthouse Performance score drops sharply after adding a hook to a page.
- Flash of blank content on auth pages.

**Phase to address:** P1 (Auth pages) + P3 (success/failure pages that read `?payment_id=`).

**Severity:** MED — breaks production builds (HIGH if deploy pipeline lacks `next build` step and goes to prod).

---

### Pitfall 21: Accidentally importing server-only code into a Client Component

**What goes wrong:**
Helper `src/lib/auth/require.ts` uses `cookies()` from `next/headers` (server-only). A new component file marked `'use client'` imports a util from `src/lib/utils.ts` which transitively imports `require.ts`. Build fails cryptically: `You're importing a component that needs "next/headers"`. Worse case: the build succeeds but a runtime function call leaks server logic into the client bundle.

**Why it happens:**
Barrel exports (`src/lib/index.ts` re-exports everything). One client importer pulls in the whole tree. Without `'server-only'` marker, the issue surfaces only at build time with confusing errors.

**How to avoid:**
1. Every server-only module (`src/lib/auth/require.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`) starts with `import 'server-only'`. Build fails fast and clearly if a client component imports it.
2. No barrel exports (`index.ts` re-exporting many files) for libs that mix server and client code. Force explicit per-file imports.
3. Mirror folders: `src/lib/auth/client.ts` (browser-safe) vs `src/lib/auth/server.ts` (with `'server-only'`). Name discipline beats magic.
4. Eslint rule `eslint-plugin-no-restricted-syntax` to forbid importing `next/headers` from `'use client'` files.

**Warning signs:**
- `'use client'` files that import from `@/lib/supabase/server`.
- Cryptic build errors mentioning `next/headers` in unexpected modules.

**Phase to address:** P0 (Foundations — set the `server-only` discipline before code lands).

**Severity:** MED — slows development; HIGH only if it lets a service_role helper leak.

---

### Pitfall 22: Middleware exceeds Edge runtime limits

**What goes wrong:**
Middleware grows from "refresh Supabase session" to "also check role + log + rate limit." Edge runtime has tight limits: 1MB compiled size, 30-second CPU max, no Node APIs (no `crypto.randomBytes`, no `fs`). One day the middleware blows the size limit (a heavy import like `bcrypt`), or a synchronous DB call adds 200ms to every request including static asset requests.

**Why it happens:**
Middleware feels like the "central place to add cross-cutting logic." It isn't. Edge middleware runs on every matched request and must stay tiny.

**How to avoid:**
1. Middleware does **only** session refresh (the documented pattern). All auth gating happens in layout-level `requireUser()`.
2. Matcher excludes static assets aggressively (already configured in `src/middleware.ts` and `security/SKILL.md:60`).
3. No `import` of heavy libs (bcrypt, sharp, libpq) in middleware files.
4. Rate limiting via `@upstash/ratelimit` — Upstash has an Edge-compatible client, but place rate limiting **in the route handler / server action**, not middleware (so it's scoped to mutating endpoints, not every page load).
5. CI: check middleware bundle size after build (`.next/server/middleware*.js`).

**Warning signs:**
- Middleware imports growing beyond `@supabase/ssr` and `next/server`.
- Bundle size warnings during build.
- Vercel logs showing middleware timeouts.

**Phase to address:** P0 (set the discipline) + P6 (verify bundle size pre-launch).

**Severity:** MED — affects performance broadly; HIGH if middleware fails entirely under load.

---

### Pitfall 23: Solo-dev MVP cuts critical safety nets (backups, monitoring, E2E)

**What goes wrong:**
With a 4–6 week deadline solo, the temptation is to skip:
- **Database backups** — Supabase Pro has daily backups but Free tier has only 7-day PITR (if available). One bad migration or accidental DELETE wipes paid user data with no recovery.
- **Error monitoring** — Sentry/equivalent not configured. Payment webhook silently fails for 6 hours; you only find out from a support email.
- **E2E test for payment** — sandbox-only "I clicked through once" testing. First real production payment hits an edge case (e.g. card declined → user clicks Back → retries → double webhook), nobody noticed because no E2E coverage.
- **Deploy rollback plan** — Vercel "redeploy previous" works for code, but if a migration ran, rollback requires also reverting the migration which Supabase doesn't auto-do.
- **PITR / point-in-time recovery** — on Supabase Free tier this is NOT included; you must upgrade to Pro ($25/mo) to get it.

**Why it happens:**
"Pre-launch is too early to spend money on tooling." Wrong — these things exist *because* MVP launches are the riskiest moment.

**How to avoid (priority order, ~1 day total):**
1. **Supabase Pro tier from day 1** — PITR, daily backups, larger quotas. $25/mo is cheaper than recovering one incident.
2. **Sentry free tier** for both Next.js client + server. Wire in P0; cost 30 min. Filter PII in `beforeSend`.
3. **E2E Playwright for the critical path:** register → confirm email (via Mailpit/Inbucket in CI) → purchase (ЮKassa sandbox) → watch a free preview lesson. One test file, ~200 lines, ~1 day to write. Non-negotiable per `.claude/skills/testing/SKILL.md`.
4. **Pre-deploy hook in Vercel:** require `npm run build && npm run test:ci` to pass. Already implied by `playwright.config.ts:7` (`forbidOnly: !!process.env.CI`) — wire the GitHub Action.
5. **Migration rollback runbook in `docs/runbooks/db-rollback.md`:** for each migration in M1, document the manual rollback SQL (knowing that DROP COLUMN is irreversible and requires PITR — see Pitfall 27).
6. **Manual smoke-test checklist** for each deploy: 5 minutes, 5 steps (login, view course, start payment to sandbox, view lesson, logout). Beats no testing.

**Warning signs:**
- No `package.json` script named `test:e2e:smoke`.
- No Sentry env var in `.env.example` … oh wait, there is. Then it must be actually wired in code, not just declared.
- Supabase project still on Free tier on launch day.

**Phase to address:** P0 (Sentry + Pro tier) + P6 (E2E + runbook).

**Severity:** HIGH — turns recoverable incidents into existential ones.

---

### Pitfall 24: Solo-dev over-builds admin/theming/microservices before having users

**What goes wrong:**
The mirror of Pitfall 23: instead of cutting too much, the solo dev over-builds:
- A full CRUD admin panel for courses (2+ weeks) when M1 sells one course (already deferred to M2 — good).
- A theming system / design tokens / dark mode toggle before having any brand.
- A custom analytics dashboard instead of just looking at Vercel Analytics + ЮKassa ЛК.
- Microservices / separate backend / GraphQL layer over Supabase.
- Custom auth instead of Supabase Auth ("for full control").
- Over-engineered state management (Redux + middleware) for 4 pages.

**Why it happens:**
Cognitive comfort: building admin tools or infrastructure feels productive and is bug-free territory (no users to confuse). Avoids the harder, fuzzier work of marketing/landing copy/payment integration.

**How to avoid:**
1. Anchor every PR to a user story from `PROJECT.md` Active. If no story, push back.
2. Time-box infrastructure work: if it exceeds 1 day, drop it for a hardcoded simpler version.
3. Single seeded course via SQL is fine for MVP. Admin panel = M2.
4. Use shadcn/ui defaults until a brand exists. Custom theming wastes time.
5. Use `next/font` with system fonts until brand defines typography.
6. Skip Zustand / Redux entirely in M1 — Server Components + Server Actions + React Query for one or two client-state needs.

**Warning signs:**
- A whole week with no PR touching `src/app/(marketing)/` or `src/app/api/webhooks/`.
- "I'm refactoring the layout system" — usually shouldn't happen pre-launch.

**Phase to address:** Across all M1 phases — discipline, not code.

**Severity:** MED — eats the deadline; not a direct Core Value breach but kills the entire MVP.

---

### Pitfall 25: Migration applied to prod without backup → irreversible data loss

**What goes wrong:**
You write `DROP COLUMN profiles.old_field` because it's "unused." Apply to prod. Realise too late that one cron job wrote to it last week, or that the column held data needed for an upcoming report. Supabase migrations are forward-only; rolling back a DROP COLUMN requires Point-in-Time Recovery (Pro+ tier only). On Free tier with no backups, data is gone.

**Why it happens:**
`supabase db push` is one command; no friction reminds you to back up first. CONCERNS.md already flags forward-only migration risk.

**How to avoid:**
1. **Never DROP** in M1 migrations. Mark as `-- DEPRECATED: do not write` and revisit later.
2. If genuinely needed: run on prod inside a `BEGIN; … COMMIT;` after explicit backup (`pg_dump` via Supabase ЛК → Backups → Download).
3. Migration filenames are timestamp-prefixed (UTC). Per-file changes are atomic. No "fix-up" SQL outside migration files — that breaks reproducibility.
4. Apply to staging branch first (Supabase Branching is free for Pro), wait 24h with smoke tests, then promote.
5. Pre-deploy CI check: `supabase db diff --schema public` against expected state; reject if unexpected drift.
6. Document the rollback for every migration: even a one-liner comment `-- ROLLBACK: ALTER TABLE x ADD COLUMN foo …; data unrecoverable`.

**Warning signs:**
- Any `DROP TABLE` or `DROP COLUMN` in M1 migrations.
- No staging Supabase project / no branch.
- `supabase db push` run directly against prod from a dev laptop.

**Phase to address:** P0 (process) + every phase that adds migrations.

**Severity:** HIGH — irreversible. Core Value (lost user purchase data = chargebacks + reputation).

---

### Pitfall 26: Missing indexes that surface at scale (especially `lesson_progress`)

**What goes wrong:**
The base migration has `idx_modules_course_id` and `idx_lessons_module_id` (good), but `lesson_progress (user_id, lesson_id)` table will land in P4. Without an index on `(user_id)` (or even better, `(user_id, lesson_id)`), every dashboard load does a full table scan. At 100 users × 50 lessons = 5k rows, it's invisible. At 5k users × 50 lessons = 250k rows, dashboard takes 5 seconds and timeouts cascade.

**Why it happens:**
Postgres doesn't auto-index foreign keys. Developer assumes the FK creates one. It doesn't.

**How to avoid:**
1. For every FK column queried in WHERE: explicit `CREATE INDEX`.
2. For every column used in ORDER BY: index covering the WHERE + ORDER BY.
3. Specifically for `lesson_progress`: `CREATE INDEX ON lesson_progress (user_id, lesson_id);` (covers per-user lookup + per-lesson lookup).
4. Specifically for `purchases`: `CREATE INDEX ON purchases (user_id, status);` (dashboard "my courses" query).
5. Specifically for `webhook_events`: the UNIQUE constraint already creates an index on `(provider, external_id)`. Also add `(processed_at)` for cleanup queries.
6. Add a CI step (or one-off pre-launch): `pg_stat_statements` query for top-10 slow queries; ensure none are seq-scans on large tables.

**Warning signs:**
- Supabase logs showing query time >500ms on dashboard load.
- `EXPLAIN ANALYZE` showing `Seq Scan` on any user-facing table.

**Phase to address:** P2 (catalog schema), P3 (purchases), P4 (lesson_progress) — every migration that introduces a table.

**Severity:** MED — degrades UX at scale (>1k MAU); not Core Value breach.

---

### Pitfall 27: Large jsonb columns growing unbounded

**What goes wrong:**
`webhook_events.payload jsonb` and `audit_log.meta jsonb` are unbounded. Each payment webhook is ~2KB. After a year of 1k payments/month + retries, `webhook_events` is 50MB+. Audit log grows even faster. Supabase Pro free DB tier is 8GB; you hit storage limits, queries slow down because of TOAST overhead, backups take forever.

**Why it happens:**
"It's just JSON, who cares." Devs don't think about retention until storage warnings hit.

**How to avoid:**
1. Retention policy in `webhook_events`: rows older than 90 days can be deleted (signature already verified, idempotency window passed).
2. Audit log: keep 1 year hot, archive older to cold storage (S3-compatible) or summarise.
3. Don't store the full event body in audit log — store `webhook_event_id` reference + a few key fields (`amount`, `status`, `email_hash`).
4. Pg_cron job (Supabase supports it) runs nightly: `DELETE FROM webhook_events WHERE processed_at < now() - interval '90 days';`
5. For very large fields (rare in MVP): consider Supabase Storage for blobs, not jsonb.

**Warning signs:**
- Supabase ЛК showing storage growth >100MB/month with low user count.
- Backup duration >10 minutes.

**Phase to address:** P3 (webhook_events schema) + P5 (audit_log conventions).

**Severity:** LOW for MVP (no scale yet), MED if neglected for 6+ months.

---

### Pitfall 28: N+1 queries in course/lesson loops

**What goes wrong:**
Course page loads modules, then for each module loops to fetch lessons:
```ts
const modules = await sb.from('modules').select('*').eq('course_id', id);
const lessonsByModule = await Promise.all(
  modules.map(m => sb.from('lessons').select('*').eq('module_id', m.id))
);
```
That's 1 + N queries. 10 modules = 11 round trips. RU users on 4G see 2-second course page loads.

**Why it happens:**
Natural way to write it. Supabase SDK's join syntax (`.select('*, lessons(*)')`) is less obvious.

**How to avoid:**
1. Use embedded selects: `sb.from('modules').select('*, lessons(*)').eq('course_id', id).order('order_index');` — single query, single trip.
2. Or: fetch modules and lessons separately, both filtered by course_id (lessons via join), then assemble in memory. Two queries instead of N+1.
3. Enable Supabase request logging in dev (`debug: true` on client) — eyeball queries per page load.
4. Add a Playwright integration test that asserts <5 DB queries per course page load (via test instrumentation).

**Warning signs:**
- Course page slow in dev with 10+ modules seeded.
- Supabase logs showing dozens of small queries per page.
- `.map(async ...)` or `Promise.all(items.map(item => fetch...))` pattern.

**Phase to address:** P2 (catalog) + P5 (dashboard).

**Severity:** MED — UX degradation; not Core Value breach.

---

### Pitfall 29: Missing pagination → load-all on lessons / users list

**What goes wrong:**
Admin lessons list (M2, but pattern applies to public catalog too): `SELECT * FROM lessons` returns all rows. With 200 lessons, that's a 50KB JSON response. With 2000 lessons in M2 expansion, that's 500KB before gzip, and TBT collapses on mobile.

**Why it happens:**
"It's only a few rows" — true at MVP, untrue forever.

**How to avoid:**
1. Default to paginated queries: `.range(0, 19)` for first page of 20.
2. UI uses cursor-based pagination (next-page button or infinite scroll), not offset (offset is slow on large tables).
3. Add a `LIMIT 100` SQL safety net even on admin queries.
4. For public catalog (1 course in MVP, but architecture for many): show featured/recent only, paginate the rest.

**Warning signs:**
- Any `.select('*')` without `.range()` or `.limit()` on a table expected to grow.
- Response sizes >100KB for list endpoints.

**Phase to address:** P2 (catalog) + M2 (admin).

**Severity:** LOW in MVP (small dataset), MED at scale.

---

### Pitfall 30: Large landing-page images / unoptimised hero

**What goes wrong:**
Landing page hero image is a 2MB PNG. RU users on Beeline/MTS 4G see white screen for 3 seconds. Lighthouse LCP score 4s+. Bounce rate doubles.

**Why it happens:**
Designer hands over a PNG. Developer drops it in `<img>` because Next.js `<Image>` requires more thought.

**How to avoid:**
1. Always use `<Image>` from `next/image`. Configures AVIF/WebP + responsive sizes automatically. Already allowed via `next.config.js` for `*.supabase.co` and `*.kinescope.io`.
2. ESLint: `@next/next/no-img-element` rule on (already in `eslint-config-next` if `next/core-web-vitals` extended — verify in `.eslintrc.json`).
3. Hero images: max 200KB AVIF, with explicit `width`/`height` to prevent CLS.
4. Defer offscreen images with `loading="lazy"` (default on `<Image>`).
5. Test landing page Lighthouse on mobile + slow 3G throttling in DevTools.

**Warning signs:**
- Any `<img>` tag in `src/app/(marketing)/`.
- Lighthouse Performance <80 on landing page.
- LCP element >1MB.

**Phase to address:** P2 (landing) + P6 (Lighthouse check pre-launch).

**Severity:** MED — conversion impact; not Core Value breach but kills funnel.

---

### Pitfall 31: Vercel cold start hitting RU users on register/payment

**What goes wrong:**
Vercel Node runtime cold start: 500ms–2s. Vercel's default deployment region for hobby is `iad1` (US East). For RU users that's already +150ms baseline RTT + cold start = 2.5s before the first byte of `/api/checkout/create`. Combined with Supabase (Frankfurt) round-trip, the create-payment action takes 3s. User suspects "site broken," refreshes, hits another cold start, abandons.

**Why it happens:**
Vercel defaults are US-centric. Edge runtime helps but has limitations (no Node APIs). Supabase region adds another hop.

**How to avoid:**
1. **Move Vercel deployment region** to `fra1` (Frankfurt) — minimum baseline 70-100ms to Moscow vs 150-200ms to US East. Set in `vercel.json` or project settings.
2. Match Supabase region (eu-central-1 / Frankfurt) — co-locate to avoid cross-Atlantic hop.
3. For critical paths (login, register, create-payment): consider Edge runtime if no Node-only deps are needed.
4. Keep server functions "warm" via Vercel's automatic warming — but realistically, for an MVP with low traffic, expect cold starts. Add a loading state on the "Купить" button so users don't perceive freeze.
5. Use ISR/static for marketing pages — `export const revalidate = 300` on landing means first paint is fast even with cold compute.
6. Long-term: if Vercel proves too slow for RU, alternatives: Yandex Cloud Functions, Selectel, or self-hosted Node on RU VPS. But moving off Vercel takes time; pick correct region first.

**Warning signs:**
- "Создание платежа..." spinner >3s in production.
- Vercel function logs showing cold-start latency consistently.
- Lighthouse "Time to First Byte" >1s from RU IP.

**Phase to address:** P0 (region choice) + P6 (perf testing from RU IP via fast.com or DevTools throttling).

**Severity:** MED — conversion / UX impact.

---

### Pitfall 32: Shared lesson link / account sharing trivially works

**What goes wrong:**
User A buys course, sends `https://your-site.ru/lessons/<lesson_id>` to a Telegram group of 50. Each clicks; if your lesson page only checks "user is logged in" without checking "user has paid this course," all 50 watch for free. Or worse: account sharing — one person's email/password is shared, 50 people log in concurrently and all watch.

**Why it happens:**
Auth check `requireUser()` is necessary but not sufficient. The page must also verify "has this user actively purchased this course?"

**How to avoid:**
1. Lesson server component does **both**: `const user = await requireUser(); const access = await assertCourseAccess(user.id, courseId); if (!access) redirect('/courses/...?reason=no_access');`
2. `assertCourseAccess` queries `purchases` table: `WHERE user_id = $1 AND course_id = $2 AND status = 'paid'`.
3. To deter account sharing: limit concurrent sessions per user. Track `auth.sessions` table; if >2 active sessions, force re-auth on oldest. (Optional for MVP; flag as M2 if account-sharing complaints arise.)
4. Watermark video stream with `user.email` overlay (Kinescope feature) — sharing video files becomes traceable.
5. Don't make lesson IDs predictable. Use UUIDs (already do via `gen_random_uuid()`) so URL enumeration doesn't reveal lesson existence.

**Warning signs:**
- Lesson page only checks `if (!user) redirect('/login')` — missing purchase check.
- Anonymous traffic with high engagement on `/lessons/...` URLs (someone shared the link).
- One user's session active in multiple cities simultaneously.

**Phase to address:** P4 (lesson access control).

**Severity:** HIGH — direct Core Value breach.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use `service_role` in dev to skip RLS for a query | Unblocks 10-min dev task | One forgotten import → catastrophic key leak (Pitfall 12) | **Never.** Use `set role` in psql instead, never in app code. |
| Skip `withCheck` on RLS update policies "for now" | Saves 1 line per policy | Privilege escalation CVE (Pitfall 10) | Never. Every UPDATE policy needs both. |
| Hand-edit `src/types/database.ts` | Avoid `npm run db:types` round-trip | Type system silently disabled (`Tables: Record<string, never>`); bugs slip past TS | Never. Regenerate after every migration. |
| Disable Supabase email confirmation in dev to "save SMTP setup" | Faster local testing | Forgotten in prod → unverified emails sign up; bot abuse | Only in `NODE_ENV !== 'production'` guarded by env var. |
| Skip webhook signature verification "until we add proper crypto" | Saves 1 hour | Pitfall 2 — anyone fakes payments | Never in any prod-touching environment. |
| Use one Supabase project for dev + prod | One env to manage | First migration mistake nukes paying-user data | Never. Two projects, or use Supabase Branching. |
| Skip Playwright E2E for payment "we'll test manually" | Saves 1 day | First refund cascade has nobody to detect it (Pitfall 6, 23) | Never for MVP launch. |
| Hardcode the single course's data in TSX instead of seeding DB | Saves "admin panel" work | Pricing changes require redeploy; no audit trail | Acceptable only if `pricing_plans` table still exists with the canonical price. UI display can be hardcoded; price source of truth = DB. |
| `'use client'` everything to "avoid server/client confusion" | No more boundary errors | Lose performance benefits, leak interactive code to first paint, bigger bundle | Never. Default server, opt into client. |
| Defer 152-ФЗ consent capture "until we have users" | Faster registration UI | First user → first violation → personal liability | Never. Consent ships with registration. |
| Defer rate limiting "Supabase Auth already throttles" | Skip Upstash setup (1 hour) | Auth endpoints get bruteforced; webhook endpoint DDoSed | Acceptable for first 24h post-launch with monitoring, not longer. |
| Skip CSP "it's tricky with Kinescope" | Faster initial deploy | XSS risk; CSP must whitelist Kinescope/Supabase/ЮKassa/Sentry origins (Pitfall 9 adjacency) | Acceptable in `Content-Security-Policy-Report-Only` mode for 2 weeks, then enforce. |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **ЮKassa create-payment** | Pass amount from client body | Server loads from `pricing_plans` by `plan_id` (Pitfall 3) |
| **ЮKassa webhook** | Parse JSON before verifying signature | Read raw text, verify HMAC, then parse |
| **ЮKassa webhook** | Only verify HMAC, don't dedupe | Both: HMAC verify AND `webhook_events` UNIQUE insert (Pitfalls 1, 2) |
| **ЮKassa receipt (54-ФЗ)** | Omit `customer.email`, use wrong VAT code | Always include `receipt.customer.email` + correct `vat_code` per tax regime (Pitfall 4) |
| **ЮKassa return URL** | Hardcode prod URL → fails in dev | Use `NEXT_PUBLIC_APP_URL` env, validated by Zod env parser |
| **Kinescope signed URL** | Cache on client | Server-fetch on each lesson load, never persist (Pitfall 7) |
| **Kinescope embed** | Allow any domain in dashboard | Explicit production domain only; no wildcards (Pitfall 9) |
| **Kinescope referrer** | Set `Referrer-Policy: no-referrer` | Use `strict-origin-when-cross-origin` so Kinescope receives origin |
| **Supabase Auth email** | Use default Supabase SMTP for transactional | Custom SMTP via Unisender / Selectel from day 1 (Pitfall 16) |
| **Supabase RLS** | UPDATE policy with USING only | Both USING and WITH CHECK (Pitfall 10) |
| **Supabase RLS** | `auth.uid() = user_id` | `(select auth.uid()) = user_id` (Pitfall 11) |
| **Supabase service_role** | Import from a file also used by client | Mandatory `import 'server-only'` on `src/lib/supabase/admin.ts` (Pitfall 12) |
| **Supabase migrations** | `supabase db push` directly to prod | Apply to staging branch first; document rollback (Pitfall 25) |
| **Unisender (M2)** | Use single API key for transactional + marketing | Separate keys + separate sender domains for reputation isolation (Pitfall 17) |
| **Yandex SmartCaptcha** | Validate token only on client | Server-side validate via `smartcaptcha.yandexcloud.net/validate` (already in security skill) |
| **Sentry** | Default config logs everything | Set `beforeSend` to strip emails, tokens, signed URLs, request bodies |
| **Vercel** | Default `iad1` region for RU users | Set to `fra1` (Frankfurt) (Pitfall 31) |
| **Next.js `useSearchParams`** | Use in page without Suspense | Wrap in `<Suspense>` or read from server `searchParams` prop (Pitfall 20) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `auth.uid()` re-evaluated per row in RLS | Dashboard load grows linearly with user content | Wrap in `(select auth.uid())` | ~1k rows per user query |
| N+1 in course→modules→lessons | Course page slow in dev with seeded data | Embedded select `modules(*, lessons(*))` | 5+ modules |
| No pagination on lesson list | Large JSON response, slow first paint | `.range(0, 19)` + cursor pagination | 100+ items |
| Missing index on `lesson_progress(user_id)` | Dashboard timeout at scale | Explicit `CREATE INDEX` (Pitfall 26) | 100k+ rows |
| Unbounded `jsonb` columns | Slow backups, storage cost | Retention policy + pg_cron cleanup (Pitfall 27) | 6+ months production |
| Vercel cold start on payment action | "Создание платежа..." >3s | Frankfurt region + warming + loading UI (Pitfall 31) | All RU traffic, always |
| Realtime subscriptions in root layout | Quota exhaustion, silent failures | Don't subscribe in always-mounted components (Pitfall 19) | 200+ concurrent users |
| Large `<img>` instead of `<Image>` | High LCP, blown LH score | `next/image` + AVIF (Pitfall 30) | Any image >100KB |
| Middleware does DB queries | Every page load +200ms | Middleware only refreshes session (Pitfall 22) | Always |
| `revalidate` missing on static pages | Every visitor hits Supabase | `export const revalidate = 300` on landing | Any traffic spike |

---

## Security Mistakes

Domain-specific issues beyond OWASP basics.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Webhook signature not verified | Anyone grants themselves access (Pitfall 2) | HMAC verify on raw body before parsing |
| Client-supplied price trusted | Pay 1₽, get full course (Pitfall 3) | Server loads price from `pricing_plans` by `plan_id` |
| Signed video URL cached client-side | Link sharing bypasses TTL (Pitfall 7) | Server-fetch per lesson, no persistence |
| "Right-click disable" theatre | False sense of security; real bypass tools exist (Pitfall 8) | Document threat model; rely on signed URL + watermark + DRM |
| RLS UPDATE policy without WITH CHECK | User changes `user_id` to escalate (Pitfall 10) | Both USING and WITH CHECK on every UPDATE policy |
| `service_role` leaks to bundle | Total DB compromise (Pitfall 12) | `import 'server-only'` on admin client |
| Supabase Frankfurt for РФ users' PII | 152-ФЗ violation; RKN fine (Pitfall 13) | Dual-write architecture or RU-hosted primary |
| Consent without versioning/IP/UA | Cannot prove agreement to RKN (Pitfall 14) | `user_consents` table with full evidence |
| Soft-delete on account deletion | 152-ФЗ "right to be forgotten" not satisfied (Pitfall 15) | 30-day soft → hard delete cron |
| Default Supabase SMTP for RU users | Mail.ru/Yandex reject; users never confirm (Pitfalls 16, 17) | Custom SMTP via Unisender/Selectel + SPF/DKIM/DMARC |
| Long JWT TTL | Stolen session usable for days | Default Supabase TTL (1h access, 30d refresh with rotation) (Pitfall 18) |
| Lesson page checks login only, not purchase | Link sharing bypasses paywall (Pitfall 32) | `assertCourseAccess(userId, courseId)` server-side |
| Audit log stores PII (email, phone, full body) | Log file = PII spill if breached | Hash identifiers; reference webhook_event_id; no raw payment bodies |
| CSP missing | XSS, clickjacking | CSP whitelisting Kinescope, Supabase, ЮKassa, Sentry; report-only first |
| No rate limit on `/api/checkout/create` | Bot floods create-payment, exhausts ЮKassa quota | Upstash ratelimit 10/min/user |
| No rate limit on captcha-protected endpoints | Captcha tokens reused | Per-token UNIQUE in captcha-verification helper |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No clear error message on payment failure | User doesn't know if money was taken; spams support | Distinct screens for: cancelled-by-user, card-declined, processing-still-running |
| Confirmation email lands in spam | User can't register | Custom SMTP + SPF/DKIM/DMARC; include "проверьте папку Спам" text |
| Lesson video doesn't autoplay → user thinks it's broken | High bounce on lesson page | Click-to-play with prominent play button; explicit "Начать урок" CTA |
| Right-click disabled annoys legitimate users (e.g. inspecting URL to share with support) | Friction, perceived hostility | Don't disable; rely on real protections |
| Account deletion is one click without confirmation | Accidental deletion → 30-day countdown of regret | Two-step: password re-entry + checkbox + 14-day grace before hard delete |
| Russian-localised dates/currencies show as `$9.99` or `5/22/2026` | Looks unprofessional | `Intl.NumberFormat('ru-RU', {style:'currency', currency:'RUB'})` + `Intl.DateTimeFormat('ru-RU')` |
| Phone number field without mask | Users enter inconsistent formats; fail validation | Use `react-imask` or similar with `+7 (___) ___-__-__` |
| No "купить в 1 клик" on returning users | High friction → cart abandonment | Pre-fill email if logged in; remember selected plan |
| Video shows seek bar but seeking past unwatched section is blocked silently | Confusion | Either allow free seeking, or show a clear lock icon with explanation |
| Logout doesn't redirect, user stays on now-broken protected page | Confusion / errors | `signOut()` + explicit `redirect('/')` |
| Password rules not shown until submit | Frustration on repeated failures | Show rules + live validation as user types |
| Long load time on payment screen with no spinner | User clicks "Купить" twice → maybe two charges | Disable button + show spinner immediately on click |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Webhook handler:** Often missing idempotency table — verify `INSERT … ON CONFLICT DO NOTHING` returns 200 on retry without re-applying side effects (test by replaying a payload).
- [ ] **Webhook handler:** Often missing signature verification — verify with a tampered body that handler returns 401.
- [ ] **Create-payment server action:** Often trusts client `amount` — verify Zod schema has no `amount` field and DB lookup is mandatory.
- [ ] **ЮKassa receipt:** Often missing `customer.email` — verify in ЛК ЮKassa "Чеки" tab that a real receipt was issued for sandbox payment.
- [ ] **RLS policy:** Often `FOR UPDATE` without `WITH CHECK` — verify with a test that user A cannot update a row to set `user_id = B`.
- [ ] **RLS policy:** Often `auth.uid()` not wrapped in subquery — verify EXPLAIN doesn't show per-row function call.
- [ ] **Supabase service-role client:** Often missing `import 'server-only'` — verify build fails when imported from a Client Component.
- [ ] **Consent capture:** Often only timestamp stored — verify `user_consents` row has IP, UA, policy_version.
- [ ] **Account deletion:** Often soft-delete only — verify cron job exists and Storage cleanup runs.
- [ ] **Email setup:** Often uses Supabase default SMTP — verify SMTP settings point to custom provider with valid SPF/DKIM/DMARC.
- [ ] **Kinescope embed:** Often whitelist contains `*` or `localhost` — verify production whitelist is your domain only.
- [ ] **Signed video URL:** Often cached client-side — verify Network tab shows fresh `getSignedUrl` call on each lesson page load.
- [ ] **Lesson access:** Often checks login only, not purchase — verify a logged-in user without purchase sees 403/redirect on `/lessons/[id]`.
- [ ] **JWT settings:** Often raised TTL — verify Supabase Auth settings still show 1h access / 30d refresh.
- [ ] **Migrations:** Often applied directly to prod — verify staging branch exists and was used.
- [ ] **Indexes:** Often missing on `lesson_progress(user_id)` — verify `EXPLAIN ANALYZE` uses index scan.
- [ ] **Sentry:** Often default config — verify `beforeSend` strips PII.
- [ ] **Vercel region:** Often default `iad1` — verify `fra1` is set.
- [ ] **CSP header:** Often missing — verify `Content-Security-Policy` response header includes Kinescope, Supabase, ЮKassa.
- [ ] **E2E test:** Often "manual smoke only" — verify `tests/e2e/payment.spec.ts` runs in CI.
- [ ] **Backups:** Often Free tier (no PITR) — verify Supabase project is on Pro tier.
- [ ] **RKN registration:** Often deferred — verify confirmation letter received before launch.
- [ ] **Privacy / Offer / Terms pages:** Often missing or generic — verify wording reviewed by lawyer, version stamped in DB.
- [ ] **Yandex SmartCaptcha:** Often only client widget rendered, not server-validated — verify server response on tampered token.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Webhook double-delivery (Pitfall 1) | LOW | Add `webhook_events` table + retroactively dedupe by querying `purchases` for duplicate `external_id`, soft-delete extras, refund affected users with apology email. |
| Signature not verified, fake payments accepted (Pitfall 2) | HIGH | (1) Deploy signature verification immediately. (2) Audit all `purchases` since launch against ЮKassa ЛК real payments; revoke fraudulent grants. (3) Notify users of access changes. (4) Incident post-mortem. |
| Client-supplied price exploited (Pitfall 3) | HIGH | (1) Fix code immediately. (2) Audit all payments below expected price points. (3) Reverse access for underpaid courses or accept loss with apology. |
| 54-ФЗ receipt missing (Pitfall 4) | MEDIUM | (1) Enable fiscalization in ЛК ЮKassa. (2) Manually issue missing receipts via ЮKassa support form. (3) Update legal pages if needed. |
| Service-role key leaked (Pitfall 12) | CRITICAL | (1) Rotate key in Supabase ЛК immediately. (2) Redeploy app with new key from env. (3) Audit DB logs for the leak window for suspicious queries. (4) Notify affected users if PII access detected. (5) Document incident. |
| 152-ФЗ violation discovered post-launch (Pitfall 13) | HIGH | (1) Stop primary collection on foreign DB. (2) Migrate PII to RF-hosted DB. (3) Submit RKN notification with corrective action. (4) Legal counsel. Cost: potentially weeks of dev + fines. |
| Mass refund cascade because lesson links shared (Pitfall 32) | MEDIUM | (1) Add purchase check to lesson page. (2) Invalidate all current signed URLs (rotate Kinescope token). (3) Decide whether to refund "victims" who shared the link (case by case). |
| Migration DROP COLUMN regrettable (Pitfall 25) | HIGH | (1) Restore via Supabase PITR (Pro tier only — Free tier = data gone). (2) If no PITR: try logical replication catch-up; usually impossible. (3) Notify affected users. |
| Mail.ru deliverability broken (Pitfall 17) | LOW–MED | (1) Add SPF/DKIM/DMARC records, wait 24h. (2) Manually resend confirmations to unconfirmed Mail.ru users via different provider. (3) Reply to "did not receive" support emails with manual confirmation token. |
| Vercel cold start tanks conversion (Pitfall 31) | LOW | (1) Change region to `fra1`. (2) Add loading state to payment button. (3) If still bad: move heavy server actions to Edge runtime where possible. |
| RLS leak (Pitfall 10, 11) | HIGH | (1) Audit which rows were leaked (Supabase query logs). (2) Fix policy. (3) Notify users per 152-ФЗ breach notification rules (within 24h of confirmation to RKN, within 72h to affected users). |

---

## Pitfall-to-Phase Mapping

How M1 phases should address these pitfalls.

| # | Pitfall | Prevention Phase | Verification |
|---|---------|------------------|--------------|
| 1 | ЮKassa webhook double-delivery | P3 | Integration test: replay same payload, single purchase row |
| 2 | ЮKassa webhook signature missing | P3 | Unit test: tampered body returns 401 |
| 3 | Client-supplied price trusted | P3 | Unit test: action ignores client `amount` |
| 4 | 54-ФЗ receipt missing | P3 + P6 | Manual: ЮKassa ЛК shows receipt for sandbox payment |
| 5 | Subscription vs one-time confusion | P3 | Code review + assertion test on payload shape |
| 6 | Refund accounting drift | P3 | Integration test: partial vs full refund access behaviour |
| 7 | Kinescope signed URL leak | P4 | Code review: no persistence; Sentry breadcrumb scrub configured |
| 8 | Right-click theatre | P4 | Threat model doc in `docs/security-threat-model.md`; no anti-features added |
| 9 | Kinescope referrer / domain whitelist | P4 + P6 | Playwright smoke loads lesson page; CSP audit |
| 10 | RLS USING vs WITH CHECK | P0 + P1 + P2 + P3 | RLS test suite per `database/SKILL.md` for every table |
| 11 | `auth.uid()` performance trap | P0 + every migration | EXPLAIN ANALYZE check on 10k-row dataset |
| 12 | Service-role key leak | P0 | Build grep: `service_role` absent from `.next/static/` |
| 13 | 152-ФЗ data localisation | P0 (architecture) + P5 + P6 | Architecture doc + RKN registration receipt |
| 14 | Consent without versioning | P1 + P5 | DB inspection: `user_consents` row has IP, UA, version |
| 15 | Soft-delete only | P5 | Integration test: user requests deletion, scheduled job hard-deletes |
| 16 | Supabase email throttle | P1 | Custom SMTP configured before P1 ships |
| 17 | RU email deliverability | P0 (DNS) + P1 | Mail.ru / Yandex postmaster tools show good reputation; send to live RU addresses |
| 18 | Long JWT TTL | P1 | Supabase ЛК settings audit |
| 19 | Realtime quota | P0 discipline | No realtime in M1 spec |
| 20 | `useSearchParams` Suspense | P1 + P3 | `npm run build` in CI |
| 21 | Server-only import leak | P0 | Build error if violated |
| 22 | Middleware bundle size | P0 + P6 | CI check on `.next/server/middleware*.js` size |
| 23 | Solo dev cuts safety nets | P0 + P6 | Pro tier enabled; Sentry wired; E2E test exists; runbook written |
| 24 | Solo dev over-builds | Across M1 | PR alignment to PROJECT.md Active stories |
| 25 | Migration without backup | P0 + every phase | Staging branch usage; no DROP in M1 |
| 26 | Missing indexes | P2 + P3 + P4 | EXPLAIN check on key queries |
| 27 | Unbounded jsonb | P3 + P5 | pg_cron retention policy migration |
| 28 | N+1 queries | P2 + P5 | Supabase query log review; query count assertion in tests |
| 29 | Missing pagination | P2 + (M2 admin) | `.range()` enforced in queries |
| 30 | Large landing images | P2 + P6 | Lighthouse check |
| 31 | Vercel cold start RU | P0 + P6 | `vercel.json` region: `fra1`; RU IP perf test |
| 32 | Lesson link sharing | P4 | Integration test: logged-in non-purchaser blocked on `/lessons/[id]` |

---

## Pre-Launch Critical Path (HIGH severity items mapped to Core Value)

The minimum bar before serving the first paying RU user. Anything missing here = do not launch.

1. **Payment correctness** (Pitfalls 1, 2, 3, 4, 6): webhook idempotency + signature + server-side pricing + 54-ФЗ receipt + refund flow.
2. **Access correctness** (Pitfalls 10, 32): RLS with WITH CHECK + server-side purchase verification on lesson pages.
3. **Video protection — real, not theatre** (Pitfalls 7, 8, 9): signed URL with short TTL + watermark + domain whitelist + no client persistence.
4. **Secret hygiene** (Pitfall 12): service-role behind `server-only`; build grep clean.
5. **152-ФЗ baseline** (Pitfalls 13, 14, 15): data architecture documented; consent captured with evidence; deletion flow implemented; RKN notified.
6. **Email deliverability** (Pitfalls 16, 17): custom SMTP + SPF/DKIM/DMARC + tested against Mail.ru and Yandex.
7. **Safety nets** (Pitfall 23): Supabase Pro tier + Sentry + Playwright E2E smoke + deploy rollback runbook.

---

## Sources

- ЮKassa webhook docs — [yookassa.ru/developers/using-api/webhooks](https://yookassa.ru/developers/using-api/webhooks) (HIGH confidence — official)
- CVE-2025-48757 / Supabase RLS leak analysis — [vibeappscanner.com/supabase-row-level-security](https://vibeappscanner.com/supabase-row-level-security) and [supabase.com/blog/supabase-security-2025-retro](https://supabase.com/blog/supabase-security-2025-retro) (HIGH — verified across multiple sources including Supabase official 2025 security retro)
- Supabase RLS performance — [supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) (HIGH — official)
- Supabase migration rollback — [supabase.com/docs/guides/deployment/database-migrations](https://supabase.com/docs/guides/deployment/database-migrations); [storyie.com/blog/drizzle-migration-supabase-production](https://storyie.com/blog/drizzle-migration-supabase-production) (HIGH/MED — official + practitioner)
- Next.js `useSearchParams` Suspense — [nextjs.org/docs/messages/missing-suspense-with-csr-bailout](https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout); [github.com/vercel/next.js/issues/74494](https://github.com/vercel/next.js/issues/74494) (HIGH — official + current issue)
- Next.js hydration mismatch with auth — [nextjs.org/docs/messages/react-hydration-error](https://nextjs.org/docs/messages/react-hydration-error) (HIGH — official)
- Kinescope DRM / piracy protection — [kinescope.com/blog/video-drm-protection-guide-2026](https://www.kinescope.com/blog/video-drm-protection-guide-2026); [kinescope.com/blog/how-to-protect-online-course-videos-from-piracy](https://www.kinescope.com/blog/how-to-protect-online-course-videos-from-piracy) (HIGH — vendor official)
- Kinescope downloader bypass tool — [github.com/anijackich/kinescope-dl](https://github.com/anijackich/kinescope-dl) (HIGH — confirms referrer-only protection is bypassable)
- Screen recording protection limits — [vdocipher.com/blog/screen-capture-block-video](https://www.vdocipher.com/blog/screen-capture-block-video); [inkryptvideos.com/screen-recording-protection-with-drm-in-2025/](https://inkryptvideos.com/screen-recording-protection-with-drm-in-2025/) (MED — practitioner)
- Service-role key leak postmortems — [vibeappscanner.com/vulnerability-in/api-key-exposure-supabase-apps](https://vibeappscanner.com/vulnerability-in/api-key-exposure-supabase-apps); [labs.cognisys.group/posts/Supabase-Leaks-What-We-Found/](https://labs.cognisys.group/posts/Supabase-Leaks-What-We-Found/) (HIGH — security research)
- 152-ФЗ July 2025 localisation — [comply.ru/tpost/c43ezsout1-lokalizatsiya-i-transgranichnaya-peredac](https://comply.ru/tpost/c43ezsout1-lokalizatsiya-i-transgranichnaya-peredac); [b-152.ru/hranenie-personalnyh-dannyh-za-granicej](https://b-152.ru/hranenie-personalnyh-dannyh-za-granicej); [habr.com/ru/companies/cloud4y/articles/949628/](https://habr.com/ru/companies/cloud4y/articles/949628/) (HIGH — Russian legal practitioner sources)
- 152-ФЗ official text — [consultant.ru/document/cons_doc_LAW_61801](https://www.consultant.ru/document/cons_doc_LAW_61801) (HIGH — official)
- Yandex DMARC / SPF / DKIM — [knowledge.ondmarc.redsift.com/en/articles/1962212-yandex-spf-and-dkim-set-up](https://knowledge.ondmarc.redsift.com/en/articles/1962212-yandex-spf-and-dkim-set-up); [mxtoolbox.com/c/outboundemailsources?public=Yandex-Mail](https://mxtoolbox.com/c/outboundemailsources?public=Yandex-Mail) (MED — practitioner)
- Vercel + Supabase cold starts — [kuberns.com/blogs/vercel-supabase/](https://kuberns.com/blogs/vercel-supabase/); [supabase.com/blog/introducing-supabase-server](https://supabase.com/blog/introducing-supabase-server) (MED — vendor + practitioner)
- Project skills (internal) — `.claude/skills/security/SKILL.md`, `.claude/skills/database/SKILL.md`, `.claude/skills/testing/SKILL.md`, `.planning/codebase/CONCERNS.md`, `.planning/PROJECT.md` (HIGH — project canonical)

---

*Pitfalls research for: VideoEdit Academy (paid LMS, RU/CIS, solo dev MVP)*
*Researched: 2026-05-24*
