import Link from 'next/link';
import { BookOpen, CreditCard, Layers, Percent, ShieldCheck, Sparkles, Users } from 'lucide-react';

import { RevenueChart } from '@/components/artum/RevenueChart';
import { requireAdmin } from '@/server/queries/auth';
import { getAdminStats, getAllPaymentsForRevenueChart } from '@/server/queries/admin';

/**
 * Главная страница админки — обзор + быстрый доступ к разделам.
 * Server Component: тянет статистику + платежи из Supabase под service_role.
 */
export default async function AdminHomePage() {
  await requireAdmin();

  const [stats, payments] = await Promise.all([
    getAdminStats(),
    getAllPaymentsForRevenueChart(6),
  ]);

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <div className="mb-8 flex items-start gap-4">
        <div className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
          <ShieldCheck className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Админ-панель</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Управление курсами, пользователями и платежами. Данные читаются напрямую
            из Supabase под service_role.
          </p>
        </div>
      </div>

      {/* Stats overview */}
      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Пользователей" value={String(stats.totalUsers)} />
        <StatCard label="Курсов" value={String(stats.totalCourses)} />
        <StatCard label="Уроков" value={String(stats.totalLessons)} />
        <StatCard label="Платежей" value={String(stats.totalPayments)} />
        <StatCard label="Сертификатов" value={String(stats.totalCertificates)} />
        <StatCard
          label="Активных подписок"
          value={String(stats.activeSubscriptions)}
        />
        <StatCard
          label="Доход"
          value={`${new Intl.NumberFormat('ru-RU').format(stats.totalRevenueMinor / 100)} ₽`}
          accent
        />
      </section>

      {/* Revenue chart */}
      <section className="mb-10">
        <RevenueChart payments={payments} months={6} />
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
          href="/admin/cases"
          icon={<Sparkles className="size-6" aria-hidden />}
          title="Кейсы"
          description="Истории студентов и проекты для публичной страницы /cases."
        />
        <QuickLink
          href="/admin/users"
          icon={<Users className="size-6" aria-hidden />}
          title="Пользователи"
          description="Список зарегистрированных + поиск + прогресс."
        />
        <QuickLink
          href="/admin/subscription-plans"
          icon={<Layers className="size-6" aria-hidden />}
          title="Планы подписки"
          description="Наборы курсов по подписке: цена за месяц/год, состав, публикация."
        />
        <QuickLink
          href="/admin/promocodes"
          icon={<Percent className="size-6" aria-hidden />}
          title="Промокоды"
          description="Скидки в процентах или рублях, лимиты использований, срок действия."
        />
        <QuickLink
          href="/admin/payments"
          icon={<CreditCard className="size-6" aria-hidden />}
          title="Платежи"
          description="Заказы и транзакции ЮKassa, статусы, возвраты."
        />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={
          accent
            ? 'mt-2 bg-gradient-to-br from-white to-[#E8DEFF] bg-clip-text text-3xl font-bold leading-none text-transparent'
            : 'mt-2 text-3xl font-semibold leading-none'
        }
      >
        {value}
      </div>
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
      className="course-card-hover flex items-start gap-4 rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl"
    >
      <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
        {icon}
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
