import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Server queries для покупок / подписок / прогресса / wishlist / certs.
 * Все читают под RLS-политикой "self_select" — пользователь видит только свои строки.
 *
 * Если userId === null или вызов без сессии — возвращаем пустой результат.
 */

// ────────────────────────────────────────────────────────────────────
// PURCHASES
// ────────────────────────────────────────────────────────────────────

export interface PurchaseRecord {
  courseId: string;
  courseSlug: string;
  boughtAt: string;
  amountMinor: number;
  discountMinor: number;
}

/**
 * Возвращает все покупки пользователя с joined slug курса.
 * Используется на /profile (Мои курсы), и для проверки доступа.
 */
export async function getMyPurchases(): Promise<PurchaseRecord[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('purchases')
    .select(
      `
      course_id,
      bought_at,
      amount_minor,
      discount_minor,
      courses:course_id ( slug )
      `,
    )
    .order('bought_at', { ascending: false });

  if (error) {
    console.error('[commerce.getMyPurchases]', error);
    return [];
  }

  // Supabase TS-inference считает joined рашение массивом, даже когда FK
  // many-to-one. Нормализуем здесь.
  type Row = {
    course_id: string;
    bought_at: string;
    amount_minor: number;
    discount_minor: number;
    courses: { slug: string }[] | { slug: string } | null;
  };

  function joinedSlug(c: Row['courses']): string | null {
    if (!c) return null;
    if (Array.isArray(c)) return c[0]?.slug ?? null;
    return c.slug;
  }

  return (data as unknown as Row[])
    .map((r) => ({
      courseId: r.course_id,
      courseSlug: joinedSlug(r.courses),
      boughtAt: r.bought_at,
      amountMinor: r.amount_minor,
      discountMinor: r.discount_minor,
    }))
    .filter((r): r is PurchaseRecord => r.courseSlug !== null) as PurchaseRecord[];
}

/**
 * Возвращает Set slug'ов купленных пользователем курсов.
 * Удобно для O(1) проверки «куплен ли курс X» в catalog grid.
 */
export async function getMyPurchasedCourseSlugs(): Promise<Set<string>> {
  const purchases = await getMyPurchases();
  return new Set(purchases.map((p) => p.courseSlug));
}

/**
 * Проверяет есть ли у текущего пользователя доступ к курсу:
 *   - либо явная покупка через purchases
 *   - либо активная подписка (expires_at > now AND NOT cancelled)
 * Возвращает true для admin'ов (они тестируют контент).
 */
export async function hasAccessToCourse(courseSlug: string): Promise<boolean> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // 1) Admin always has access
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (profile?.is_admin) return true;

  // Курс по slug — нужен и для подписки-набора, и для проверки покупки
  const { data: course } = await supabase
    .from('courses')
    .select('id')
    .eq('slug', courseSlug)
    .single();
  if (!course) return false;

  // 2) Подписка — доступ ТОЛЬКО если она покрывает именно этот курс
  const sub = await getMyActiveSubscription();
  if (sub) {
    if (sub.isAllCourses) return true; // план «Все курсы» → весь каталог
    const { data: covered } = await supabase
      .from('subscription_courses')
      .select('course_id')
      .eq('subscription_id', sub.id)
      .eq('course_id', course.id)
      .maybeSingle();
    if (covered) return true;
  }

  // 3) Явная покупка
  const { data: purchase } = await supabase
    .from('purchases')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('course_id', course.id)
    .maybeSingle();

  return !!purchase;
}

// ────────────────────────────────────────────────────────────────────
// PAYMENTS (история)
// ────────────────────────────────────────────────────────────────────

export interface PaymentRecord {
  id: string;
  courseSlug: string | null;
  amountMinor: number;
  paidAt: string;
  method: 'card' | 'sbp' | 'subscription';
  status: 'succeeded' | 'refunded';
}

