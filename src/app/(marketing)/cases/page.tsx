import Link from 'next/link';
import { Briefcase } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/shared/GlassCard';

export const metadata = { title: 'Кейсы — скоро' };

export default function CasesPage() {
  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-12">
      <GlassCard glow className="max-w-md p-10 text-center">
        <div
          className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"
          aria-hidden
        >
          <Briefcase className="size-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Кейсы — скоро</h1>
        <p className="mt-2 text-sm text-[#C4A8FF]/70">
          Соберём истории студентов: что научились делать, какие проекты сделали,
          куда устроились. Раздел в работе.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">К каталогу курсов</Link>
        </Button>
      </GlassCard>
    </div>
  );
}
