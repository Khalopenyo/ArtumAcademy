'use client';

import { useEffect, useState } from 'react';

import { useArtumStore, getCurrentUser } from './index';

/**
 * SSR-safe hook: возвращает true только после первой гидрейции
 * zustand `persist` middleware из localStorage. До этого момента
 * UI должен показывать skeleton/placeholder, иначе будет hydration
 * mismatch между сервером (initial state) и клиентом (загруженный state).
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // useArtumStore.persist.hasHydrated() уже true после первой
    // загрузки в браузере; setHydrated синхронно вернётся.
    if (useArtumStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useArtumStore.persist.onFinishHydration(() => setHydrated(true));
    return () => unsub();
  }, []);
  return hydrated;
}

/**
 * Удобный хук для текущего пользователя — null если гость или не гидрейтирован.
 */
export function useCurrentUser() {
  return useArtumStore((s) => getCurrentUser(s));
}
