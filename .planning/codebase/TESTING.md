# Testing Patterns

**Analysis Date:** 2026-05-23

> Repository is in early scaffold state. Only one real test file exists
> (`src/lib/utils.test.ts`) plus the Vitest setup at `tests/unit/setup.ts`.
> The patterns below come from `.claude/skills/testing/SKILL.md` (treated as
> mandatory project rules), the configured tooling (`vitest.config.ts`,
> `playwright.config.ts`, `package.json`), and the one real test as the
> reference implementation.

## Test Framework

**Unit / component runner — Vitest** (`package.json:74`, `vitest@^2.1.2`).
- Config: `vitest.config.ts`.
- Environment: `jsdom` (`vitest.config.ts:8`) — DOM is available without a
  browser.
- Globals: `true` (`vitest.config.ts:9`) — `describe`, `it`, `expect`, `vi`
  are available without imports, though the in-repo test still imports them
  explicitly (`src/lib/utils.test.ts:1`) and that is the preferred style.
- React plugin via `@vitejs/plugin-react` (`vitest.config.ts:2`).
- Path alias `@/*` → `./src/*` mirrors `tsconfig.json` so test imports look
  identical to source imports (`vitest.config.ts:13-17`).

**Component testing layer:**
- `@testing-library/react@^16.0.1`
- `@testing-library/user-event@^14.5.2`
- `@testing-library/jest-dom@^6.5.0` — extends `expect` with DOM matchers.
- `jsdom@^25.0.1` — DOM implementation.

**E2E runner — Playwright** (`package.json:52`, `@playwright/test@^1.48.0`).
- Config: `playwright.config.ts`.
- Test directory: `./tests/e2e` (`playwright.config.ts:4`).
- Default timeout: 30 s per test (`playwright.config.ts:5`).
- Parallelism: `fullyParallel: true`; on CI it drops to a single worker
  (`playwright.config.ts:6,9`).
- Retries: 2 on CI, 0 locally (`playwright.config.ts:8`).
- Reporter: `github` on CI, `html` locally (`playwright.config.ts:10`).
- `forbidOnly: !!process.env.CI` — `.only` blocks CI builds
  (`playwright.config.ts:7`).
- Base URL: `process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'`
  (`playwright.config.ts:12`).
- Browsers (`playwright.config.ts:16-19`):
  - `chromium` — `Desktop Chrome`.
  - `mobile-chrome` — `Pixel 5`.
- Trace: `on-first-retry`; screenshot: `only-on-failure`
  (`playwright.config.ts:13-14`).
- Dev server: locally Playwright runs `npm run dev` itself with
  `reuseExistingServer: true` and a 120 s startup timeout; on CI it expects an
  already-running server (`playwright.config.ts:20-27`).

**Integration runner — Vitest with a separate config**
(`package.json:19` references `vitest.integration.config.ts`). The config file
is not yet present in the repo; create it alongside the first integration
suite. Integration tests are deliberately excluded from the default unit run
via `vitest.config.ts:11` (`'tests/integration/**'`).

**Coverage — V8 provider** (`@vitest/coverage-v8@^2.1.2`,
`package.json:60`). Wired through `npm run test:coverage` (which runs
`vitest run --coverage`). No thresholds are encoded in `vitest.config.ts` yet
— enforcement is by the risk-based policy below, not by percentage.

## Test File Organization

**Layout under `tests/`** (`tests/` directory listing):
| Subdir | Holds | Runner |
|---|---|---|
| `tests/unit/` | Vitest setup file (`tests/unit/setup.ts`) and any test that cannot live next to its source. | Vitest (`npm run test`) |
| `tests/integration/` | Server Action / DB integration tests that hit the test Supabase project. Excluded from `vitest.config.ts`. | Vitest with `vitest.integration.config.ts` (`npm run test:integration`) |
| `tests/e2e/` | Playwright specs. Excluded from `vitest.config.ts`. | Playwright (`npm run test:e2e`) |

**Unit / component tests are colocated** next to their source as
`<Name>.test.ts(x)` (`.claude/skills/testing/SKILL.md:79`). Real example:
`src/lib/utils.test.ts` sits next to `src/lib/utils.ts`.

**Integration tests are colocated too**, using the
`<name>.integration.test.ts` suffix so the default Vitest exclude glob
(`tests/integration/**`) still lets the per-config include rule pick them up —
e.g. the skill template lives at
`src/server/actions/submissions.integration.test.ts`
(`.claude/skills/testing/SKILL.md:142`).

**Setup file** (`tests/unit/setup.ts`) wires:
- `@testing-library/jest-dom/vitest` matchers globally.
- `cleanup()` in `afterEach` to tear down rendered React trees.

Wired into Vitest via `vitest.config.ts:10` `setupFiles`.

## Naming

- Test file: `<SourceName>.test.ts` (utility/hook) or `<SourceName>.test.tsx`
  (component).
- Integration: `<SourceName>.integration.test.ts`.
- E2E: `<feature>.spec.ts` under `tests/e2e/` (Playwright convention; see
  `tests/e2e/registration.spec.ts` template at
  `.claude/skills/testing/SKILL.md:219`).
