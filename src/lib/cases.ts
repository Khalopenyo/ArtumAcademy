import type { CategoryId } from '@/lib/mock/courses';

/**
 * Кейс — история студента / проект для публичной страницы /cases.
 * Карточка: фото ИЛИ встроенное видео по ссылке + заголовок + описание +
 * имя + результат + направление.
 */
export interface Case {
  id: string;
  title: string;
  studentName: string;
  description: string;
  result: string;
  category: CategoryId;
  coverUrl: string | null;
  /** Ссылка на видео (RuTube / YouTube / VK / Vimeo). Если есть — показываем плеер. */
  videoUrl: string | null;
  published: boolean;
  orderIndex: number;
}

/**
 * Превращает ссылку на видео (RuTube / YouTube / VK Video / Vimeo) в embed-URL
 * для iframe. Белый список провайдеров — произвольные URL НЕ встраиваются
 * (защита от вставки чужих iframe). null = провайдер не распознан → фолбэк на фото.
 */
export function caseVideoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');

  // RuTube: rutube.ru/video/<id>/ или /play/embed/<id>
  if (host === 'rutube.ru') {
    const m = raw.match(/rutube\.ru\/(?:video|play\/embed)\/([0-9a-fA-F]+)/);
    if (m) return `https://rutube.ru/play/embed/${m[1]}`;
  }
  // YouTube
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = parsed.searchParams.get('v');
    if (v) return `https://www.youtube.com/embed/${v}`;
    const m = raw.match(/youtube(?:-nocookie)?\.com\/(?:shorts|embed)\/([\w-]+)/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
  }
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0];
    if (id) return `https://www.youtube.com/embed/${id}`;
  }
  // Vimeo
  if (host === 'vimeo.com') {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
  }
  // VK Video: vk.com/video<oid>_<id> или vkvideo.ru/...
  if (host === 'vk.com' || host === 'vkvideo.ru') {
    const m = raw.match(/video(-?\d+)_(\d+)/);
    if (m) return `https://vk.com/video_ext.php?oid=${m[1]}&id=${m[2]}&hd=2`;
  }
  return null;
}
