import type { UserStats } from '@/lib/mock/courses';
import { cn } from '@/lib/utils';

interface UserStatsBlockProps {
  stats: UserStats;
  className?: string;
}

/**
 * Блок статистики пользователя — нижняя полоска со светящимся фиолетовым
 * градиентом. 4 значения подряд: активные курсы, сертификаты, время обучения,
 * общий прогресс. Дизайн по макету (stats-bar внизу страницы).
 */
export function UserStatsBlock({ stats, className }: UserStatsBlockProps) {
  const items = [
    { label: 'Активных курса', value: String(stats.activeCourses) },
    { label: 'Сертификат', value: String(stats.certificates) },
    { label: 'Время обучения', value: `${stats.studyHoursTotal} ч` },
    { label: 'Общий прогресс', value: `${stats.overallProgressPercent}%` },
  ];

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-4 rounded-2xl border border-primary/12 p-5 sm:grid-cols-4 sm:p-6',
        className,
      )}
      style={{
        background:
          'linear-gradient(135deg, rgba(30, 18, 53, 0.6), rgba(45, 27, 82, 0.3), rgba(13, 13, 15, 0.85))',
      }}
    >
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <div className="bg-gradient-to-br from-white to-primary-lighter bg-clip-text text-2xl font-bold leading-none text-transparent sm:text-3xl">
            {item.value}
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
