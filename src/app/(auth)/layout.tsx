import Link from 'next/link';

import { Logo } from '@/components/shared/Logo';

/**
 * Auth route-group layout — минимальная chrome для /login, /register, /forgot-password.
 *
 * Дизайн: только лого + центрированная карточка формы. Это снижает отвлечение
 * на этапе конверсии (стандартный паттерн EdTech: KF Academy, Skillbox имеют
 * аналогичный авторизационный flow).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <Logo className="text-xl" />
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            На главную
          </Link>
        </div>
      </header>
      <main className="container mx-auto flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
