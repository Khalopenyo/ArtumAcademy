'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/shared/GlassCard';

interface Props {
  status: 'pending' | 'succeeded' | 'canceled' | 'refunded' | string;
  kind: 'course' | 'subscription';
  courseSlug: string | null;
}

const MAX_POLLS = 12; // ~30 сек

/**
 * Поллит статус платежа: доступ выдаётся вебхуком асинхронно, поэтому пока
 * 'pending' — каждые 2.5с делаем router.refresh() (сервер перечитывает статус).
 */
export function PaymentReturnClient({ status, kind, courseSlug }: Props) {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (status !== 'pending' || tries >= MAX_POLLS) return;
    const t = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, 2500);
    return () => clearTimeout(t);
  }, [status, tries, router]);

  // Подписка → каталог («/»); курс → его страница. (/dashboard не существует.)
  const learnHref = kind === 'course' && courseSlug ? `/courses/${courseSlug}` : '/';

  return (
    <div className="container mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-4 py-12">
      <GlassCard className="w-full p-8 text-center">
        {status === 'succeeded' ? (
          <>
            <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
              <CheckCircle2 className="size-7" aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Оплата прошла!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {kind === 'course'
                ? 'Доступ к курсу открыт. Чек придёт на вашу почту.'
                : 'Подписка активна — доступ ко всем курсам открыт. Чек придёт на почту.'}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button asChild>
                <Link href={learnHref}>{kind === 'course' ? 'К курсу' : 'К курсам'}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/profile">В профиль</Link>
              </Button>
            </div>
          </>
        ) : status === 'canceled' || status === 'refunded' ? (
          <>
            <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive ring-1 ring-destructive/30">
              <XCircle className="size-7" aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Оплата не завершена</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Платёж отменён или не прошёл. Деньги не списаны — можно попробовать ещё раз.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button asChild variant="outline">
                <Link href={learnHref}>Вернуться</Link>
              </Button>
            </div>
          </>
        ) : tries >= MAX_POLLS ? (
          <>
            <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              <Clock className="size-7" aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Оплата обрабатывается</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Это занимает чуть больше обычного. Доступ откроется автоматически в течение
              пары минут — загляните в профиль чуть позже.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button asChild variant="outline">
                <Link href="/profile">В профиль</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
              <Loader2 className="size-7 animate-spin" aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Проверяем оплату…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Подтверждаем платёж и открываем доступ. Не закрывайте страницу.
            </p>
          </>
        )}
      </GlassCard>
    </div>
  );
}
