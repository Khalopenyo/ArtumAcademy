'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auditLog } from '@/lib/audit-log';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/queries/auth';

/**
 * Admin Server Actions для CRUD кейсов.
 *
 * SECURITY: каждый action начинается с assertAdmin() (cookie/сессия +
 * profiles.is_admin). Service-role клиент обходит RLS, поэтому без проверки
 * любой залогиненный пользователь мог бы дёрнуть action напрямую.
 *
 * Все входные данные ре-валидируются через Zod ДАЖЕ на update (Server Action —
 * публичный HTTP-эндпоинт; TypeScript-типы не защищают в рантайме). Мутации
 * пишутся в audit_log.
 */

async function assertAdmin(): Promise<
  { ok: true; user: { id: string } } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Не авторизован' };
  if (!user.isAdmin) return { ok: false, error: 'Недостаточно прав' };
  return { ok: true, user: { id: user.id } };
}

const CATEGORY_VALUES = ['ai', 'photo', 'video', 'editing', 'design', 'visual', 'copy'] as const;

const CaseSchema = z.object({
  title: z.string().min(1, 'Укажите заголовок'),
  studentName: z.string().default(''),
  description: z.string().default(''),
  result: z.string().default(''),
  category: z.enum(CATEGORY_VALUES),
  coverUrl: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  published: z.boolean().default(true),
  orderIndex: z.number().int().default(100),
});

const idSchema = z.string().uuid();

type CaseInput = z.infer<typeof CaseSchema>;
type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCaseAction(
  input: CaseInput,
): Promise<ActionResult & { id?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const parsed = CaseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('cases')
    .insert({
      title: parsed.data.title,
      student_name: parsed.data.studentName,
      description: parsed.data.description,
      result: parsed.data.result,
      category: parsed.data.category,
      cover_url: parsed.data.coverUrl ?? null,
      video_url: parsed.data.videoUrl ?? null,
      published: parsed.data.published,
      order_index: parsed.data.orderIndex,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  await auditLog({
    userId: guard.user.id,
    action: 'case.created',
    entityType: 'case',
    entityId: data.id,
  });
  revalidatePath('/cases');
  return { ok: true, id: data.id };
}

export async function updateCaseAction(
  id: string,
  patch: Partial<CaseInput>,
): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Некорректный id' };
  // Ре-валидируем patch (частичная схема) — категория/число не должны попасть в БД сырыми.
  const parsed = CaseSchema.partial().safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' };
  }
  const p = parsed.data;
  const admin = createAdminClient();
  const row: Record<string, unknown> = {};
  if (p.title !== undefined) row.title = p.title;
  if (p.studentName !== undefined) row.student_name = p.studentName;
  if (p.description !== undefined) row.description = p.description;
  if (p.result !== undefined) row.result = p.result;
  if (p.category !== undefined) row.category = p.category;
  if (p.coverUrl !== undefined) row.cover_url = p.coverUrl;
  if (p.videoUrl !== undefined) row.video_url = p.videoUrl;
  if (p.published !== undefined) row.published = p.published;
  if (p.orderIndex !== undefined) row.order_index = p.orderIndex;
  // updated_at проставляется триггером cases_set_updated_at.
  const { error } = await admin
    .from('cases')
    .update(row as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  await auditLog({
    userId: guard.user.id,
    action: 'case.updated',
    entityType: 'case',
    entityId: id,
  });
  revalidatePath('/cases');
  return { ok: true };
}

export async function deleteCaseAction(id: string): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Некорректный id' };
  const admin = createAdminClient();
  const { error } = await admin.from('cases').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  await auditLog({
    userId: guard.user.id,
    action: 'case.deleted',
    entityType: 'case',
    entityId: id,
  });
  revalidatePath('/cases');
  return { ok: true };
}
