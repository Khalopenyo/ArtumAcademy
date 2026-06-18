import { Trophy } from 'lucide-react';

import { CategoryIcon } from '@/components/artum/CategoryIcon';
import { getCategory } from '@/lib/mock/courses';
import { type Case, caseVideoEmbedUrl } from '@/lib/cases';
import { cn } from '@/lib/utils';

/**
 * Карточка кейса на публичной странице /cases.
 * Медиа-область (16:9): встроенное видео (если задана ссылка) → фото → градиент.
 * Ниже — тег направления, заголовок, имя студента, описание и блок результата.
 */
export function CaseCard({ caseItem }: { caseItem: Case }) {
  const category = getCategory(caseItem.category);
  const embed = caseVideoEmbedUrl(caseItem.videoUrl);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/70 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50">
      <div className="relative aspect-video overflow-hidden bg-secondary/40">
        {embed ? (
          <iframe
            src={embed}
            title={caseItem.title}
            loading="lazy"
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
          />
        ) : caseItem.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={caseItem.coverUrl}
            alt={caseItem.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600/30 via-fuchsia-500/20 to-pink-500/20">
            <CategoryIcon categoryId={caseItem.category} className="size-10 text-white/50" />
          </div>
        )}
        <span
          className={cn(
            'pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur',
            category.tagBgClass,
            category.tagTextClass,
          )}
        >
          <CategoryIcon categoryId={caseItem.category} className="size-3" />
          {category.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
          {caseItem.title}
        </h3>
        {caseItem.studentName ? (
          <p className="text-xs font-medium text-primary-light">{caseItem.studentName}</p>
        ) : null}
        {caseItem.description ? (
          <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
            {caseItem.description}
          </p>
        ) : null}
        {caseItem.result ? (
          <div className="mt-auto flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/10 p-2.5">
            <Trophy className="mt-0.5 size-4 shrink-0 text-primary-light" aria-hidden />
            <span className="text-sm font-medium text-primary-lighter">{caseItem.result}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
