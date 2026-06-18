import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton-каркас каталога (Suspense fallback сегмента). Повторяет будущую
 * сетку варианта B — 2 колонки на телефоне, 3 на lg — чтобы загрузка плавно
 * перетекала в реальный контент, а не «прыгала» со спиннера. Header/Footer
 * остаются (это layout), подменяется только контент страницы.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Загрузка"
      className="container mx-auto px-4 py-8 sm:px-9 sm:py-10"
    >
      <span className="sr-only">Загрузка…</span>

      {/* Hero */}
      <Skeleton className="h-44 w-full rounded-2xl sm:h-52" />

      {/* Панель поиска + чипы категорий */}
      <div className="mt-7 space-y-3 rounded-2xl border border-border/60 bg-card/40 p-4">
        <Skeleton className="h-11 w-full rounded-md" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
          ))}
        </div>
      </div>

      {/* Счётчик */}
      <Skeleton className="mb-4 mt-3 h-4 w-24" />

      {/* Сетка карточек — 2 колонки на телефоне, 3 на lg (как в варианте B) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-border/60 bg-card/40"
          >
            <Skeleton className="h-24 w-full rounded-none sm:h-36" />
            <div className="space-y-2 p-3 sm:p-5">
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-3 h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
