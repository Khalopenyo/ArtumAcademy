'use client';

import { useEffect, useRef } from 'react';

/**
 * Звёздный космический фон на всю страницу.
 *
 * Состав:
 *   1. Базовый градиент — глубокий тёмно-фиолетово-чёрный
 *   2. ~240 случайных звёзд (мерцают + лёгкий 2D-дрейф); генерируются после mount,
 *      чтобы избежать hydration mismatch
 *   3. Кометы — изредка пролетают по диагонали со светящимся следом
 *
 * Лежит fixed inset-0 -z-10 за всем контентом. Не блокирует клики
 * (pointer-events-none) и не попадает в screen reader (aria-hidden).
 */
export function CosmicBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Очищаем при HMR / перерендере
    el.innerHTML = '';
    // Уважаем prefers-reduced-motion: оставляем мерцание (+ кометы), но
    // отключаем дрейф (постоянный transform по сотням элементов) — это главный
    // источник лагов при скролле под backdrop-blur на слабых/таких машинах.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count = reduceMotion ? 110 : 150;
    for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      star.className = 'cosmic-star';
      const size = 0.6 + Math.random() * 2.0;
      const opacity = 0.35 + Math.random() * 0.6;
      // Случайные тайминги → естественное мерцание, без «синхронного» эффекта.
      const twinkle = (2.5 + Math.random() * 4).toFixed(2); // 2.5–6.5с
      const drift = (12 + Math.random() * 14).toFixed(1); // 12–26с — медленно, мягко
      // Лёгкий 2D-дрейф: каждая звезда плывёт в своём направлении на ±~16px.
      const driftX = (Math.random() * 32 - 16).toFixed(1); // −16…+16px
      const driftY = (Math.random() * 32 - 16).toFixed(1); // −16…+16px
      const delay = (Math.random() * 5).toFixed(2);
      // Под reduced-motion — только мерцание (opacity); иначе + мягкий дрейф.
      // Без will-change: сотни постоянных слоёв давали лаги, браузер сам
      // композитит opacity/transform-анимации эффективнее.
      const animation = reduceMotion
        ? `starTwinkle ${twinkle}s ease-in-out ${delay}s infinite`
        : `starTwinkle ${twinkle}s ease-in-out ${delay}s infinite, starDrift ${drift}s ease-in-out ${delay}s infinite alternate`;
      star.style.cssText = `
        position: absolute;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 0 ${(size * 1.8).toFixed(1)}px rgba(255, 255, 255, 0.5);
        opacity: ${opacity};
        --star-o: ${opacity};
        --drift-x: ${driftX}px;
        --drift-y: ${driftY}px;
        animation: ${animation};
      `;
      el.appendChild(star);
    }
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background:
          // Покрывающий градиент сверху-слева (космический фиолет)
          'radial-gradient(ellipse 800px 600px at 15% 10%, rgba(76, 29, 149, 0.32), transparent 60%),' +
          // Подсвет снизу-справа (более холодный, как далёкая туманность)
          'radial-gradient(ellipse 700px 500px at 85% 90%, rgba(124, 58, 237, 0.18), transparent 60%),' +
          // Лёгкая вспышка в центре для объёма
          'radial-gradient(ellipse 600px 400px at 50% 50%, rgba(168, 85, 247, 0.06), transparent 70%),' +
          // База — глубокий тёмно-фиолетово-синий
          'linear-gradient(180deg, #0A0618 0%, #080514 50%, #06040F 100%)',
      }}
    >
      {/* Звёзды (генерируются JS-ом выше) */}
      <div ref={ref} className="absolute inset-0" />

      {/* Кометы — изредка пролетают по диагонали (см. .cosmic-comet в globals.css) */}
      <span className="cosmic-comet" style={{ top: '6%', animationDuration: '18s', animationDelay: '2s' }} />
      <span className="cosmic-comet" style={{ top: '34%', animationDuration: '24s', animationDelay: '9s' }} />
      <span className="cosmic-comet" style={{ top: '62%', animationDuration: '21s', animationDelay: '15s' }} />
    </div>
  );
}