- `describe` block name = the unit under test (function name, component name,
  or scenario).
- `it`/`test` descriptions in **Russian** — present-tense, focused on observed
  behaviour. Real examples
  (`src/lib/utils.test.ts:5,9,15,19,23`):
  - `'форматирует целое число в рубли'`
  - `'не отображает копейки для целых сумм'`
  - `'объединяет классы строкой'`
  - `'фильтрует falsy значения'`
  - `'разрешает Tailwind-конфликты в пользу последнего'`

## Test Structure

**AAA — Arrange, Act, Assert.** One assertion per test where feasible
(`.claude/skills/testing/SKILL.md:82-83`).

**Real unit test** (`src/lib/utils.test.ts`):
```ts
import { describe, it, expect } from 'vitest';
import { formatPrice, cn } from './utils';

describe('formatPrice', () => {
  it('форматирует целое число в рубли', () => {
    expect(formatPrice(19900)).toMatch(/19\s?900/);
  });

  it('не отображает копейки для целых сумм', () => {
    expect(formatPrice(4900)).not.toContain(',00');
  });
});
```

**Component test pattern** (skill template,
`.claude/skills/testing/SKILL.md:91-126`):
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SubmitAssignmentForm } from './SubmitForm';

vi.mock('@/server/actions/submissions', async () => {
  const actual = await vi.importActual('@/server/actions/submissions');
  return { ...actual, submitAssignment: vi.fn() };
});

describe('SubmitAssignmentForm', () => {
  it('показывает ошибку, если ссылка пустая', async () => {
    const user = userEvent.setup();
    render(<SubmitAssignmentForm assignmentId="11111111-1111-1111-1111-111111111111" />);
    await user.click(screen.getByRole('button', { name: /отправить/i }));
    expect(await screen.findByText(/введите корректную ссылку/i)).toBeInTheDocument();
  });
});
```

Component-test rules
(`.claude/skills/testing/SKILL.md:128-134`):
1. Test **behaviour**, not implementation — never assert on classes.
2. Prefer `screen.getByRole` and accessible queries over `getByTestId`.
3. Use `userEvent.setup()` (not `fireEvent`).
4. Each test is independent; rely on the `afterEach(cleanup)` in
   `tests/unit/setup.ts`.

**Integration test pattern** (skill template,
`.claude/skills/testing/SKILL.md:141-182`):
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { submitAssignment } from './submissions';
import { testSupabase, createTestUser, createTestAssignment }
  from '@/tests/integration/setup';

describe('submitAssignment (integration)', () => {
  let userId: string;
  let assignmentId: string;

  beforeEach(async () => {
    userId = await createTestUser('test@example.com');
    assignmentId = await createTestAssignment();
  });

  it('создаёт submission в статусе pending', async () => {
    const result = await submitAssignment({ assignmentId, videoUrl: '...', comment: 'Готово' });
    expect(result.ok).toBe(true);
    // ...read back from testSupabase and assert
  });
});
```

## What's Mocked vs Hit Live

Project rule (`.claude/skills/testing/SKILL.md:8`):
> В проекте тесты пишутся к каждой фиче, не "потом покроем". Это явное
> требование.

Tests must be written **per feature**, not deferred to a "coverage sweep"
later.

| Layer | Mock or live? | Where |
|---|---|---|
| Pure utilities, Zod schemas | No mocks at all (`.claude/skills/testing/SKILL.md:84`). | `src/lib/utils.test.ts` |
| Component tests | Mock Server Actions imported from `@/server/actions/*` with `vi.mock(...)`; preserve real exports via `vi.importActual(...)`. | `.claude/skills/testing/SKILL.md:98-101` |
| Server Actions / queries (integration) | **Hit a real test Supabase database.** No mocking of Supabase, no mocking of RLS. Helpers `createTestUser`, `createTestAssignment`, `testSupabase`, `createTestClientFor` are expected to live in `@/tests/integration/setup`. | `.claude/skills/testing/SKILL.md:141-197` |
| RLS policies | **Always tested live.** Every Server Action that mutates a table with RLS must have at least one cross-user test that asserts a foreign user cannot read or mutate the row (`.claude/skills/testing/SKILL.md:186-197`). | `.claude/skills/testing/SKILL.md:188-196` |
| External APIs (ЮKassa, CloudPayments, Kinescope, Unisender) | Never call production endpoints from tests. Use the provider's test sandbox (ЮKassa test mode) or intercept (email). Never use production API keys in tests (`.claude/skills/testing/SKILL.md:243,282`). | rule |
| E2E | Hits the running Next.js app (`localhost:3000` by default) against the test Supabase project; payments and email use sandbox modes. | `playwright.config.ts:11-27`, `.claude/skills/testing/SKILL.md:243` |

**Mocking guidance**
(`.claude/skills/testing/SKILL.md:84,278`):
- Don't mock what you can call directly.
- Don't write "tests on mocks of mocks" — you end up testing the mock, not
  the code.

