'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'artum-cookie-consent-v1';

/**
 * Cookie-баннер для соответствия 152-ФЗ + ePrivacy. Показывается один
 * раз гостям, скрывается после клика «Принять» или «Только нужные».
 * Состояние хранится в localStorage (не критичный для безопасности
 * флаг — поэтому без сервера).
 *
 * Для запуска в продакшен полезно расширить:
 *   - категории кук (essential / analytics / marketing)
 *   - блокировка Я.Метрика до согласия
 *   - запись согласия в `user_consents` после регистрации
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Гидрейтимся ТОЛЬКО на клиенте — иначе hydration mismatch
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage может быть недоступен (private mode и т.п.) — игнорим
    }
  }, []);

  function accept(level: 'all' | 'essential') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ level, ts: Date.now() }));
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:bottom-4 sm:px-6">
      <div
        role="dialog"
        aria-labelledby="cookie-title"
        className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border/60 bg-[#0A0618]/90 p-4 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:gap-4 sm:p-5"
      >
        <div className="flex shrink-0 size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Cookie className="size-5" aria-hidden />
        </div>
        <div className="flex-1 text-sm leading-snug text-muted-foreground">
          <div id="cookie-title" className="font-medium text-foreground">
            Мы используем cookie
          </div>
          <p className="mt-0.5 text-xs">
            Для авторизации и аналитики. Продолжая, вы соглашаетесь с{' '}
            <Link href="/privacy" className="text-primary underline-offset-2 hover:underline">
              политикой конфиденциальности
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => accept('essential')}
            className="rounded-lg border border-border/60 bg-transparent px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            Только нужные
          </button>
          <button
            type="button"
            onClick={() => accept('all')}
            className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Принять
          </button>
          <button
            type="button"
            onClick={() => accept('essential')}
            aria-label="Закрыть"
            className="-mr-1.5 inline-flex size-11 items-center justify-center text-muted-foreground hover:text-foreground sm:hidden"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
