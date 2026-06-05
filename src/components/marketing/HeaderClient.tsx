'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { Bell, LogOut, Menu, Settings, ShieldCheck, User, X } from 'lucide-react';

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
import { MOCK_NOTIFICATIONS, MOCK_UNREAD_COUNT } from '@/lib/mock/user';
import { signOutAction } from '@/server/actions/auth';
import type { AuthUser } from '@/server/queries/auth';
import { cn } from '@/lib/utils';

/**
 * Навигация по макету artum_academy_homepage_cosmic.
 * Заглушечные роуты /cases /about /contacts появятся позже —
 * сейчас они ведут на главную с якорем для визуальной полноты.
 */
const NAV_ITEMS = [
  { href: '/', label: 'Главная', match: 'home' as const },
  { href: '/?view=courses#catalog', label: 'Курсы', match: 'courses' as const },
  { href: '/cases', label: 'Кейсы', match: 'cases' as const },
  { href: '/about', label: 'О компании', match: 'about' as const },
  { href: '/contacts', label: 'Контакты', match: 'contacts' as const },
];

interface HeaderClientProps {
  className?: string;
  user: AuthUser | null;
}

export function HeaderClient({ className, user }: HeaderClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isGuest = !user;

  function isActive(item: (typeof NAV_ITEMS)[number]): boolean {
    if (item.match === 'home') return pathname === '/';
    if (item.match === 'courses') return pathname.startsWith('/courses');
    if (item.match === 'cases') return pathname.startsWith('/cases');
    if (item.match === 'about') return pathname.startsWith('/about');
    if (item.match === 'contacts') return pathname.startsWith('/contacts');
    return false;
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-border/40 bg-[#0A0618]/70 backdrop-blur-xl',
        'supports-[backdrop-filter]:bg-[#0A0618]/50',
        className,
      )}
    >
      <nav
        aria-label="Главная навигация"
        className="container mx-auto flex h-16 items-center justify-between gap-4 px-4"
      >
        <Logo className="text-[17px]" />

        {/* Desktop nav — по центру с подчёркиванием активного */}
        <ul className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    'relative inline-flex h-16 items-center text-[13px] font-medium transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t bg-primary"
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Desktop right cluster */}
        <div className="hidden items-center gap-4 md:flex">
          {isGuest ? (
            <>
              <Link
                href="/register"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Регистрация
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Войти
              </Link>
            </>
          ) : (
            <>
              <NotificationButton />
              <UserMenu user={user} />
            </>
          )}
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
        <div id="mobile-nav-panel" className="border-t border-border/40 bg-[#0A0618]/95 backdrop-blur md:hidden">
          <div className="container mx-auto flex flex-col gap-1 px-4 py-3">
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
            <div className="my-2 h-px bg-border/40" />
            {isGuest ? (
              <div className="flex flex-col gap-2 px-3 py-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/register" onClick={() => setMobileOpen(false)}>
                    Регистрация
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    Войти
                  </Link>
                </Button>
              </div>
            ) : (
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-3"
              >
                <AvatarPill initials={user.initials} small />
                <div className="text-sm">
                  <div className="font-medium text-foreground">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
              </Link>
            )}
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
          className="relative size-9 rounded-full hover:bg-secondary/60"
        >
          <Bell className="size-4" aria-hidden />
          {MOCK_UNREAD_COUNT > 0 ? (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 inline-flex size-2 rounded-full bg-primary ring-2 ring-background"
            />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Уведомления</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ul className="max-h-80 overflow-y-auto py-1 text-sm">
          {MOCK_NOTIFICATIONS.map((n) => (
            <li key={n.id} className="border-b border-border/50 px-3 py-2 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-foreground">{n.title}</div>
                {n.unread ? (
                  <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                ) : null}
              </div>
              <div className="mt-0.5 text-muted-foreground">{n.body}</div>
              <div className="mt-1 text-xs text-muted-foreground/80">{n.ago}</div>
            </li>
          ))}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ user }: { user: AuthUser }) {
  const [pending, startTransition] = useTransition();

  function onLogout() {
    startTransition(async () => {
      try {
        await signOutAction();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes('NEXT_REDIRECT')) {
          toast.error(`Ошибка выхода: ${message}`);
        }
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Меню пользователя — ${user.name}`}
          className="inline-flex size-9 items-center justify-center rounded-full transition-opacity hover:opacity-80"
        >
          <AvatarPill initials={user.initials} small />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
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
        {user.isAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin" className="cursor-pointer">
                <ShieldCheck className="mr-2 size-4" aria-hidden /> Админ-панель
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onLogout();
          }}
          disabled={pending}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 size-4" aria-hidden />
          {pending ? 'Выходим…' : 'Выйти'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AvatarPill({ initials, small = false }: { initials: string; small?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary/20 font-semibold text-primary ring-2 ring-primary/40',
        small ? 'size-9 text-xs' : 'size-10 text-sm',
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
