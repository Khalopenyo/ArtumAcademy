'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  CreditCard,
  LayoutDashboard,
  Layers,
  type LucideIcon,
  Percent,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const LINKS: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: '/admin', label: 'Обзор', icon: LayoutDashboard, exact: true },
  { href: '/admin/courses', label: 'Курсы', icon: BookOpen },
  { href: '/admin/cases', label: 'Кейсы', icon: Sparkles },
  { href: '/admin/subscription-plans', label: 'Планы подписки', icon: Layers },
  { href: '/admin/reviews', label: 'Отзывы', icon: Star },
  { href: '/admin/users', label: 'Пользователи', icon: Users },
  { href: '/admin/promocodes', label: 'Промокоды', icon: Percent },
  { href: '/admin/payments', label: 'Платежи', icon: CreditCard },
];

/**
 * Постоянная навигация админки (sidebar на десктопе, горизонтальный скролл на
 * мобильном). Подсвечивает активный раздел — больше не нужно возвращаться на
 * дашборд через quick-links.
 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Разделы админки"
      className="flex gap-1 overflow-x-auto p-3 lg:flex-col lg:overflow-visible lg:p-4"
    >
      {LINKS.map((l) => {
        const active = l.exact
          ? pathname === l.href
          : pathname === l.href || pathname.startsWith(`${l.href}/`);
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
