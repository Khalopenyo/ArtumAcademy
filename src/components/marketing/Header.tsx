'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LogOut, Menu, Settings, User, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logo } from '@/components/shared/Logo';
import { MOCK_CURRENT_USER, MOCK_UNREAD_COUNT } from '@/lib/mock/user';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Главная' },
  { href: '/?view=courses', label: 'Курсы' },
  { href: '/certificates', label: 'Сертификаты' },
] as const;

interface HeaderProps {
  className?: string;
}

/**
 * Главный хедер Artum Academy (ТЗ §4.1):
 *   Логотип ARTUM · навигация (Главная / Курсы / Сертификаты) · уведомления · аватар
 *
 * Mock auth: на этапе 1 предполагаем, что пользователь всегда залогинен.
 * Этап 2 заменит на server-side `requireUser()` и условный рендер гостевого варианта.
 */
export function Header({ className }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur',
        'supports-[backdrop-filter]:bg-background/70',
        className,
      )}
    >
      <nav
        aria-label="Главная навигация"
        className="container mx-auto flex h-16 items-center justify-between gap-4"
      >
        <Logo className="text-xl" />

        {/* Desktop nav */}
        <ul className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/' && !item.href.includes('?')
                : pathname.startsWith(item.href.split('?')[0]!);
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Desktop right cluster: notifications + avatar */}
        <div className="hidden items-center gap-2 md:flex">
          <NotificationButton />
          <UserMenu />
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-panel"
          onClick={() => setMobileOpen((v) => !v)}
          className={cn(
            'inline-flex size-10 items-center justify-center rounded-md md:hidden',
            'text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
          )}
        >
          {mobileOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </nav>

      {/* Mobile panel */}
      {mobileOpen ? (
        <div id="mobile-nav-panel" className="border-t border-border bg-background md:hidden">
          <div className="container mx-auto flex flex-col gap-1 py-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-border" />
            <Link
              href="/profile"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-3"
            >
              <Avatar small />
              <div className="text-sm">
                <div className="font-medium text-foreground">{MOCK_CURRENT_USER.name}</div>
                <div className="text-xs text-muted-foreground">{MOCK_CURRENT_USER.email}</div>
              </div>
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function NotificationButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Уведомления (${MOCK_UNREAD_COUNT} непрочитанных)`}
          className="relative size-10 rounded-full hover:bg-secondary"
        >
          <Bell className="size-5" aria-hidden />
          {MOCK_UNREAD_COUNT > 0 ? (
            <span
              aria-hidden
              className="absolute right-2 top-2 inline-flex size-2 rounded-full bg-primary ring-2 ring-background"
            />
          ) : null}
          <span className="sr-only">Открыть уведомления</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Уведомления</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-72 overflow-y-auto py-1 text-sm">
          <div className="px-3 py-2 text-muted-foreground">
            На скелете уведомления — заглушка. На этапе 6 ТЗ будет real-time лента.
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Меню пользователя — ${MOCK_CURRENT_USER.name}`}
          className="inline-flex size-10 items-center justify-center rounded-full transition-opacity hover:opacity-80"
        >
          <Avatar />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="text-sm font-medium">{MOCK_CURRENT_USER.name}</div>
          <div className="truncate text-xs text-muted-foreground">{MOCK_CURRENT_USER.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <User className="mr-2 size-4" aria-hidden /> Личный кабинет
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile?tab=settings" className="cursor-pointer">
            <Settings className="mr-2 size-4" aria-hidden /> Настройки
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/login" className="cursor-pointer text-destructive">
            <LogOut className="mr-2 size-4" aria-hidden /> Выйти
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Avatar({ small = false }: { small?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary/20 font-semibold text-primary ring-2 ring-primary/40',
        small ? 'size-9 text-xs' : 'size-10 text-sm',
      )}
      aria-hidden
    >
      {MOCK_CURRENT_USER.initials}
    </span>
  );
}
