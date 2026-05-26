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
    <div className="flex min-h-screen flex-col text-foreground">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
