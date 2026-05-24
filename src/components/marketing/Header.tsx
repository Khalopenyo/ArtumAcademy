'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/Logo';
import { cn } from '@/lib/utils';

interface HeaderProps {
  className?: string;
}

/**
 * Public marketing header — sticky, blurred, with mobile hamburger.
 * Renders Logo + Войти / Регистрация on desktop; hamburger panel on mobile.
 *
 * UI-SPEC §3.2 — Public Header pattern.
 * UI-SPEC §10.4 — theme toggle deferred to M2 (prefers-color-scheme handles dark mode).
 */
export function Header({ className }: HeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b bg-background/95 backdrop-blur',
        'supports-[backdrop-filter]:bg-background/60',
        className,
      )}
    >
      <nav className="container mx-auto flex h-14 items-center justify-between md:h-16">
        <Logo className="text-lg" />

        {/* Desktop nav */}
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Войти</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Регистрация</Link>
          </Button>
        </div>

        {/* Mobile hamburger toggle */}
        <button
          type="button"
          aria-label={open ? 'Закрыть меню' : 'Меню'}
          aria-expanded={open}
          aria-controls="mobile-nav-panel"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            'inline-flex size-11 items-center justify-center rounded-md md:hidden',
            'transition-colors hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </nav>

      {/* Mobile panel (md:hidden) */}
      {open ? (
        <div
          id="mobile-nav-panel"
          className="border-t bg-background md:hidden"
        >
          <div className="container mx-auto flex flex-col py-2">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={cn(
                'inline-flex min-h-11 items-center px-2 py-3 text-base font-medium',
                'rounded-md transition-colors hover:bg-accent hover:text-accent-foreground',
              )}
            >
              Войти
            </Link>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className={cn(
                'inline-flex min-h-11 items-center px-2 py-3 text-base font-medium text-primary',
                'rounded-md transition-colors hover:bg-accent hover:text-accent-foreground',
              )}
            >
              Регистрация
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
