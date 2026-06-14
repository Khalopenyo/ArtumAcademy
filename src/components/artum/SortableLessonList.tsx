'use client';

import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
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
import { Edit3, FileText, GripVertical, Save, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { KinescopeUploadButton } from '@/components/artum/KinescopeUploadButton';
import { parseLessonVideo } from '@/lib/kinescope/video-ref';
import { type Lesson, formatDuration } from '@/lib/mock/courses';
import {
  deleteLessonAction,
  reorderLessonsAction,
  updateLessonAction,
} from '@/server/actions/admin/courses';
import { cn } from '@/lib/utils';

// Редактор контента грузим lazy (только на клиенте) — TipTap тяжёлый.
const LessonContentEditor = dynamic(
  () => import('@/components/artum/LessonContentEditor').then((m) => m.LessonContentEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-border bg-background text-sm text-muted-foreground">
        Загрузка редактора…
      </div>
    ),
  },
);

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
  const [contentLesson, setContentLesson] = useState<Lesson | null>(null);
  const [contentHtml, setContentHtml] = useState('');
  const [savingContent, startContentSave] = useTransition();

  function saveContent() {
    if (!contentLesson) return;
    const id = contentLesson.id;
    startContentSave(async () => {
      const res = await updateLessonAction(id, { content: contentHtml }, courseSlug);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Контент урока сохранён');
      setContentLesson(null);
      router.refresh();
    });
  }

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
              onUploaded={(videoId) => {
                startTransition(async () => {
                  const res = await updateLessonAction(
                    lesson.id,
                    { videoUrl: `kinescope:${videoId}` },
                    courseSlug,
                  );
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success('Видео привязано к уроку');
                  router.refresh();
                });
              }}
              onEditContent={() => {
                setContentLesson(lesson);
                setContentHtml(lesson.content ?? '');
              }}
            />
          ))}
        </ul>
      </SortableContext>

      <Dialog open={!!contentLesson} onOpenChange={(o) => { if (!o) setContentLesson(null); }}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Контент урока{contentLesson ? `: ${contentLesson.title}` : ''}</DialogTitle>
          </DialogHeader>
          {contentLesson ? (
            <LessonContentEditor value={contentHtml} onChange={setContentHtml} />
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContentLesson(null)} disabled={savingContent}>
              Отмена
            </Button>
            <Button onClick={saveContent} disabled={savingContent}>
              {savingContent ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  onUploaded,
  onEditContent,
}: {
  lesson: Lesson;
  index: number;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<Lesson>) => void;
  onDelete: () => void;
  onUploaded: (videoId: string) => void;
  onEditContent: () => void;
}) {
  const video = parseLessonVideo(lesson.videoUrl);
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
              {' · '}
              {video.kind === 'kinescope' ? (
                <span className="text-primary">🟣 Kinescope</span>
              ) : video.kind === 'file' ? (
                <span className="text-muted-foreground">видео-файл</span>
              ) : (
                <span className="text-amber-500/80">без видео</span>
              )}
              {lesson.content ? <span className="text-emerald-500/80"> · 📄 текст</span> : null}
            </div>
          </div>
          <KinescopeUploadButton
            title={lesson.title}
            onUploaded={onUploaded}
            label={video.kind === 'none' ? 'Загрузить' : 'Заменить'}
          />
          <Button variant="outline" size="sm" onClick={onEditContent}>
            <FileText className="mr-1 size-4" aria-hidden />
            Контент
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label="Редактировать урок">
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
