'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/mock/courses';
import { cn } from '@/lib/utils';
import { refundPaymentAction } from '@/server/actions/admin/payments';
import type { AdminPaymentRow } from '@/server/queries/admin';

const STATUS_META: Record<AdminPaymentRow['status'], { label: string; cls: string }> = {
  succeeded: { label: 'Оплачен', cls: 'bg-emerald-500/15 text-emerald-400' },
  pending: { label: 'Ожидает', cls: 'bg-amber-500/15 text-amber-400' },
  canceled: { label: 'Отменён', cls: 'bg-muted text-muted-foreground' },
  refunded: { label: 'Возврат', cls: 'bg-destructive/15 text-destructive' },
};

const METHOD_LABEL: Record<AdminPaymentRow['method'], string> = {
  card: 'Карта',
  sbp: 'СБП',
  subscription: 'Подписка',
};

type Filter = 'all' | AdminPaymentRow['status'];
const TABS: Filter[] = ['all', 'succeeded', 'pending', 'canceled', 'refunded'];

export function AdminPaymentsClient({ payments }: { payments: AdminPaymentRow[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const visible = useMemo(
    () => (filter === 'all' ? payments : payments.filter((p) => p.status === filter)),
    [payments, filter],
  );

  function onRefund(id: string) {
    if (!confirm('Вернуть платёж? Деньги вернутся покупателю, а доступ будет отозван.')) return;
    startTransition(async () => {
      const res = await refundPaymentAction(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Платёж возвращён, доступ отозван');
      router.refresh();
    });
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <h1 className="text-3xl font-bold tracking-tight">Платежи и заказы</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Транзакции ЮKassa (последние {payments.length}). Доступ открывается после статуса «Оплачен».
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm transition-colors',
              filter === t
                ? 'bg-primary text-primary-foreground'
                : 'border border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'all' ? 'Все' : STATUS_META[t].label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
          Платежей нет.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Дата</th>
                <th className="px-5 py-3">Покупатель</th>
                <th className="px-5 py-3">Что</th>
                <th className="px-5 py-3 text-right">Сумма</th>
                <th className="px-5 py-3">Метод</th>
                <th className="px-5 py-3">Промокод</th>
                <th className="px-5 py-3">Статус</th>
                <th className="px-5 py-3 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/50">
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                    {new Date(p.paidAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-5 py-3">{p.userEmail}</td>
                  <td className="px-5 py-3">{p.courseTitle ?? 'Подписка'}</td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums">
                    {formatPrice(p.amountMinor)}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{METHOD_LABEL[p.method]}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.promocode ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                        STATUS_META[p.status].cls,
                      )}
                    >
                      {STATUS_META[p.status].label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {p.status === 'succeeded' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => onRefund(p.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        Вернуть
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile: карточки */}
          <ul className="divide-y divide-border/40 md:hidden">
            {visible.map((p) => (
              <li key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.userEmail}</div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {p.courseTitle ?? 'Подписка'}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {p.status === 'succeeded' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => onRefund(p.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        Вернуть
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 font-medium',
                      STATUS_META[p.status].cls,
                    )}
                  >
                    {STATUS_META[p.status].label}
                  </span>
                  <span className="font-medium tabular-nums">{formatPrice(p.amountMinor)}</span>
                  <span className="text-muted-foreground">{METHOD_LABEL[p.method]}</span>
                  <span className="text-muted-foreground">
                    {new Date(p.paidAt).toLocaleDateString('ru-RU')}
                  </span>
                  {p.promocode ? (
                    <span className="text-muted-foreground">Промокод: {p.promocode}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
