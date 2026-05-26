import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Server queries для админ-панели.
 * Все читают через service_role (createAdminClient) и обходят RLS —
 * админ должен видеть все строки. Вызывающий код обязан вызвать
 * requireAdmin() в Server Component / Server Action ДО этих query.
 */

// ────────────────────────────────────────────────────────────────────
// DASHBOARD STATS
// ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  totalCourses: number;
  totalLessons: number;
  totalPayments: number;
  totalCertificates: number;
  totalRevenueMinor: number;
  activeSubscriptions: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const admin = createAdminClient();

  // Параллельно тянем counts через Postgres COUNT(*) (head:true → не возвращает строки)
  const [
    { count: usersCount },
    { count: coursesCount },
    { count: lessonsCount },
    { count: paymentsCount },
    { count: certsCount },
    { data: revenueData },
    { count: activeSubsCount },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('courses').select('*', { count: 'exact', head: true }),
    admin.from('lessons').select('*', { count: 'exact', head: true }),
    admin.from('payments').select('*', { count: 'exact', head: true }),
    admin.from('certificates').select('*', { count: 'exact', head: true }),
    admin
      .from('payments')
      .select('amount_minor')
      .eq('status', 'succeeded'),
    admin
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('cancelled', false)
      .gt('expires_at', new Date().toISOString()),
  ]);

  const totalRevenueMinor = (revenueData ?? []).reduce(
    (sum, p: { amount_minor: number }) => sum + p.amount_minor,
    0,
  );

  return {
    totalUsers: usersCount ?? 0,
    totalCourses: coursesCount ?? 0,
    totalLessons: lessonsCount ?? 0,
    totalPayments: paymentsCount ?? 0,
    totalCertificates: certsCount ?? 0,
    totalRevenueMinor,
    activeSubscriptions: activeSubsCount ?? 0,
  };
}

// ────────────────────────────────────────────────────────────────────
// PAYMENTS (для RevenueChart)
// ────────────────────────────────────────────────────────────────────

export interface AdminPaymentRecord {
  status: 'succeeded' | 'refunded';
  paidAt: string;
  amountMinor: number;
}

export async function getAllPaymentsForRevenueChart(
  monthsBack: number = 12,
): Promise<AdminPaymentRecord[]> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - monthsBack * 31 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from('payments')
    .select('status, paid_at, amount_minor')
    .gte('paid_at', since)
    .order('paid_at', { ascending: true });

  if (error) {
    console.error('[admin.getAllPaymentsForRevenueChart]', error);
    return [];
  }

  return (data as Array<{ status: 'succeeded' | 'refunded'; paid_at: string; amount_minor: number }>).map((p) => ({
    status: p.status,
    paidAt: p.paid_at,
    amountMinor: p.amount_minor,
  }));
}

// ────────────────────────────────────────────────────────────────────
// USERS LIST
// ────────────────────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  initials: string;
  isAdmin: boolean;
  registeredAt: string;
  purchasesCount: number;
  certificatesCount: number;
  completedLessonsCount: number;
  hasActiveSubscription: boolean;
}

/**
 * Возвращает список всех пользователей + их статистика для админки.
 * Делает 5 запросов параллельно, агрегирует в JS (для нашего масштаба ок).
 */
export async function getAdminUsersList(): Promise<AdminUserRow[]> {
  const admin = createAdminClient();

  // Все профили (admin видит все по RLS)
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, name, initials, is_admin, registered_at')
    .order('registered_at', { ascending: false });
  if (profilesError) {
    console.error('[admin.getAdminUsersList] profiles', profilesError);
    return [];
  }

  // Email'ы из auth.users через Auth Admin API
  const { data: authData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000, // 1000 user'ов в одном запросе достаточно для MVP
  });
  const emailById = new Map<string, string>();
  for (const u of authData.users) {
    emailById.set(u.id, u.email ?? '');
  }

  // Агрегаты — параллельно
  const [purchasesRes, certsRes, lessonsDoneRes, subsRes] = await Promise.all([
    admin.from('purchases').select('user_id'),
    admin.from('certificates').select('user_id'),
    admin.from('lesson_progress').select('user_id'),
    admin
      .from('subscriptions')
      .select('user_id')
      .eq('cancelled', false)
      .gt('expires_at', new Date().toISOString()),
  ]);

  const purchasesByUser = countBy(purchasesRes.data ?? [], 'user_id');
  const certsByUser = countBy(certsRes.data ?? [], 'user_id');
  const lessonsByUser = countBy(lessonsDoneRes.data ?? [], 'user_id');
  const activeSubUsers = new Set(
    (subsRes.data ?? []).map((s: { user_id: string }) => s.user_id),
  );

  type ProfileRow = {
    id: string;
    name: string;
    initials: string;
    is_admin: boolean;
    registered_at: string;
  };

  return (profiles as ProfileRow[]).map((p) => ({
    id: p.id,
    email: emailById.get(p.id) ?? '',
    name: p.name,
    initials: p.initials,
    isAdmin: p.is_admin,
    registeredAt: p.registered_at,
    purchasesCount: purchasesByUser.get(p.id) ?? 0,
    certificatesCount: certsByUser.get(p.id) ?? 0,
    completedLessonsCount: lessonsByUser.get(p.id) ?? 0,
    hasActiveSubscription: activeSubUsers.has(p.id),
  }));
}

// ────────────────────────────────────────────────────────────────────
// PROMOCODES LIST
// ────────────────────────────────────────────────────────────────────

export interface AdminPromocodeRow {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  validUntil: string | null;
  usesLeft: number | null;
  note: string;
  createdAt: string;
}

export async function getAdminPromocodes(): Promise<AdminPromocodeRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('promocodes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[admin.getAdminPromocodes]', error);
    return [];
  }
  type Row = {
    id: string;
    code: string;
    type: 'percent' | 'fixed';
    value: number;
    valid_until: string | null;
    uses_left: number | null;
    note: string;
    created_at: string;
  };
  return (data as Row[]).map((p) => ({
    id: p.id,
    code: p.code,
    type: p.type,
    value: p.value,
    validUntil: p.valid_until,
    usesLeft: p.uses_left,
    note: p.note,
    createdAt: p.created_at,
  }));
}

// ────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────

function countBy<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key]);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
