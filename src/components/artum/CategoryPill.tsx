'use client';

import type { CategoryId } from '@/lib/mock/courses';
import { cn } from '@/lib/utils';

interface CategoryPillProps {
  /** "all" для пилюли «Все курсы» */
  categoryId: CategoryId | 'all';
  label: string;
  emoji?: string;
  active: boolean;
  onSelect: (id: CategoryId | 'all') => void;
}

/**
 * Пилюля-фильтр для категорий курсов (ТЗ §4.1).
 *
 * Активная — фиолетовый фон + белый текст; неактивная — бордер + muted.
 *
 * Фильтрация мгновенная (клиентский стейт в DashboardClient) — НЕ навигация,
 * чтобы не перезапрашивать серверную страницу на каждый клик.
 */
export function CategoryPill({ categoryId, label, active, onSelect }: CategoryPillProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(categoryId)}
      className={cn(
        'inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-medium backdrop-blur transition-all sm:px-[18px] sm:py-[7px]',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_24px_rgba(168,85,247,0.35)]'
          : 'border-border/70 bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-[#E8DEFF]',
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
