'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';

/**
 * Обёртка над официальным `@kinescope/react-kinescope-player`.
 *
 * Грузится только на клиенте (`ssr: false`) — плеер создаёт iframe и работает
 * с `window`/postMessage. Прогресс и длительность приходят событиями, поэтому
 * ref на инстанс не нужен (что важно: next/dynamic не форвардит ref):
 *   - стартовая позиция → проп `query.seek`
 *   - позиция          → onTimeUpdate({ currentTime })
 *   - длительность     → onReady/onDurationChange({ duration }) (кэшируем)
 *   - конец            → onEnded
 *
 * watermark — текстовый водяной знак поверх видео (обычно email зрителя):
 * деанонимизирует утечки/перезаливы. Это и есть «income-protecting» фича,
 * ради которой берём Kinescope, а не голый <video>.
 */

const Player = dynamic(() => import('@kinescope/react-kinescope-player'), {
  ssr: false,
  loading: () => <PlayerSkeleton />,
});

function PlayerSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div
        className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70"
        aria-label="Загрузка плеера"
      />
    </div>
  );
}

interface KinescopePlayerProps {
  videoId: string;
  /** Стартовая позиция, секунды. */
  startPositionSec?: number;
  /** Текст водяного знака (анти-пиратство) — обычно email зрителя. */
  watermarkText?: string | null;
  /** DRM watch-token, если включён signed-доступ (иначе домен-restriction). */
  drmAuthToken?: string;
  /** onProgress: ~1 раз/сек — текущая позиция и длительность. */
  onProgress?: (positionSec: number, durationSec: number) => void;
  /** onEnded: видео закончилось. */
  onEnded?: () => void;
}

export function KinescopePlayer({
  videoId,
  startPositionSec = 0,
  watermarkText,
  drmAuthToken,
  onProgress,
  onEnded,
}: KinescopePlayerProps) {
  const durationRef = useRef(0);
  const lastEmitRef = useRef(-1);

  // При смене видео сбрасываем кэш длительности и троттл.
  useEffect(() => {
    durationRef.current = 0;
    lastEmitRef.current = -1;
  }, [videoId]);

  function rememberDuration(duration: number) {
    if (Number.isFinite(duration) && duration > 0) durationRef.current = duration;
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
      <Player
        videoId={videoId}
        query={startPositionSec > 0 ? { seek: Math.floor(startPositionSec) } : undefined}
        width="100%"
        height="100%"
        language="ru"
        playsInline
        drmAuthToken={drmAuthToken}
        watermark={watermarkText ? { text: watermarkText, mode: 'random' } : undefined}
        onReady={({ duration }) => rememberDuration(duration)}
        onDurationChange={({ duration }) => rememberDuration(duration)}
        onTimeUpdate={({ currentTime }) => {
          // Троттлим до 1 эмита в секунду (timeupdate стреляет чаще).
          const now = Math.floor(currentTime);
          if (now === lastEmitRef.current) return;
          lastEmitRef.current = now;
          if (onProgress && durationRef.current > 0) {
            onProgress(currentTime, durationRef.current);
          }
        }}
        onEnded={() => onEnded?.()}
      />
    </div>
  );
}
