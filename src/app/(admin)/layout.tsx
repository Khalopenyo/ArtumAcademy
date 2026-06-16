import { AdminSidebar } from '@/components/artum/AdminSidebar';
import { Footer } from '@/components/marketing/Footer';
import { Header } from '@/components/marketing/Header';
import { requireAdmin } from '@/server/queries/auth';

/**
 * Admin route-group layout — server-side auth gate, требует profiles.is_admin=true.
 * Постоянный сайдбар-навигация по разделам (на мобильном — горизонтальный скролл).
 *
 * Не-залогиненных отправляет на /login, не-админов — на /.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-screen flex-col text-foreground">
      <Header />
      <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col lg:flex-row">
        <aside className="border-b border-border/40 lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="lg:sticky lg:top-2">
            <AdminSidebar />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
