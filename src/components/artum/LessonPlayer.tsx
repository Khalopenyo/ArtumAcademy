'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

interface LessonPlayerProps {
  videoUrl: string | null;
  /** Стартовая позиция, секунды (из store) */
  startPositionSec?: number;
  /** Фолбэк-градиент-фон, когда видео нет */
  fallbackGradient?: string;
  /** onProgress: каждые ~1 сек, передаёт текущую позицию и длительность */
  onProgress?: (positionSec: number, durationSec: number) => void;
  /** onEnded: видео закончилось */
  onEnded?: () => void;
}

/**
 * Минимальный HTML5-плеер для уроков.
 * Поддерживает любой формат, который браузер умеет: mp4, webm, hls (Safari).
 *
 * Mock-URLs в src/lib/mock/courses.ts — это публичные mp4 от Google.
 * При переходе на реальный backend заменим на signed URLs (Mux/Kinescope)
 * + поддержку HLS-streaming.
 *
 * onProgress эмитится каждую секунду через `timeupdate` event.
 */
export function LessonPlayer({
  videoUrl,
  startPositionSec = 0,
  fallbackGradient,
  onProgress,
  onEnded,
}: LessonPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const seededRef = useRef(false);
  const lastEmitRef = useRef(0);

  // При смене урока сбрасываем seed-флаг
  useEffect(() => {
    seededRef.current = false;
    lastEmitRef.current = 0;
  }, [videoUrl]);

  // Seek на startPositionSec при готовности метаданных
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

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
  }, [videoUrl, startPositionSec]);

  if (!videoUrl) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 bg-gradient-to-br opacity-60',
            fallbackGradient,
          )}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
          <div className="text-sm">Видео не загружено для этого урока</div>
          <div className="text-xs text-white/50">
            Привяжите URL через админ-панель курса
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        playsInline
        preload="metadata"
        className="size-full"
        onTimeUpdate={(e) => {
          const video = e.currentTarget;
          // Throttle до 1 эмита в секунду (timeupdate fires ~4 раза/сек)
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
