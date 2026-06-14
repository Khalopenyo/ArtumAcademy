import { NextResponse } from 'next/server';

import { auditLog } from '@/lib/audit-log';
import { uploadVideoToKinescope } from '@/lib/kinescope/upload';
import { logger } from '@/lib/logger';
import { getCurrentUser } from '@/server/queries/auth';

/**
 * POST /api/admin/videos — загрузка видео-файла в Kinescope (только админ).
 *
 * Браузер шлёт сырые байты файла в теле запроса + заголовки:
 *   Content-Type: <mime>            — тип файла
 *   X-Video-Title: <encoded title>  — название (percent-encoded, для кириллицы)
 *
 * Файл стримится через наш сервер в Kinescope (токен остаётся серверным).
 * Возвращает { ok, videoId } — клиент сохраняет id в урок.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 });
  if (!user.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Недостаточно прав' }, { status: 403 });
  }

  if (!req.body) {
    return NextResponse.json({ ok: false, error: 'Пустой запрос (нет файла)' }, { status: 400 });
  }

  const rawTitle = req.headers.get('x-video-title') ?? '';
  let title = 'lesson';
  try {
    title = decodeURIComponent(rawTitle) || 'lesson';
  } catch {
    title = rawTitle || 'lesson';
  }
  const contentType = req.headers.get('content-type') ?? 'application/octet-stream';

  logger.info({ userId: user.id, title }, 'kinescope upload: start');
  const result = await uploadVideoToKinescope({ body: req.body, title, contentType });

  if (!result.ok) {
    logger.error({ userId: user.id, err: result.error }, 'kinescope upload: failed');
    return NextResponse.json(result, { status: 502 });
  }

  await auditLog({
    userId: user.id,
    action: 'video.uploaded',
    entityType: 'kinescope_video',
    entityId: result.videoId,
  });
  logger.info({ userId: user.id, videoId: result.videoId }, 'kinescope upload: done');
  return NextResponse.json({ ok: true, videoId: result.videoId });
}
