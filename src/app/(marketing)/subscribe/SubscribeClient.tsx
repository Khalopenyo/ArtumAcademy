'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Infinity as InfinityIcon, ShieldCheck, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/mock/courses';
import {
  buySubscriptionAction,
  cancelSubscriptionAction,
} from '@/server/actions/commerce';
import type { SubscriptionRecord } from '@/server/queries/commerce';
import { cn } from '@/lib/utils';

/** Цены тарифов подписки (копейки) — синхронизировано с server action */
const SUBSCRIPTION_PRICES = {
  monthly: 99_000,
  yearly: 990_000,
} as const;

interface SubscribeClientProps {
  isLoggedIn: boolean;
  activeSubscription: SubscriptionRecord | null;
}

export function SubscribeClient({ isLoggedIn, activeSubscription }: SubscribeClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleBuy(period: 'monthly' | 'yearly') {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent('/subscribe')}`);
      return;
    }
    startTransition(async () => {
      const res = await buySubscriptionAction(period);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        period === 'monthly' ? 'Подписка на 30 дней оформлена!' : 'Годовая подписка оформлена!',
      );
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
          <InfinityIcon className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Подписка на все курсы Artum
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          Один платёж — доступ ко всему каталогу. Учитесь без ограничений и переплат за каждый курс.
        </p>
      </div>

      {/* Активная подписка — отдельный блок */}
      {activeSubscription ? (
        <section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-primary/30 bg-primary/5 p-6 backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <ShieldCheck className="size-6" aria-hidden />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Подписка активна</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Тариф «{activeSubscription.period === 'monthly' ? 'Месячный' : 'Годовой'}» ·{' '}
                действует до{' '}
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

      {/* Тарифы */}
      <section className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-2">
        <PlanCard
          period="monthly"
          title="Месяц"
          price={SUBSCRIPTION_PRICES.monthly}
          subtitle="990 ₽ каждый месяц"
          features={[
            'Доступ ко всему каталогу из 7 категорий',
            'Новые курсы добавляются автоматически',
            'Сертификаты PDF на каждый завершённый курс',
            'Отмена в любой момент',
          ]}
          ctaLabel={pending ? 'Покупаем…' : 'Оформить за 990 ₽'}
          onClick={() => handleBuy('monthly')}
          disabled={pending || !!activeSubscription}
          highlight={false}
        />
        <PlanCard
          period="yearly"
          title="Год"
          price={SUBSCRIPTION_PRICES.yearly}
          subtitle="9 900 ₽ — выгода 20%"
          features={[
            'Всё что в месячном тарифе',
            'Выгода 2 376 ₽ за год',
            'Подходит для системного обучения',
            'Можно отменить — доступ до конца года',
          ]}
          ctaLabel={pending ? 'Покупаем…' : 'Оформить за 9 900 ₽'}
          onClick={() => handleBuy('yearly')}
          disabled={pending || !!activeSubscription}
          highlight
        />
      </section>

      {/* Альтернатива — купить курсы по-отдельности */}
      <section className="mx-auto mt-10 max-w-2xl text-center">
        <p className="text-sm text-muted-foreground">
          Не уверены, что хотите подписку?{' '}
          <Link href="/" className="text-primary hover:underline">
            Купите один курс отдельно
          </Link>
        </p>
      </section>
    </div>
  );
}

function PlanCard({
  period,
  title,
  price,
  subtitle,
  features,
  ctaLabel,
  onClick,
  disabled,
  highlight,
}: {
  period: 'monthly' | 'yearly';
  title: string;
  price: number;
  subtitle: string;
  features: string[];
  ctaLabel: string;
  onClick: () => void;
  disabled: boolean;
  highlight: boolean;
}) {
  return (
    <div className="relative">
      {highlight ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px -z-10 rounded-2xl opacity-70 blur-2xl"
          style={{
            background:
              'radial-gradient(circle at 50% 0%, rgba(168, 85, 247, 0.4), transparent 70%)',
          }}
        />
      ) : null}
      <div
        className={cn(
          'relative flex h-full flex-col gap-5 rounded-2xl border bg-card/60 p-6 backdrop-blur-xl sm:p-8',
          highlight
            ? 'border-primary/60 shadow-[0_0_40px_rgba(168,85,247,0.15)]'
            : 'border-border/60',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {highlight ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              <Zap className="size-3" aria-hidden /> Популярный
            </span>
          ) : null}
        </div>

        <div className="bg-gradient-to-br from-white to-[#E8DEFF] bg-clip-text text-3xl font-bold text-transparent">
          {formatPrice(price)}
          <span className="ml-1 bg-none text-sm font-normal text-muted-foreground [-webkit-text-fill-color:initial]">
            / {period === 'monthly' ? 'мес' : 'год'}
          </span>
        </div>

        <ul className="space-y-2 text-sm">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="text-muted-foreground">{f}</span>
            </li>
          ))}
        </ul>

        <Button
          size="lg"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'mt-auto w-full',
            highlight
              ? 'bg-primary text-primary-foreground shadow-[0_0_24px_rgba(168,85,247,0.35)] hover:bg-primary/90'
              : 'border border-border/60 bg-background/40 backdrop-blur',
          )}
          variant={highlight ? 'default' : 'outline'}
        >
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}
