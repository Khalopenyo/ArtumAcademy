'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Settings, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type StoredUser, useArtumStore } from '@/lib/store';

interface ProfileSettingsProps {
  user: StoredUser;
}

/**
 * Реальное редактирование профиля: имя, email, пароль.
 * Mock-режим: пишет в Zustand store + localStorage. На стадии БД
 * заменится на Supabase Auth update calls.
 */
export function ProfileSettings({ user }: ProfileSettingsProps) {
  return (
    <div className="space-y-6">
      <CredentialsCard user={user} />
      <ProfileCard user={user} />
      <p className="text-xs text-muted-foreground">
        Сейчас все изменения сохраняются локально. На следующей стадии
        переедут на Supabase Auth + Postgres.
      </p>
    </div>
  );
}

function CredentialsCard({ user }: { user: StoredUser }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border p-5">
        <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ShieldCheck className="size-5" aria-hidden />
        </div>
        <div>
          <h3 className="text-base font-semibold">Учётные данные</h3>
          <p className="text-sm text-muted-foreground">
            Email и пароль для входа на платформу.
          </p>
        </div>
      </div>
      <div className="divide-y divide-border">
        <EmailRow user={user} />
        <PasswordRow />
      </div>
    </div>
  );
}

function ProfileCard({ user }: { user: StoredUser }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border p-5">
        <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Settings className="size-5" aria-hidden />
        </div>
        <div>
          <h3 className="text-base font-semibold">Профиль</h3>
          <p className="text-sm text-muted-foreground">
            Имя отображается в сертификатах и в хедере.
          </p>
        </div>
      </div>
      <div className="divide-y divide-border">
        <NameRow user={user} />
      </div>
    </div>
  );
}

function NameRow({ user }: { user: StoredUser }) {
  const updateProfile = useArtumStore((s) => s.updateProfile);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);

  function save() {
    startTransition(() => {
      const res = updateProfile({ name });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Имя обновлено');
      setEditing(false);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="space-y-1">
        <div className="text-sm font-medium">Имя</div>
        {editing ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            className="min-w-[16rem]"
          />
        ) : (
          <div className="text-sm text-muted-foreground">{user.name}</div>
        )}
      </div>
      <div className="flex gap-2">
        {editing ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setName(user.name);
                setEditing(false);
              }}
              disabled={pending}
            >
              Отмена
            </Button>
            <Button size="sm" onClick={save} disabled={pending || !name.trim()}>
              {pending ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Изменить
          </Button>
        )}
      </div>
    </div>
  );
}

function EmailRow({ user }: { user: StoredUser }) {
  const updateProfile = useArtumStore((s) => s.updateProfile);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(user.email);

  function save() {
    startTransition(() => {
      const res = updateProfile({ email });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Email обновлён');
      setEditing(false);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="space-y-1">
        <div className="text-sm font-medium">Email</div>
        {editing ? (
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            className="min-w-[16rem]"
            autoComplete="email"
          />
        ) : (
          <div className="text-sm text-muted-foreground">{user.email}</div>
        )}
      </div>
      <div className="flex gap-2">
        {editing ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEmail(user.email);
                setEditing(false);
              }}
              disabled={pending}
            >
              Отмена
            </Button>
            <Button size="sm" onClick={save} disabled={pending || !email.trim()}>
              {pending ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Изменить
          </Button>
        )}
      </div>
    </div>
  );
}

function PasswordRow() {
  const changePassword = useArtumStore((s) => s.changePassword);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState('');
  const [next1, setNext1] = useState('');
  const [next2, setNext2] = useState('');
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    if (next1 !== next2) {
      setError('Новые пароли не совпадают');
      return;
    }
    startTransition(() => {
      const res = changePassword({ currentPassword: current, newPassword: next1 });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success('Пароль обновлён');
      setCurrent('');
      setNext1('');
      setNext2('');
      setEditing(false);
    });
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 p-5">
      <div className="flex-1 space-y-1">
        <div className="text-sm font-medium">Пароль</div>
        {editing ? (
          <div className="mt-2 max-w-md space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cur-pw" className="text-xs">Текущий пароль</Label>
              <Input
                id="cur-pw"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw" className="text-xs">Новый пароль</Label>
              <Input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={next1}
                onChange={(e) => setNext1(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw2" className="text-xs">Повторите новый пароль</Label>
              <Input
                id="new-pw2"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={next2}
                onChange={(e) => setNext2(e.target.value)}
                disabled={pending}
              />
            </div>
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">••••••••</div>
        )}
      </div>
      <div className="flex gap-2">
        {editing ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCurrent('');
                setNext1('');
                setNext2('');
                setError(null);
                setEditing(false);
              }}
              disabled={pending}
            >
              Отмена
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={pending || !current || next1.length < 8 || next2.length < 8}
            >
              {pending ? 'Сохраняем…' : 'Сменить'}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Сменить
          </Button>
        )}
      </div>
    </div>
  );
}
