'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Award, BookOpen, CreditCard, Heart, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { CertificateCard } from '@/components/artum/CertificateCard';
import { CourseCard } from '@/components/artum/CourseCard';
import { ProfileSettings } from '@/components/artum/ProfileSettings';
import {
  type Course,
  formatDuration,
  formatPrice,
  getCourseLessonsCount,
  getCourseTotalDuration,
} from '@/lib/mock/courses';
import type { AuthUser } from '@/server/queries/auth';
import type {
  CertificateRecord,
  PaymentRecord,
  PurchaseRecord,
} from '@/server/queries/commerce';
import { cn } from '@/lib/utils';

const VALID_TABS = new Set(['courses', 'wishlist', 'certificates', 'payments', 'settings']);

interface ProfilePageClientProps {
  user: AuthUser;
  courses: Course[];
  purchases: PurchaseRecord[];
  completedLessonIds: string[];
  wishlistSlugs: string[];
  certificates: CertificateRecord[];
  payments: PaymentRecord[];
  subscribedSlugs: string[];
}

export function ProfilePageClient(props: ProfilePageClientProps) {
  return (
    <Suspense fallback={null}>
      <ProfileInner {...props} />
    </Suspense>
  );
}

function ProfileInner({
  user,
  courses,
  purchases,
  completedLessonIds,
  wishlistSlugs,
  certificates,
  payments,
  subscribedSlugs,
}: ProfilePageClientProps) {
  const searchParams = useSearchParams();
  const initialTab = VALID_TABS.has(searchParams.get('tab') ?? '')
    ? (searchParams.get('tab') as string)
    : 'courses';

  // Set'ы для O(1)
  const purchasedSet = useMemo(
    () => new Set(purchases.map((p) => p.courseSlug)),
    [purchases],
  );
  const subscribedSet = useMemo(() => new Set(subscribedSlugs), [subscribedSlugs]);
  const completedSet = useMemo(() => new Set(completedLessonIds), [completedLessonIds]);
  const wishlistSet = useMemo(() => new Set(wishlistSlugs), [wishlistSlugs]);

  // Доступные курсы — купленные ИЛИ покрытые подпиской (её набором)
  const accessibleCourses = useMemo(
    () =>
      courses.filter((c) => subscribedSet.has(c.slug) || purchasedSet.has(c.slug)),
    [courses, subscribedSet, purchasedSet],
  );

  const wishlistCourses = useMemo(
    () => courses.filter((c) => wishlistSet.has(c.slug)),
    [courses, wishlistSet],
  );

  // Прогресс по курсу
  function courseProgress(course: Course) {
    const lessons = course.modules.flatMap((m) => m.lessons);
    const completed = lessons.filter((l) => completedSet.has(l.id)).length;
    return {
      totalLessons: lessons.length,
      completedLessons: completed,
      percent:
        lessons.length === 0 ? 0 : Math.round((completed / lessons.length) * 100),
    };
  }

  const stats = useMemo(() => {
    const certs = certificates.length;
    const active = accessibleCourses.filter((c) => {
      const p = courseProgress(c);
      return p.percent > 0 && p.percent < 100;
    }).length;
    const studySeconds = accessibleCourses.reduce((sum, c) => {
      const p = courseProgress(c);
      const totalDur = getCourseTotalDuration(c);
      return sum + totalDur * (p.percent / 100);
    }, 0);
    return {
      activeCourses: active,
      certificates: certs,
      studyHoursTotal: Math.round(studySeconds / 3600),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessibleCourses, certificates, completedSet]);

  // Lookup для payments: courseSlug → title
  const slugToTitle = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of courses) m.set(c.slug, c.title);
    return m;
  }, [courses]);

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      {/* Header card */}
      <section className="mb-8 flex flex-col items-start gap-6 rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl sm:flex-row sm:items-center sm:p-8">
        <span
          aria-hidden
          className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary ring-4 ring-primary/30 sm:size-24 sm:text-3xl"
        >
          {user.initials}
        </span>
        <div className="flex-1 space-y-2">
          <h1 className="text-2xl font-bold leading-none tracking-tight sm:text-3xl">
            {user.name}
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            С нами с {new Date(user.registeredAt).toLocaleDateString('ru-RU')}
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-4 sm:w-auto">
          <Stat label="Активные" value={String(stats.activeCourses)} />
          <Stat label="Сертификаты" value={String(stats.certificates)} />
          <Stat label="Часов" value={String(stats.studyHoursTotal)} />
        </div>
      </section>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:h-10 sm:w-auto sm:gap-0">
          <TabsTrigger value="courses" className="gap-2">
            <BookOpen className="size-4" aria-hidden />
            <span className="hidden sm:inline">Мои курсы</span>
            <span className="sm:hidden">Курсы</span>
          </TabsTrigger>
          <TabsTrigger value="wishlist" className="gap-2">
            <Heart className="size-4" aria-hidden />
            <span className="hidden sm:inline">Избранное</span>
            <span className="sm:hidden">Избр.</span>
            {wishlistCourses.length > 0 ? (
              <span className="ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-secondary px-1.5 text-xs">
                {wishlistCourses.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="certificates" className="gap-2">
            <Award className="size-4" aria-hidden />
            <span className="hidden sm:inline">Сертификаты</span>
            <span className="sm:hidden">Серт.</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="size-4" aria-hidden />
            <span className="hidden sm:inline">История оплат</span>
            <span className="sm:hidden">Оплаты</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="col-span-2 gap-2 sm:col-span-1">
            <Settings className="size-4" aria-hidden />
            Настройки
          </TabsTrigger>
        </TabsList>

        {/* Мои курсы */}
        <TabsContent value="courses">
          {accessibleCourses.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="size-10" aria-hidden />}
              title="Пока нет купленных курсов"
              hint="Загляните в каталог и выберите первый курс."
              cta={
                <Button asChild>
                  <Link href="/">Каталог курсов</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {accessibleCourses.map((course) => {
                const progress = courseProgress(course);
                const lessons = getCourseLessonsCount(course);
                const duration = getCourseTotalDuration(course);
                return (
                  <Link
                    key={course.id}
                    href={`/courses/${course.slug}`}
                    className="course-card-hover flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl sm:flex-row sm:items-center"
                  >
                    <div
                      aria-hidden
                      className={cn(
                        'h-20 w-full shrink-0 rounded-lg bg-gradient-to-br sm:h-16 sm:w-28',
                        course.coverGradient,
                      )}
                    />
                    <div className="flex-1 space-y-1">
                      <h3 className="line-clamp-1 font-semibold sm:line-clamp-2">{course.title}</h3>
                      <div className="text-xs text-muted-foreground">
                        {lessons} уроков · {formatDuration(duration)}
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${progress.percent}%` }}
                            aria-hidden
                          />
                        </div>
                        <span className="text-xs font-medium text-primary">
                          {progress.percent}%
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Избранное */}
        <TabsContent value="wishlist">
          {wishlistCourses.length === 0 ? (
            <EmptyState
              icon={<Heart className="size-10" aria-hidden />}
              title="Избранное пусто"
              hint="Сохраняйте интересные курсы кнопкой ♡, чтобы вернуться к ним позже."
              cta={
                <Button asChild>
                  <Link href="/">Каталог курсов</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {wishlistCourses.map((course) => {
                const isPurchased = subscribedSet.has(course.slug) || purchasedSet.has(course.slug);
                const progress = isPurchased ? courseProgress(course).percent : 0;
                return (
                  <CourseCard
                    key={course.id}
                    course={course}
                    purchased={isPurchased}
                    progressPercent={progress}
                    inWishlist={true}
                    isGuest={false}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Сертификаты */}
        <TabsContent value="certificates">
          {certificates.length === 0 ? (
            <EmptyState
              icon={<Award className="size-10" aria-hidden />}
              title="Пока нет сертификатов"
              hint="Сертификат выдаётся автоматически при 100% прохождении курса."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {certificates.map((cert) => (
                <CertificateCard
                  key={cert.id}
                  cert={cert}
                  course={courses.find((c) => c.slug === cert.courseSlug) ?? null}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* История оплат */}
        <TabsContent value="payments">
          {payments.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="size-10" aria-hidden />}
              title="История оплат пуста"
              hint="После первой покупки чек появится здесь."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
              <table className="hidden w-full text-sm md:table">
                <thead className="bg-card/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Курс</th>
                    <th className="px-5 py-3 text-left font-medium">Дата</th>
                    <th className="px-5 py-3 text-left font-medium">Способ</th>
                    <th className="px-5 py-3 text-right font-medium">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((p) => {
                    const title =
                      p.method === 'subscription'
                        ? 'Подписка «Все курсы»'
                        : p.courseSlug
                          ? (slugToTitle.get(p.courseSlug) ?? p.courseSlug)
                          : 'Платёж';
                    return (
                      <tr key={p.id} className="hover:bg-secondary/50">
                        <td className="max-w-0 px-5 py-3">
                          {p.courseSlug && p.method !== 'subscription' ? (
                            <Link
                              href={`/courses/${p.courseSlug}`}
                              className="block truncate font-medium transition-colors hover:text-primary"
                            >
                              {title}
                            </Link>
                          ) : (
                            <span className="block truncate font-medium">{title}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {new Date(p.paidAt).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {p.method === 'card' ? 'Карта' : p.method === 'sbp' ? 'СБП' : 'Подписка'}
                        </td>
                        <td className="px-5 py-3 text-right font-medium tabular-nums">
                          {formatPrice(p.amountMinor)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile: карточки */}
              <ul className="divide-y divide-border md:hidden">
                {payments.map((p) => {
                  const title =
                    p.method === 'subscription'
                      ? 'Подписка «Все курсы»'
                      : p.courseSlug
                        ? (slugToTitle.get(p.courseSlug) ?? p.courseSlug)
                        : 'Платёж';
                  return (
                    <li key={p.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        {p.courseSlug && p.method !== 'subscription' ? (
                          <Link
                            href={`/courses/${p.courseSlug}`}
                            className="line-clamp-2 min-w-0 font-medium transition-colors hover:text-primary"
                          >
                            {title}
                          </Link>
                        ) : (
                          <span className="line-clamp-2 min-w-0 font-medium">{title}</span>
                        )}
                        <span className="shrink-0 font-medium tabular-nums">
                          {formatPrice(p.amountMinor)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span>{new Date(p.paidAt).toLocaleDateString('ru-RU')}</span>
                        <span aria-hidden>·</span>
                        <span>
                          {p.method === 'card' ? 'Карта' : p.method === 'sbp' ? 'СБП' : 'Подписка'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </TabsContent>

        {/* Настройки */}
        <TabsContent value="settings">
          <ProfileSettings user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/30 p-3 text-center backdrop-blur">
      <div className="bg-gradient-to-br from-white to-primary-lighter bg-clip-text text-xl font-bold leading-none text-transparent">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  hint,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/60 bg-card/40 p-12 text-center backdrop-blur">
      <div className="inline-flex items-center justify-center rounded-2xl bg-secondary p-4 text-muted-foreground">
        {icon}
      </div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
      {cta}
    </div>
  );
}
