'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Award, House, LayoutGrid, type LucideIcon, User } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Нижний таб-бар приложения (мобайл, вариант B из спеки адаптива).
 *
 * Только на телефоне (`md:hidden`), `fixed bottom-0`, с учётом
 * safe-area-inset-bottom. Рендерится из layout'ов (marketing)/(app)
 * только для залогиненных — это навигация авторизованного приложения.
 *
 * Маршруты привязаны к реально существующим страницам. Отдельного
 * «Обучение»-хаба в проекте пока нет, поэтому 4-я вкладка — Сертификаты.
 */
const TABS: { href: string; label: string; icon: LucideIcon; isActive: (p: string) => boolean }[] = [
  { href: '/', label: 'Главная', icon: House, isActive: (p) => p === '/' },
  {
    href: '/?view=courses#catalog',
    label: 'Курсы',
    icon: LayoutGrid,
    isActive: (p) => p.startsWith('/courses'),
  },
  {
    href: '/certificates',
    label: 'Сертификаты',
    icon: Award,
    isActive: (p) => p.startsWith('/certificates'),
  },
  { href: '/profile', label: 'Кабинет', icon: User, isActive: (p) => p.startsWith('/profile') },
];

export function AppTabBar() {
  const pathname = usePathname();

  // Плеер урока — иммерсивный: у него своя липкая панель «Следующий урок».
  // Прячем таб-бар, чтобы не было двух конкурирующих нижних панелей.
  if (pathname.startsWith('/learn/')) return null;

  return (
    <nav
      aria-label="Навигация приложения"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-[#0A0618]/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex h-14 max-w-md items-stretch">
        {TABS.map((t) => {
          const active = t.isActive(pathname);
          const Icon = t.icon;
          return (
            <Link
              key={t.label}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                active ? 'text-primary-light' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon
                className={cn('size-5 shrink-0', active && 'fill-primary/15')}
                strokeWidth={active ? 2.2 : 1.8}
                aria-hidden
              />
              <span className="max-w-full truncate px-1">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
