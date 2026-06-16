import { Brain, Camera, PenTool, Palette, Scissors, Sparkles, Video, type LucideIcon } from 'lucide-react';

import type { CategoryId } from '@/lib/mock/courses';
import { cn } from '@/lib/utils';

/**
 * Монохромная line-иконка направления (lucide) — взамен эмодзи как
 * бренд-иконографики. Наследует цвет родителя (currentColor), поэтому
 * внутри тега категории автоматически принимает его цвет.
 */
const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  ai: Brain,
  photo: Camera,
  video: Video,
  editing: Scissors,
  design: Palette,
  visual: Sparkles,
  copy: PenTool,
};

export function CategoryIcon({
  categoryId,
  className,
}: {
  categoryId: CategoryId;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[categoryId];
  return <Icon className={cn('size-3.5', className)} aria-hidden />;
}
