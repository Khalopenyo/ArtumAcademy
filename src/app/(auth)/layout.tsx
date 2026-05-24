import { Header } from '@/components/marketing/Header';

/**
 * Auth route-group layout — future-proof slot for /login, /register, etc.
 *
 * Plan-01 decision (UI-SPEC §3.1 + RESEARCH §Recommended File Structure):
 *   Auth pages live under (marketing)/ for now (consistent with Supabase Next.js docs).
 *   This (auth) group is created empty so future plans can opt-in by moving routes here.
 *   Currently no routes are attached → this layout adds zero runtime overhead.
 *
 * Reuses marketing Header for visual continuity. A minimal-header variant can be added
 * later if conversion testing shows the marketing nav distracts from auth flow.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="container mx-auto flex-1 max-w-md py-12">{children}</main>
    </div>
  );
}