export async function getMyPayments(): Promise<PaymentRecord[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('payments')
    .select(
      `
      id,
      course_id,
      amount_minor,
      paid_at,
      method,
      status,
      courses:course_id ( slug )
      `,
    )
    .order('paid_at', { ascending: false });

  if (error) {
    console.error('[commerce.getMyPayments]', error);
    return [];
  }

  type Row = {
    id: string;
    course_id: string | null;
    amount_minor: number;
    paid_at: string;
    method: 'card' | 'sbp' | 'subscription';
    status: 'succeeded' | 'refunded';
    courses: { slug: string }[] | { slug: string } | null;
  };

  function joinedSlug(c: Row['courses']): string | null {
    if (!c) return null;
    if (Array.isArray(c)) return c[0]?.slug ?? null;
    return c.slug;
  }

  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    courseSlug: joinedSlug(r.courses),
    amountMinor: r.amount_minor,
    paidAt: r.paid_at,
    method: r.method,
    status: r.status,
  }));
}

// ────────────────────────────────────────────────────────────────────
// SUBSCRIPTION
// ────────────────────────────────────────────────────────────────────

export interface SubscriptionRecord {
  id: string;
  tier: 'all_courses';
  planId: string | null;
  /** Снимок на момент покупки: true = доступ ко всему каталогу (живой). */
  isAllCourses: boolean;
  startedAt: string;
  expiresAt: string;
  amountMinor: number;
  period: 'monthly' | 'yearly';
  cancelled: boolean;
}

/**
 * Возвращает активную подписку (не истекшую и не отменённую) или null.
 */
export async function getMyActiveSubscription(): Promise<SubscriptionRecord | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('cancelled', false)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[commerce.getMyActiveSubscription]', error);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    tier: data.tier,
    planId: data.plan_id,
    isAllCourses: data.is_all_courses,
    startedAt: data.started_at,
    expiresAt: data.expires_at,
    amountMinor: data.amount_minor,
    period: data.period,
    cancelled: data.cancelled,
  };
}

/**
 * Slug'и курсов, к которым даёт доступ активная подписка пользователя:
 *   • план «Все курсы» → все курсы каталога (живой доступ);
 *   • кураторский план → замороженный набор подписки (subscription_courses).
 * Пусто, если активной подписки нет. Используется в UI (что показывать доступным).
 */
export async function getMySubscribedCourseSlugs(): Promise<Set<string>> {
  const sub = await getMyActiveSubscription();
  if (!sub) return new Set();
  const supabase = createServerSupabase();

  if (sub.isAllCourses) {
    const { data, error } = await supabase.from('courses').select('slug');
    if (error) {
      console.error('[commerce.getMySubscribedCourseSlugs/all]', error);
      return new Set();
    }
    return new Set((data as { slug: string }[]).map((r) => r.slug));
  }

  const { data, error } = await supabase
    .from('subscription_courses')
    .select('courses:course_id ( slug )')
    .eq('subscription_id', sub.id);
  if (error) {
    console.error('[commerce.getMySubscribedCourseSlugs/set]', error);
    return new Set();
  }
  type Row = { courses: { slug: string }[] | { slug: string } | null };
  return new Set(
    (data as unknown as Row[])
      .map((r) => {
        if (!r.courses) return null;
        if (Array.isArray(r.courses)) return r.courses[0]?.slug ?? null;
        return r.courses.slug;
      })
      .filter((s): s is string => !!s),
  );
}

// ────────────────────────────────────────────────────────────────────
// WISHLIST
// ────────────────────────────────────────────────────────────────────

/**
 * Возвращает Set slug'ов курсов в избранном — для O(1) проверки.
 */
export async function getMyWishlistSlugs(): Promise<Set<string>> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('wishlist')
    .select('courses:course_id ( slug )');

  if (error) {
    console.error('[commerce.getMyWishlistSlugs]', error);
    return new Set();
  }
  type Row = { courses: { slug: string }[] | { slug: string } | null };
  return new Set(
    (data as unknown as Row[])
      .map((r) => {
        if (!r.courses) return null;
        if (Array.isArray(r.courses)) return r.courses[0]?.slug ?? null;
        return r.courses.slug;
      })
      .filter((s): s is string => !!s),
  );
}

