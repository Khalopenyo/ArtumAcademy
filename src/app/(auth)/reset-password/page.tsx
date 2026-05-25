'use client';

import { Suspense, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { LockKeyhole } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useArtumStore } from '@/lib/store';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}

function ResetInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const resetPasswordWithToken = useArtumStore((s) => s.resetPasswordWithToken);
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Неверная ссылка</h1>
        <p className="text-sm text-muted-foreground">
          В адресе нет recovery-token. Запросите новое восстановление пароля.
        </p>
        <Button asChild variant="outline">
          <Link href="/forgot-password">Запросить ссылку</Link>
        </Button>
      </div>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    startTransition(() => {
      const res = resetPasswordWithToken(token, password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success('Пароль обновлён. Войдите с новым паролем.');
      router.push('/login');
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <LockKeyhole className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Новый пароль</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Придумайте новый пароль для вашего аккаунта
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Новый пароль</Label>
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
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Повторите пароль</Label>
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
          />
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Сохраняем…' : 'Установить пароль'}
        </Button>
      </form>
    </div>
  );
}
