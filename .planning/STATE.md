# State: VideoEdit Academy

**Initialized:** 2026-05-24
**Last updated:** 2026-05-24 (roadmap revised 6 → 7 phases, dev-first / prod-last)

---

## Project Reference

**Project:** VideoEdit Academy (code: `VEA`)
**Reference doc:** `.planning/PROJECT.md`
**Core Value:** Купивший пользователь должен иметь возможность смотреть оплаченный курс без перебоев и без возможности скачать видео.
**Current focus:** Bootstrap Phase 1 (Dev Foundations) — settle env-parser, service_role boundary, audit_log, RLS test harness, Sentry SDK with dev-DSN. Production-grade gates (Supabase Pro, custom domain, юрист sign-off) intentionally deferred to Phase 7 to unblock dev work from external lead-times.

---

## Current Position

**Milestone:** v1.0-mvp (M1, ~4–6 недель разработки + ~1–1.5 недели production prep)
**Current phase:** 1 — Dev Foundations
**Current plan:** none (roadmap revised; awaiting `/gsd:plan-phase 1`)
**Status:** Not started
**Progress:**
```
[░░░░░░░░░░░░░░░░░░░░] 0/7 phases · 0/84 requirements
```

> **Note on P7:** Phase 7 (Production Launch Prep) is a release-gate phase — mostly checklist work, not code. It bundles all production-prep items (Supabase Pro+PITR, Vercel fra1, custom domain + DNS, custom SMTP + deliverability evidence, ЮKassa prod, RKN notification, юрист sign-off, prod deploy, security checklist, financial smoke test on 1₽). Stylistically still part of the v1.0-mvp milestone — the public launch happens after P7. P1–P6 deliver feature-complete product on dev-стенде (Supabase free, ЮKassa sandbox, Supabase default SMTP, preview URLs) which can be demoed to friends, beta testers, or investors via preview-URL before P7 kicks in.

---

## Performance Metrics

| Metric | Target | Current |
|---|---|---|
| Phases complete | 7/7 | 0/7 |
| v1 requirements complete | 84/84 | 0/84 |
| HIGH-severity pitfalls prevented | 13/13 | 0/13 (none reached yet) |
| Compliance gates closed (COMP-01..06) | 6/6 | 0/6 (all in P7) |
| E2E critical-path test passing | yes | no (not yet written, target P6 against ЮKassa sandbox) |
| Feature-complete on dev-стенде (post-P6 demo readiness) | yes | no |
| Production launch ready (post-P7) | yes | no |
| Estimated weeks elapsed | 5–7.5 | 0 |

---

## Accumulated Context

### Decisions (from PROJECT.md Key Decisions + research + 2026-05-24 restructure)

- Split product into M1 (MVP) + M2 (admin + full marketing) — 4-6 weeks for full v1 solo unrealistic
- Vertical MVP: every phase is a slice through DB / server / client / test (`project_mode=mvp`)
- Quality (Opus) model profile for planning agents (security/compliance cost of mistakes is high)
- ЮKassa as sole payment provider (no Stripe/Paddle — sanctions); Kinescope as sole video host (private signed URL)
- Admin panel deferred to M2 (one course via SQL seed in MVP)
- Unisender / marketing email deferred to M2 (transactional via Supabase Auth + custom SMTP in M1 P7)
- Sentry SaaS replaced by self-hosted GlitchTip/Bugsink (Sentry SaaS blocked for RU since 2024-09-10)
- Vercel `fra1` region (not default `iad1`) for ~150ms latency reduction to RU
- **(NEW 2026-05-24) Dev-first / prod-last restructure**: 6 phases → 7 phases. Production-prep concerns (Supabase Pro+PITR, custom domain + DNS, custom SMTP, ЮKassa prod, RKN, юрист sign-off, prod deploy) moved out of P1/P2/P3/P6 into a new dedicated Phase 7. Rationale: external lead-times (юрист 1-2 weeks, ЮKassa prod 1-3 days, DNS 24-48h, RKN form 1-3 days) blocked dev work in the original ordering. New ordering: P1–P6 build feature-complete product on dev-стенде (Supabase free, ЮKassa sandbox, Supabase default SMTP, preview URLs); P7 swaps env-vars + closes compliance gates for public launch.

### Open Decisions (from research/SUMMARY.md Open Questions)

#### Resolve in Phase 1 (dev-only)
8. Self-hosted error monitoring backend: GlitchTip vs Bugsink — P1 dev-DSN setup (prod instance in P7)
9. Upstash RU availability test — P1; fallback to Postgres rate-limiter
12. Single fixed price for M1 (no tiers, no promo) — recommended, P1 confirm
14. Realtime in M1? — recommendation NO (poll on visit only) — P1 confirm

#### Resolve in Phase 4/5 (research spikes)
1. ЮKassa webhook auth model — resolve via Phase 4 pre-phase spike (before P4 starts)
15. Kinescope JWT exact claim shape — resolve via Phase 5 pre-phase spike (before P5 starts)

#### Resolve in Phase 5–7 (parallel external tracks; start during P5)
2. 152-ФЗ architecture choice (dual-write vs Yandex Cloud migration vs documented risk) — юрист deliverable for P7 FOUND-09; start engagement during P5
3. Юр.форма: ИП vs самозанятый — resolve before ЮKassa prod application (PAY-01, P7); start during P5
4. Rosobrnadzor license held or planned — does not block M1, but copy in P2 must NOT mention tax deduction 13% until decided; finalise before P7 prod
5. ЮKassa account status (apply or connected?) — start applying during P5 (1-3 day lead → ready by P7)
6. Custom domain purchased? — start during P5 (24-48h DNS lead → ready by P7)
7. Custom SMTP provider: Unisender vs Selectel Mail vs Yandex Mail for Business — decide during P5; wire in P7
10. Vercel alpha vs immediate Yandex Cloud migration — decide in P7 escalation if `.ru` domain blocked at launch
11. Юрист for `/oferta` (template review vs full consultation) — start during P5, ~5-15k₽
13. Kinescope account + project_id + secret token — start during P5 spike (test-mode account is free, no KYC; production whitelist in P7)

