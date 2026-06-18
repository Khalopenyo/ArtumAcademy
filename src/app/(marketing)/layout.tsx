import { AppTabBar } from '@/components/marketing/AppTabBar';
import { Footer } from '@/components/marketing/Footer';
import { Header } from '@/components/marketing/Header';
import { getCurrentUser } from '@/server/queries/auth';

/**
 * Marketing route-group layout — public pages with full chrome.
 *
 * Wraps: /, /courses/[slug], /privacy, /oferta, and auth pages (/login, /register,
 *   /forgot-password, /reset-password — per RESEARCH §Recommended File Structure
 *   we keep auth under (marketing) for consistency with Supabase docs Next.js example).
 *
 * No auth gate — pages here are public. Нижний таб-бар (мобайл) показываем
 * только залогиненным — это навигация авторизованного приложения.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div
      className={`flex min-h-screen flex-col text-foreground${user ? ' pb-[4.5rem] md:pb-0' : ''}`}
    >
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      {user ? <AppTabBar /> : null}
    </div>
  );
}
