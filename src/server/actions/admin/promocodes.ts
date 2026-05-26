'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/queries/auth';

/**
 * Admin Server Actions для CRUD промокодов.
 * Каждый action проверяет is_admin перед записью.
 */

async function assertAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Не авторизован' };
  if (!user.isAdmin) return { ok: false, error: 'Недостаточно прав' };
  return { ok: true };
}

type ActionResult = { ok: true } | { ok: false; error: string };

const PromocodeSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[A-Z0-9_-]{3,32}$/, 'Код: только латиница/цифры/-_, 3-32 символа'),
  type: z.enum(['percent', 'fixed']),
  /** percent: 1-100; fixed: копейки */
  value: z.number().int().positive(),
  /** ISO date string или null */
  validUntil: z.string().nullable(),
  /** число использований или null */
  usesLeft: z.number().int().min(0).nullable(),
  note: z.string().default(''),
});

export async function createPromocodeAction(
  input: z.infer<typeof PromocodeSchema>,
): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;

  const parsed = PromocodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' };
  }
  const { code, type, value, validUntil, usesLeft, note } = parsed.data;

  if (type === 'percent' && (value < 1 || value > 100)) {
    return { ok: false, error: 'Процент должен быть 1-100' };
  }
  if (type === 'fixed' && value < 100) {
    return { ok: false, error: 'Фикс. скидка должна быть >= 1 ₽ (100 копеек)' };
  }

  const admin = createAdminClient();
  const { error } = await admin.from('promocodes').insert({
    code,
    type,
    value,
    valid_until: validUntil,
    uses_left: usesLeft,
    note,
  });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Промокод с таким кодом уже существует' };
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/promocodes');
  return { ok: true };
}

export async function deletePromocodeAction(id: string): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: 'Невалидный id' };
  }

  const admin = createAdminClient();
  const { error } = await admin.from('promocodes').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/promocodes');
  return { ok: true };
}
