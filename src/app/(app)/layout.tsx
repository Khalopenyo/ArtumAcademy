import { AppTabBar } from '@/components/marketing/AppTabBar';
import { Footer } from '@/components/marketing/Footer';
import { Header } from '@/components/marketing/Header';
import { requireUser } from '@/server/queries/auth';

/**
 * (app) route-group layout — server-side auth gate.
 *
 * `requireUser()` редиректит на /login если cookie сессии нет/истекла.
 * Это server-side проверка (а не AuthGate), поэтому без flash гость→user
 * и без локального localStorage check.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="flex min-h-screen flex-col pb-[4.5rem] text-foreground md:pb-0">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      {/* Нижний таб-бар — мобайл, всегда (зона за auth-gate) */}
      <AppTabBar />
    </div>
  );
}
