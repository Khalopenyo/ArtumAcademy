import { Footer } from '@/components/marketing/Footer';
import { Header } from '@/components/marketing/Header';

/**
 * Marketing route-group layout — public pages with full chrome.
 *
 * Wraps: /, /courses/[slug], /privacy, /oferta, and auth pages (/login, /register,
 *   /forgot-password, /reset-password — per RESEARCH §Recommended File Structure
 *   we keep auth under (marketing) for consistency with Supabase docs Next.js example).
 *
 * No auth gate — pages here are public.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col text-foreground">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
