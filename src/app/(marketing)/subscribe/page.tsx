'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Infinity as InfinityIcon, ShieldCheck, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/mock/courses';
import {
  SUBSCRIPTION_PRICES,
  getActiveSubscription,
  useArtumStore,
} from '@/lib/store';
import { useCurrentUser, useHydrated } from '@/lib/store/hooks';
import { cn } from '@/lib/utils';

export default function SubscribePage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const state = useArtumStore();
  const buySubscription = useArtumStore((s) => s.buySubscription);
  const cancelSubscription = useArtumStore((s) => s.cancelSubscription);
  const [pending, startTransition] = useTransition();

  const activeSub = hydrated && user ? getActiveSubscription(state, user.id) : null;

  function handleBuy(period: 'monthly' | 'yearly') {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent('/subscribe')}`);
      return;
    }
    startTransition(() => {
      const res = buySubscription(period);
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
    cancelSubscription();
    toast.success('Подписка отменена');
    router.refresh();
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
      {activeSub ? (
        <section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <div className="flex items-start gap-4">
            <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <ShieldCheck className="size-6" aria-hidden />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Подписка активна</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Тариф «{activeSub.period === 'monthly' ? 'Месячный' : 'Годовой'}» ·{' '}
                действует до{' '}
                <span className="text-foreground">
                  {new Date(activeSub.expiresAt).toLocaleDateString('ru-RU', {
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
          disabled={pending || !!activeSub}
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
          disabled={pending || !!activeSub}
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
    <div
      className={cn(
        'flex flex-col gap-5 rounded-2xl border bg-card p-6 sm:p-8',
        highlight
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {highlight ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Zap className="size-3" aria-hidden /> Популярный
          </span>
        ) : null}
      </div>

      <div className="text-3xl font-bold">
        {formatPrice(price)}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
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
        className="mt-auto w-full"
        variant={highlight ? 'default' : 'outline'}
      >
        {ctaLabel}
      </Button>
    </div>
  );
}
