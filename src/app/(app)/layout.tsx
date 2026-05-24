// Auth gate added in plan-08 (requireUser → redirect /login?next=...);
// chrome (AppHeader) + EmailVerificationBanner added in plan-10.
// This minimal stub lets plan-10's /dashboard render in dev before plan-08 hardens the gate.

/**
 * App route-group layout — auth-gated zone (will gate in plan-08, chrome in plan-10).
 *
 * For now: pure passthrough so the group exists and any (app)/page.tsx renders cleanly.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
