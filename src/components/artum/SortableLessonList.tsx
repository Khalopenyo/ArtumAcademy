'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { Edit3, GripVertical, Save, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type Lesson, formatDuration } from '@/lib/mock/courses';
import {
  deleteLessonAction,
  reorderLessonsAction,
  updateLessonAction,
} from '@/server/actions/admin/courses';
import { cn } from '@/lib/utils';

interface SortableLessonListProps {
  courseSlug: string;
  moduleId: string;
  lessons: Lesson[];
}

/**
 * Drag-and-drop сортировка уроков внутри модуля.
 * Использует @dnd-kit (мини-bundle, accessibility-friendly).
 */
export function SortableLessonList({
  courseSlug,
  moduleId: _moduleId,
  lessons,
}: SortableLessonListProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = lessons.findIndex((l) => l.id === active.id);
    const newIdx = lessons.findIndex((l) => l.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(lessons, oldIdx, newIdx);
    startTransition(async () => {
      const res = await reorderLessonsAction(
        reordered.map((l) => l.id),
        courseSlug,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Порядок уроков обновлён');
      router.refresh();
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-border">
          {lessons.map((lesson, idx) => (
            <SortableLessonRow
              key={lesson.id}
              lesson={lesson}
              index={idx}
              editing={editingId === lesson.id}
              onEdit={() => setEditingId(lesson.id)}
              onCancel={() => setEditingId(null)}
              onSave={(patch) => {
                startTransition(async () => {
                  const res = await updateLessonAction(lesson.id, patch, courseSlug);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  setEditingId(null);
                  toast.success('Урок обновлён');
                  router.refresh();
                });
              }}
              onDelete={() => {
                if (!confirm('Удалить урок?')) return;
                startTransition(async () => {
                  const res = await deleteLessonAction(lesson.id, courseSlug);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success('Урок удалён');
                  router.refresh();
                });
              }}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableLessonRow({
  lesson,
  index,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  lesson: Lesson;
  index: number;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<Lesson>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [title, setTitle] = useState(lesson.title);
  const [minutes, setMinutes] = useState(String(Math.round(lesson.durationSec / 60)));
  const [preview, setPreview] = useState(lesson.preview);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-4 transition-colors',
        isDragging && 'bg-secondary/60 opacity-80',
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        aria-label="Перетащить урок"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <span className="w-8 font-mono text-xs text-muted-foreground">
        {index + 1}.
      </span>

      {editing ? (
        <div className="flex flex-1 flex-wrap items-end gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-[14rem] flex-1"
            placeholder="Название урока"
          />
          <Input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-20"
            placeholder="мин"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={preview}
              onChange={(e) => setPreview(e.target.checked)}
            />
            превью
          </label>
          <Button
            size="sm"
            onClick={() => {
              const m = parseInt(minutes, 10);
              onSave({
                title: title.trim(),
                durationSec: Math.max(60, isNaN(m) ? lesson.durationSec : m * 60),
                preview,
              });
            }}
          >
            <Save className="size-4" aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex-1">
            <div className="text-sm font-medium">{lesson.title}</div>
            <div className="text-xs text-muted-foreground">
              {formatDuration(lesson.durationSec)}
              {lesson.preview ? ' · превью' : ''}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit3 className="size-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="size-4 text-destructive" aria-hidden />
          </Button>
        </>
      )}
    </li>
  );
}
