'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Heart } from 'lucide-react';

import { toggleWishlistAction } from '@/server/actions/commerce';
import { cn } from '@/lib/utils';

interface WishlistButtonProps {
  courseSlug: string;
  courseTitle: string;
  /** Начальное состояние из server-fetched данных */
  initialInList: boolean;
  /** Если пользователь не залогинен — клик редиректит на /login */
  isGuest: boolean;
  size?: 'xs' | 'sm' | 'md';
  /** stop propagation/preventDefault when used inside <Link> wrapper */
  stopParentLink?: boolean;
  className?: string;
}

/**
 * Кнопка «в избранное» с сердечком. Использует Server Action
 * `toggleWishlistAction` для записи в Supabase. Optimistic UI:
 * сначала переключаем local state, потом дожидаемся ответа сервера;
 * при ошибке — откатываем.
 */
export function WishlistButton({
  courseSlug,
  courseTitle,
  initialInList,
  isGuest,
  size = 'sm',
  stopParentLink = false,
  className,
}: WishlistButtonProps) {
  const router = useRouter();
  const [inList, setInList] = useState(initialInList);
  const [pending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    if (stopParentLink) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isGuest) {
      router.push(`/login?next=${encodeURIComponent('/')}`);
      return;
    }
    const wasIn = inList;
    setInList(!wasIn); // optimistic
    startTransition(async () => {
      const res = await toggleWishlistAction(courseSlug);
      if (!res.ok) {
        setInList(wasIn); // откат
        toast.error(res.error);
        return;
      }
      toast.success(wasIn ? 'Убрано из избранного' : `«${courseTitle}» в избранном`);
      router.refresh();
    });
  }

  const dim = size === 'md' ? 'size-10' : size === 'xs' ? 'size-7' : 'size-8';
  const iconDim = size === 'md' ? 'size-5' : size === 'xs' ? 'size-3.5' : 'size-4';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={inList ? 'Убрать из избранного' : 'В избранное'}
      aria-pressed={inList}
      title={inList ? 'В избранном — снять' : 'Добавить в избранное'}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-background/70 text-foreground backdrop-blur transition-all',
        'hover:bg-background disabled:opacity-50',
        dim,
        className,
      )}
    >
      <Heart
        className={cn(
          iconDim,
          'transition-colors',
          inList ? 'fill-primary text-primary' : 'text-foreground',
        )}
        aria-hidden
      />
    </button>
  );
}
