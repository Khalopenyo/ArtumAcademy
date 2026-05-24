import Link from 'next/link';

import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

/**
 * Brand wordmark — no SVG until brand identity exists (UI-SPEC §10.1).
 * Used in (marketing) Header, (auth) Header, (app) AppHeader, Footer.
 */
export function Logo({ className }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        'inline-flex items-center font-bold tracking-tight',
        'transition-colors hover:text-primary/80',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm',
        className,
      )}
      aria-label="VideoEdit Academy — на главную"
    >
      <span>VideoEdit Academy</span>
    </Link>
  );
}
