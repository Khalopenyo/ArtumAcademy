'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download, Settings, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteAccountAction, exportMyDataAction } from '@/server/actions/account';
import { updatePasswordAction, updateProfileAction } from '@/server/actions/auth';
import type { AuthUser } from '@/server/queries/auth';

interface ProfileSettingsProps {
  user: AuthUser;
}

/**
 * Реальное редактирование профиля: имя, email, пароль.
 * Использует Supabase Auth Server Actions:
 *   - имя/email → updateProfileAction (пишет в profiles + auth.users)
 *   - пароль → updatePasswordAction (Supabase signed-in session уже верифицирована;
 *     поэтому current password не запрашиваем — это стандартный паттерн @supabase)
 *
 * После успешного апдейта вызываем router.refresh() чтобы Server Components
 * (Header) перетянули новый user.
 */
export function ProfileSettings({ user }: ProfileSettingsProps) {
  return (
    <div className="space-y-6">
      <CredentialsCard user={user} />
      <ProfileCard user={user} />
      <p className="text-xs text-muted-foreground">
        Изменения сохраняются в Supabase. При смене email Supabase отправит
        письмо подтверждения на новый адрес (когда SMTP будет настроен).
      </p>
      <DangerZone user={user} />
    </div>
  );
}

/**
 * 152-ФЗ: право на доступ к данным (выгрузка в JSON) и право на удаление
 * аккаунта. Удаление необратимо → требует ввести слово-подтверждение.
 */
function DangerZone({ user }: { user: AuthUser }) {
  const [pendingExport, startExport] = useTransition();
  const [pendingDelete, startDelete] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const CONFIRM_WORD = 'УДАЛИТЬ';
  const confirmed = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  function onExport() {
    startExport(async () => {
      const res = await exportMyDataAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'artum-academy-my-data.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Данные выгружены в файл');
    });
  }

  function onDelete() {
    if (!confirmed) return;
    startDelete(async () => {
      const res = await deleteAccountAction();
      if (!res.ok) {
        toast.error(res.error ?? 'Не удалось удалить аккаунт');
        return;
      }
      toast.success('Аккаунт и все данные удалены');
      // Жёсткий редирект: сессия аннулирована, сбрасываем весь клиентский стейт.
      window.location.href = '/';
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-destructive/40 bg-destructive/5">
      <div className="flex items-start gap-3 border-b border-destructive/30 p-5">
        <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
          <ShieldAlert className="size-5" aria-hidden />
        </div>
        <div>
          <h3 className="text-base font-semibold">Управление данными</h3>
          <p className="text-sm text-muted-foreground">
            Ваши права по 152-ФЗ: выгрузка персональных данных и удаление аккаунта.
          </p>
        </div>
      </div>
      <div className="divide-y divide-destructive/20">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="space-y-1">
            <div className="text-sm font-medium">Скачать мои данные</div>
            <div className="max-w-md text-sm text-muted-foreground">
              Профиль, покупки, платежи, сертификаты, прогресс и согласия — одним
              JSON-файлом.
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onExport} disabled={pendingExport}>
            <Download className="mr-2 size-4" aria-hidden />
            {pendingExport ? 'Готовим…' : 'Скачать'}
          </Button>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-destructive">Удалить аккаунт</div>
              <div className="max-w-md text-sm text-muted-foreground">
                Безвозвратно удалит профиль <span className="text-foreground">{user.email}</span>,
                доступы к курсам, сертификаты и историю. Действие нельзя отменить.
              </div>
            </div>
            {!confirming ? (
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirming(true)}
              >
                <Trash2 className="mr-2 size-4" aria-hidden />
                Удалить
              </Button>
            ) : null}
          </div>

          {confirming ? (
            <div className="max-w-md space-y-3 rounded-xl border border-destructive/30 bg-background/40 p-4">
              <Label htmlFor="confirm-delete" className="text-xs">
                Для подтверждения введите{' '}
                <span className="font-semibold text-destructive">{CONFIRM_WORD}</span>
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={pendingDelete}
                autoComplete="off"
                placeholder={CONFIRM_WORD}
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConfirming(false);
                    setConfirmText('');
                  }}
                  disabled={pendingDelete}
                >
                  Отмена
                </Button>
                <Button
                  size="sm"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onDelete}
                  disabled={pendingDelete || !confirmed}
                >
                  {pendingDelete ? 'Удаляем…' : 'Удалить навсегда'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CredentialsCard({ user }: { user: AuthUser }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
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

function ProfileCard({ user }: { user: AuthUser }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
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

function NameRow({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);

  function save() {
    startTransition(async () => {
      const res = await updateProfileAction({ name });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Имя обновлено');
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium">Имя</div>
        {editing ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            className="w-full sm:max-w-[16rem] sm:min-w-[16rem]"
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

function EmailRow({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(user.email);

  function save() {
    startTransition(async () => {
      const res = await updateProfileAction({ email });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Email обновлён. Проверьте почту для подтверждения.');
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium">Email</div>
        {editing ? (
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            className="w-full sm:max-w-[16rem] sm:min-w-[16rem]"
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
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [next1, setNext1] = useState('');
  const [next2, setNext2] = useState('');
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    if (next1 !== next2) {
      setError('Новые пароли не совпадают');
      return;
    }
    if (next1.length < 8) {
      setError('Пароль минимум 8 символов');
      return;
    }
    startTransition(async () => {
      const res = await updatePasswordAction(next1);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success('Пароль обновлён');
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
              disabled={pending || next1.length < 8 || next2.length < 8}
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
