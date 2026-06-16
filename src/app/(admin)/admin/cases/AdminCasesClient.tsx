'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, Edit, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/artum/CategoryIcon';
import { type CategoryId, CATEGORIES, getCategory } from '@/lib/mock/courses';
import type { Case } from '@/lib/cases';
import { deleteCaseAction } from '@/server/actions/admin/cases';
import { cn } from '@/lib/utils';

interface AdminCasesClientProps {
  initialCases: Case[];
}

export default function AdminCasesClient({ initialCases }: AdminCasesClientProps) {
  const router = useRouter();
  const allCases = useMemo(() => initialCases, [initialCases]);
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');

  const visible = filter === 'all' ? allCases : allCases.filter((c) => c.category === filter);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Удалить кейс «${title}»? Действие необратимо.`)) return;
    const res = await deleteCaseAction(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Кейс удалён');
    router.refresh();
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        К админ-панели
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Кейсы</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {visible.length} из {allCases.length} кейсов
          </p>
        </div>
        <Button onClick={() => router.push('/admin/cases/new')}>
          <Plus className="mr-1 size-4" aria-hidden />
          Создать кейс
        </Button>
      </div>

      {/* Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          Все ({allCases.length})
        </FilterPill>
        {CATEGORIES.map((cat) => {
          const count = allCases.filter((c) => c.category === cat.id).length;
          return (
            <FilterPill key={cat.id} active={filter === cat.id} onClick={() => setFilter(cat.id)}>
              <CategoryIcon categoryId={cat.id} className="size-3.5" /> {cat.label} ({count})
            </FilterPill>
          );
        })}
      </div>

      {allCases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground backdrop-blur">
          Пока нет ни одного кейса. Нажмите «Создать кейс».
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-card/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Кейс</th>
                <th className="px-5 py-3 text-left font-medium">Направление</th>
                <th className="px-5 py-3 text-left font-medium">Результат</th>
                <th className="px-5 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {visible.map((c) => {
                const category = getCategory(c.category);
                return (
                  <tr key={c.id} className="hover:bg-secondary/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.title}</span>
                        {c.published === false ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-500">
                            Черновик
                          </span>
                        ) : null}
                      </div>
                      {c.studentName ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">{c.studentName}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                          category.tagBgClass,
                          category.tagTextClass,
                        )}
                      >
                        <CategoryIcon categoryId={category.id} className="size-3.5" />
                        {category.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <span className="line-clamp-1">{c.result || '—'}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button asChild variant="ghost" size="sm" aria-label={`Редактировать ${c.title}`}>
                          <Link href={`/admin/cases/${c.id}`}>
                            <Edit className="size-4" aria-hidden />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Удалить ${c.title}`}
                          onClick={() => handleDelete(c.id, c.title)}
                        >
                          <Trash2 className="size-4 text-destructive" aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile: карточки */}
          <ul className="divide-y divide-border/40 md:hidden">
            {visible.map((c) => {
              const category = getCategory(c.category);
              return (
                <li key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{c.title}</span>
                        {c.published === false ? (
                          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-500">
                            Черновик
                          </span>
                        ) : null}
                      </div>
                      {c.studentName ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">{c.studentName}</div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button asChild variant="ghost" size="sm" aria-label={`Редактировать ${c.title}`}>
                        <Link href={`/admin/cases/${c.id}`}>
                          <Edit className="size-4" aria-hidden />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Удалить ${c.title}`}
                        onClick={() => handleDelete(c.id, c.title)}
                      >
                        <Trash2 className="size-4 text-destructive" aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium',
                        category.tagBgClass,
                        category.tagTextClass,
                      )}
                    >
                      <CategoryIcon categoryId={category.id} className="size-3.5" />
                      {category.label}
                    </span>
                    <span className="line-clamp-1 text-muted-foreground">{c.result || '—'}</span>
                  </div>
                </li>
              );
            })}
          </ul>
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
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
