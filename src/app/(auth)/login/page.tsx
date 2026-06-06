'use client';

import { Suspense, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { LogIn, Mail, KeyRound, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/shared/GlassCard';
import { signInAction, requestEmailCodeAction, verifyEmailCodeAction } from '@/server/actions/auth';

type Mode = 'password' | 'code';

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
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = searchParams.get('next') ?? '/';

  function finishLogin() {
    toast.success('Добро пожаловать!');
    router.push(next);
    router.refresh();
  }

  function switchMode(m: Mode) {
    setError(null);
    setCode('');
    setCodeSent(false);
    setMode(m);
  }

  function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signInAction({ email, password });
      if (!res.ok) return setError(res.error);
      finishLogin();
    });
  }

  function onRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestEmailCodeAction(email);
      if (!res.ok) return setError(res.error);
      setCodeSent(true);
      toast.success(`Код отправлен на ${email}`);
    });
  }

  function onVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyEmailCodeAction({ email, code });
      if (!res.ok) return setError(res.error);
      finishLogin();
    });
  }

  const inputCls = 'h-11 border-border/60 bg-background/40 backdrop-blur';

  return (
    <GlassCard glow className="p-8 sm:p-10">
      <div className="space-y-6">
        <div className="text-center">
          <div
            className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"
            aria-hidden
          >
            {mode === 'code' ? <Mail className="size-6" /> : <LogIn className="size-6" />}
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Вход в Artum</h1>
          <p className="mt-2 text-sm text-[#C4A8FF]/70">
            {mode === 'password'
              ? 'Введите email и пароль, чтобы продолжить обучение'
              : codeSent
                ? `Введите код из письма, отправленного на ${email}`
                : 'Отправим одноразовый код на вашу почту'}
          </p>
        </div>

        {/* ── Режим: пароль ── */}
        {mode === 'password' ? (
          <form onSubmit={onPasswordSubmit} className="space-y-4">
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
                className={inputCls}
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
                className={inputCls}
              />
            </div>

            {error ? <ErrorBox>{error}</ErrorBox> : null}

            <Button type="submit" size="lg" className={primaryCls} disabled={pending}>
              {pending ? 'Входим…' : 'Войти'}
            </Button>

            <button
              type="button"
              onClick={() => switchMode('code')}
              className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <KeyRound className="size-4" aria-hidden />
              Войти по коду из письма
            </button>
          </form>
        ) : null}

        {/* ── Режим: код из письма ── */}
        {mode === 'code' && !codeSent ? (
          <form onSubmit={onRequestCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code-email" className="text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="code-email"
                type="email"
                placeholder="you@artum.academy"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                className={inputCls}
              />
            </div>

            {error ? <ErrorBox>{error}</ErrorBox> : null}

            <Button type="submit" size="lg" className={primaryCls} disabled={pending}>
              {pending ? 'Отправляем…' : 'Получить код'}
            </Button>

            <button
              type="button"
              onClick={() => switchMode('password')}
              className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Войти по паролю
            </button>
          </form>
        ) : null}

        {mode === 'code' && codeSent ? (
          <form onSubmit={onVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-xs uppercase tracking-wider text-muted-foreground">
                Код из письма
              </Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={pending}
                className={`${inputCls} text-center text-lg tracking-[0.5em]`}
              />
            </div>

            {error ? <ErrorBox>{error}</ErrorBox> : null}

            <Button type="submit" size="lg" className={primaryCls} disabled={pending || code.length !== 6}>
              {pending ? 'Проверяем…' : 'Войти'}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setCode('');
                  setCodeSent(false);
                  setError(null);
                }}
                className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-4" aria-hidden />
                Изменить email
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await requestEmailCodeAction(email);
                    if (res.ok) toast.success('Код отправлен повторно');
                    else setError(res.error);
                  })
                }
                className="text-primary transition-colors hover:text-[#C4A8FF] disabled:opacity-50"
              >
                Отправить ещё раз
              </button>
            </div>
          </form>
        ) : null}

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

const primaryCls =
  'h-11 w-full bg-primary text-primary-foreground shadow-[0_0_24px_rgba(168,85,247,0.35)] hover:bg-primary/90';

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive backdrop-blur">
      {children}
    </p>
  );
}
