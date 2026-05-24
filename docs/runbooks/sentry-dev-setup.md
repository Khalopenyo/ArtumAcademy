# Runbook: Local Sentry / Bugsink dev setup (FOUND-06)

> **Audience:** any VideoEdit Academy developer who needs to capture and
> inspect errors emitted by `@sentry/nextjs` during local development.
> **Outcome:** A running self-hosted error monitor reachable at
> `http://localhost:8000`, a DSN wired into your `.env.local`, and a
> 30-second acceptance check that proves end-to-end delivery.

---

## What this is

Phase 1 (plan-05) installed `@sentry/nextjs@^8` and wired three Sentry
config files at repo root + `withSentryConfig` in `next.config.js`. The
SDK is configured to be a **graceful no-op** when `SENTRY_DSN` is empty,
so the app starts even without a backend.

This runbook points that SDK at a **local, self-hosted error monitor**
so you can observe what would be sent to production GlitchTip/Bugsink in
P7. We pick a self-hosted backend on purpose — **Sentry SaaS is
Sanctions-affected and unavailable for the RU market** (see
`.planning/research/STACK.md`).

> **N.B.** plan-01's Zod schema (`src/env.ts`) declares `SENTRY_DSN` and
> `NEXT_PUBLIC_SENTRY_DSN` as **required** at runtime boot. You MUST fill
> them in `.env.local` even for local dev — otherwise `next dev` exits
> with `ZodError` before serving the first request. The `silent: !DSN`
> flag in `next.config.js` only guards the `next build` path, not boot.

---

## Why two options (and which to pick)

| Backend       | Containers           | Storage          | Setup time | Use for                    |
|---------------|----------------------|------------------|-----------:|----------------------------|
| **Bugsink**   | 1 (single image)     | SQLite (default) | ~2 minutes | **Dev (recommended)**      |
| **GlitchTip** | 4 (web/worker/db/redis) | Postgres + Redis | ~10 minutes | Staging / P7 prod parity |

Both speak the Sentry v7 protocol that `@sentry/nextjs@^8` ships. Use
Bugsink for everyday dev — it's a single `docker run` and fits a laptop.
Use GlitchTip when you need to validate the deploy you'll actually ship.

---

## Bugsink setup (recommended for dev)

### 1. Run the container

```bash
docker run -d \
  --name bugsink \
  -p 8000:8000 \
  -e SECRET_KEY=$(openssl rand -hex 32) \
  -e CREATE_INITIAL_SUPERUSER=1 \
  bugsink/bugsink:latest
```

Wait ~10 seconds for the first-boot migrations. Verify:

```bash
docker ps | grep bugsink
curl -sf http://localhost:8000/ >/dev/null && echo "up" || echo "down"
```

### 2. Create admin + project

1. Open `http://localhost:8000` in a browser.
2. Sign in with the bootstrap admin credentials printed in
   `docker logs bugsink | grep -i 'superuser\|password'` (or set
   `INITIAL_SUPERUSER_USERNAME` / `INITIAL_SUPERUSER_PASSWORD` env vars
   on the `docker run` line).
3. Create a Team → Project (any name; e.g. `videoedit-academy-dev`).
4. Copy the DSN. Format:

   ```
   http://<key>@localhost:8000/<projectId>
   ```

### 3. Wire it into `.env.local`

Append (or overwrite the empty stubs from `.env.example`):

```bash
SENTRY_DSN=http://<key>@localhost:8000/1
NEXT_PUBLIC_SENTRY_DSN=http://<key>@localhost:8000/1
```

> Use the **same DSN** for both server and client in dev — the project
> doesn't separate them locally. In prod (P7) they'll point at the same
> self-hosted instance too, but the public/server split is preserved so
> we never leak a server-only key into the client bundle.

---

## GlitchTip setup (alternative — staging / P7 parity)

GlitchTip needs `docker-compose` with Postgres + Redis + web + worker.
Follow the upstream `docker-compose.yml` from
<https://glitchtip.com/documentation/install> verbatim, then mint a DSN
through the same UI flow as Bugsink (step 2 above). The DSN format is
identical.

We **do not commit a docker-compose for either** to this repo — infra
provisioning lives in P7. Devs run whichever they prefer; the SDK
doesn't care which side answers.

---

## Verification (the 30-second acceptance check)

This is the concrete, single-path invocation the plan calls out (plan-05
Task 8 / Fix 8 — no ambiguity, no "navigate somewhere and click").

### Prerequisites

- Bugsink (or GlitchTip) running on `http://localhost:8000`.
- `.env.local` has `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` populated.

### Trigger

```bash
npx tsx scripts/sentry-test.ts
```

The script imports `_sentryTestAction()`, captures one synthetic
`Error('Phase 1 sentry verification — ignore me')`, and `Sentry.flush(2000)`
to guarantee delivery before exit.

### Expected within 30 seconds

Open the Bugsink/GlitchTip dashboard → Issues → you should see:

> **Phase 1 sentry verification — ignore me** — 1 event, just now.

That's the entire acceptance gate for FOUND-06.

---

## Troubleshooting

| Symptom                                      | Cause / fix                                                                                          |
|----------------------------------------------|------------------------------------------------------------------------------------------------------|
| `ECONNREFUSED localhost:8000`                | Bugsink container not running. `docker ps \| grep bugsink`. Restart with `docker start bugsink`.    |
| `next dev` exits with `ZodError: SENTRY_DSN` | DSN missing in `.env.local`. The Zod schema requires both DSNs at boot. Fill them per the format above. |
| DSN format error in Sentry SDK logs          | Must be exactly `http://<key>@host:port/<projectId>` — no trailing slash, no path beyond the project ID. |
| CORS errors on client-side capture           | Bugsink must be on `localhost:8000` (same origin family as `localhost:3000`). If you put it elsewhere, configure CORS allowlist in Bugsink admin. |
| No event arrives, no error logged            | Check `enabled: !!process.env.SENTRY_DSN` — DSN must be **non-empty** at boot. Restart `next dev` after editing `.env.local`. |
| `next build` warns about source-map upload   | Expected in P1 — `authToken` is intentionally commented in `next.config.js`. P7 wires it for prod.    |
| `npx tsx scripts/sentry-test.ts` script not found | The temp script is created in plan-05 task 7b and **deleted at phase close** (task 8). After P1 closes, re-create from RESEARCH.md §Pattern 4 lines 646–656 or use a Server Action you're already debugging. |

---

## Phase close cleanup

Once you've observed the verification event:

1. Take a screenshot of the issue in Bugsink/GlitchTip.
2. (Optional) Save it to `docs/compliance/sentry-dev-verification.png`
   for future audit reference.
3. Delete both temporary files (plan-05 task 8):
   - `src/server/actions/_sentry-test.ts`
   - `scripts/sentry-test.ts`
4. Commit the deletion: `chore(1-05): remove temporary Sentry test action + script after FOUND-06 verified`.

The remaining wiring (config files, `withSentryConfig`, instrumentation
hook, env-var slot) stays — that's what FOUND-06 ships.

---

## See also

- `.planning/phases/1-dev-foundations/RESEARCH.md` §Pattern 4 — the
  upstream snippets these files are copied from.
- `.planning/phases/1-dev-foundations/plans/plan-05-sentry-dev-dsn.md` —
  the plan that produced this runbook.
- `.claude/skills/security/SKILL.md` §1 — secret-handling rules; the
  `beforeSend` hook in `sentry.server.config.ts` is a defense-in-depth
  layer on top of pino's redaction (FOUND-04).
