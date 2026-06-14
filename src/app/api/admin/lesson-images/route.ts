import { NextResponse } from 'next/server';

import { auditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/queries/auth';

/**
 * POST /api/admin/lesson-images — загрузка картинки урока в Supabase Storage
 * (только админ). Возвращает публичный URL для вставки в редактор.
 * Бакет `lesson-content` создаётся лениво (public). Токены не в браузере.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'lesson-content';
const MAX_BYTES = 8 * 1024 * 1024; // 8 МБ на картинку

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 });
  if (!user.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Недостаточно прав' }, { status: 403 });
  }

  let file: FormDataEntryValue | null = null;
  try {
    const form = await req.formData();
    file = form.get('file');
  } catch {
    return NextResponse.json({ ok: false, error: 'Некорректный запрос' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Файл не найден' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ ok: false, error: 'Можно загружать только изображения' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'Картинка больше 8 МБ' }, { status: 400 });
  }

  const admin = createAdminClient();
  // Лениво создаём публичный бакет (если уже есть — ошибку игнорируем).
  try {
    await admin.storage.createBucket(BUCKET, { public: true });
  } catch {
    /* bucket already exists */
  }

  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (error) {
    logger.error({ err: error, userId: user.id }, 'lesson-image upload failed');
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  await auditLog({
    userId: user.id,
    action: 'lesson_image.uploaded',
    entityType: 'storage',
    entityId: path,
  });
  return NextResponse.json({ ok: true, url: pub.publicUrl });
}
