import Link from 'next/link';
import { Home, MessageCircle } from 'lucide-react';

import { GlassCard } from '@/components/shared/GlassCard';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Страница не найдена',
};

/**
 * Корневая 404 — ловит все несуществующие URL и вызовы notFound() из роутов
 * (например несуществующий /courses/[slug]). Брендированная, на русском,
 * с выходами наружу — чтобы пользователь не упирался в тупик.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <GlassCard glow className="w-full max-w-md p-8 text-center sm:p-10">
        <div className="flex justify-center">
          <Logo className="text-xl" />
        </div>

        <p className="mt-8 bg-gradient-to-br from-primary via-fuchsia-400 to-primary bg-clip-text text-7xl font-extrabold tracking-tight text-transparent sm:text-8xl">
          404
        </p>

        <h1 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">Страница не найдена</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Возможно, ссылка устарела или в адресе опечатка. Давайте вернёмся к обучению.
        </p>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/">
              <Home aria-hidden />
              На главную
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/contacts">
              <MessageCircle aria-hidden />
              Связаться с нами
            </Link>
          </Button>
        </div>
      </GlassCard>
    </main>
  );
}