### Todos (rolling)

- [ ] Resolve open decisions 8, 9, 12, 14 in Phase 1
- [ ] (Deferred to P5) Begin engaging юрист for `/oferta` review + 152-ФЗ architecture (1-2 week lead-time → ready by P7)
- [ ] (Deferred to P5) Start ЮKassa production application (1-3 day lead → ready by P7)
- [ ] (Deferred to P5) Set DNS for custom domain + SMTP provider (SPF/DKIM/DMARC, 24-48h propagation → ready by P7)
- [ ] (Deferred to P5) Register Kinescope test-mode account (free, instant) + plan production whitelist for P7
- [ ] (Deferred to P5) Decide and apply to RKN form (free, ~1-3 day processing → ready by P7)
- [ ] Run `/gsd:plan-phase 1` to decompose Phase 1 into plans

### Blockers

None currently. The roadmap is revised (6 → 7 phases, dev-first / prod-last); user can run `/gsd:plan-phase 1` to decompose Phase 1.

### Pre-phase Research Spikes (scheduled)

| Before | What | Output |
|---|---|---|
| Phase 4 | ЮKassa webhook auth model (HMAC vs IP vs path-secret) | `docs/research/yookassa-webhook-auth.md` with decision |
| Phase 5 | Kinescope private signed-URL JWT claim shape | `docs/research/kinescope-jwt-claims.md` with verified claims |

### Phase 7 External Tracks (start during P5/P6 to avoid blocking)

To keep P7 close to 1–1.5 weeks calendar, these external lead-time items should be **kicked off during P5 or earlier** so the artifacts are ready when P7 starts:

| Track | Lead-time | Owner | Kick-off |
|---|---|---|---|
| Юрист (privacy/oferta review + 152-ФЗ architecture sign-off) | 1-2 weeks | External | P5 day 1 |
| ЮKassa production shop registration (offerta URL + ИП reqs) | 1-3 days | Solo dev | P5 mid-phase |
| Custom domain purchase + DNS records (SPF/DKIM/DMARC) | 24-48h propagation | Solo dev | P5 end / P6 start |
| Custom SMTP provider account (Unisender / Selectel) | Hours-days | Solo dev | P5 end |
| RKN «Уведомление об обработке ПДн» submission | 1-3 days processing | Solo dev + юрист (for оператор reqs) | P6 mid |
| Supabase Pro upgrade ($25/mo) | Instant (paid resource) | Solo dev | P7 start |

---

## Session Continuity

### Last session ended

State was initialized 2026-05-24; roadmap was revised the same day (6 → 7 phases, dev-first / prod-last restructure). No work sessions yet.

### Next session should

1. Read `.planning/PROJECT.md` (Core Value + Constraints)
2. Read `.planning/ROADMAP.md` (updated 7-phase structure with split FOUND/PAY/OPS allocations)
3. Read `.planning/REQUIREMENTS.md` (FOUND-02/03/04/05/06/10 for Phase 1 scope — note: FOUND-01/07/08/09 deferred to Phase 7)
4. Read `.planning/research/SUMMARY.md` (build-order rationale) + `.planning/research/PITFALLS.md` (HIGH-severity items #10, #12, #21, #22 — addressed in Phase 1; #13, #16, #17 — deferred to Phase 7)
5. Run `/gsd:plan-phase 1` to derive Phase 1 plans

### Conventions to follow

- Project skills live in `.claude/skills/` (videoedit-academy, database, api-conventions, ui-conventions, security, testing, workflow) — load `SKILL.md` lightweight indices first, descend to `rules/*.md` as needed
- Project codebase map: `.planning/codebase/{STACK,INTEGRATIONS,ARCHITECTURE,STRUCTURE,CONVENTIONS,TESTING,CONCERNS}.md`
- Migrations: timestamp-prefixed UTC, never DROP in M1 (PITFALL #25)
- Server-only modules start with `import 'server-only'` first line (PITFALL #12)
- All RLS UPDATE policies need BOTH `USING` and `WITH CHECK` (PITFALL #10)
- **Dev-stenв convention (P1–P6):** ЮKassa env vars point to sandbox; Sentry DSN points to dev instance; Supabase URL points to free-tier project; SMTP = Supabase default. **Production cutover (P7):** env-var swap to prod credentials, DNS cutover, financial smoke test.

---

## Phase Transition Log

| Date | From | To | Notes |
|---|---|---|---|
| 2026-05-24 | — | Phase 1 (planned, original 6-phase roadmap) | Roadmap initialized |
| 2026-05-24 | (revision) | Phase 1 (planned, 7-phase roadmap) | Restructured to 7 phases: dev-first (P1-P6 on Supabase free + ЮKassa sandbox + Supabase default SMTP + preview URLs) / prod-last (P7 = production launch prep with Pro tier, custom domain, custom SMTP, ЮKassa prod, RKN, юрист sign-off, financial smoke test). Unblocks dev from external lead-times. Awaiting `/gsd:plan-phase 1`. |

---

*State initialized: 2026-05-24*
*State updated: 2026-05-24 — 6 → 7 phase restructure (dev-first / prod-last)*
