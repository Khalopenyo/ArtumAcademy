/**
 * Классификация значения `lessons.video_url`.
 *
 * Одно поле БД может хранить разные виды видео-ссылок, а плеер сам выбирает
 * рендерер:
 *   - Kinescope video ID (UUID / короткий код) или `kinescope.io`-URL
 *     → { kind: 'kinescope', videoId }   → официальный Kinescope-плеер
 *   - обычный http(s)-URL (mp4/webm/hls — в т.ч. демо-моки)
 *     → { kind: 'file', url }            → HTML5 <video>
 *   - пусто / мусор
 *     → { kind: 'none' }                 → плейсхолдер
 *
 * Чистая функция без побочных эффектов и без `server-only` — используется
 * и на сервере, и в клиентском компоненте LessonPlayer. Покрыта юнит-тестами.
 */

export type LessonVideoRef =
  | { kind: 'kinescope'; videoId: string }
  | { kind: 'file'; url: string }
  | { kind: 'none' };

/** UUID v1–v5 — один из форматов Kinescope video id. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Короткий «голый» идентификатор: буквы/цифры/-/_, 6–64 символа, без точек. */
const BARE_ID_RE = /^[0-9a-z_-]{6,64}$/i;

/** Достаёт Kinescope videoId из `kinescope.io`-URL (или null, если это не он). */
function extractKinescopeId(url: URL): string | null {
  if (!/(^|\.)kinescope\.io$/i.test(url.hostname)) return null;
  // поддерживаем /{id}, /embed/{id}, /watch/{id}
  const segments = url.pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return null;
  if (UUID_RE.test(last) || BARE_ID_RE.test(last)) return last;
  return null;
}

export function parseLessonVideo(value: string | null | undefined): LessonVideoRef {
  const v = value?.trim();
  if (!v) return { kind: 'none' };

  // 1) Явный префикс — самый надёжный способ для админа: `kinescope:<id>`
  if (/^kinescope:/i.test(v)) {
    const id = v.slice(v.indexOf(':') + 1).trim();
    return id && (UUID_RE.test(id) || BARE_ID_RE.test(id))
      ? { kind: 'kinescope', videoId: id }
      : { kind: 'none' };
  }

  // 2) Полноценный URL
  if (/^https?:\/\//i.test(v)) {
    try {
      const kid = extractKinescopeId(new URL(v));
      if (kid) return { kind: 'kinescope', videoId: kid };
    } catch {
      return { kind: 'none' };
    }
    return { kind: 'file', url: v };
  }

  // 3) Голый UUID → Kinescope
  if (UUID_RE.test(v)) return { kind: 'kinescope', videoId: v };

  // 4) Голый короткий id (админ вставил «как есть»)
  if (BARE_ID_RE.test(v)) return { kind: 'kinescope', videoId: v };

  return { kind: 'none' };
}
