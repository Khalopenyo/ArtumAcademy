'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, Edit3, Plus, Save, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CourseForm } from '@/components/artum/CourseForm';
import { type Lesson, formatDuration } from '@/lib/mock/courses';
import { getAllCoursesEffective, useArtumStore } from '@/lib/store';

type EditMode = 'meta' | 'modules';

/**
 * Страница редактирования курса.
 * - Tab "Свойства" — CourseForm (название, цена, категория, цвет)
 * - Tab "Модули и уроки" — список модулей с CRUD-кнопками
 */
export default function AdminEditCoursePage() {
  const params = useParams<{ slug: string }>();
  const state = useArtumStore();
  const updateCourse = useArtumStore((s) => s.updateCourse);
  const addLesson = useArtumStore((s) => s.addLesson);
  const updateLesson = useArtumStore((s) => s.updateLesson);
  const deleteLesson = useArtumStore((s) => s.deleteLesson);

  const allCourses = useMemo(() => getAllCoursesEffective(state), [state]);
  const course = useMemo(
    () => allCourses.find((c) => c.slug === params.slug) ?? null,
    [allCourses, params.slug],
  );

  const [mode, setMode] = useState<EditMode>('meta');
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [editingLesson, setEditingLesson] = useState<{
    moduleId: string;
    lessonId: string;
  } | null>(null);

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        Курс не найден.{' '}
        <Link href="/admin/courses" className="text-primary hover:underline">
          К списку
        </Link>
      </div>
    );
  }

  function addModule() {
    if (!newModuleTitle.trim()) {
      toast.error('Введите название модуля');
      return;
    }
    const newMod = {
      id: `mod-${course!.slug}-${Date.now()}`,
      title: newModuleTitle.trim(),
      description: '',
      lessons: [],
    };
    updateCourse(course!.slug, { modules: [...course!.modules, newMod] });
    setNewModuleTitle('');
    toast.success('Модуль добавлен');
  }

  function deleteModule(moduleId: string) {
    if (!confirm('Удалить модуль вместе со всеми уроками?')) return;
    updateCourse(course!.slug, {
      modules: course!.modules.filter((m) => m.id !== moduleId),
    });
    toast.success('Модуль удалён');
  }

  function addLessonToModule(moduleId: string) {
    const title = prompt('Название урока');
    if (!title?.trim()) return;
    const durStr = prompt('Длительность в минутах', '10');
    const minutes = parseInt(durStr ?? '10', 10);
    const lesson: Lesson = {
      id: `lesson-${moduleId}-${Date.now()}`,
      title: title.trim(),
      durationSec: Math.max(60, isNaN(minutes) ? 600 : minutes * 60),
      completed: false,
      preview: false,
    };
    addLesson(course!.slug, moduleId, lesson);
    toast.success('Урок добавлен');
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

                <ul className="divide-y divide-border">
                  {m.lessons.map((l, lIdx) => {
                    const isEditing =
                      editingLesson?.moduleId === m.id && editingLesson?.lessonId === l.id;
                    return (
                      <li key={l.id} className="flex items-center gap-3 p-4">
                        <span className="font-mono text-xs text-muted-foreground">
                          {mIdx + 1}.{lIdx + 1}
                        </span>
                        {isEditing ? (
                          <LessonInlineEditor
                            lesson={l}
                            onSave={(patch) => {
                              updateLesson(course.slug, m.id, l.id, patch);
                              setEditingLesson(null);
                              toast.success('Урок обновлён');
                            }}
                            onCancel={() => setEditingLesson(null)}
                          />
                        ) : (
                          <>
                            <div className="flex-1">
                              <div className="text-sm font-medium">{l.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDuration(l.durationSec)}
                                {l.preview ? ' · превью' : ''}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingLesson({ moduleId: m.id, lessonId: l.id })}
                            >
                              <Edit3 className="size-4" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Удалить урок?')) {
                                  deleteLesson(course.slug, m.id, l.id);
                                  toast.success('Урок удалён');
                                }
                              }}
                            >
                              <Trash2 className="size-4 text-destructive" aria-hidden />
                            </Button>
                          </>
                        )}
                      </li>
                    );
                  })}
                  <li className="p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addLessonToModule(m.id)}
                      className="text-primary"
                    >
                      <Plus className="mr-1 size-4" aria-hidden /> Добавить урок
                    </Button>
                  </li>
                </ul>
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

function LessonInlineEditor({
  lesson,
  onSave,
  onCancel,
}: {
  lesson: Lesson;
  onSave: (patch: Partial<Lesson>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [minutes, setMinutes] = useState(String(Math.round(lesson.durationSec / 60)));
  const [preview, setPreview] = useState(lesson.preview);

  return (
    <div className="flex flex-1 flex-wrap items-end gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 min-w-[16rem]"
        placeholder="Название урока"
      />
      <Input
        type="number"
        min={1}
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        className="w-24"
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
  );
}
