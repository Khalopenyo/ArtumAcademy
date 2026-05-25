'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, Edit, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  type CategoryId,
  CATEGORIES,
  formatPrice,
  getCategory,
} from '@/lib/mock/courses';
import { getAllCoursesEffective, useArtumStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function AdminCoursesPage() {
  const router = useRouter();
  const state = useArtumStore();
  const deleteCourse = useArtumStore((s) => s.deleteCourse);
  const allCourses = useMemo(() => getAllCoursesEffective(state), [state]);
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');

  const visible = filter === 'all' ? allCourses : allCourses.filter((c) => c.category === filter);

  function handleDelete(slug: string, title: string) {
    if (!confirm(`Удалить курс «${title}»? Действие необратимо.`)) return;
    deleteCourse(slug);
    toast.success('Курс удалён');
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
          <h1 className="text-3xl font-bold tracking-tight">Курсы</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {visible.length} из {allCourses.length} курсов
          </p>
        </div>
        <Button onClick={() => router.push('/admin/courses/new')}>
          <Plus className="mr-1 size-4" aria-hidden />
          Создать курс
        </Button>
      </div>

      {/* Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          Все ({allCourses.length})
        </FilterPill>
        {CATEGORIES.map((cat) => {
          const count = allCourses.filter((c) => c.category === cat.id).length;
          return (
            <FilterPill key={cat.id} active={filter === cat.id} onClick={() => setFilter(cat.id)}>
              {cat.emoji} {cat.label} ({count})
            </FilterPill>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-card/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Курс</th>
              <th className="px-5 py-3 text-left font-medium">Категория</th>
              <th className="px-5 py-3 text-right font-medium">Цена</th>
              <th className="px-5 py-3 text-right font-medium">Модули / Уроки</th>
              <th className="px-5 py-3 text-right font-medium">Студентов</th>
              <th className="px-5 py-3 text-right font-medium">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((c) => {
              const category = getCategory(c.category);
              const lessonsCount = c.modules.reduce((sum, m) => sum + m.lessons.length, 0);
              return (
                <tr key={c.id} className="hover:bg-secondary/50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/courses/${c.slug}`}
                      className="font-medium transition-colors hover:text-primary"
                    >
                      {c.title}
                    </Link>
                    <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {c.shortDescription}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        category.tagBgClass,
                        category.tagTextClass,
                      )}
                    >
                      <span aria-hidden>{category.emoji}</span>
                      {category.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatPrice(c.priceMinor)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                    {c.modules.length} / {lessonsCount}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                    {c.studentsCount}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        aria-label={`Редактировать ${c.title}`}
                      >
                        <Link href={`/admin/courses/${c.slug}`}>
                          <Edit className="size-4" aria-hidden />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Удалить ${c.title}`}
                        onClick={() => handleDelete(c.slug, c.title)}
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
      </div>
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
