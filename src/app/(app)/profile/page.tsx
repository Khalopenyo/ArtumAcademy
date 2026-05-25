import Link from 'next/link';
import { Award, BookOpen, CreditCard, Settings, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  formatDuration,
  formatPrice,
  getCertificatedCourses,
  getCourseLessonsCount,
  getCourseProgress,
  getCourseTotalDuration,
  getPurchasedCourses,
  getUserStats,
  MOCK_CERTIFICATES,
  MOCK_PAYMENTS,
} from '@/lib/mock/courses';
import { MOCK_CURRENT_USER } from '@/lib/mock/user';
import { cn } from '@/lib/utils';

interface ProfilePageProps {
  searchParams: { tab?: string };
}

const VALID_TABS = new Set(['courses', 'certificates', 'payments', 'settings']);

/**
 * Личный кабинет (ТЗ §4.5):
 *   - Аватар и имя пользователя
 *   - Список купленных курсов с прогрессом
 *   - Список полученных сертификатов
 *   - История оплат
 *   - Настройки профиля (смена пароля, email)
 */
export default function ProfilePage({ searchParams }: ProfilePageProps) {
  const initialTab = VALID_TABS.has(searchParams.tab ?? '')
    ? (searchParams.tab as string)
    : 'courses';

  const stats = getUserStats();
  const purchased = getPurchasedCourses();
  const certified = getCertificatedCourses();

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      {/* Header card */}
      <section className="mb-8 flex flex-col items-start gap-6 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:p-8">
        <span
          aria-hidden
          className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary ring-4 ring-primary/30 sm:size-24 sm:text-3xl"
        >
          {MOCK_CURRENT_USER.initials}
        </span>
        <div className="flex-1 space-y-2">
          <h1 className="text-2xl font-bold leading-none tracking-tight sm:text-3xl">
            {MOCK_CURRENT_USER.name}
          </h1>
          <p className="text-sm text-muted-foreground">{MOCK_CURRENT_USER.email}</p>
          <p className="text-xs text-muted-foreground">
            С нами с {new Date(MOCK_CURRENT_USER.registeredAt).toLocaleDateString('ru-RU')}
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-4 sm:w-auto sm:grid-cols-3">
          <Stat label="Активные" value={String(stats.activeCourses)} />
          <Stat label="Сертификаты" value={String(stats.certificates)} />
          <Stat label="Часов" value={String(stats.studyHoursTotal)} />
        </div>
      </section>

      {/* Tabs */}
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
                const progress = getCourseProgress(course);
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
                        {lessons} уроков · {formatDuration(duration)} · куплен{' '}
                        {new Date(course.purchasedAt ?? '').toLocaleDateString('ru-RU')}
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
          {certified.length === 0 ? (
            <EmptyState
              icon={<Award className="size-10" aria-hidden />}
              title="Пока нет сертификатов"
              hint="Сертификат выдаётся автоматически при 100% прохождении курса."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {MOCK_CERTIFICATES.map((cert) => (
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
                    <h3 className="mt-1 font-semibold">{cert.courseTitle}</h3>
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
          {MOCK_PAYMENTS.length === 0 ? (
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
                  {MOCK_PAYMENTS.map((p) => (
                    <tr key={p.id} className="hover:bg-secondary/50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/courses/${p.courseSlug}`}
                          className="font-medium transition-colors hover:text-primary"
                        >
                          {p.courseTitle}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Настройки */}
        <TabsContent value="settings">
          <div className="space-y-6">
            <SettingsSection
              icon={<ShieldCheck className="size-5" aria-hidden />}
              title="Учётные данные"
              description="Email и пароль для входа на платформу."
            >
              <SettingRow label="Email">
                <span className="text-sm">{MOCK_CURRENT_USER.email}</span>
                <Button variant="outline" size="sm">Изменить</Button>
              </SettingRow>
              <SettingRow label="Пароль">
                <span className="text-sm text-muted-foreground">••••••••</span>
                <Button variant="outline" size="sm">Сменить</Button>
              </SettingRow>
            </SettingsSection>

            <SettingsSection
              icon={<Settings className="size-5" aria-hidden />}
              title="Профиль"
              description="Имя отображается в сертификатах и в хедере."
            >
              <SettingRow label="Имя">
                <span className="text-sm">{MOCK_CURRENT_USER.name}</span>
                <Button variant="outline" size="sm">Изменить</Button>
              </SettingRow>
            </SettingsSection>

            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
              <h3 className="text-base font-semibold text-destructive">Удалить аккаунт</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Удаление аккаунта необратимо. Все купленные курсы и сертификаты будут потеряны.
              </p>
              <Button variant="destructive" size="sm" className="mt-3">
                Удалить аккаунт
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              На этапе 1 ТЗ (скелет) формы — заглушки. Реальные изменения добавятся на этапе 2 (Авторизация).
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Helpers (local components)
// ────────────────────────────────────────────────────────────────────

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

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border p-5">
        <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
