'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, Edit, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/mock/courses';
import type { AdminPlanRow } from '@/server/queries/subscription-plans';
import { deletePlanAction } from '@/server/actions/admin/subscription-plans';

export default function SubscriptionPlansClient({ initialPlans }: { initialPlans: AdminPlanRow[] }) {
  const router = useRouter();
  const plans = useMemo(() => initialPlans, [initialPlans]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Удалить план «${name}»? Действие необратимо.`)) return;
    const res = await deletePlanAction(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('План удалён');
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
          <h1 className="text-3xl font-bold tracking-tight">Планы подписки</h1>
          <p className="mt-1 text-sm text-muted-foreground">{plans.length} планов</p>
        </div>
        <Button onClick={() => router.push('/admin/subscription-plans/new')}>
          <Plus className="mr-1 size-4" aria-hidden />
          Создать план
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground backdrop-blur">
          Пока нет планов. Нажмите «Создать план».
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
          <table className="w-full text-sm">
            <thead className="bg-card/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">План</th>
                <th className="px-5 py-3 text-right font-medium">Мес / Год</th>
                <th className="px-5 py-3 text-right font-medium">Курсов</th>
                <th className="px-5 py-3 text-right font-medium">Подписчиков</th>
                <th className="px-5 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {plans.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      {p.published === false ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-500">
                          Черновик
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {p.description || '—'}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatPrice(p.priceMonthlyMinor)} / {formatPrice(p.priceYearlyMinor)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                    {p.isAllCourses ? 'Все' : p.courseCount}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                    {p.activeSubscribers}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button asChild variant="ghost" size="sm" aria-label={`Редактировать ${p.name}`}>
                        <Link href={`/admin/subscription-plans/${p.id}`}>
                          <Edit className="size-4" aria-hidden />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Удалить ${p.name}`}
                        onClick={() => handleDelete(p.id, p.name)}
                      >
                        <Trash2 className="size-4 text-destructive" aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
