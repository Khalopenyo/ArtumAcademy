// TEMPORARY — created in plan-05 for FOUND-06 verification.
// Deleted before Phase 1 closes (see plan-05 task 8).
// Invoked via scripts/sentry-test.ts (also temporary).
//
// This action exists for ONE purpose: prove an event reaches the local
// Bugsink/GlitchTip dashboard within 30 seconds of invocation. After
// FOUND-06 acceptance, both this file and the invocation script are
// removed — auto-instrumentation from @sentry/nextjs covers real Server
// Actions and Route Handlers without manual capture (per plan-05 §Out of
// Scope and api-conventions skill §"Никаких console.log в продакшен-коде").
//
// See: .planning/phases/1-dev-foundations/RESEARCH.md §Pattern 4 lines 646–656.

'use server';

import * as Sentry from '@sentry/nextjs';

export async function _sentryTestAction(): Promise<{ ok: true }> {
  Sentry.captureException(new Error('Phase 1 sentry verification — ignore me'));
  await Sentry.flush(2000); // ensure event sent before the caller returns
  return { ok: true };
}
