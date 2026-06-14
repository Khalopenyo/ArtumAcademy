import { NextResponse } from 'next/server';

import { auditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/queries/auth';

/**
 * POST /api/admin/course-covers — загрузка обложки курса (картинка/GIF/видео)
 * в Supabase Storage (только админ). Возвращает публичный URL.
 * Бакет `course-covers` создаётся лениво (public).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'course-covers';
const MAX_BYTES = 25 * 1024 * 1024; // 25 МБ (под короткое видео-луп)

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
  const okType =
    file.type.startsWith('image/') || file.type === 'video/mp4' || file.type === 'video/webm';
  if (!okType) {
    return NextResponse.json(
      { ok: false, error: 'Можно: картинка, GIF или видео (mp4/webm)' },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'Файл больше 25 МБ' }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    await admin.storage.createBucket(BUCKET, { public: true });
  } catch {
    /* bucket exists */
  }

  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (error) {
    logger.error({ err: error, userId: user.id }, 'course-cover upload failed');
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  await auditLog({
    userId: user.id,
    action: 'course_cover.uploaded',
    entityType: 'storage',
    entityId: path,
  });
  return NextResponse.json({ ok: true, url: pub.publicUrl });
}
