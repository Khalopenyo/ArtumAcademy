'use client';

import { Suspense, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useArtumStore } from '@/lib/store';

/**
 * Страница входа (ТЗ §4.6) — реальный submit против mock store.
 * Поддерживает `?next=<path>` для редиректа на ту страницу, откуда юзер
 * был отброшен auth gate'ом.
 */
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
  const loginUser = useArtumStore((s) => s.loginUser);
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const next = searchParams.get('next') ?? '/';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(() => {
      const res = loginUser({ email, password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Добро пожаловать, ${res.user.name}!`);
      router.push(next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <LogIn className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Вход в Artum</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Введите email и пароль, чтобы продолжить обучение
        </p>
        <p className="mt-2 text-xs text-muted-foreground/80">
          Демо-аккаунт: <code className="font-mono">ivan.petrov@example.com</code> / <code className="font-mono">demo1234</code>
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@artum.academy"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Пароль</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              Забыли?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Минимум 8 символов"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Входим…' : 'Войти'}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" aria-hidden />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-2 text-muted-foreground">или через</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() =>
          toast.info('Google OAuth подключим на этапе с реальной БД', {
            description: 'Сейчас используется mock-аутентификация в localStorage',
          })
        }
      >
        <GoogleIcon className="mr-2 size-5" aria-hidden /> Войти через Google
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Нет аккаунта?{' '}
        <Link
          href={next === '/' ? '/register' : `/register?next=${encodeURIComponent(next)}`}
          className="text-primary hover:underline"
        >
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M21.35 11.1h-9.17v2.96h5.27c-.49 2.51-2.71 4.32-5.27 4.32-3.17 0-5.74-2.57-5.74-5.74S8.99 6.9 12.18 6.9c1.46 0 2.78.54 3.8 1.43l2.11-2.12a8.5 8.5 0 0 0-5.91-2.27c-4.7 0-8.51 3.81-8.51 8.5s3.81 8.5 8.51 8.5c4.91 0 8.16-3.45 8.16-8.32 0-.56-.05-1.1-.15-1.62z" fill="#fff" />
    </svg>
  );
}
