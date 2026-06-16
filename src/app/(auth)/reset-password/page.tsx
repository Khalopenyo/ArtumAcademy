'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LockKeyhole } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/shared/GlassCard';
import { updatePasswordAction } from '@/server/actions/auth';

/**
 * Страница сброса пароля.
 * Пользователь попадает сюда по ссылке из письма Supabase recovery.
 * К моменту попадания у него уже есть recovery-сессия (Supabase
 * автоматически обменивает ?code= на сессию через middleware).
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    startTransition(async () => {
      const res = await updatePasswordAction(password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success('Пароль обновлён');
      router.push('/');
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
            <LockKeyhole className="size-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Новый пароль</h1>
          <p className="mt-2 text-sm text-primary-light/70">
            Придумайте новый пароль для вашего аккаунта
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
              Новый пароль
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-xs uppercase tracking-wider text-muted-foreground">
              Повторите пароль
            </Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Тот же пароль"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {pending ? 'Сохраняем…' : 'Установить пароль'}
          </Button>
        </form>
      </div>
    </GlassCard>
  );
}
