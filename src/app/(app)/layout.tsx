import { Footer } from '@/components/marketing/Footer';
import { Header } from '@/components/marketing/Header';

/**
 * App route-group layout — auth-gated zone (этап 2 ТЗ §9 поставит requireUser).
 *
 * На этапе 1 (скелет): mock currentUser в Header показывает залогиненную версию
 * всегда. На этапе 2 здесь будет:
 *   const user = await requireUser({ next: pathname });
 * с редиректом на /login если null.
 *
 * Chrome = Header + Footer (тот же, что у (marketing)) — единый визуальный язык.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
