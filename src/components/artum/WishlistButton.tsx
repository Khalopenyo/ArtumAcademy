'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Heart } from 'lucide-react';

import { isInWishlist, useArtumStore } from '@/lib/store';
import { useCurrentUser, useHydrated } from '@/lib/store/hooks';
import { cn } from '@/lib/utils';

interface WishlistButtonProps {
  courseSlug: string;
  courseTitle: string;
  /** размер икон-кнопки */
  size?: 'sm' | 'md';
  /** stop propagation/preventDefault when used inside <Link> wrapper */
  stopParentLink?: boolean;
  className?: string;
}

/**
 * Кнопка «в избранное» с сердечком. Анонимный клик → редирект на /login.
 */
export function WishlistButton({
  courseSlug,
  courseTitle,
  size = 'sm',
  stopParentLink = false,
  className,
}: WishlistButtonProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const inList = useArtumStore((s) => (user ? isInWishlist(s, user.id, courseSlug) : false));
  const toggleWishlist = useArtumStore((s) => s.toggleWishlist);

  function handleClick(e: React.MouseEvent) {
    if (stopParentLink) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!user) {
      router.push(`/login?next=${encodeURIComponent('/')}`);
      return;
    }
    const wasIn = inList;
    toggleWishlist(courseSlug);
    toast.success(wasIn ? 'Убрано из избранного' : `«${courseTitle}» в избранном`);
  }

  if (!hydrated) {
    return null;
  }

  const dim = size === 'md' ? 'size-10' : 'size-8';
  const iconDim = size === 'md' ? 'size-5' : 'size-4';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={inList ? 'Убрать из избранного' : 'В избранное'}
      aria-pressed={inList}
      title={inList ? 'В избранном — снять' : 'Добавить в избранное'}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-background/70 text-foreground backdrop-blur transition-all',
        'hover:bg-background',
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
