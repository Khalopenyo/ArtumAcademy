'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function VerifyForm() {
  const router = useRouter();
  const [num, setNum] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = num.trim();
    if (v) router.push(`/verify/${encodeURIComponent(v)}`);
  }

  return (
    <div className="container mx-auto max-w-xl px-4 py-12 sm:py-16">
      <GlassCard glow className="p-8 text-center sm:p-10">
        <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
          <ShieldCheck className="size-7" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Проверка сертификата</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Введите номер сертификата (например, ART-2026-123456), чтобы убедиться в его подлинности.
        </p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Input
            value={num}
            onChange={(e) => setNum(e.target.value)}
            placeholder="ART-2026-..."
            aria-label="Номер сертификата"
            className="h-11 w-full min-w-0 border-border/60 bg-background/40 text-center font-mono backdrop-blur sm:flex-1 sm:text-left"
          />
          <Button type="submit" size="lg" className="h-11 w-full sm:w-auto" disabled={!num.trim()}>
            Проверить
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
