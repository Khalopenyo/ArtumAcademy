'use client';

import { Suspense, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/shared/GlassCard';
import { signInAction } from '@/server/actions/auth';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const next = searchParams.get('next') ?? '/';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signInAction({ email, password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success('Добро пожаловать!');
      router.push(next);
      router.refresh();
    });
  }

  return (
    <GlassCard glow className="p-8 sm:p-10">
      <div className="space-y-6">
        <div className="text-center">
          <div
            className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"
            aria-hidden
          >
            <LogIn className="size-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Вход в Artum</h1>
          <p className="mt-2 text-sm text-[#C4A8FF]/70">
            Введите email и пароль, чтобы продолжить обучение
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@artum.academy"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              className="h-11 border-border/60 bg-background/40 backdrop-blur"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
                Пароль
              </Label>
              <Link href="/forgot-password" className="text-xs text-primary transition-colors hover:text-[#C4A8FF]">
                Забыли?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Минимум 8 символов"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              className="h-11 border-border/60 bg-background/40 backdrop-blur"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive backdrop-blur">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full bg-primary text-primary-foreground shadow-[0_0_24px_rgba(168,85,247,0.35)] hover:bg-primary/90"
            disabled={pending}
          >
            {pending ? 'Входим…' : 'Войти'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Нет аккаунта?{' '}
          <Link
            href={next === '/' ? '/register' : `/register?next=${encodeURIComponent(next)}`}
            className="font-medium text-primary transition-colors hover:text-[#C4A8FF]"
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </GlassCard>
  );
}
