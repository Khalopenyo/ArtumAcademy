import Link from 'next/link';
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/shared/GlassCard';

export const metadata = { title: 'О компании' };

export default function AboutPage() {
  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-12">
      <GlassCard glow className="max-w-2xl p-10 text-center sm:p-12">
        <div
          className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"
          aria-hidden
        >
          <Sparkles className="size-6" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          О компании
        </h1>
        <p className="mt-4 text-base leading-relaxed text-primary-light/80">
          Artum Academy — образовательная платформа с курсами по AI, фото, видео,
          монтажу, дизайну, визуалу и копирайтингу. Преподают практики индустрии,
          а не теоретики.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Подробная страница со списком преподавателей, миссией и контактами
          появится позже. Пока — каталог курсов и подписка.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/">Каталог курсов</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/subscribe">Подписка</Link>
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
