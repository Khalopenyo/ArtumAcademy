'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Корневая граница ошибок — ловит ошибки в самом root layout. Заменяет
 * весь документ, поэтому рендерит свои <html>/<body> и использует inline-стили
 * (globals.css здесь может быть недоступен). Закрывает варнинг Sentry о
 * необходимости global-error для отчётов о render-ошибках в App Router.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#06040F',
          color: '#fff',
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, letterSpacing: '0.08em' }}>
            <span style={{ color: '#A855F7' }}>ARTUM</span> Academy
          </div>
          <h1 style={{ marginTop: 24, fontSize: 24 }}>Критическая ошибка</h1>
          <p style={{ marginTop: 8, color: '#9CA3AF', fontSize: 14, lineHeight: 1.5 }}>
            Приложение столкнулось с ошибкой. Мы уже знаем о ней. Попробуйте перезагрузить страницу.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              background: '#A855F7',
              color: '#fff',
              border: 0,
              borderRadius: 8,
              padding: '12px 24px',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Перезагрузить
          </button>
        </div>
      </body>
    </html>
  );
}
