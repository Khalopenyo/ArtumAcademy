'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import {
  getAllCoursesEffective,
  getCourseProgressFromStore,
  isCoursePurchased,
  useArtumStore,
} from '@/lib/store';

export default function AdminUsersPage() {
  const state = useArtumStore();
  const allCourses = useMemo(() => getAllCoursesEffective(state), [state]);
  const rows = useMemo(
    () =>
      state.users.map((u) => {
        const purchased = allCourses.filter((c) => isCoursePurchased(state, u.id, c.slug));
        const certs = state.certificates.filter((c) => c.userId === u.id).length;
        const overall =
          purchased.length === 0
            ? 0
            : Math.round(
                purchased.reduce((s, c) => s + getCourseProgressFromStore(state, u.id, c).percent, 0) /
                  purchased.length,
              );
        return { user: u, purchasedCount: purchased.length, certs, overall };
      }),
    [state, allCourses],
  );

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
        {rows.length} {rows.length === 1 ? 'пользователь' : 'пользователей'} (включая seed)
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
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
      </div>
    </div>
  );
}
