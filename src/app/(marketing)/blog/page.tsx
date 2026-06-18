import Link from 'next/link';
import { Newspaper } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/shared/GlassCard';

export const metadata = {
  title: 'Блог / Новости — скоро',
  description: 'Статьи, разборы и новости платформы Artum Academy.',
};

export default function BlogPage() {
  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-12">
      <GlassCard glow className="max-w-md p-6 text-center sm:p-10">
        <div
          className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"
          aria-hidden
        >
          <Newspaper className="size-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Блог / Новости — скоро</h1>
        <p className="mt-2 text-sm text-primary-light/70">
          Здесь будут статьи, разборы и новости платформы: тренды нейросетей,
          съёмки, монтажа и дизайна, обновления курсов. Раздел в работе.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">К каталогу курсов</Link>
        </Button>
      </GlassCard>
    </div>
  );
}
