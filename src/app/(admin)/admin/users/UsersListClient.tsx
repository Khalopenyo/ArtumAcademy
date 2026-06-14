'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, Plus, Search, Settings2, ShieldCheck, ShieldOff, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  grantCourseAccessAction,
  revokeCourseAccessAction,
  setUserRoleAction,
} from '@/server/actions/admin/users';
import type { AdminUserRow } from '@/server/queries/admin';
import { cn } from '@/lib/utils';

interface CourseOption {
  slug: string;
  title: string;
}

interface UsersListClientProps {
  users: AdminUserRow[];
  courses: CourseOption[];
}

export function UsersListClient({ users, courses }: UsersListClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'student'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [grantSlug, setGrantSlug] = useState('');

  const titleBySlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of courses) m.set(c.slug, c.title);
    return m;
  }, [courses]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter === 'admin' && !u.isAdmin) return false;
      if (roleFilter === 'student' && u.isAdmin) return false;
      if (!normalized) return true;
      return (
        u.name.toLowerCase().includes(normalized) || u.email.toLowerCase().includes(normalized)
      );
    });
  }, [users, query, roleFilter]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? 'Ошибка');
        return;
      }
      toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        К админ-панели
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Пользователи</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Всего: {users.length}. Показано: {rows.length}
      </p>

      {/* Search + filter */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Поиск по имени или email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-border/60 bg-card/60 pl-9 pr-9 backdrop-blur"
          />
          {query ? (
            <button
              type="button"
              aria-label="Очистить"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="inline-flex rounded-md border border-border/60 bg-card/60 p-1 text-xs backdrop-blur">
          {(['all', 'admin', 'student'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={cn(
                'rounded-sm px-3 py-1.5 transition-colors',
                roleFilter === r
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r === 'all' ? 'Все' : r === 'admin' ? 'admin' : 'студенты'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {query ? `По запросу «${query}» ничего не найдено.` : 'Пользователей пока нет.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-card/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Имя · email</th>
                <th className="px-5 py-3 text-left font-medium">Роль</th>
                <th className="px-5 py-3 text-left font-medium">Регистрация</th>
                <th className="px-5 py-3 text-right font-medium">Куплено</th>
                <th className="px-5 py-3 text-right font-medium">Серт.</th>
                <th className="px-5 py-3 text-right font-medium">Уроков</th>
                <th className="px-5 py-3 text-right font-medium">Подписка</th>
                <th className="px-5 py-3 text-right font-medium">Управление</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((u) => {
                const expanded = expandedId === u.id;
                return (
                  <Fragment key={u.id}>
                    <tr className="hover:bg-secondary/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="inline-flex size-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary ring-1 ring-primary/30"
                          >
                            {u.initials}
                          </span>
                          <div>
                            <div className="font-medium">{u.name}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {u.isAdmin ? (
                          <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                            admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-secondary/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            студент
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {new Date(u.registeredAt).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">
                        {u.purchasesCount}
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">
                        {u.certificatesCount}
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">
                        {u.completedLessonsCount}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {u.hasActiveSubscription ? (
                          <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                            активна
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setExpandedId(expanded ? null : u.id);
                            setGrantSlug('');
                          }}
                        >
                          <Settings2 className="size-4" aria-hidden />
                        </Button>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="bg-secondary/20">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="space-y-3">
                            {/* Роль */}
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="w-28 text-sm text-muted-foreground">Роль:</span>
                              {u.isAdmin ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={pending}
                                  onClick={() => run(() => setUserRoleAction(u.id, false), 'Роль снята')}
                                >
                                  <ShieldOff className="mr-1 size-4" aria-hidden />
                                  Снять админа
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={pending}
                                  onClick={() => run(() => setUserRoleAction(u.id, true), 'Назначен админом')}
                                >
                                  <ShieldCheck className="mr-1 size-4" aria-hidden />
                                  Сделать админом
                                </Button>
                              )}
                            </div>

                            {/* Выдать доступ */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="w-28 text-sm text-muted-foreground">Выдать курс:</span>
                              <select
                                value={grantSlug}
                                onChange={(e) => setGrantSlug(e.target.value)}
                                className="h-9 min-w-[14rem] rounded-md border border-input bg-background px-3 text-sm"
                              >
                                <option value="">— выберите курс —</option>
                                {courses
                                  .filter((c) => !u.purchasedCourseSlugs.includes(c.slug))
                                  .map((c) => (
                                    <option key={c.slug} value={c.slug}>
                                      {c.title}
                                    </option>
                                  ))}
                              </select>
                              <Button
                                size="sm"
                                disabled={pending || !grantSlug}
                                onClick={() => {
                                  const slug = grantSlug;
                                  setGrantSlug('');
                                  run(() => grantCourseAccessAction(u.id, slug), 'Доступ выдан');
                                }}
                              >
                                <Plus className="mr-1 size-4" aria-hidden />
                                Выдать
                              </Button>
                            </div>

                            {/* Есть доступ — отозвать */}
                            <div className="flex flex-wrap items-start gap-2">
                              <span className="w-28 pt-1.5 text-sm text-muted-foreground">
                                Есть доступ:
                              </span>
                              <div className="flex flex-1 flex-wrap gap-2">
                                {u.purchasedCourseSlugs.length === 0 ? (
                                  <span className="pt-1.5 text-sm text-muted-foreground/60">—</span>
                                ) : (
                                  u.purchasedCourseSlugs.map((slug) => (
                                    <span
                                      key={slug}
                                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs"
                                    >
                                      {titleBySlug.get(slug) ?? slug}
                                      <button
                                        type="button"
                                        aria-label="Отозвать доступ"
                                        disabled={pending}
                                        onClick={() =>
                                          run(
                                            () => revokeCourseAccessAction(u.id, slug),
                                            'Доступ отозван',
                                          )
                                        }
                                        className="text-destructive transition-opacity hover:opacity-60"
                                      >
                                        <X className="size-3.5" aria-hidden />
                                      </button>
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
