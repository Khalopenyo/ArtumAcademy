'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SubscriptionPlan } from '@/lib/subscription-plans';
import { createPlanAction, updatePlanAction } from '@/server/actions/admin/subscription-plans';

interface CourseOption {
  id: string;
  title: string;
}

interface SubscriptionPlanFormProps {
  initial?: SubscriptionPlan;
  allCourses: CourseOption[];
}

/**
 * Форма создания/редактирования плана подписки.
 * Цены вводятся в рублях, конвертируются в копейки при сохранении.
 */
export function SubscriptionPlanForm({ initial, allCourses }: SubscriptionPlanFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const editing = !!initial;

  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priceMonthly, setPriceMonthly] = useState(
    initial ? String(initial.priceMonthlyMinor / 100) : '990',
  );
  const [priceYearly, setPriceYearly] = useState(
    initial ? String(initial.priceYearlyMinor / 100) : '9900',
  );
  const [isAllCourses, setIsAllCourses] = useState(initial?.isAllCourses ?? false);
  const [published, setPublished] = useState(initial?.published ?? true);
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.courseIds ?? []));
  const [query, setQuery] = useState('');

  function toggleCourse(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleCourses = query.trim()
    ? allCourses.filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()))
    : allCourses;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error('Заполните название и slug');
      return;
    }
    const monthly = Math.round(parseFloat(priceMonthly) * 100);
    const yearly = Math.round(parseFloat(priceYearly) * 100);
    if (!Number.isFinite(monthly) || monthly < 0 || !Number.isFinite(yearly) || yearly < 0) {
      toast.error('Некорректная цена');
      return;
    }
    if (!isAllCourses && selected.size === 0) {
      toast.error('Выберите хотя бы один курс или включите «Доступ ко всему каталогу»');
      return;
    }

    const payload = {
      slug: slug.trim(),
      name: name.trim(),
      description,
      priceMonthlyMinor: monthly,
      priceYearlyMinor: yearly,
      isAllCourses,
      published,
      courseIds: isAllCourses ? [] : Array.from(selected),
    };

    startTransition(async () => {
      const res = editing
        ? await updatePlanAction(initial!.id, payload)
        : await createPlanAction({ ...payload, orderIndex: 100 });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? 'План обновлён' : 'План создан');
      router.push('/admin/subscription-plans');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Название плана</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!editing && !slug) {
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                    .slice(0, 40),
                );
              }
            }}
            placeholder="AI-набор"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (URL)</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="ai-bundle"
            required
            disabled={editing}
            pattern="[-a-z0-9]+"
          />
          {editing ? <p className="text-xs text-muted-foreground">Slug нельзя менять</p> : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="desc">Описание</Label>
        <textarea
          id="desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Что входит в подписку и для кого она"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pm">Цена за месяц, ₽</Label>
          <Input
            id="pm"
            type="number"
            min={0}
            step={50}
            value={priceMonthly}
            onChange={(e) => setPriceMonthly(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="py">Цена за год, ₽</Label>
          <Input
            id="py"
            type="number"
            min={0}
            step={100}
            value={priceYearly}
            onChange={(e) => setPriceYearly(e.target.value)}
            required
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
        <input
          type="checkbox"
          checked={isAllCourses}
          onChange={(e) => setIsAllCourses(e.target.checked)}
          className="size-4 accent-primary"
        />
        <span className="text-sm">
          Доступ ко всему каталогу{' '}
          <span className="text-muted-foreground">
            — подписка даёт все курсы (включая будущие). Иначе выберите курсы ниже.
          </span>
        </span>
      </label>

      {!isAllCourses ? (
        <div className="space-y-2">
          <Label>Курсы в плане ({selected.size} выбрано)</Label>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск курса по названию"
            className="h-9"
          />
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {visibleCourses.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">Курсы не найдены.</p>
            ) : (
              visibleCourses.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-secondary/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleCourse(c.id)}
                    className="size-4 accent-primary"
                  />
                  <span className="text-sm">{c.title}</span>
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="size-4 accent-primary"
        />
        <span className="text-sm">
          Опубликован{' '}
          <span className="text-muted-foreground">— виден на /subscribe. Снимите для черновика.</span>
        </span>
      </label>

      <div className="flex justify-end gap-2 border-t border-border pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/subscription-plans')}
          disabled={pending}
        >
          Отмена
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Сохраняем…' : editing ? 'Сохранить' : 'Создать план'}
        </Button>
      </div>
    </form>
  );
}
