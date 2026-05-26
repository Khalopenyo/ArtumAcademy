'use client';

import { useMemo } from 'react';

/**
 * Минимальный shape платежа для chart'а — namespace-agnostic.
 * Работает и со StoredPayment (mock), и с server PaymentRecord.
 */
interface ChartPayment {
  status: 'succeeded' | 'refunded';
  paidAt: string;
  amountMinor: number;
}

interface RevenueChartProps {
  payments: ChartPayment[];
  /** Сколько месяцев показывать (по умолчанию 6) */
  months?: number;
}

/**
 * Простой bar-chart дохода по месяцам.
 * Без внешних библиотек — голый SVG / divs.
 */
export function RevenueChart({ payments, months = 6 }: RevenueChartProps) {
  const buckets = useMemo(() => {
    const now = new Date();
    const labels: { key: string; label: string; total: number }[] = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      labels.push({ key, label, total: 0 });
    }
    const byKey = new Map(labels.map((b) => [b.key, b]));
    for (const p of payments) {
      if (p.status !== 'succeeded') continue;
      const d = new Date(p.paidAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const b = byKey.get(key);
      if (b) b.total += p.amountMinor;
    }
    return labels;
  }, [payments, months]);

  const maxTotal = Math.max(1, ...buckets.map((b) => b.total));
  const totalSum = buckets.reduce((s, b) => s + b.total, 0);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Доход за последние {months} месяцев
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {new Intl.NumberFormat('ru-RU').format(totalSum / 100)} ₽
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {payments.filter((p) => p.status === 'succeeded').length} платежей всего
        </span>
      </div>

      <div className="mt-6 flex h-32 items-end gap-2">
        {buckets.map((b) => {
          const heightPct = (b.total / maxTotal) * 100;
          return (
            <div
              key={b.key}
              className="group flex flex-1 flex-col items-center gap-1.5"
              title={`${b.label}: ${new Intl.NumberFormat('ru-RU').format(b.total / 100)} ₽`}
            >
              <div className="relative flex h-full w-full items-end">
                <div
                  className="w-full rounded-t-md bg-primary/30 transition-all group-hover:bg-primary/50"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                  aria-hidden
                />
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {b.label}
              </div>
              <div className="text-xs tabular-nums">
                {b.total === 0
                  ? '—'
                  : `${Math.round(b.total / 100_000)}k`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
