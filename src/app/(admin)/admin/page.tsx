'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { BookOpen, Percent, ShieldCheck, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RevenueChart } from '@/components/artum/RevenueChart';
import { getAllCoursesEffective, useArtumStore } from '@/lib/store';

/**
 * Главная страница админки — обзор + быстрый доступ к разделам.
 */
export default function AdminHomePage() {
  const state = useArtumStore();
  const allCourses = useMemo(() => getAllCoursesEffective(state), [state]);

  const totals = useMemo(() => {
    const totalUsers = state.users.length;
    const totalCourses = allCourses.length;
    const totalLessons = allCourses.reduce(
      (sum, c) => sum + c.modules.reduce((s, m) => s + m.lessons.length, 0),
      0,
    );
    const totalPayments = state.payments.length;
    const totalCertificates = state.certificates.length;
    const totalRevenue = state.payments
      .filter((p) => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amountMinor, 0);

    return {
      totalUsers,
      totalCourses,
      totalLessons,
      totalPayments,
      totalCertificates,
      totalRevenue,
    };
  }, [allCourses, state]);

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <div className="mb-8 flex items-start gap-4">
        <div className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Админ-панель</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Управление курсами, пользователями и платежами. Все изменения
            сейчас живут в localStorage браузера — будут заменены на реальную
            БД на следующей стадии.
          </p>
        </div>
      </div>

      {/* Stats overview */}
      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Пользователей" value={String(totals.totalUsers)} />
        <StatCard label="Курсов" value={String(totals.totalCourses)} />
        <StatCard label="Уроков" value={String(totals.totalLessons)} />
        <StatCard label="Платежей" value={String(totals.totalPayments)} />
        <StatCard label="Сертификатов" value={String(totals.totalCertificates)} />
        <StatCard
          label="Доход (mock)"
          value={`${new Intl.NumberFormat('ru-RU').format(totals.totalRevenue / 100)} ₽`}
        />
      </section>

      {/* Revenue chart */}
      <section className="mb-10">
        <RevenueChart payments={state.payments} months={6} />
      </section>

      {/* Quick links */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink
          href="/admin/courses"
          icon={<BookOpen className="size-6" aria-hidden />}
          title="Курсы"
          description="CRUD курсов, модулей и уроков. Drag-drop сортировка."
        />
        <QuickLink
          href="/admin/users"
          icon={<Users className="size-6" aria-hidden />}
          title="Пользователи"
          description="Список зарегистрированных + поиск + прогресс."
        />
        <QuickLink
          href="/admin/promocodes"
          icon={<Percent className="size-6" aria-hidden />}
          title="Промокоды"
          description="Скидки в процентах или рублях, лимиты использований, срок действия."
        />
      </section>

      {/* Reset all data */}
      <ResetCard />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold leading-none">{value}</div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="course-card-hover flex items-start gap-4 rounded-2xl border border-border bg-card p-6"
    >
      <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        {icon}
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

function ResetCard() {
  const reset = useArtumStore((s) => s.reset);
  return (
    <section className="mt-10 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <h2 className="text-base font-semibold text-destructive">Сброс данных</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Удалит всех пользователей (кроме seed), все курсы, добавленные через
        админку, прогресс и сертификаты. Используйте для очистки демо-стенда.
      </p>
      <Button
        variant="destructive"
        size="sm"
        className="mt-3"
        onClick={() => {
          if (confirm('Точно сбросить всё к seed-состоянию?')) {
            reset();
            location.reload();
          }
        }}
      >
        Сбросить всё к seed-состоянию
      </Button>
    </section>
  );
}
