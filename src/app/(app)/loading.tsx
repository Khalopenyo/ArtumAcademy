import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton-каркас защищённой зоны (профиль, сертификаты, уроки). Нейтральный
 * каркас «шапка профиля + табы + список карточек» — подходит под большинство
 * экранов зоны и плавнее голого спиннера.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка" className="container mx-auto px-4 py-8 sm:py-10">
      <span className="sr-only">Загрузка…</span>

      {/* Шапка */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      {/* Табы */}
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-11 flex-1 rounded-xl" />
        ))}
      </div>

      {/* Список карточек */}
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
