'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Layers, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/mock/courses';
import { buySubscriptionAction, cancelSubscriptionAction } from '@/server/actions/commerce';
import type { SubscriptionRecord } from '@/server/queries/commerce';
import { cn } from '@/lib/utils';

export interface PlanView {
  id: string;
  name: string;
  description: string;
  priceMonthlyMinor: number;
  priceYearlyMinor: number;
  isAllCourses: boolean;
  courseTitles: string[];
}

interface SubscribeClientProps {
  isLoggedIn: boolean;
  activeSubscription: SubscriptionRecord | null;
  plans: PlanView[];
}

export function SubscribeClient({ isLoggedIn, activeSubscription, plans }: SubscribeClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');

  function handleBuy(planId: string) {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent('/subscribe')}`);
      return;
    }
    startTransition(async () => {
      const res = await buySubscriptionAction(planId, period);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data?.confirmationUrl) {
        window.location.href = res.data.confirmationUrl;
        return;
      }
      router.push('/');
    });
  }

  function handleCancel() {
    if (!confirm('Отменить подписку? Доступ останется до конца оплаченного периода.')) return;
    startTransition(async () => {
      const res = await cancelSubscriptionAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Подписка отменена');
      router.refresh();
    });
  }

  return (
    <div className="container mx-auto px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Layers className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Подписка</h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          Оформите подписку и получите доступ к набору курсов. Один платёж за период — учитесь без
          переплат за каждый курс.
        </p>
      </div>

      {/* Активная подписка */}
      {activeSubscription ? (
        <section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-primary/30 bg-primary/5 p-6 backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <ShieldCheck className="size-6" aria-hidden />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Подписка активна</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Период «{activeSubscription.period === 'monthly' ? 'Месяц' : 'Год'}» · действует до{' '}
                <span className="text-foreground">
                  {new Date(activeSubscription.expiresAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-destructive hover:text-destructive"
                onClick={handleCancel}
                disabled={pending}
              >
                Отменить продление
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {plans.length === 0 ? (
        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground backdrop-blur">
          Планы подписки скоро появятся.
        </div>
      ) : (
        <>
          {/* Переключатель периода */}
          <div className="mx-auto mt-10 flex w-fit items-center gap-1 rounded-full border border-border/60 bg-card/60 p-1 backdrop-blur">
            <PeriodTab active={period === 'monthly'} onClick={() => setPeriod('monthly')}>
              Месяц
            </PeriodTab>
            <PeriodTab active={period === 'yearly'} onClick={() => setPeriod('yearly')}>
              Год · выгоднее
            </PeriodTab>
          </div>

          {/* Карточки планов */}
          <section
            className={cn(
              'mx-auto mt-8 grid max-w-5xl gap-6',
              plans.length === 1 ? 'max-w-md' : 'sm:grid-cols-2 lg:grid-cols-3',
            )}
          >
            {plans.map((p) => {
              const priceMinor =
                period === 'monthly' ? p.priceMonthlyMinor : p.priceYearlyMinor;
              const unavailable = priceMinor <= 0;
              return (
                <PlanCard
                  key={p.id}
                  plan={p}
                  priceMinor={priceMinor}
                  period={period}
                  ctaLabel={
                    pending
                      ? 'Покупаем…'
                      : unavailable
                        ? 'Период недоступен'
                        : `Оформить за ${formatPrice(priceMinor)}`
                  }
                  onClick={() => handleBuy(p.id)}
                  disabled={pending || unavailable || !!activeSubscription}
                />
              );
            })}
          </section>
        </>
      )}

      <p className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-emerald-500/80" aria-hidden />
        Безопасная оплата через ЮKassa · чек по 54-ФЗ · отмена в любой момент
      </p>

      {/* Альтернатива — отдельная покупка курса */}
      <section className="mx-auto mt-10 max-w-2xl text-center">
        <p className="text-sm text-muted-foreground">
          Нужен только один курс?{' '}
          <Link href="/" className="text-primary hover:underline">
            Купите его отдельно
          </Link>{' '}
          — это отдельная разовая покупка, без подписки.
        </p>
      </section>
    </div>
  );
}

function PeriodTab({
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
        'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function PlanCard({
  plan,
  priceMinor,
  period,
  ctaLabel,
  onClick,
  disabled,
}: {
  plan: PlanView;
  priceMinor: number;
  period: 'monthly' | 'yearly';
  ctaLabel: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <div className="relative flex h-full flex-col gap-4 rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl">
      <div>
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 truncate text-xl font-bold">{plan.name}</h2>
          {plan.isAllCourses ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
              <Sparkles className="size-3" aria-hidden /> Всё
            </span>
          ) : null}
        </div>
        {plan.description ? (
          <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
        ) : null}
      </div>

      <div className="bg-gradient-to-br from-white to-primary-lighter bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
        {priceMinor > 0 ? formatPrice(priceMinor) : '—'}
        <span className="ml-1 bg-none text-sm font-normal text-muted-foreground [-webkit-text-fill-color:initial]">
          / {period === 'monthly' ? 'мес' : 'год'}
        </span>
      </div>

      <ul className="space-y-2 text-sm">
        {plan.isAllCourses ? (
          <>
            <Feature>Доступ ко всему каталогу курсов</Feature>
            <Feature>Новые курсы добавляются автоматически</Feature>
          </>
        ) : (
          <>
            {plan.courseTitles.slice(0, 6).map((t) => (
              <Feature key={t}>{t}</Feature>
            ))}
            {plan.courseTitles.length > 6 ? (
              <li className="pl-6 text-xs text-muted-foreground">
                и ещё {plan.courseTitles.length - 6}
              </li>
            ) : null}
            {plan.courseTitles.length === 0 ? (
              <li className="text-xs text-muted-foreground">Курсы скоро добавят в план</li>
            ) : null}
          </>
        )}
        <Feature>Сертификаты PDF за завершённые курсы</Feature>
        <Feature>Отмена в любой момент</Feature>
      </ul>

      <Button size="lg" onClick={onClick} disabled={disabled} className="mt-auto w-full">
        {ctaLabel}
      </Button>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 line-clamp-2 text-muted-foreground">{children}</span>
    </li>
  );
}
