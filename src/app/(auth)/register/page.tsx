'use client';

import { Suspense, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/shared/GlassCard';
import { signUpAction } from '@/server/actions/auth';

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = searchParams.get('next') ?? '/';
  const canSubmit = name.length > 0 && email.length > 0 && password.length >= 8 && agreed;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await signUpAction({ name, email, password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Аккаунт создан. Добро пожаловать, ${name}!`);
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
            <UserPlus className="size-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Регистрация</h1>
          <p className="mt-2 text-sm text-[#C4A8FF]/70">
            Создайте аккаунт, чтобы покупать курсы и получать сертификаты
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">
              Имя
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Как к вам обращаться?"
              autoComplete="given-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              className="h-11 border-border/60 bg-background/40 backdrop-blur"
            />
          </div>
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
            <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
              Пароль
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Минимум 8 символов"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              className="h-11 border-border/60 bg-background/40 backdrop-blur"
            />
            <p className="text-[11px] text-muted-foreground/70">Минимум 8 символов</p>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/30 p-3 backdrop-blur">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              className="mt-0.5"
              disabled={pending}
            />
            <Label htmlFor="agree" className="text-xs font-normal leading-relaxed text-muted-foreground">
              Я согласен с{' '}
              <Link href="/oferta" target="_blank" className="text-primary underline-offset-2 hover:underline">
                публичной офертой
              </Link>
              {' '}и даю согласие на обработку персональных данных в соответствии с{' '}
              <Link href="/privacy" target="_blank" className="text-primary underline-offset-2 hover:underline">
                политикой конфиденциальности
              </Link>
            </Label>
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
            disabled={!canSubmit || pending}
          >
            {pending ? 'Создаём аккаунт…' : 'Создать аккаунт'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{' '}
          <Link
            href={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`}
            className="font-medium text-primary transition-colors hover:text-[#C4A8FF]"
          >
            Войти
          </Link>
        </p>
      </div>
    </GlassCard>
  );
}
