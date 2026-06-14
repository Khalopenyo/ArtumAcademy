import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';
import type { SubscriptionPlan } from '@/lib/subscription-plans';

/**
 * Server queries для планов подписки.
 * Публичное чтение — только published (RLS sub_plans_public_select).
 * Админ-запросы — service_role.
 */

interface PlanRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_monthly_minor: number;
  price_yearly_minor: number;
  is_all_courses: boolean;
  published: boolean;
  order_index: number;
}

function rowToPlan(r: PlanRow, courseIds: string[]): SubscriptionPlan {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    priceMonthlyMinor: r.price_monthly_minor,
    priceYearlyMinor: r.price_yearly_minor,
    isAllCourses: r.is_all_courses,
    published: r.published,
    orderIndex: r.order_index,
    courseIds,
  };
}

function groupCourseIds(
  links: Array<{ plan_id: string; course_id: string }>,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const l of links) {
    const arr = map.get(l.plan_id) ?? [];
    arr.push(l.course_id);
    map.set(l.plan_id, arr);
  }
  return map;
}

/** Публичные (опубликованные) планы — для /subscribe. */
export async function getPublishedPlans(): Promise<SubscriptionPlan[]> {
  const supabase = createServerSupabase();
  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('published', true)
    .order('order_index', { ascending: true });
  if (error || !plans) {
    if (error) console.error('[plans.getPublishedPlans]', error);
    return [];
  }
  const { data: links } = await supabase
    .from('subscription_plan_courses')
    .select('plan_id, course_id');
  const byPlan = groupCourseIds((links ?? []) as Array<{ plan_id: string; course_id: string }>);
  return (plans as PlanRow[]).map((p) => rowToPlan(p, byPlan.get(p.id) ?? []));
}

export interface AdminPlanRow extends SubscriptionPlan {
  courseCount: number;
  activeSubscribers: number;
}

/** Админ: все планы + счётчики курсов и активных подписчиков. */
export async function getAllPlansForAdmin(): Promise<AdminPlanRow[]> {
  const admin = createAdminClient();
  const { data: plans, error } = await admin
    .from('subscription_plans')
    .select('*')
    .order('order_index', { ascending: true });
  if (error || !plans) {
    if (error) console.error('[plans.getAllPlansForAdmin]', error);
    return [];
  }
  const [{ data: links }, { data: subs }] = await Promise.all([
    admin.from('subscription_plan_courses').select('plan_id, course_id'),
    admin
      .from('subscriptions')
      .select('plan_id')
      .eq('cancelled', false)
      .gt('expires_at', new Date().toISOString()),
  ]);
  const byPlan = groupCourseIds((links ?? []) as Array<{ plan_id: string; course_id: string }>);
  const subCount = new Map<string, number>();
  for (const s of (subs ?? []) as Array<{ plan_id: string | null }>) {
    if (s.plan_id) subCount.set(s.plan_id, (subCount.get(s.plan_id) ?? 0) + 1);
  }
  return (plans as PlanRow[]).map((p) => {
    const courseIds = byPlan.get(p.id) ?? [];
    return {
      ...rowToPlan(p, courseIds),
      courseCount: courseIds.length,
      activeSubscribers: subCount.get(p.id) ?? 0,
    };
  });
}

/** Админ: план по id с набором курсов — для формы редактирования. */
export async function getPlanByIdForAdmin(id: string): Promise<SubscriptionPlan | null> {
  const admin = createAdminClient();
  const { data: plan, error } = await admin
    .from('subscription_plans')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !plan) return null;
  const { data: links } = await admin
    .from('subscription_plan_courses')
    .select('course_id')
    .eq('plan_id', id);
  return rowToPlan(
    plan as PlanRow,
    ((links ?? []) as Array<{ course_id: string }>).map((l) => l.course_id),
  );
}
