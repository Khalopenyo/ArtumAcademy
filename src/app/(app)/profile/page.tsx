'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Award, BookOpen, CreditCard, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ProfileSettings } from '@/components/artum/ProfileSettings';
import {
  formatDuration,
  formatPrice,
  getCourseLessonsCount,
  getCourseTotalDuration,
} from '@/lib/mock/courses';
import {
  getAllCoursesEffective,
  getCourseProgressFromStore,
  isCoursePurchased,
  useArtumStore,
} from '@/lib/store';
import { useCurrentUser } from '@/lib/store/hooks';
import { cn } from '@/lib/utils';

const VALID_TABS = new Set(['courses', 'certificates', 'payments', 'settings']);

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileInner />
    </Suspense>
  );
}

function ProfileInner() {
  const searchParams = useSearchParams();
  const initialTab = VALID_TABS.has(searchParams.get('tab') ?? '')
    ? (searchParams.get('tab') as string)
    : 'courses';

  const user = useCurrentUser()!; // AuthGate уже гарантирует
  const state = useArtumStore();

  const allCourses = useMemo(() => getAllCoursesEffective(state), [state]);
  const purchased = useMemo(
    () => allCourses.filter((c) => isCoursePurchased(state, user.id, c.slug)),
    [allCourses, state, user.id],
  );
  const myPayments = useMemo(
    () => state.payments.filter((p) => p.userId === user.id),
    [state.payments, user.id],
  );
  const myCertificates = useMemo(
    () => state.certificates.filter((c) => c.userId === user.id),
    [state.certificates, user.id],
  );

  const stats = useMemo(() => {
    const certs = myCertificates.length;
    const active = purchased.filter((c) => {
      const p = getCourseProgressFromStore(state, user.id, c);
      return p.percent > 0 && p.percent < 100;
    }).length;
    const studySeconds = purchased.reduce((sum, c) => {
      const p = getCourseProgressFromStore(state, user.id, c);
      const totalDur = getCourseTotalDuration(c);
      return sum + totalDur * (p.percent / 100);
    }, 0);
    return {
      activeCourses: active,
      certificates: certs,
      studyHoursTotal: Math.round(studySeconds / 3600),
    };
  }, [purchased, myCertificates, state, user.id]);

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      {/* Header card */}
      <section className="mb-8 flex flex-col items-start gap-6 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:p-8">
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
        <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="courses" className="gap-2">
            <BookOpen className="size-4" aria-hidden />
            <span className="hidden sm:inline">Мои курсы</span>
            <span className="sm:hidden">Курсы</span>
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
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="size-4" aria-hidden />
            Настройки
          </TabsTrigger>
        </TabsList>

        {/* Мои курсы */}
        <TabsContent value="courses">
          {purchased.length === 0 ? (
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
              {purchased.map((course) => {
                const progress = getCourseProgressFromStore(state, user.id, course);
                const lessons = getCourseLessonsCount(course);
                const duration = getCourseTotalDuration(course);
                return (
                  <Link
                    key={course.id}
                    href={`/courses/${course.slug}`}
                    className="course-card-hover flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center"
                  >
                    <div
                      aria-hidden
                      className={cn(
                        'h-20 w-full shrink-0 rounded-lg bg-gradient-to-br sm:h-16 sm:w-28',
                        course.coverGradient,
                      )}
                    />
                    <div className="flex-1 space-y-1">
                      <h3 className="font-semibold">{course.title}</h3>
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

        {/* Сертификаты */}
        <TabsContent value="certificates">
          {myCertificates.length === 0 ? (
            <EmptyState
              icon={<Award className="size-10" aria-hidden />}
              title="Пока нет сертификатов"
              hint="Сертификат выдаётся автоматически при 100% прохождении курса."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {myCertificates.map((cert) => (
                <div key={cert.id} className="space-y-3 rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Award className="size-6" aria-hidden />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(cert.issuedAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Сертификат
                    </div>
                    <h3 className="mt-1 font-semibold">{cert.courseSlug}</h3>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    № {cert.verificationNumber}
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/certificates#${cert.id}`}>Открыть</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* История оплат */}
        <TabsContent value="payments">
          {myPayments.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="size-10" aria-hidden />}
              title="История оплат пуста"
              hint="После первой покупки чек появится здесь."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-card/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Курс</th>
                    <th className="px-5 py-3 text-left font-medium">Дата</th>
                    <th className="px-5 py-3 text-left font-medium">Способ</th>
                    <th className="px-5 py-3 text-right font-medium">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {myPayments.map((p) => {
                    const c = allCourses.find((x) => x.slug === p.courseSlug);
                    return (
                      <tr key={p.id} className="hover:bg-secondary/50">
                        <td className="px-5 py-3">
                          <Link
                            href={`/courses/${p.courseSlug}`}
                            className="font-medium transition-colors hover:text-primary"
                          >
                            {c?.title ?? p.courseSlug}
                          </Link>
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
    <div className="rounded-xl bg-background/50 p-3 text-center">
      <div className="text-xl font-semibold leading-none">{value}</div>
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
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
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

