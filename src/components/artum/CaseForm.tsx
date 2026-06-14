'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type CategoryId, CATEGORIES } from '@/lib/mock/courses';
import { type Case, caseVideoEmbedUrl } from '@/lib/cases';
import { createCaseAction, updateCaseAction } from '@/server/actions/admin/cases';

interface CaseFormProps {
  /** undefined = создание, иначе — редактирование */
  initial?: Case;
}

/**
 * Форма создания / редактирования кейса.
 * Поля: заголовок, имя студента, направление, описание, результат, фото, публикация.
 */
export function CaseForm({ initial }: CaseFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const editing = !!initial;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [studentName, setStudentName] = useState(initial?.studentName ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [result, setResult] = useState(initial?.result ?? '');
  const [category, setCategory] = useState<CategoryId>(initial?.category ?? 'ai');
  const [published, setPublished] = useState(initial?.published ?? true);
  const [coverUrl, setCoverUrl] = useState<string | null>(initial?.coverUrl ?? null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? '');

  function pickCover() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingCover(true);
      const fd = new FormData();
      fd.append('file', file);
      fetch('/api/admin/case-covers', { method: 'POST', body: fd })
        .then((r) => r.json())
        .then((j) => {
          if (j?.ok && j.url) {
            setCoverUrl(j.url as string);
            toast.success('Фото загружено');
          } else {
            toast.error(j?.error ?? 'Не удалось загрузить фото');
          }
        })
        .catch(() => toast.error('Сеть прервалась при загрузке'))
        .finally(() => setUploadingCover(false));
    };
    input.click();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Укажите заголовок');
      return;
    }
    startTransition(async () => {
      if (editing) {
        const res = await updateCaseAction(initial!.id, {
          title,
          studentName,
          description,
          result,
          category,
          coverUrl,
          videoUrl: videoUrl.trim() || null,
          published,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success('Кейс обновлён');
        router.push('/admin/cases');
        router.refresh();
        return;
      }
      const res = await createCaseAction({
        title,
        studentName,
        description,
        result,
        category,
        coverUrl,
        videoUrl: videoUrl.trim() || null,
        published,
        orderIndex: 100,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Кейс создан');
      router.push('/admin/cases');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Заголовок</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="От нуля до монтажёра за 3 месяца"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="student">Имя студента</Label>
          <Input
            id="student"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Анна Петрова"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Направление</Label>
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Описание</Label>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Что студент изучил, какие проекты сделал, чем гордится"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="result">Результат</Label>
        <Input
          id="result"
          value={result}
          onChange={(e) => setResult(e.target.value)}
          placeholder="Устроился в студию / набрал 50k подписчиков"
        />
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
            — виден на /cases. Снимите галочку, чтобы сохранить как черновик.
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <Label htmlFor="videoUrl">Ссылка на видео (необязательно)</Label>
        <Input
          id="videoUrl"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://rutube.ru/video/…  (или YouTube / VK / Vimeo)"
        />
        <p className="text-xs text-muted-foreground">
          Для тяжёлых работ: вставьте ссылку с RuTube, YouTube, VK Видео или Vimeo — в карточке
          покажется встроенный плеер вместо фото.
        </p>
        {videoUrl.trim() ? (
          caseVideoEmbedUrl(videoUrl) ? (
            <div className="mt-2 aspect-video w-full max-w-md overflow-hidden rounded-lg border border-border">
              <iframe
                src={caseVideoEmbedUrl(videoUrl) ?? undefined}
                title="Предпросмотр видео"
                className="h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
              />
            </div>
          ) : (
            <p className="text-xs text-amber-500">
              Ссылка не распознана. Поддерживаются RuTube, YouTube, VK Видео, Vimeo.
            </p>
          )
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Фото кейса</Label>
        <div className="flex items-center gap-3">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary/40">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                нет фото
              </div>
            )}
          </div>
          <div className="flex flex-col items-start gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pickCover}
              disabled={uploadingCover}
            >
              {uploadingCover ? 'Загрузка…' : coverUrl ? 'Заменить фото' : 'Загрузить фото'}
            </Button>
            {coverUrl ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setCoverUrl(null)}>
                Убрать фото
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Картинка до 10 МБ. Лучше горизонтальная, ~16:9.
        </p>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/cases')}
          disabled={pending}
        >
          Отмена
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Сохраняем…' : editing ? 'Сохранить' : 'Создать кейс'}
        </Button>
      </div>
    </form>
  );
}
