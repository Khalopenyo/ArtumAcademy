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
  /** Подсчёт курсов в категории (опционально) */
  count?: number;
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
export function CategoryPill({ categoryId, label, emoji, active, count }: CategoryPillProps) {
  const href = categoryId === 'all' ? '/' : `/?category=${categoryId}`;

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-secondary hover:text-foreground',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {emoji ? <span aria-hidden>{emoji}</span> : null}
      <span>{label}</span>
      {count !== undefined ? (
        <span
          className={cn(
            'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs',
            active ? 'bg-primary-foreground/20' : 'bg-secondary',
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
