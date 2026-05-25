import { AuthGate } from '@/components/shared/AuthGate';
import { Footer } from '@/components/marketing/Footer';
import { Header } from '@/components/marketing/Header';

/**
 * Admin route-group layout — auth-gated + isAdmin required.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <AuthGate adminOnly>{children}</AuthGate>
      </main>
      <Footer />
    </div>
  );
}
