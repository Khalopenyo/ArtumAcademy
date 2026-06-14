'use client';

import { useEffect, useRef } from 'react';

import { KinescopePlayer } from '@/components/artum/KinescopePlayer';
import { parseLessonVideo } from '@/lib/kinescope/video-ref';
import { cn } from '@/lib/utils';

interface LessonPlayerProps {
  /**
   * Значение lessons.video_url. Может быть:
   *   - Kinescope video ID / `kinescope.io`-URL → официальный плеер
   *   - обычный http(s)-URL (mp4/webm/hls) → HTML5 <video>
   *   - null → плейсхолдер
   */
  videoUrl: string | null;
  /** Стартовая позиция, секунды (из store) */
  startPositionSec?: number;
  /** Фолбэк-градиент-фон, когда видео нет */
  fallbackGradient?: string;
  /** Водяной знак для Kinescope (анти-пиратство) — обычно email зрителя. */
  watermarkText?: string | null;
  /** onProgress: каждые ~1 сек, передаёт текущую позицию и длительность */
  onProgress?: (positionSec: number, durationSec: number) => void;
  /** onEnded: видео закончилось */
  onEnded?: () => void;
}

/**
 * Диспетчер плеера урока. По формату lessons.video_url выбирает рендерер:
 *   - Kinescope → <KinescopePlayer> (private-link, HLS, водяной знак)
 *   - файл/URL → <Html5Player> (демо-моки, прямые ссылки)
 *   - нет видео → плейсхолдер
 *
 * Внешний контракт совпадает со старым LessonPlayer, поэтому страница урока
 * не меняется. Каждый под-плеер владеет своими хуками (rules of hooks).
 */
export function LessonPlayer({
  videoUrl,
  startPositionSec = 0,
  fallbackGradient,
  watermarkText,
  onProgress,
  onEnded,
}: LessonPlayerProps) {
  const ref = parseLessonVideo(videoUrl);

  if (ref.kind === 'kinescope') {
    return (
      <KinescopePlayer
        videoId={ref.videoId}
        startPositionSec={startPositionSec}
        watermarkText={watermarkText}
        onProgress={onProgress}
        onEnded={onEnded}
      />
    );
  }

  if (ref.kind === 'file') {
    return (
      <Html5Player
        url={ref.url}
        startPositionSec={startPositionSec}
        onProgress={onProgress}
        onEnded={onEnded}
      />
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
      <div
        aria-hidden
        className={cn('absolute inset-0 bg-gradient-to-br opacity-60', fallbackGradient)}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
        <div className="text-sm">Видео не загружено для этого урока</div>
        <div className="text-xs text-white/50">Привяжите видео через админ-панель курса</div>
      </div>
    </div>
  );
}

interface Html5PlayerProps {
  url: string;
  startPositionSec: number;
  onProgress?: (positionSec: number, durationSec: number) => void;
  onEnded?: () => void;
}

/**
 * Минимальный HTML5-плеер: любой формат, который умеет браузер (mp4, webm,
 * hls в Safari). Используется для демо-моков и прямых ссылок.
 * onProgress эмитится ~раз в секунду через `timeupdate`.
 */
function Html5Player({ url, startPositionSec, onProgress, onEnded }: Html5PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const seededRef = useRef(false);
  const lastEmitRef = useRef(0);

  // При смене урока сбрасываем seed-флаг.
  useEffect(() => {
    seededRef.current = false;
    lastEmitRef.current = 0;
  }, [url]);

  // Seek на startPositionSec при готовности метаданных.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function handleLoadedMetadata() {
      if (seededRef.current || startPositionSec <= 0 || !video) return;
      try {
        video.currentTime = startPositionSec;
      } catch {
        // ignore
      }
      seededRef.current = true;
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }, [url, startPositionSec]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={url}
        controls
        playsInline
        preload="metadata"
        className="size-full"
        onTimeUpdate={(e) => {
          const video = e.currentTarget;
          // Throttle до 1 эмита в секунду (timeupdate fires ~4 раза/сек).
          const now = Math.floor(video.currentTime);
          if (now === lastEmitRef.current) return;
          lastEmitRef.current = now;
          if (onProgress && video.duration > 0 && Number.isFinite(video.duration)) {
            onProgress(video.currentTime, video.duration);
          }
        }}
        onEnded={() => {
          onEnded?.();
        }}
      />
    </div>
  );
}
