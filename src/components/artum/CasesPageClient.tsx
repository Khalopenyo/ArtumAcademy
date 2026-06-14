'use client';

import { useMemo, useState } from 'react';

import { CaseCard } from '@/components/artum/CaseCard';
import { type CategoryId, CATEGORIES } from '@/lib/mock/courses';
import type { Case } from '@/lib/cases';
import { cn } from '@/lib/utils';

/**
 * Публичная страница кейсов: заголовок, фильтр по направлениям и сетка карточек.
 * Фильтрация мгновенная (клиентский стейт) — данные уже загружены сервером.
 */
export function CasesPageClient({ cases }: { cases: Case[] }) {
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');

  const visible = useMemo(
    () => (filter === 'all' ? cases : cases.filter((c) => c.category === filter)),
    [cases, filter],
  );

  return (
    <div className="container mx-auto px-4 py-10 sm:px-9">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Кейсы студентов</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Реальные истории: чему научились, какие проекты сделали и каких результатов достигли
          наши студенты.
        </p>
      </div>

      {cases.length > 0 ? (
        <div className="mb-6 mt-6 flex flex-wrap gap-2">
          <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
            Все ({cases.length})
          </FilterPill>
          {CATEGORIES.map((cat) => {
            const count = cases.filter((c) => c.category === cat.id).length;
            if (count === 0) return null;
            return (
              <FilterPill key={cat.id} active={filter === cat.id} onClick={() => setFilter(cat.id)}>
                {cat.emoji} {cat.label} ({count})
              </FilterPill>
            );
          })}
        </div>
      ) : null}

      {cases.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground backdrop-blur">
          Кейсы скоро появятся. Загляните позже.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <CaseCard key={c.id} caseItem={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium backdrop-blur transition-all',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_24px_rgba(168,85,247,0.35)]'
          : 'border-border/70 bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-[#E8DEFF]',
      )}
    >
      {children}
    </button>
  );
}
