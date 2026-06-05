import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { Logo } from '@/components/shared/Logo';

export const metadata = { title: 'Вход и регистрация' };

/**
 * Auth route-group layout — космическая тема Artum.
 * Минимальная chrome: лого + ссылка на главную. Центрированная карточка
 * для login/register/forgot-password/reset-password. Звёздный фон
 * приходит из root layout (<CosmicBackground />).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col text-foreground">
      <header className="border-b border-border/30 bg-[#0A0618]/50 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo className="text-[17px]" />
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            На главную
          </Link>
        </div>
      </header>
      <main className="container mx-auto flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
