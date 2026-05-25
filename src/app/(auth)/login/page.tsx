'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Страница входа (ТЗ §4.6).
 * Скелет: статичная форма без submit-логики. Реальный auth — этап 2 ТЗ §9.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          toast.info('Авторизация появится на этапе 2 ТЗ §9', {
            description: 'Сейчас вы видите скелет (этап 1 ТЗ §9 — вёрстка)',
          });
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@artum.academy"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button type="submit" size="lg" className="w-full">
          Войти
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
          toast.info('Google OAuth подключим на этапе 2 ТЗ §9', {
            description: 'Сейчас вы видите скелет (этап 1 ТЗ §9 — вёрстка)',
          })
        }
      >
        <GoogleIcon className="mr-2 size-5" aria-hidden /> Войти через Google
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Нет аккаунта?{' '}
        <Link href="/register" className="text-primary hover:underline">
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
