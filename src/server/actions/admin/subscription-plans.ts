'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auditLog } from '@/lib/audit-log';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/queries/auth';

/**
 * Admin Server Actions для CRUD планов подписки (money-critical).
 * Каждый action под assertAdmin(), Zod-валидация, аудит.
 */

async function assertAdmin(): Promise<
  { ok: true; user: { id: string } } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Не авторизован' };
  if (!user.isAdmin) return { ok: false, error: 'Недостаточно прав' };
  return { ok: true, user: { id: user.id } };
}

const PlanSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug: только латиница, цифры, дефис'),
  name: z.string().min(1, 'Укажите название'),
  description: z.string().default(''),
  priceMonthlyMinor: z.number().int().min(0).default(0),
  priceYearlyMinor: z.number().int().min(0).default(0),
  isAllCourses: z.boolean().default(false),
  published: z.boolean().default(true),
  orderIndex: z.number().int().default(100),
  courseIds: z.array(z.string().uuid()).default([]),
});

type PlanInput = z.infer<typeof PlanSchema>;
type ActionResult = { ok: true } | { ok: false; error: string };
const idSchema = z.string().uuid();

/** Заменяет состав плана (для кураторских планов). isAllCourses → набор не нужен. */
async function setPlanCourses(
  admin: ReturnType<typeof createAdminClient>,
  planId: string,
  courseIds: string[],
  isAllCourses: boolean,
): Promise<void> {
  await admin.from('subscription_plan_courses').delete().eq('plan_id', planId);
  if (isAllCourses || courseIds.length === 0) return;
  await admin
    .from('subscription_plan_courses')
    .insert(courseIds.map((cid) => ({ plan_id: planId, course_id: cid })));
}

export async function createPlanAction(
  input: PlanInput,
): Promise<ActionResult & { id?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const parsed = PlanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' };
  }
  const p = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('subscription_plans')
    .insert({
      slug: p.slug,
      name: p.name,
      description: p.description,
      price_monthly_minor: p.priceMonthlyMinor,
      price_yearly_minor: p.priceYearlyMinor,
      is_all_courses: p.isAllCourses,
      published: p.published,
      order_index: p.orderIndex,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'План с таким slug уже существует' };
    return { ok: false, error: error.message };
  }
  await setPlanCourses(admin, data.id, p.courseIds, p.isAllCourses);
  await auditLog({
    userId: guard.user.id,
    action: 'subscription_plan.created',
    entityType: 'subscription_plan',
    entityId: data.id,
  });
  revalidatePath('/subscribe');
  return { ok: true, id: data.id };
}

export async function updatePlanAction(
  id: string,
  patch: Partial<PlanInput>,
): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Некорректный id' };
  const parsed = PlanSchema.partial().safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' };
  }
  const p = parsed.data;
  const admin = createAdminClient();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.slug !== undefined) row.slug = p.slug;
  if (p.name !== undefined) row.name = p.name;
  if (p.description !== undefined) row.description = p.description;
  if (p.priceMonthlyMinor !== undefined) row.price_monthly_minor = p.priceMonthlyMinor;
  if (p.priceYearlyMinor !== undefined) row.price_yearly_minor = p.priceYearlyMinor;
  if (p.isAllCourses !== undefined) row.is_all_courses = p.isAllCourses;
  if (p.published !== undefined) row.published = p.published;
  if (p.orderIndex !== undefined) row.order_index = p.orderIndex;
  const { error } = await admin
    .from('subscription_plans')
    .update(row as never)
    .eq('id', id);
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'План с таким slug уже существует' };
    return { ok: false, error: error.message };
  }
  // Набор курсов меняем только если он передан в patch.
  if (p.courseIds !== undefined) {
    // Нужен актуальный флаг isAllCourses (из patch или из БД).
    let isAll = p.isAllCourses;
    if (isAll === undefined) {
      const { data: cur } = await admin
        .from('subscription_plans')
        .select('is_all_courses')
        .eq('id', id)
        .maybeSingle();
      isAll = (cur as { is_all_courses?: boolean } | null)?.is_all_courses ?? false;
    }
    await setPlanCourses(admin, id, p.courseIds, isAll);
  } else if (p.isAllCourses === true) {
    // Стал «всё» → набор больше не нужен, чистим.
    await setPlanCourses(admin, id, [], true);
  }
  await auditLog({
    userId: guard.user.id,
    action: 'subscription_plan.updated',
    entityType: 'subscription_plan',
    entityId: id,
  });
  revalidatePath('/subscribe');
  return { ok: true };
}

export async function deletePlanAction(id: string): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Некорректный id' };
  const admin = createAdminClient();
  // Нельзя удалить план, на который ссылаются активные подписки.
  const { data: active } = await admin
    .from('subscriptions')
    .select('id')
    .eq('plan_id', id)
    .eq('cancelled', false)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (active) {
    return { ok: false, error: 'У плана есть активные подписчики — удалить нельзя' };
  }
  const { error } = await admin.from('subscription_plans').delete().eq('id', id);
  if (error) {
    // 23503 = FK violation (есть исторические подписки на план)
    if (error.code === '23503') {
      return { ok: false, error: 'На план ссылаются подписки — удалить нельзя. Снимите публикацию.' };
    }
    return { ok: false, error: error.message };
  }
  await auditLog({
    userId: guard.user.id,
    action: 'subscription_plan.deleted',
    entityType: 'subscription_plan',
    entityId: id,
  });
  revalidatePath('/subscribe');
  return { ok: true };
}
