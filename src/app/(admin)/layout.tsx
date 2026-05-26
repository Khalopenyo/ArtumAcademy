import { Footer } from '@/components/marketing/Footer';
import { Header } from '@/components/marketing/Header';
import { requireAdmin } from '@/server/queries/auth';

/**
 * Admin route-group layout — server-side auth gate, требует profiles.is_admin=true.
 *
 * Не-залогиненных отправляет на /login, не-админов — на /.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-screen flex-col text-foreground">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
