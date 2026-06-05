'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { RotateCcw, Home } from 'lucide-react';

import { GlassCard } from '@/components/shared/GlassCard';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';

/**
 * Граница ошибок сегмента (App Router). Ловит рантайм-ошибки в роутах —
 * вместо белого экрана показывает брендированный экран с «Повторить».
 * Ошибка уходит в Sentry.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <GlassCard glow className="w-full max-w-md p-8 text-center sm:p-10">
        <div className="flex justify-center">
          <Logo className="text-xl" />
        </div>
        <h1 className="mt-8 text-2xl font-bold tracking-tight sm:text-3xl">Что-то пошло не так</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Произошла непредвиденная ошибка — мы уже получили уведомление. Попробуйте обновить
          страницу или вернуться на главную.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={() => reset()}>
            <RotateCcw aria-hidden />
            Повторить
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">
              <Home aria-hidden />
              На главную
            </Link>
          </Button>
        </div>
      </GlassCard>
    </main>
  );
}
