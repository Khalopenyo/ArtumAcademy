'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
import { useArtumStore } from '@/lib/store';
import { useCurrentUser, useHydrated } from '@/lib/store/hooks';
import { MOCK_NOTIFICATIONS, MOCK_UNREAD_COUNT } from '@/lib/mock/user';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Главная' },
  { href: '/?view=courses', label: 'Курсы' },
  { href: '/certificates', label: 'Сертификаты' },
] as const;

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const isGuest = !hydrated || !user;

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

        {/* Desktop nav — показываем только если не гость */}
        {!isGuest ? (
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
        ) : (
          <span className="hidden flex-1 md:block" />
        )}

        {/* Desktop right cluster */}
        <div className="hidden items-center gap-2 md:flex">
          {isGuest ? (
            <GuestActions />
          ) : (
            <>
              <NotificationButton />
              <UserMenu />
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
        <div id="mobile-nav-panel" className="border-t border-border bg-background md:hidden">
          <div className="container mx-auto flex flex-col gap-1 py-3">
            {!isGuest
              ? NAV_ITEMS.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md px-3 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))
              : null}
            <div className="my-2 h-px bg-border" />
            {isGuest ? (
              <div className="flex flex-col gap-2 px-3 py-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    Войти
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register" onClick={() => setMobileOpen(false)}>
                    Регистрация
                  </Link>
                </Button>
              </div>
            ) : (
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-3"
              >
                <AvatarMobile />
                <div className="text-sm">
                  <div className="font-medium text-foreground">{user!.name}</div>
                  <div className="text-xs text-muted-foreground">{user!.email}</div>
                </div>
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function GuestActions() {
  return (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link href="/login">Войти</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/register">Регистрация</Link>
      </Button>
    </>
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

function UserMenu() {
  const router = useRouter();
  const user = useCurrentUser()!;
  const logoutUser = useArtumStore((s) => s.logoutUser);

  function onLogout() {
    logoutUser();
    toast.success('Вы вышли из аккаунта');
    router.push('/login');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Меню пользователя — ${user.name}`}
          className="inline-flex size-10 items-center justify-center rounded-full transition-opacity hover:opacity-80"
        >
          <AvatarPill initials={user.initials} />
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
          onSelect={onLogout}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 size-4" aria-hidden /> Выйти
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

function AvatarMobile() {
  const user = useCurrentUser();
  return <AvatarPill initials={user?.initials ?? '?'} small />;
}
