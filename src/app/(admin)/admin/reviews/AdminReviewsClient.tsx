'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, Star, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { AdminReviewRow } from '@/server/queries/reviews';
import { deleteReviewAction } from '@/server/actions/admin/reviews';
import { cn } from '@/lib/utils';

export default function AdminReviewsClient({ initialReviews }: { initialReviews: AdminReviewRow[] }) {
  const router = useRouter();
  const reviews = useMemo(() => initialReviews, [initialReviews]);

  async function handleDelete(id: string) {
    if (!confirm('Удалить этот отзыв? Действие необратимо.')) return;
    const res = await deleteReviewAction(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Отзыв удалён');
    router.refresh();
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        К админ-панели
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Отзывы</h1>
        <p className="mt-1 text-sm text-muted-foreground">{reviews.length} отзывов · модерация</p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground backdrop-blur">
          Отзывов пока нет.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-card/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Курс</th>
                <th className="px-5 py-3 text-left font-medium">Автор</th>
                <th className="px-5 py-3 text-left font-medium">Оценка</th>
                <th className="px-5 py-3 text-left font-medium">Отзыв</th>
                <th className="px-5 py-3 text-right font-medium">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {reviews.map((r) => (
                <tr key={r.id} className="align-top hover:bg-secondary/50">
                  <td className="px-5 py-3">
                    {r.courseSlug ? (
                      <Link
                        href={`/courses/${r.courseSlug}`}
                        className="font-medium transition-colors hover:text-primary"
                      >
                        {r.courseTitle}
                      </Link>
                    ) : (
                      <span className="font-medium">{r.courseTitle}</span>
                    )}
                    <div className="mt-0.5 text-xs text-muted-foreground/70">
                      {new Date(r.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </td>
                  <td className="px-5 py-3">{r.authorName}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={cn(
                            'size-3.5',
                            n <= r.rating ? 'fill-primary text-primary' : 'text-muted-foreground/40',
                          )}
                          aria-hidden
                        />
                      ))}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <span className="line-clamp-2">{r.body || '—'}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Удалить отзыв"
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 className="size-4 text-destructive" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile: карточки */}
          <ul className="divide-y divide-border/40 md:hidden">
            {reviews.map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {r.courseSlug ? (
                      <Link
                        href={`/courses/${r.courseSlug}`}
                        className="block truncate font-medium transition-colors hover:text-primary"
                      >
                        {r.courseTitle}
                      </Link>
                    ) : (
                      <span className="block truncate font-medium">{r.courseTitle}</span>
                    )}
                    <div className="mt-0.5 text-xs text-muted-foreground/70">
                      {new Date(r.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Удалить отзыв"
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 className="size-4 text-destructive" aria-hidden />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <span className="text-muted-foreground">{r.authorName}</span>
                  <span className="inline-flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={cn(
                          'size-3.5',
                          n <= r.rating ? 'fill-primary text-primary' : 'text-muted-foreground/40',
                        )}
                        aria-hidden
                      />
                    ))}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{r.body || '—'}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
