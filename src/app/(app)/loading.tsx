import { Loader2 } from 'lucide-react';

/** Мгновенный индикатор загрузки при навигации в защищённой зоне (профиль, уроки, сертификаты). */
export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка" className="flex min-h-[70vh] items-center justify-center px-4">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
      <span className="sr-only">Загрузка…</span>
    </div>
  );
}
