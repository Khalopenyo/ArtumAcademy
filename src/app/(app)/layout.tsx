import { AuthGate } from '@/components/shared/AuthGate';
import { Footer } from '@/components/marketing/Footer';
import { Header } from '@/components/marketing/Header';

/**
 * (app) route-group layout — auth-gated zone.
 *
 * AuthGate (client-side) редиректит гостей на /login?next=<path>.
 * После переключения на реальный auth (стадия БД) логика мигрирует
 * на server-side requireUser() в middleware.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <AuthGate>{children}</AuthGate>
      </main>
      <Footer />
    </div>
  );
}
