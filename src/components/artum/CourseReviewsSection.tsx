'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CourseReviews, Review } from '@/lib/reviews';
import { deleteMyReviewAction, submitReviewAction } from '@/server/actions/reviews';
import { cn } from '@/lib/utils';

function Stars({
  value,
  size = 'size-4',
  interactive = false,
  onPick,
}: {
  value: number;
  size?: string;
  interactive?: boolean;
  onPick?: (n: number) => void;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) =>
        interactive ? (
          <button key={n} type="button" onClick={() => onPick?.(n)} aria-label={`${n} из 5`}>
            <Star
              className={cn(size, n <= value ? 'fill-primary text-primary' : 'text-muted-foreground/40')}
              aria-hidden
            />
          </button>
        ) : (
          <Star
            key={n}
            className={cn(size, n <= Math.round(value) ? 'fill-primary text-primary' : 'text-muted-foreground/40')}
            aria-hidden
          />
        ),
      )}
    </span>
  );
}

interface Props {
  courseSlug: string;
  reviews: CourseReviews;
  myReview: Review | null;
  /** Есть ли у пользователя доступ к курсу (можно оставить отзыв). */
  canReview: boolean;
}

export function CourseReviewsSection({ courseSlug, reviews, myReview, canReview }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rating, setRating] = useState(myReview?.rating ?? 5);
  const [body, setBody] = useState(myReview?.body ?? '');
  const [editing, setEditing] = useState(!myReview);

  // Свой отзыв показываем отдельной карточкой выше — из общего списка исключаем.
  const others = reviews.list.filter((r) => r.id !== myReview?.id);

  function submit() {
    if (rating < 1) {
      toast.error('Поставьте оценку');
      return;
    }
    startTransition(async () => {
      const res = await submitReviewAction(courseSlug, rating, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Спасибо за отзыв!');
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm('Удалить ваш отзыв?')) return;
    startTransition(async () => {
      const res = await deleteMyReviewAction(courseSlug);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Отзыв удалён');
      router.refresh();
    });
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Отзывы</h2>
        {reviews.count > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Stars value={reviews.average} />
            <span className="font-medium text-foreground">{reviews.average.toFixed(1)}</span> ·{' '}
            {reviews.count}
          </span>
        ) : null}
      </div>

      {canReview ? (
        myReview && !editing ? (
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <Stars value={myReview.rating} />
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>
                  Изменить
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={remove}
                  disabled={pending}
                >
                  Удалить
                </Button>
              </div>
            </div>
            {myReview.body ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{myReview.body}</p>
            ) : null}
            <p className="mt-1.5 text-xs text-muted-foreground/70">Ваш отзыв</p>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ваша оценка:</span>
              <Stars value={rating} size="size-6" interactive onPick={setRating} />
            </div>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              placeholder="Расскажите, что понравилось (необязательно)"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={pending}>
                {pending ? 'Отправка…' : myReview ? 'Сохранить' : 'Оставить отзыв'}
              </Button>
              {myReview ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={pending}>
                  Отмена
                </Button>
              ) : null}
            </div>
          </div>
        )
      ) : null}

      {others.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {myReview
            ? 'Других отзывов пока нет.'
            : canReview
              ? 'Пока нет отзывов — будьте первым.'
              : 'Пока нет отзывов.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {others.map((r) => (
            <li key={r.id} className="rounded-xl border border-border/50 bg-card/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{r.authorName}</span>
                <Stars value={r.rating} />
              </div>
              {r.body ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
              ) : null}
              <p className="mt-1.5 text-xs text-muted-foreground/70">
                {new Date(r.createdAt).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
