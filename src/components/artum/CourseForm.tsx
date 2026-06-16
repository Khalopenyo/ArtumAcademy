'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CourseCover } from '@/components/artum/CourseCover';
import {
  type CategoryId,
  type Course,
  CATEGORIES,
} from '@/lib/mock/courses';
import {
  createCourseAction,
  createModuleAction,
  updateCourseAction,
} from '@/server/actions/admin/courses';

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
  const [pending, startTransition] = useTransition();

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
  const [published, setPublished] = useState(initial?.published ?? true);
  const [coverUrl, setCoverUrl] = useState<string | null>(initial?.coverUrl ?? null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [authorName, setAuthorName] = useState(initial?.authorName ?? '');
  const [authorTitle, setAuthorTitle] = useState(initial?.authorTitle ?? '');
  const [authorBio, setAuthorBio] = useState(initial?.authorBio ?? '');
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState<string | null>(
    initial?.authorAvatarUrl ?? null,
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [outcomesText, setOutcomesText] = useState(
    (initial?.learningOutcomes ?? []).join('\n'),
  );

  function pickCover() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/mp4,video/webm';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingCover(true);
      const fd = new FormData();
      fd.append('file', file);
      fetch('/api/admin/course-covers', { method: 'POST', body: fd })
        .then((r) => r.json())
        .then((j) => {
          if (j?.ok && j.url) {
            setCoverUrl(j.url as string);
            toast.success('Обложка загружена');
          } else {
            toast.error(j?.error ?? 'Не удалось загрузить обложку');
          }
        })
        .catch(() => toast.error('Сеть прервалась при загрузке'))
        .finally(() => setUploadingCover(false));
    };
    input.click();
  }

  function pickAvatar() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingAvatar(true);
      const fd = new FormData();
      fd.append('file', file);
      fetch('/api/admin/course-covers', { method: 'POST', body: fd })
        .then((r) => r.json())
        .then((j) => {
          if (j?.ok && j.url) {
            setAuthorAvatarUrl(j.url as string);
            toast.success('Фото автора загружено');
          } else {
            toast.error(j?.error ?? 'Не удалось загрузить фото');
          }
        })
        .catch(() => toast.error('Сеть прервалась при загрузке'))
        .finally(() => setUploadingAvatar(false));
    };
    input.click();
  }

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

    const learningOutcomes = outcomesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const authorFields = {
      authorName: authorName.trim() || null,
      authorTitle: authorTitle.trim() || null,
      authorBio: authorBio.trim() || null,
      authorAvatarUrl,
      learningOutcomes,
    };

    startTransition(async () => {
      if (editing) {
        const res = await updateCourseAction(initial!.slug, {
          slug: initial!.slug,
          title,
          shortDescription,
          longDescription,
          category,
          priceMinor,
          coverGradient,
          coverUrl,
          published,
          ...authorFields,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success('Курс обновлён');
        router.push('/admin/courses');
        router.refresh();
        return;
      }

      // create
      const res = await createCourseAction({
        slug,
        title,
        shortDescription,
        longDescription,
        category,
        studentsCount: 0,
        priceMinor,
        coverGradient,
        coverUrl,
        published,
        orderIndex: 100,
        ...authorFields,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Создаём первый модуль (best effort, не блокируем UX)
      await createModuleAction({
        courseSlug: slug,
        title: 'Модуль 1',
        description: 'Опишите содержание модуля',
        orderIndex: 0,
      });
      toast.success('Курс создан');
      router.push(`/admin/courses/${slug}`);
      router.refresh();
    });
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
            pattern="[-a-z0-9]+"
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

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="size-4 accent-primary"
        />
        <span className="text-sm">
          Опубликован{' '}
          <span className="text-muted-foreground">
            — виден в каталоге. Снимите галочку, чтобы сохранить как черновик.
          </span>
        </span>
      </label>

      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="text-sm font-medium">Автор курса <span className="text-muted-foreground">— блок доверия на странице</span></div>
        <div className="flex items-center gap-3">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-full border border-border bg-secondary/40">
            {authorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={authorAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] text-muted-foreground">
                фото
              </div>
            )}
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={pickAvatar} disabled={uploadingAvatar}>
              {uploadingAvatar ? 'Загрузка…' : authorAvatarUrl ? 'Заменить фото' : 'Фото автора'}
            </Button>
            {authorAvatarUrl ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAuthorAvatarUrl(null)}>
                Убрать
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="authorName">Имя автора</Label>
            <Input
              id="authorName"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Иван Петров"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="authorTitle">Регалии / роль</Label>
            <Input
              id="authorTitle"
              value={authorTitle}
              onChange={(e) => setAuthorTitle(e.target.value)}
              placeholder="Арт-директор, 8 лет в Midjourney"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="authorBio">Об авторе</Label>
          <textarea
            id="authorBio"
            rows={2}
            value={authorBio}
            onChange={(e) => setAuthorBio(e.target.value)}
            placeholder="Коротко: опыт, проекты, чем известен"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="outcomes">Чему научитесь (по пункту на строку)</Label>
        <textarea
          id="outcomes"
          rows={4}
          value={outcomesText}
          onChange={(e) => setOutcomesText(e.target.value)}
          placeholder={'Генерировать изображения в Midjourney\nПисать сложные промпты\nГотовить ассеты для соцсетей'}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          Каждая строка — отдельный пункт «Чему вы научитесь» на странице курса.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Обложка курса (картинка / GIF / видео)</Label>
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg border border-border">
            <CourseCover coverUrl={coverUrl} gradient={coverGradient} />
          </div>
          <div className="flex flex-col items-start gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pickCover}
              disabled={uploadingCover}
            >
              {uploadingCover ? 'Загрузка…' : coverUrl ? 'Заменить обложку' : 'Загрузить обложку'}
            </Button>
            {coverUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCoverUrl(null)}
              >
                Убрать (вернуть градиент)
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          16:9, ~1280×720. Гифки/видео — до 25 МБ. Без обложки показывается градиент ниже.
        </p>
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
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/courses')}
          disabled={pending}
        >
          Отмена
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Сохраняем…' : editing ? 'Сохранить' : 'Создать курс'}
        </Button>
      </div>
    </form>
  );
}
