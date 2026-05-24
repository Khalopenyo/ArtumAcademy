import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface LegalDocPageProps {
  children: ReactNode;
  className?: string;
}

/**
 * Server Component wrapper for long-form legal prose (/privacy, /oferta).
 *
 * Applies Tailwind typography (`prose`) classes for readable line-length and rhythm.
 * Container width capped at `max-w-3xl` (≈75ch) per UI-SPEC §4.7.
 */
export function LegalDocPage({ children, className }: LegalDocPageProps) {
  return (
    <article
      className={cn(
        'prose prose-neutral dark:prose-invert mx-auto max-w-3xl px-4 py-12 md:py-16',
        'prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-10',
        className,
      )}
    >
      {children}
    </article>
  );
}
