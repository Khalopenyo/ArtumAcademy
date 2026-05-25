'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type CategoryId,
  type Course,
  CATEGORIES,
} from '@/lib/mock/courses';
import { useArtumStore } from '@/lib/store';

const GRADIENTS = [
  { id: 'purple', label: 'Фиолетовый', value: 'from-purple-600 via-fuchsia-500 to-pink-500' },
  { id: 'green', label: 'Зелёный', value: 'from-emerald-500 via-teal-500 to-cyan-500' },
  { id: 'amber', label: 'Жёлтый', value: 'from-amber-500 via-yellow-500 to-orange-500' },
  { id: 'orange', label: 'Оранжевый', value: 'from-orange-500 via-red-500 to-pink-500' },
  { id: 'blue', label: 'Синий', value: 'from-blue-500 via-sky-500 to-cyan-500' },
  { id: 'pink', label: 'Розовый', value: 'from-pink-500 via-rose-500 to-fuchsia-500' },
  { id: 'teal', label: 'Бирюзовый', value: 'from-teal-500 via-cyan-500 to-emerald-500' },
];

interface CourseFormProps {
  /** undefined = create mode, иначе — edit mode */
  initial?: Course;
}

/**
 * Форма для создания / редактирования курса.
 * При создании: добавляет в store через addCourse + создаёт 1 пустой модуль.
 * При редактировании: вызывает updateCourse (slug нельзя менять).
 */
export function CourseForm({ initial }: CourseFormProps) {
  const router = useRouter();
  const addCourse = useArtumStore((s) => s.addCourse);
  const updateCourse = useArtumStore((s) => s.updateCourse);

  const editing = !!initial;

  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [shortDescription, setShortDescription] = useState(
    initial?.shortDescription ?? '',
  );
  const [longDescription, setLongDescription] = useState(initial?.longDescription ?? '');
  const [category, setCategory] = useState<CategoryId>(initial?.category ?? 'ai');
  const [priceMajor, setPriceMajor] = useState(
    initial ? String(initial.priceMinor / 100) : '9900',
  );
  const [coverGradient, setCoverGradient] = useState(
    initial?.coverGradient ?? GRADIENTS[0]!.value,
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !slug) {
      toast.error('Заполните название и slug');
      return;
    }
    const priceMinor = Math.round(parseFloat(priceMajor) * 100);
    if (!Number.isFinite(priceMinor) || priceMinor < 0) {
      toast.error('Некорректная цена');
      return;
    }

    if (editing) {
      updateCourse(initial!.slug, {
        title,
        shortDescription,
        longDescription,
        category,
        priceMinor,
        coverGradient,
      });
      toast.success('Курс обновлён');
      router.push('/admin/courses');
      return;
    }

    // create
    const course: Course = {
      id: `course-${slug}`,
      slug,
      title,
      shortDescription,
      longDescription,
      category,
      studentsCount: 0,
      priceMinor,
      coverGradient,
      modules: [
        {
          id: `mod-${slug}-1`,
          title: 'Модуль 1',
          description: 'Опишите содержание модуля',
          lessons: [],
        },
      ],
      purchased: false,
      purchasedAt: null,
      certificateIssued: false,
    };
    addCourse(course);
    toast.success('Курс создан');
    router.push(`/admin/courses/${slug}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Название курса</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!editing && !slug) {
                // auto-derive slug from title (latin-only)
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                    .slice(0, 40),
                );
              }
            }}
            placeholder="Midjourney от нуля"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (URL)</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="midjourney-basics"
            required
            disabled={editing}
            pattern="[a-z0-9-]+"
          />
          {editing ? (
            <p className="text-xs text-muted-foreground">Slug нельзя менять</p>
          ) : (
            <p className="text-xs text-muted-foreground">Только латиница, цифры и дефис</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="short">Краткое описание (карточка)</Label>
        <Input
          id="short"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          placeholder="Освойте генерацию изображений в Midjourney v7"
          maxLength={120}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="long">Полное описание (страница курса)</Label>
        <textarea
          id="long"
          rows={4}
          value={longDescription}
          onChange={(e) => setLongDescription(e.target.value)}
          placeholder="Расскажите подробнее о курсе и для кого он"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Категория</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryId)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Цена, ₽</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={100}
            value={priceMajor}
            onChange={(e) => setPriceMajor(e.target.value)}
            placeholder="9900"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Цвет обложки</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADIENTS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setCoverGradient(g.value)}
              className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
                coverGradient === g.value
                  ? 'border-primary ring-2 ring-primary/40'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <span
                aria-hidden
                className={`h-8 w-8 rounded-md bg-gradient-to-br ${g.value}`}
              />
              <span className="text-xs">{g.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-6">
        <Button type="button" variant="outline" onClick={() => router.push('/admin/courses')}>
          Отмена
        </Button>
        <Button type="submit">{editing ? 'Сохранить' : 'Создать курс'}</Button>
      </div>
    </form>
  );
}
