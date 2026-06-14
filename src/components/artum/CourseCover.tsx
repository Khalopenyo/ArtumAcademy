import { cn } from '@/lib/utils';

/**
 * Обложка курса: медиа (картинка/GIF/видео) или градиент-фолбэк.
 * Заполняет родителя (`absolute inset-0`) — оборачивающий элемент должен быть
 * `relative` + `overflow-hidden` + задавать высоту.
 *
 * GIF рендерим обычным <img> (next/image заморозил бы анимацию).
 * Видео — немой автоплей-луп.
 */
const VIDEO_RE = /\.(mp4|webm|mov)(\?|$)/i;

interface CourseCoverProps {
  coverUrl?: string | null;
  gradient: string;
  className?: string;
}

export function CourseCover({ coverUrl, gradient, className }: CourseCoverProps) {
  if (coverUrl && VIDEO_RE.test(coverUrl)) {
    return (
      <video
        src={coverUrl}
        className={cn('absolute inset-0 size-full object-cover', className)}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
      />
    );
  }
  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt=""
        aria-hidden
        className={cn('absolute inset-0 size-full object-cover', className)}
      />
    );
  }
  return (
    <div aria-hidden className={cn('absolute inset-0 bg-gradient-to-br', gradient, className)} />
  );
}
