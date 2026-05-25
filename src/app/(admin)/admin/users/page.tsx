'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  getAllCoursesEffective,
  getCourseProgressFromStore,
  isCoursePurchased,
  useArtumStore,
} from '@/lib/store';

export default function AdminUsersPage() {
  const state = useArtumStore();
  const allCourses = useMemo(() => getAllCoursesEffective(state), [state]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'student'>('all');

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return state.users
      .filter((u) => {
        if (roleFilter === 'admin' && !u.isAdmin) return false;
        if (roleFilter === 'student' && u.isAdmin) return false;
        if (!normalized) return true;
        return (
          u.name.toLowerCase().includes(normalized) ||
          u.email.toLowerCase().includes(normalized)
        );
      })
      .map((u) => {
        const purchased = allCourses.filter((c) => isCoursePurchased(state, u.id, c.slug));
        const certs = state.certificates.filter((c) => c.userId === u.id).length;
        const overall =
          purchased.length === 0
            ? 0
            : Math.round(
                purchased.reduce(
                  (s, c) => s + getCourseProgressFromStore(state, u.id, c).percent,
                  0,
                ) / purchased.length,
              );
        return { user: u, purchasedCount: purchased.length, certs, overall };
      });
  }, [state, allCourses, query, roleFilter]);

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
        Всего: {state.users.length}. Показано: {rows.length}
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
            className="pl-9 pr-9"
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
        <div className="inline-flex rounded-md border border-border p-1 text-xs">
          {(['all', 'admin', 'student'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded-sm px-3 py-1.5 transition-colors ${
                roleFilter === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {r === 'all' ? 'Все' : r === 'admin' ? 'admin' : 'студенты'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            По запросу «{query}» ничего не найдено.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-card/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Имя · email</th>
                <th className="px-5 py-3 text-left font-medium">Роль</th>
                <th className="px-5 py-3 text-left font-medium">Регистрация</th>
                <th className="px-5 py-3 text-right font-medium">Куплено</th>
                <th className="px-5 py-3 text-right font-medium">Сертификаты</th>
                <th className="px-5 py-3 text-right font-medium">Прогресс</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ user, purchasedCount, certs, overall }) => (
                <tr key={user.id} className="hover:bg-secondary/50">
                  <td className="px-5 py-3">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    {user.isAdmin ? (
                      <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                        admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        студент
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(user.registeredAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums">{purchasedCount}</td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums">{certs}</td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums">{overall}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
