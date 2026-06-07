import { Loader2 } from 'lucide-react';

/**
 * Мгновенный индикатор загрузки при навигации (Suspense fallback сегмента).
 * Без него App Router ждёт весь серверный рендер молча → переход «подвисает».
 * Header/Footer остаются (это layout), подменяется только контент страницы.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка" className="flex min-h-[70vh] items-center justify-center px-4">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
      <span className="sr-only">Загрузка…</span>
    </div>
  );
}
