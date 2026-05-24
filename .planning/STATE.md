# State: VideoEdit Academy

**Initialized:** 2026-05-24
**Last updated:** 2026-05-24

---

## Project Reference

**Project:** VideoEdit Academy (code: `VEA`)
**Reference doc:** `.planning/PROJECT.md`
**Core Value:** Купивший пользователь должен иметь возможность смотреть оплаченный курс без перебоев и без возможности скачать видео.
**Current focus:** Bootstrap Phase 1 (Foundations & Compliance Setup) — settle env-parser, service_role boundary, audit_log, RLS test harness, 152-ФЗ architecture decision before any feature phase begins.

---

## Current Position

**Milestone:** v1.0-mvp (M1, 4–6 weeks solo)
**Current phase:** 1 — Foundations & Compliance Setup
**Current plan:** none (roadmap just initialized; awaiting `/gsd:plan-phase 1`)
**Status:** Not started
**Progress:**
```
[░░░░░░░░░░░░░░░░░░░░] 0/6 phases · 0/84 requirements
```

---

## Performance Metrics

| Metric | Target | Current |
|---|---|---|
| Phases complete | 6/6 | 0/6 |
| v1 requirements complete | 84/84 | 0/84 |
| HIGH-severity pitfalls prevented | 13/13 | 0/13 (none reached yet) |
| Compliance gates closed (COMP-01..06) | 6/6 | 0/6 |
| E2E critical-path test passing | yes | no (not yet written) |
| Estimated weeks elapsed | 4–6 | 0 |

---

## Accumulated Context

### Decisions (from PROJECT.md Key Decisions + research)

- Split product into M1 (MVP) + M2 (admin + full marketing) — 4-6 weeks for full v1 solo unrealistic
- Vertical MVP: every phase is a slice through DB / server / client / test (`project_mode=mvp`)
- Quality (Opus) model profile for planning agents (security/compliance cost of mistakes is high)
- ЮKassa as sole payment provider (no Stripe/Paddle — sanctions); Kinescope as sole video host (private signed URL)
- Admin panel deferred to M2 (one course via SQL seed in MVP)
- Unisender / marketing email deferred to M2 (transactional via Supabase Auth + custom SMTP in M1)
- Sentry SaaS replaced by self-hosted GlitchTip/Bugsink (Sentry SaaS blocked for RU since 2024-09-10)
- Vercel `fra1` region (not default `iad1`) for ~150ms latency reduction to RU

### Open Decisions (from research/SUMMARY.md Open Questions — must resolve in Phase 1)

1. ЮKassa webhook auth model — resolve via Phase 4 pre-phase spike (before P4 starts)
2. 152-ФЗ architecture choice (dual-write vs Yandex Cloud migration vs documented risk) — resolve in Phase 1, requires юрист
3. Юр.форма: ИП vs самозанятый — resolve in Phase 1 before ЮKassa application
4. Rosobrnadzor license held or planned — does not block M1, but copy in Phase 2 must NOT mention tax deduction 13% until decided
5. ЮKassa account status (apply or connected?) — start in Phase 1 (1–3 day lead)
6. Custom domain purchased? — Phase 1 (24-48h DNS lead)
7. Custom SMTP provider: Unisender vs Selectel Mail vs Yandex Mail for Business — Phase 1
8. Self-hosted error monitoring backend: GlitchTip vs Bugsink — Phase 1 ops sub-task
9. Upstash RU availability test — Phase 1; fallback to Postgres rate-limiter
10. Vercel alpha vs immediate Yandex Cloud migration — Phase 1 escalation if `.ru` domain needed at launch
11. Юрист for `/oferta` (template review vs full consultation) — Phase 1, ~5-15k₽
12. Single fixed price for M1 (no tiers, no promo) — recommended, Phase 1 confirm
13. Kinescope account + project_id + secret token — start Phase 1
14. Realtime in M1? — recommendation NO (poll on visit only) — Phase 1 confirm
15. Kinescope JWT exact claim shape — resolve via Phase 5 pre-phase spike (before P5 starts)

### Todos (rolling)

- [ ] Resolve open decisions 2, 3, 7, 8, 9, 10, 11, 14 in Phase 1 (planning blocker)
- [ ] Begin ЮKassa application (1-3 day lead) — Phase 1 day 1
- [ ] Set DNS for custom SMTP (SPF/DKIM/DMARC, 24-48h lead) — Phase 1 day 1
- [ ] Engage юрист for `/oferta` + 152-ФЗ architecture review — Phase 1 day 1
- [ ] Kinescope account application — Phase 1 day 1 (lead time before Phase 5 spike)
- [ ] Run `/gsd:plan-phase 1` to decompose Phase 1 into plans

### Blockers

None currently. The roadmap is created; user should approve and then run `/gsd:plan-phase 1` (or whatever planning workflow the project uses) to decompose Phase 1.

### Pre-phase Research Spikes (scheduled)

| Before | What | Output |
|---|---|---|
| Phase 4 | ЮKassa webhook auth model (HMAC vs IP vs path-secret) | `docs/research/yookassa-webhook-auth.md` with decision |
| Phase 5 | Kinescope private signed-URL JWT claim shape | `docs/research/kinescope-jwt-claims.md` with verified claims |

---

## Session Continuity

### Last session ended

State was initialized today (2026-05-24) immediately after roadmap creation. No work sessions yet.

### Next session should

1. Read `.planning/PROJECT.md` (Core Value + Constraints)
2. Read `.planning/ROADMAP.md` (phase structure)
3. Read `.planning/REQUIREMENTS.md` (FOUND-01..10 for Phase 1 scope)
4. Read `.planning/research/SUMMARY.md` (build-order rationale) + `.planning/research/PITFALLS.md` (HIGH-severity items #10, #12, #13, #21, #22, #23 — all addressed in Phase 1)
5. Run `/gsd:plan-phase 1` to derive Phase 1 plans

### Conventions to follow

- Project skills live in `.claude/skills/` (videoedit-academy, database, api-conventions, ui-conventions, security, testing, workflow) — load `SKILL.md` lightweight indices first, descend to `rules/*.md` as needed
- Project codebase map: `.planning/codebase/{STACK,INTEGRATIONS,ARCHITECTURE,STRUCTURE,CONVENTIONS,TESTING,CONCERNS}.md`
- Migrations: timestamp-prefixed UTC, never DROP in M1 (PITFALL #25)
- Server-only modules start with `import 'server-only'` first line (PITFALL #12)
- All RLS UPDATE policies need BOTH `USING` and `WITH CHECK` (PITFALL #10)

---

## Phase Transition Log

| Date | From | To | Notes |
|---|---|---|---|
| 2026-05-24 | — | Phase 1 (planned) | Roadmap initialized; awaiting `/gsd:plan-phase 1` |

---

*State initialized: 2026-05-24*
