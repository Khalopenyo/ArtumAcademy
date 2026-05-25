'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useArtumStore } from '@/lib/store';

export default function AdminPromocodesPage() {
  const promocodes = useArtumStore((s) => s.promocodes);
  const addPromocode = useArtumStore((s) => s.addPromocode);
  const deletePromocode = useArtumStore((s) => s.deletePromocode);
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('10');
  const [validUntil, setValidUntil] = useState('');
  const [usesLeft, setUsesLeft] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const valueNum = parseInt(value, 10);
    if (isNaN(valueNum)) {
      setError('Некорректное значение');
      return;
    }
    const usesNum = usesLeft.trim() === '' ? null : parseInt(usesLeft, 10);
    if (usesNum !== null && (isNaN(usesNum) || usesNum < 1)) {
      setError('Лимит использований — целое число > 0 или пусто');
      return;
    }
    startTransition(() => {
      const res = addPromocode({
        code: code.trim(),
        type,
        value: type === 'fixed' ? valueNum * 100 : valueNum, // fixed: ввод в ₽ → копейки
        validUntil: validUntil.trim() || null,
        usesLeft: usesNum,
        note: note.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success('Промокод создан');
      setCode('');
      setValue('10');
      setValidUntil('');
      setUsesLeft('');
      setNote('');
    });
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        К админ-панели
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Промокоды</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Скидки на отдельные курсы. Подписка ими не охватывается.
      </p>

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="mt-6 grid gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-5 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="space-y-1 lg:col-span-2">
          <Label htmlFor="code" className="text-xs">Код (A-Z / 0-9)</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SALE20"
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="type" className="text-xs">Тип</Label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as 'percent' | 'fixed')}
            disabled={pending}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="percent">%</option>
            <option value="fixed">₽</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="value" className="text-xs">
            {type === 'percent' ? '%' : 'Размер ₽'}
          </Label>
          <Input
            id="value"
            type="number"
            min={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="valid-until" className="text-xs">До (ISO date)</Label>
          <Input
            id="valid-until"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="uses-left" className="text-xs">Лимит (пусто = ∞)</Label>
          <Input
            id="uses-left"
            type="number"
            min={1}
            value={usesLeft}
            onChange={(e) => setUsesLeft(e.target.value)}
            placeholder="∞"
            disabled={pending}
          />
        </div>
        <div className="space-y-1 sm:col-span-2 lg:col-span-5">
          <Label htmlFor="note" className="text-xs">Заметка</Label>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Например: «Чёрная пятница»"
            disabled={pending}
          />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <Button type="submit" disabled={pending} className="w-full">
            <Plus className="mr-1 size-4" aria-hidden /> Создать
          </Button>
        </div>
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2 lg:col-span-6">
            {error}
          </p>
        ) : null}
      </form>

      {/* List */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        {promocodes.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Промокодов пока нет.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-card/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Код</th>
                <th className="px-5 py-3 text-left font-medium">Скидка</th>
                <th className="px-5 py-3 text-left font-medium">Действует до</th>
                <th className="px-5 py-3 text-right font-medium">Осталось</th>
                <th className="px-5 py-3 text-left font-medium">Заметка</th>
                <th className="px-5 py-3 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {promocodes.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/50">
                  <td className="px-5 py-3 font-mono font-medium">{p.code}</td>
                  <td className="px-5 py-3">
                    {p.type === 'percent' ? `${p.value}%` : `${p.value / 100} ₽`}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {p.validUntil
                      ? new Date(p.validUntil).toLocaleDateString('ru-RU')
                      : 'бессрочно'}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {p.usesLeft ?? '∞'}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{p.note || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Удалить ${p.code}`}
                      onClick={() => {
                        if (confirm(`Удалить промокод ${p.code}?`)) {
                          deletePromocode(p.id);
                          toast.success('Промокод удалён');
                        }
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
