'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CourseForm } from '@/components/artum/CourseForm';
import { SortableLessonList } from '@/components/artum/SortableLessonList';
import type { Course } from '@/lib/mock/courses';
import {
  createLessonAction,
  createModuleAction,
  deleteModuleAction,
} from '@/server/actions/admin/courses';

type EditMode = 'meta' | 'modules';

/**
 * Страница редактирования курса.
 * - Tab "Свойства" — CourseForm (название, цена, категория, цвет)
 * - Tab "Модули и уроки" — список модулей с CRUD-кнопками
 */
interface EditCoursePageClientProps {
  course: Course;
}

export function EditCoursePageClient({ course }: EditCoursePageClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mode, setMode] = useState<EditMode>('meta');
  const [newModuleTitle, setNewModuleTitle] = useState('');

  function addModule() {
    if (!newModuleTitle.trim()) {
      toast.error('Введите название модуля');
      return;
    }
    startTransition(async () => {
      const res = await createModuleAction({
        courseSlug: course.slug,
        title: newModuleTitle.trim(),
        description: '',
        orderIndex: course.modules.length,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setNewModuleTitle('');
      toast.success('Модуль добавлен');
      router.refresh();
    });
  }

  function deleteModule(moduleId: string) {
    if (!confirm('Удалить модуль вместе со всеми уроками?')) return;
    startTransition(async () => {
      const res = await deleteModuleAction(moduleId, course.slug);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Модуль удалён');
      router.refresh();
    });
  }

  function addLessonToModule(moduleId: string) {
    const title = prompt('Название урока');
    if (!title?.trim()) return;
    const durStr = prompt('Длительность в минутах', '10');
    const minutes = parseInt(durStr ?? '10', 10);
    const videoUrl = prompt(
      'Видео: Kinescope ID или kinescope.io-ссылка (рекоменд.), либо прямой mp4-URL. Пусто = позже:',
      '',
    );
    const moduleObj = course.modules.find((m) => m.id === moduleId);
    const orderIndex = moduleObj ? moduleObj.lessons.length : 100;
    startTransition(async () => {
      const res = await createLessonAction(
        {
          moduleId,
          title: title!.trim(),
          durationSec: Math.max(60, isNaN(minutes) ? 600 : minutes * 60),
          videoUrl: videoUrl?.trim() ? videoUrl.trim() : null,
          preview: false,
          orderIndex,
        },
        course.slug,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Урок добавлен');
      router.refresh();
    });
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <Link
        href="/admin/courses"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        К списку курсов
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            slug: <code className="font-mono">{course.slug}</code>
          </p>
        </div>
        <div className="inline-flex rounded-md border border-border p-1">
          <button
            type="button"
            onClick={() => setMode('meta')}
            className={`rounded-sm px-3 py-1.5 text-sm transition-colors ${
              mode === 'meta' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Свойства
          </button>
          <button
            type="button"
            onClick={() => setMode('modules')}
            className={`rounded-sm px-3 py-1.5 text-sm transition-colors ${
              mode === 'modules' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Модули и уроки
          </button>
        </div>
      </div>

      {mode === 'meta' ? <CourseForm initial={course} /> : null}

      {mode === 'modules' ? (
        <div className="space-y-6">
          {course.modules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-muted-foreground">
              У курса пока нет модулей.
            </div>
          ) : (
            course.modules.map((m, mIdx) => (
              <div key={m.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-start justify-between gap-3 border-b border-border p-5">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Модуль {mIdx + 1}
                    </div>
                    <h3 className="mt-1 text-base font-semibold">{m.title}</h3>
                    {m.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Удалить модуль"
                    onClick={() => deleteModule(m.id)}
                  >
                    <Trash2 className="size-4 text-destructive" aria-hidden />
                  </Button>
                </div>

                <SortableLessonList
                  courseSlug={course.slug}
                  moduleId={m.id}
                  lessons={m.lessons}
                />
                <div className="border-t border-border p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addLessonToModule(m.id)}
                    className="text-primary"
                  >
                    <Plus className="mr-1 size-4" aria-hidden /> Добавить урок
                  </Button>
                </div>
              </div>
            ))
          )}

          <div className="flex items-end gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-5">
            <div className="flex-1 space-y-1">
              <Label htmlFor="new-module">Название нового модуля</Label>
              <Input
                id="new-module"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="Например: Цветокоррекция"
              />
            </div>
            <Button onClick={addModule}>
              <Plus className="mr-1 size-4" aria-hidden /> Добавить
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

