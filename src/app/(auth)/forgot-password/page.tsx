'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useArtumStore } from '@/lib/store';

export default function ForgotPasswordPage() {
  const requestPasswordReset = useArtumStore((s) => s.requestPasswordReset);
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<{ email: string; resetLink: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(() => {
      const res = requestPasswordReset(email);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const resetLink = `${window.location.origin}/reset-password?token=${res.token}`;
      setSentTo({ email: email.trim(), resetLink });
      toast.success('Ссылка для сброса пароля «отправлена»');
    });
  }

  if (sentTo) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <KeyRound className="size-6" aria-hidden />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Письмо отправлено</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Мы «отправили» инструкцию на <span className="text-foreground">{sentTo.email}</span>
          </p>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="font-medium text-foreground">Демо-режим</p>
          <p className="mt-1 text-muted-foreground">
            Письмо не отправляется по-настоящему. Откройте ссылку ниже, чтобы продолжить
            восстановление пароля:
          </p>
          <Link
            href={sentTo.resetLink.replace(window.location.origin, '')}
            className="mt-3 inline-flex max-w-full break-all text-primary underline-offset-2 hover:underline"
          >
            {sentTo.resetLink}
          </Link>
        </div>

        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href="/login">Вернуться ко входу</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <KeyRound className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Восстановление пароля</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Введите email — мы «отправим» ссылку для сброса
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

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Отправляем…' : 'Отправить ссылку'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Вспомнили пароль?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
