'use client';

import { useEffect, useState, useTransition } from 'react';
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
import { signOutAction } from '@/server/actions/auth';
import {
  fetchMyNotificationsAction,
  markNotificationsReadAction,
} from '@/server/actions/notifications';
import type { AuthUser } from '@/server/queries/auth';
import type { NotificationRecord } from '@/server/queries/notifications';
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
  notifications: NotificationRecord[];
}

export function HeaderClient({ className, user, notifications }: HeaderClientProps) {
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

  // Закрываем drawer при переходе на другой маршрут
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Пока drawer открыт — блокируем скролл body и закрываем по Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  return (
    <>
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
                    'relative inline-flex h-16 items-center text-sm font-medium transition-colors',
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
              <NotificationButton notifications={notifications} />
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
            'inline-flex size-11 items-center justify-center rounded-md md:hidden',
            'text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
          )}
        >
          {mobileOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </nav>
      </header>

      {/* Drawer вынесен из <header>: у шапки backdrop-filter, который иначе
          становится containing-block для position:fixed и обрезает drawer
          по высоте шапки. Здесь fixed считается от вьюпорта. */}
      <div
        aria-hidden
        onClick={() => setMobileOpen(false)}
        className={cn(
          'fixed inset-0 z-40 bg-[#04020C]/60 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <div
        id="mobile-nav-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Меню"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[82%] max-w-sm flex-col border-l border-border/60',
          'bg-gradient-to-b from-[#15101F] to-[#0C0818] shadow-[-24px_0_60px_rgba(0,0,0,.5)]',
          'transition-transform duration-300 [transition-timing-function:cubic-bezier(.4,0,.2,1)] md:hidden',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <Logo className="text-[16px]" />
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={() => setMobileOpen(false)}
            className="inline-flex size-11 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav aria-label="Мобильная навигация" className="flex flex-col gap-1 px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 items-center justify-between rounded-xl px-4 text-base font-medium transition-colors',
                  active
                    ? 'bg-primary/15 text-primary-light'
                    : 'text-foreground hover:bg-secondary/60',
                )}
              >
                {item.label}
                <span aria-hidden className="text-muted-foreground">
                  ›
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2.5 border-t border-border/40 p-5">
          {isGuest ? (
            <>
              <Button asChild className="h-12 w-full text-sm">
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  Начать обучение
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 w-full text-sm">
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  Войти в аккаунт
                </Link>
              </Button>
            </>
          ) : (
            <Link
              href="/profile"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3 transition-colors hover:bg-secondary/60"
            >
              <AvatarPill initials={user.initials} small />
              <div className="min-w-0 text-sm">
                <div className="truncate font-medium text-foreground">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

function NotificationButton({ notifications }: { notifications: NotificationRecord[] }) {
  const [items, setItems] = useState(notifications);
  const [, startTransition] = useTransition();
  const unread = items.filter((n) => !n.read).length;

  // Live-обновление: тянем свежие уведомления каждые 30с и при возврате фокуса
  // на вкладку. Не затираем список при пустом ответе (уведомления не удаляются,
  // пустой ответ = транзиентная ошибка), чтобы избежать мигания.
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const fresh = await fetchMyNotificationsAction();
        if (active && fresh.length) setItems(fresh);
      } catch {
        /* ignore — повторим на следующем тике */
      }
    }
    const id = setInterval(refresh, 30_000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  function onOpenChange(open: boolean) {
    if (open && unread > 0) {
      // оптимистично гасим бейдж + помечаем прочитанными на сервере
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      startTransition(() => {
        void markNotificationsReadAction();
      });
    }
  }

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Уведомления (${unread} непрочитанных)`}
          className="relative size-10 rounded-full hover:bg-secondary/60"
        >
          <Bell className="size-4" aria-hidden />
          {unread > 0 ? (
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
        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            Пока нет уведомлений
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1 text-sm">
            {items.map((n) => (
              <li key={n.id} className="border-b border-border/50 px-3 py-2 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-foreground">{n.title}</div>
                  {!n.read ? (
                    <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </div>
                {n.body ? <div className="mt-0.5 text-muted-foreground">{n.body}</div> : null}
                <div className="mt-1 text-xs text-muted-foreground/80">{formatAgo(n.createdAt)}</div>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} дн назад`;
  return new Date(iso).toLocaleDateString('ru-RU');
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
          className="inline-flex size-10 items-center justify-center rounded-full transition-opacity hover:opacity-80"
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
