'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, ChevronLeft, Lock, Play, Tag, Users, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CourseCard } from '@/components/artum/CourseCard';
import { WishlistButton } from '@/components/artum/WishlistButton';
import { GlassCard } from '@/components/shared/GlassCard';
import {
  formatDuration,
  formatLessonsCount,
  formatPrice,
  formatStudentsCount,
  getCategory,
  getCourseLessonsCount,
  getCourseTotalDuration,
} from '@/lib/mock/courses';
import type { Course } from '@/lib/mock/courses';
import { buyCourseAction, validatePromocodeAction } from '@/server/actions/commerce';
import { cn } from '@/lib/utils';

interface CoursePageClientProps {
  course: Course;
  similar: Course[];
  isLoggedIn: boolean;
  purchasedSlugs: string[];
  completedLessonIds: string[];
  wishlistSlugs: string[];
  hasCertificate: boolean;
  hasActiveSubscription: boolean;
}

export default function CoursePageClient({
  course,
  similar,
  isLoggedIn,
  purchasedSlugs,
  completedLessonIds,
  wishlistSlugs,
  hasCertificate,
  hasActiveSubscription,
}: CoursePageClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [promoPending, startPromoTransition] = useTransition();
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountMinor: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const purchasedSet = useMemo(() => new Set(purchasedSlugs), [purchasedSlugs]);
  const wishlistSet = useMemo(() => new Set(wishlistSlugs), [wishlistSlugs]);
  const completedSet = useMemo(() => new Set(completedLessonIds), [completedLessonIds]);

  const category = getCategory(course.category);
  const lessonsCount = getCourseLessonsCount(course);
  const totalDuration = getCourseTotalDuration(course);

  // Доступ = явная покупка ИЛИ активная подписка
  const purchased = hasActiveSubscription || purchasedSet.has(course.slug);

  // Прогресс по курсу из completedLessonIds
  const lessonsAll = course.modules.flatMap((m) => m.lessons);
  const completedLessons = lessonsAll.filter((l) => completedSet.has(l.id)).length;
  const progress = {
    totalLessons: lessonsAll.length,
    completedLessons,
    percent:
      lessonsAll.length === 0 ? 0 : Math.round((completedLessons / lessonsAll.length) * 100),
  };

  // Find next not-completed lesson (для CTA «Продолжить»)
  function findNextLesson() {
    if (!isLoggedIn) return null;
    for (const l of lessonsAll) {
      if (!completedSet.has(l.id)) return l;
    }
    return null;
  }
  const nextLesson = findNextLesson();

  function onBuy() {
    startTransition(async () => {
      const res = await buyCourseAction(course.slug, appliedPromo?.code);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const discount = res.data?.discountMinor ?? 0;
      const savedMsg =
        discount > 0
          ? ` (с промокодом — сэкономили ${(discount / 100).toLocaleString('ru-RU')} ₽)`
          : '';
      toast.success(`Курс «${course.title}» куплен${savedMsg}. Удачного обучения!`);
      router.refresh();
    });
  }

  function onApplyPromo() {
    setPromoError(null);
    startPromoTransition(async () => {
      const res = await validatePromocodeAction(promoCode, course.slug);
      if (!res.ok) {
        setPromoError(res.error);
        return;
      }
      setAppliedPromo({
        code: res.data.code,
        discountMinor: res.data.discountMinor,
      });
      toast.success(`Промокод применён — скидка ${formatPrice(res.data.discountMinor)}`);
    });
  }

  // CTA logic
  let ctaLabel: string;
  let ctaHref: string | null = null;
  let ctaOnClick: (() => void) | null = null;

  if (!isLoggedIn) {
    ctaLabel = 'Войти и купить';
    ctaHref = `/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`;
  } else if (!purchased) {
    ctaLabel = pending ? 'Покупаем…' : 'Купить курс';
    ctaOnClick = onBuy;
  } else if (nextLesson) {
    ctaLabel = progress.percent > 0 ? 'Продолжить' : 'Начать обучение';
    ctaHref = `/learn/${course.slug}/${nextLesson.id}`;
  } else {
    ctaLabel = 'Курс пройден';
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        К каталогу курсов
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Левая колонка — описание + уроки */}
        <div className="space-y-8 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-border/60">
            <div
              aria-hidden
              className={cn(
                'h-44 w-full bg-gradient-to-br opacity-90 sm:h-56',
                course.coverGradient,
              )}
            />
            <div className="space-y-4 bg-card/70 p-6 backdrop-blur-xl sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
                    category.tagBgClass,
                    category.tagTextClass,
                  )}
                >
                  <span aria-hidden>{category.emoji}</span>
                  {category.label}
                </span>
                {!purchased ? (
                  <WishlistButton
                    courseSlug={course.slug}
                    courseTitle={course.title}
                    initialInList={wishlistSet.has(course.slug)}
                    isGuest={!isLoggedIn}
                    size="md"
                  />
                ) : null}
              </div>
              <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                {course.title}
              </h1>
              <p className="text-base text-muted-foreground">{course.longDescription}</p>

              <div className="flex flex-wrap items-center gap-4 pt-2 text-sm text-muted-foreground">
                <span>{formatLessonsCount(lessonsCount)}</span>
                <span aria-hidden>·</span>
                <span>{formatDuration(totalDuration)}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-4" aria-hidden />
                  {formatStudentsCount(course.studentsCount)}
                </span>
              </div>
            </div>
          </div>

          {/* Программа */}
          <section aria-labelledby="programme-heading" className="space-y-4">
            <div className="flex items-end justify-between">
              <h2 id="programme-heading" className="text-xl font-semibold sm:text-2xl">
                Программа
              </h2>
              {purchased && progress.percent > 0 ? (
                <span className="text-sm text-muted-foreground">
                  Прошли {progress.completedLessons} из {progress.totalLessons} уроков
                </span>
              ) : null}
            </div>

            <div className="space-y-3">
              {course.modules.map((module, moduleIdx) => (
                <div
                  key={module.id}
                  className="overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl"
                >
                  <div className="border-b border-border/50 bg-card/30 p-4 sm:p-5">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Модуль {moduleIdx + 1}
                    </div>
                    <h3 className="mt-1 text-base font-semibold sm:text-lg">{module.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                  </div>
                  <ul className="divide-y divide-border">
                    {module.lessons.map((lesson, lessonIdx) => {
                      const canOpen = purchased || lesson.preview;
                      const completed = completedSet.has(lesson.id);
                      const lessonNumber = `${moduleIdx + 1}.${lessonIdx + 1}`;
                      const rowClasses = cn(
                        'flex items-center gap-4 p-4 transition-colors',
                        canOpen ? 'hover:bg-secondary' : 'cursor-not-allowed opacity-60',
                      );
                      const Inner = (
                        <>
                          <span className="shrink-0">
                            {completed ? (
                              <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/20 text-primary">
                                <Check className="size-4" aria-hidden />
                              </span>
                            ) : canOpen ? (
                              <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                                <Play className="size-3.5" aria-hidden fill="currentColor" />
                              </span>
                            ) : (
                              <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                                <Lock className="size-3.5" aria-hidden />
                              </span>
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-mono text-xs text-muted-foreground">
                                {lessonNumber}
                              </span>
                              <span className="truncate font-medium text-foreground">
                                {lesson.title}
                              </span>
                              {lesson.preview && !purchased ? (
                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                                  Превью
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDuration(lesson.durationSec)}
                          </span>
                        </>
                      );
                      return (
                        <li key={lesson.id}>
                          {canOpen ? (
                            <Link
                              href={`/learn/${course.slug}/${lesson.id}`}
                              className={rowClasses}
                            >
                              {Inner}
                            </Link>
                          ) : (
                            <div className={rowClasses} aria-disabled="true">
                              {Inner}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Похожие курсы */}
          {similar.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-end justify-between">
                <h2 className="text-xl font-semibold sm:text-2xl">Похожие курсы</h2>
                <span className="text-sm text-muted-foreground">
                  По категории «{category.label}»
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {similar.map((s) => {
                  const sPurchased = hasActiveSubscription || purchasedSet.has(s.slug);
                  const sLessons = s.modules.flatMap((m) => m.lessons);
                  const sCompleted = sLessons.filter((l) => completedSet.has(l.id)).length;
                  const sPercent =
                    sLessons.length === 0
                      ? 0
                      : Math.round((sCompleted / sLessons.length) * 100);
                  return (
                    <CourseCard
                      key={s.id}
                      course={s}
                      purchased={sPurchased}
                      progressPercent={sPercent}
                      inWishlist={wishlistSet.has(s.slug)}
                      isGuest={!isLoggedIn}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        {/* Правая колонка — sticky CTA card */}
        <aside className="lg:col-span-1">
          <GlassCard glow className="sticky top-24 space-y-4 p-6">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {purchased ? 'Доступ' : 'Стоимость'}
              </div>
              {purchased ? (
                <div className="text-3xl font-bold">
                  {hasActiveSubscription && !purchasedSet.has(course.slug)
                    ? 'По подписке'
                    : 'Бессрочный'}
                </div>
              ) : appliedPromo ? (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground line-through">
                    {formatPrice(course.priceMinor)}
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {formatPrice(Math.max(0, course.priceMinor - appliedPromo.discountMinor))}
                  </div>
                  <div className="text-xs text-primary">
                    Скидка {formatPrice(appliedPromo.discountMinor)} ·{' '}
                    <code className="font-mono">{appliedPromo.code}</code>
                  </div>
                </div>
              ) : (
                <div className="text-3xl font-bold">{formatPrice(course.priceMinor)}</div>
              )}
              {!purchased && !appliedPromo ? (
                <p className="text-xs text-muted-foreground">
                  Разовая оплата · доступ навсегда
                </p>
              ) : null}
              {purchased ? (
                <p className="text-xs text-muted-foreground">Доступ ко всем урокам открыт</p>
              ) : null}
            </div>

            {/* Promocode input — только для не купленных */}
            {!purchased && isLoggedIn ? (
              appliedPromo ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="size-3.5 text-primary" aria-hidden />
                    Промокод <code className="font-mono font-medium">{appliedPromo.code}</code> применён
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedPromo(null);
                      setPromoCode('');
                      setPromoError(null);
                    }}
                    aria-label="Снять промокод"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Промокод"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value.toUpperCase());
                        setPromoError(null);
                      }}
                      className="h-9 text-sm"
                      disabled={promoPending}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onApplyPromo}
                      disabled={!promoCode.trim() || promoPending}
                    >
                      {promoPending ? '…' : 'Применить'}
                    </Button>
                  </div>
                  {promoError ? (
                    <p className="text-xs text-destructive">{promoError}</p>
                  ) : null}
                </div>
              )
            ) : null}

            {purchased && progress.percent > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Прогресс</span>
                  <span className="font-medium text-primary">{progress.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress.percent}%` }}
                    aria-hidden
                  />
                </div>
              </div>
            ) : null}

            {ctaHref ? (
              <Button asChild size="lg" className="w-full">
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
            ) : ctaOnClick ? (
              <Button size="lg" className="w-full" onClick={ctaOnClick} disabled={pending}>
                {ctaLabel}
              </Button>
            ) : (
              <Button size="lg" className="w-full" disabled>
                {ctaLabel}
              </Button>
            )}

            {!purchased ? (
              <Link
                href="/subscribe"
                className="block rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 text-center text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
              >
                Или оформите подписку — доступ ко всем курсам от <span className="font-semibold text-foreground">990 ₽/мес</span>
              </Link>
            ) : null}

            {/* Course meta summary */}
            <div className="space-y-2 border-t border-border pt-4 text-sm">
              <Meta label="Уроков" value={formatLessonsCount(lessonsCount)} />
              <Meta label="Длительность" value={formatDuration(totalDuration)} />
              <Meta label="Студентов" value={formatStudentsCount(course.studentsCount)} />
              <Meta label="Категория" value={category.label} />
              <Meta
                label="Сертификат"
                value={hasCertificate ? 'Получен' : 'После 100% прохождения'}
              />
            </div>
          </GlassCard>
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
