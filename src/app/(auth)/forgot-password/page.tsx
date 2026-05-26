'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/shared/GlassCard';
import { requestPasswordResetAction } from '@/server/actions/auth';

export default function ForgotPasswordPage() {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestPasswordResetAction(email);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSentTo(email.trim());
      toast.success('Если email зарегистрирован, мы отправили ссылку');
    });
  }

  if (sentTo) {
    return (
      <GlassCard glow className="p-8 sm:p-10">
        <div className="space-y-6">
          <div className="text-center">
            <div
              className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"
              aria-hidden
            >
              <KeyRound className="size-6" />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Проверьте почту</h1>
            <p className="mt-2 text-sm text-[#C4A8FF]/70">
              Если <span className="text-foreground">{sentTo}</span> зарегистрирован, мы отправили
              ссылку для сброса пароля.
            </p>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs backdrop-blur">
            <p className="font-medium text-foreground">SMTP пока не настроен</p>
            <p className="mt-1 text-muted-foreground">
              Реальное письмо не доставится (пока подключим SMTP). Чтобы протестировать flow,
              открой Supabase Dashboard → Authentication → Users → найди свой email →
              Send password reset → возьми ссылку из{' '}
              <code className="rounded bg-card/80 px-1 font-mono text-[10px]">auth.flow_state</code>.
            </p>
          </div>

          <Button asChild variant="outline" size="lg" className="h-11 w-full border-border/60 bg-background/40">
            <Link href="/login">Вернуться ко входу</Link>
          </Button>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard glow className="p-8 sm:p-10">
      <div className="space-y-6">
        <div className="text-center">
          <div
            className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"
            aria-hidden
          >
            <KeyRound className="size-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Восстановление пароля</h1>
          <p className="mt-2 text-sm text-[#C4A8FF]/70">
            Введите email — мы отправим ссылку для сброса
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
            {pending ? 'Отправляем…' : 'Отправить ссылку'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Вспомнили пароль?{' '}
          <Link href="/login" className="font-medium text-primary transition-colors hover:text-[#C4A8FF]">
            Войти
          </Link>
        </p>
      </div>
    </GlassCard>
  );
}
