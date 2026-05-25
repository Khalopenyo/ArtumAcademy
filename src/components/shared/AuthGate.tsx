'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useArtumStore } from '@/lib/store';
import { useCurrentUser, useHydrated } from '@/lib/store/hooks';

interface AuthGateProps {
  children: React.ReactNode;
  /** Требовать isAdmin (для /admin/*) */
  adminOnly?: boolean;
}

/**
 * Client-side auth gate для (app) и (admin) зон.
 *
 * Поведение:
 *   1. До hydrate'а localStorage → показывает spinner (skeleton state)
 *   2. После hydrate, если currentUser=null → router.push('/login?next=<current>')
 *   3. Если adminOnly + user.isAdmin=false → router.push('/') + toast
 *   4. Иначе рендерит children
 *
 * Когда появится реальный Supabase Auth (стадия с БД), этот компонент
 * либо удаляется (replaced by middleware + Server Component requireUser),
 * либо упрощается до показа спиннера.
 */
export function AuthGate({ children, adminOnly = false }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const user = useCurrentUser();
  // Subscribe to ensure re-render on logout (re-uses currentUserId selector)
  useArtumStore((s) => s.currentUserId);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
      return;
    }
    if (adminOnly && !user.isAdmin) {
      router.replace('/');
    }
  }, [hydrated, user, adminOnly, pathname, router]);

  // До hydrate'а или во время редиректа показываем минимальный spinner
  if (!hydrated || !user || (adminOnly && !user.isAdmin)) {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
          <span className="text-sm">Загрузка…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
