import Link from 'next/link';
import {
  Award,
  BookOpen,
  CreditCard,
  GraduationCap,
  Layers,
  Percent,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wallet,
} from 'lucide-react';

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

      {/* Главные бизнес-метрики — крупно, верхний уровень иерархии */}
      <section className="mb-3 grid gap-3 sm:grid-cols-3">
        <HeroStat
          label="Доход"
          value={`${new Intl.NumberFormat('ru-RU').format(stats.totalRevenueMinor / 100)} ₽`}
          icon={<Wallet className="size-5" aria-hidden />}
          accent
        />
        <HeroStat
          label="Платежей"
          value={String(stats.totalPayments)}
          icon={<CreditCard className="size-5" aria-hidden />}
        />
        <HeroStat
          label="Активных подписок"
          value={String(stats.activeSubscriptions)}
          icon={<Layers className="size-5" aria-hidden />}
        />
      </section>

      {/* Каталог и аудитория — компактно, второй уровень */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <MiniStat
          label="Пользователей"
          value={String(stats.totalUsers)}
          icon={<Users className="size-4" aria-hidden />}
        />
        <MiniStat
          label="Курсов"
          value={String(stats.totalCourses)}
          icon={<BookOpen className="size-4" aria-hidden />}
        />
        <MiniStat
          label="Уроков"
          value={String(stats.totalLessons)}
          icon={<GraduationCap className="size-4" aria-hidden />}
        />
        <MiniStat
          label="Сертификатов"
          value={String(stats.totalCertificates)}
          icon={<Award className="size-4" aria-hidden />}
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
          href="/admin/reviews"
          icon={<Star className="size-6" aria-hidden />}
          title="Отзывы"
          description="Модерация отзывов о курсах: рейтинг, тексты, удаление."
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

/** Крупная карточка ключевой метрики (верхний уровень KPI-иерархии). */
function HeroStat({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl sm:p-6">
      <div className="flex items-center gap-2.5 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
          {icon}
        </span>
        {label}
      </div>
      <div
        className={
          accent
            ? 'mt-4 bg-gradient-to-br from-white to-primary-lighter bg-clip-text text-4xl font-bold leading-none text-transparent'
            : 'mt-4 text-4xl font-bold leading-none'
        }
      >
        {value}
      </div>
    </div>
  );
}

/** Компактная вторичная метрика (нижний уровень KPI-иерархии). */
function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xl font-semibold leading-none">{value}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{label}</div>
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
