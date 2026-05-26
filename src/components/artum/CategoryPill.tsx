'use client';

import Link from 'next/link';

import type { CategoryId } from '@/lib/mock/courses';
import { cn } from '@/lib/utils';

interface CategoryPillProps {
  /** "all" для пилюли «Все курсы» */
  categoryId: CategoryId | 'all';
  label: string;
  emoji?: string;
  active: boolean;
}

/**
 * Пилюля-фильтр для категорий курсов (ТЗ §4.1).
 *
 * Активная пилюля — фиолетовый фон + белый текст.
 * Неактивная — прозрачный фон + бордер + muted текст.
 *
 * Click меняет query-param `?category=<id>` чтобы dashboard перерендерил
 * сетку. Server Component-friendly через Link (без onClick).
 */
export function CategoryPill({ categoryId, label, active }: CategoryPillProps) {
  const href = categoryId === 'all' ? '/' : `/?category=${categoryId}`;

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-medium backdrop-blur transition-all sm:px-[18px] sm:py-[7px]',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_24px_rgba(168,85,247,0.35)]'
          : 'border-border/70 bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-[#E8DEFF]',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {label}
    </Link>
  );
}
