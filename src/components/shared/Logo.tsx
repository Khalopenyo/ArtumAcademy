import Link from 'next/link';

import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Использовать как просто `<span>` (без `<Link>`) — для случаев, когда лого внутри другой ссылки */
  asSpan?: boolean;
}

/**
 * Artum Academy wordmark.
 *
 * Дизайн: «ARTUM» жирным белым + «Academy» полупрозрачным светло-фиолетовым.
 * Скелетный вариант без SVG-логотипа — брендинговую иконку добавим после
 * утверждения макетов (ТЗ §1.4 — референсы, окончательный бренд TBD).
 */
export function Logo({ className, asSpan = false }: LogoProps) {
  const content = (
    <>
      <span className="font-extrabold tracking-tight text-foreground">ARTUM</span>
      <span className="ml-1 font-medium tracking-wide text-primary/80">Academy</span>
    </>
  );

  const baseClasses = cn(
    'inline-flex items-baseline text-lg leading-none',
    'transition-colors',
    className,
  );

  if (asSpan) {
    return <span className={baseClasses}>{content}</span>;
  }

  return (
    <Link
      href="/"
      className={cn(
        baseClasses,
        'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'hover:opacity-90',
      )}
      aria-label="Artum Academy — на главную"
    >
      {content}
    </Link>
  );
}
