import { Award, BookOpen, Clock, TrendingUp } from 'lucide-react';

import type { UserStats } from '@/lib/mock/courses';
import { cn } from '@/lib/utils';

interface UserStatsBlockProps {
  stats: UserStats;
  className?: string;
}

/**
 * Блок статистики пользователя на дашборде (ТЗ §4.1):
 *   активные курсы · сертификаты · время обучения · общий прогресс
 */
export function UserStatsBlock({ stats, className }: UserStatsBlockProps) {
  const items = [
    {
      label: 'Активные курсы',
      value: String(stats.activeCourses),
      icon: BookOpen,
    },
    {
      label: 'Сертификаты',
      value: String(stats.certificates),
      icon: Award,
    },
    {
      label: 'Время обучения',
      value: `${stats.studyHoursTotal} ч`,
      icon: Clock,
    },
    {
      label: 'Общий прогресс',
      value: `${stats.overallProgressPercent}%`,
      icon: TrendingUp,
    },
  ];

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4 sm:gap-4 sm:p-6',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-2 rounded-xl bg-background/50 p-4">
          <div className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <item.icon className="size-5" aria-hidden />
          </div>
          <div className="text-2xl font-semibold leading-none text-foreground">{item.value}</div>
          <div className="text-xs text-muted-foreground">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
