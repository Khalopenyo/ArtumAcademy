import 'server-only';

import { env } from '@/env';

/**
 * Серверная загрузка видео в Kinescope (simple direct upload v2).
 * Токен и project id — серверные, в браузер НЕ попадают (загрузка идёт через
 * наш Route Handler, который проксирует поток в Kinescope).
 *
 * Контракт проверен вживую против боевого API:
 *   POST https://uploader.kinescope.io/v2/video
 *   headers: Authorization: Bearer <token>, X-Parent-ID: <project>, X-Video-Title
 *   body:    сырые байты файла
 *   → 200 { data: { id, ... } }
 */

const UPLOADER_URL = 'https://uploader.kinescope.io/v2/video';

function isStub(v: string | undefined): boolean {
  return !v || v.trim() === '' || v.startsWith('stub');
}

/** true, если заданы реальные (не-заглушечные) ключи Kinescope. */
export function kinescopeConfigured(): boolean {
  return !isStub(env.KINESCOPE_PRIVATE_API_TOKEN) && !isStub(env.KINESCOPE_PROJECT_ID);
}

export type KinescopeUploadResult = { ok: true; videoId: string } | { ok: false; error: string };

export async function uploadVideoToKinescope(opts: {
  body: ReadableStream<Uint8Array> | ArrayBuffer | Blob;
  title: string;
  contentType?: string;
}): Promise<KinescopeUploadResult> {
  if (!kinescopeConfigured()) {
    return { ok: false, error: 'Kinescope не настроен: задайте реальные ключи в .env' };
  }

  // undici требует `duplex: 'half'` при стриминге тела (ReadableStream).
  const init: RequestInit & { duplex?: 'half' } = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.KINESCOPE_PRIVATE_API_TOKEN}`,
      'X-Parent-ID': env.KINESCOPE_PROJECT_ID,
      'X-Video-Title': encodeURIComponent(opts.title || 'lesson'),
      'Content-Type': opts.contentType || 'application/octet-stream',
    },
    body: opts.body as BodyInit,
  };
  if (opts.body instanceof ReadableStream) init.duplex = 'half';

  let res: Response;
  try {
    res = await fetch(UPLOADER_URL, init);
  } catch (err) {
    return { ok: false, error: `Kinescope недоступен: ${(err as Error).message}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return {
      ok: false,
      error: `Kinescope ответил ${res.status}${text ? `: ${text.slice(0, 300)}` : ''}`,
    };
  }

  const json = (await res.json().catch(() => null)) as
    | { data?: { id?: string }; id?: string }
    | null;
  const videoId = json?.data?.id ?? json?.id;
  if (!videoId) return { ok: false, error: 'Kinescope не вернул id видео' };
  return { ok: true, videoId };
}