// ────────────────────────────────────────────────────────────────────
// LESSON PROGRESS
// ────────────────────────────────────────────────────────────────────

/**
 * Возвращает Set lesson_id, отмеченных как completed текущим юзером.
 */
export async function getMyCompletedLessonIds(): Promise<Set<string>> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('lesson_id');
  if (error) {
    console.error('[commerce.getMyCompletedLessonIds]', error);
    return new Set();
  }
  return new Set((data as { lesson_id: string }[]).map((r) => r.lesson_id));
}

export interface LessonWatchPositionRecord {
  lessonId: string;
  positionSec: number;
  durationSec: number;
}

/**
 * Возвращает позиции воспроизведения видео — для resume в LessonPlayer.
 */
export async function getMyWatchPositions(): Promise<
  Record<string, LessonWatchPositionRecord>
> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('lesson_watch_position')
    .select('lesson_id, position_sec, duration_sec');
  if (error) {
    console.error('[commerce.getMyWatchPositions]', error);
    return {};
  }
  const result: Record<string, LessonWatchPositionRecord> = {};
  for (const r of data as Array<{
    lesson_id: string;
    position_sec: number;
    duration_sec: number;
  }>) {
    result[r.lesson_id] = {
      lessonId: r.lesson_id,
      positionSec: r.position_sec,
      durationSec: r.duration_sec,
    };
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────
// CERTIFICATES
// ────────────────────────────────────────────────────────────────────

export interface CertificateRecord {
  id: string;
  courseSlug: string;
  verificationNumber: string;
  studentName: string;
  issuedAt: string;
}

export async function getMyCertificates(): Promise<CertificateRecord[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('certificates')
    .select(
      `
      id,
      verification_number,
      student_name,
      issued_at,
      courses:course_id ( slug )
      `,
    )
    .order('issued_at', { ascending: false });
  if (error) {
    console.error('[commerce.getMyCertificates]', error);
    return [];
  }
  type Row = {
    id: string;
    verification_number: string;
    student_name: string;
    issued_at: string;
    courses: { slug: string }[] | { slug: string } | null;
  };
  function joinedSlug(c: Row['courses']): string | null {
    if (!c) return null;
    if (Array.isArray(c)) return c[0]?.slug ?? null;
    return c.slug;
  }
  return (data as unknown as Row[])
    .map((r) => ({
      id: r.id,
      courseSlug: joinedSlug(r.courses),
      verificationNumber: r.verification_number,
      studentName: r.student_name,
      issuedAt: r.issued_at,
    }))
    .filter((r): r is CertificateRecord => r.courseSlug !== null) as CertificateRecord[];
}

// ────────────────────────────────────────────────────────────────────
// ПУБЛИЧНАЯ ПРОВЕРКА СЕРТИФИКАТА (по номеру)
// ────────────────────────────────────────────────────────────────────

export interface CertificateVerification {
  verificationNumber: string;
  studentName: string;
  courseTitle: string;
  issuedAt: string;
}

/**
 * Поиск сертификата по verification_number для публичной проверки (/verify/[number]).
 * Через admin (обход RLS) — проверяющий анонимный. Номер неугадываем, отдаём
 * только безопасные поля (имя, курс, дата).
 */
export async function verifyCertificateByNumber(
  number: string,
): Promise<CertificateVerification | null> {
  const clean = number.trim();
  if (!clean) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('certificates')
    .select('verification_number, student_name, issued_at, courses:course_id ( title )')
    .eq('verification_number', clean)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    verification_number: string;
    student_name: string;
    issued_at: string;
    courses: { title: string }[] | { title: string } | null;
  };
  const courseTitle = Array.isArray(row.courses) ? row.courses[0]?.title : row.courses?.title;

  return {
    verificationNumber: row.verification_number,
    studentName: row.student_name,
    courseTitle: courseTitle ?? 'Курс',
    issuedAt: row.issued_at,
  };
}