## Commands

From `package.json:8-21`:

```bash
npm run test                # Vitest in watch mode (unit + component)
npm run test:ci             # Single Vitest pass (CI mode)
npm run test:coverage       # Vitest with V8 coverage report
npm run test:integration    # Vitest with vitest.integration.config.ts
npm run test:e2e            # Playwright
npm run test:e2e:ui         # Playwright UI mode
```

Adjacent quality gates that must also pass on every PR
(`.claude/skills/workflow/SKILL.md:119-124`):

```bash
npm run lint                # ESLint
npm run typecheck           # tsc --noEmit
npm run build               # Next.js production build (catches SSR-only bugs)
```

CI runs unit + integration + e2e on every PR
(`.claude/skills/testing/SKILL.md:259`).

## Coverage

There is **no enforced coverage percentage** in `vitest.config.ts`. The
project's stated policy
(`.claude/skills/testing/SKILL.md:262-272`) is *risk coverage, not percentage
coverage*. Required 100% coverage targets:

- **Every Zod schema** (validation is explicit business logic).
- **Every utility under `src/lib/billing/` and `src/lib/auth/`** (money +
  permissions).
- **Every Server Action that mutates the DB.**
- **Every E2E scenario in the P0/P1 list below.**

Coverage report is generated with `npm run test:coverage` via the
`@vitest/coverage-v8` provider.

## Test Types — What to Cover

| Type | Tool | Coverage target |
|---|---|---|
| Unit | Vitest | Pure functions with non-trivial logic (progress calc, discounts, formatting), Zod schemas, utilities. |
| Component | Vitest + Testing Library | Components with logic (forms, filtered dropdowns, the video player). **Not** purely visual components. |
| Integration | Vitest + real test Supabase | Server Actions, server queries, RLS policies. |
| E2E | Playwright | Critical user journeys (table below). |

**Explicitly out of scope** (`.claude/skills/testing/SKILL.md:28-31`):
- Trivial getters/setters.
- JSX without logic.
- TypeScript types (the compiler covers them).
- Third-party libraries.

## E2E Targets

Mandatory critical scenarios with priorities
(`.claude/skills/testing/SKILL.md:203-214`):

| Scenario | Priority |
|---|---|
| Registration + email confirm + login | P0 |
| Purchase a plan (ЮKassa test mode) | P0 |
| View a lesson | P0 |
| Submit homework + curator review | P0 |
| Password recovery | P1 |
| Apply a promo code | P1 |
| Receive a certificate | P1 |
| Delete account | P2 |

E2E rules (`.claude/skills/testing/SKILL.md:238-244`):
1. Each test seeds its own data; tests are independent.
2. Use unique emails — `test-${Date.now()}@example.com`.
3. Never depend on external services in production — ЮKassa runs in test
   mode, email is intercepted.
4. Every test begins with `page.goto(...)`; never depend on the previous
   test's URL.
5. Never use `page.waitForTimeout(...)` — use awaitable assertions like
   `await expect(locator).toBeVisible()`.

E2E browsers covered by default: desktop Chrome and Pixel 5 mobile Chrome
(`playwright.config.ts:16-19`).

## Common Patterns

**Async — `userEvent` setup pattern:**
```ts
const user = userEvent.setup();
await user.click(screen.getByRole('button', { name: /отправить/i }));
expect(await screen.findByText(/...введите.../i)).toBeInTheDocument();
```

**Pending state assertion** (form blocks submit while transition is pending,
`.claude/skills/testing/SKILL.md:113-124`):
```ts
const { submitAssignment } = await import('@/server/actions/submissions');
vi.mocked(submitAssignment).mockImplementation(() => new Promise(() => {}));
await user.click(screen.getByRole('button', { name: /отправить/i }));
expect(screen.getByRole('button')).toBeDisabled();
```

**RLS isolation assertion** (integration tier,
`.claude/skills/testing/SKILL.md:187-196`):
```ts
const user1 = await createTestUser('u1@test.com');
const user2 = await createTestUser('u2@test.com');
// user1 inserts a submission via the action
const user2Client = createTestClientFor(user2);
const { data } = await user2Client.from('submissions').select('*');
expect(data).toHaveLength(0);
```

**Boundary coverage rule**
(`.claude/skills/testing/SKILL.md:84`): always cover `null`, `undefined`,
empty arrays, and negative numbers for any function that takes them.

**Time-based code** must use `vi.useFakeTimers()` — tests must never depend
on real wall-clock time (`.claude/skills/testing/SKILL.md:281`).

## Anti-Patterns (Forbidden)

From `.claude/skills/testing/SKILL.md:276-282`:

- Tests for the sake of tests.
- Asserting on TypeScript types (the compiler already does this).
- "Mocks-on-mocks" tests that exercise nothing real.
- Committing `it.only` / `describe.only` (Playwright also enforces this via
  `forbidOnly` on CI, `playwright.config.ts:7`).
- Time-dependent tests without `vi.useFakeTimers()`.
- Production keys for external services in tests.

---

*Testing analysis: 2026-05-23*
