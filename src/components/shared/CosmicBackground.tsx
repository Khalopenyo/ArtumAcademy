'use client';

import { useEffect, useRef } from 'react';

/**
 * Звёздный космический фон на всю страницу.
 *
 * Состав:
 *   1. Базовый градиент — глубокий тёмно-фиолетово-чёрный (вместо плоского #0D0D0F)
 *   2. Два больших фиолетовых "орба" в углах для глубины
 *   3. ~120 случайных звёзд (мелкие белые точки) — генерируются после mount
 *      чтобы избежать hydration mismatch
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
    const count = 120;
    for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      const size = 0.5 + Math.random() * 1.8;
      const opacity = 0.15 + Math.random() * 0.5;
      star.style.cssText = `
        position: absolute;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.7);
        opacity: ${opacity};
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
      <div ref={ref} className="absolute inset-0" />
    </div>
  );
}
