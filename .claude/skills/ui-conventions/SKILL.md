---
name: ui-conventions
description: Правила вёрстки и работы с React-компонентами в проекте VideoEdit Academy на Next.js 14 App Router. Используй при создании страниц, компонентов, форм, модалок, плееров, табов и любых UI-элементов. Описывает работу с Tailwind CSS, shadcn/ui, тёмной темой, React Hook Form + Zod, loading-состояниями, пустыми состояниями и обработкой ошибок. Также описывает деление на Server и Client Components.
---

# UI-конвенции

## Server vs Client Components

### Server Component (по умолчанию)
- Любая страница, показывающая данные
- Чтение из БД при рендере
- Без интерактивности (нет `useState`, `onClick`)

### Client Component (`"use client"`)
- Формы с локальным стейтом
- Интерактивный UI: модалки, табы, dropdown
- Использование React Query, Zustand, framer-motion
- Работа с `window`, `localStorage`

**Правило:** клиентский код держим как можно глубже в дереве. Не делай `"use client"` на странице целиком, если интерактивен только один компонент — выноси его отдельно.

---

## Дизайн-система

Базируемся на **shadcn/ui**. Это коллекция копируемых компонентов на Radix UI + Tailwind. Компоненты лежат в `src/components/ui/`.

### Добавление компонента shadcn
```bash
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add data-table
```

### Кастомные компоненты
- **Переиспользуемые** → `src/components/shared/`
- **Привязанные к модулю** → `src/components/<module>/` (`src/components/lessons/VideoPlayer.tsx`)
- **Одноразовые внутри страницы** → рядом со страницей в `src/app/(group)/page/components/`

---

## Стилизация

Только **Tailwind CSS**. Никакого CSS-in-JS, `.module.css`, inline-стилей (кроме редчайших случаев с динамическими `transform`).

### Принципы

1. **Mobile-first.** Сначала мобильная вёрстка, потом `md:`, `lg:` префиксы.
2. **`cn()` для слияния классов** через `tailwind-merge`.
3. **`cva` для вариантов компонентов** (если 15+ классов на элементе).
4. **Никаких магических чисел.** Не `mt-[37px]`, а `mt-9` из spacing scale Tailwind.

### Шаблон компонента

```tsx
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        {
          primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
          secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          ghost: 'hover:bg-accent hover:text-accent-foreground',
        }[variant],
        {
          sm: 'h-9 px-3 text-sm',
          md: 'h-10 px-4 text-sm',
          lg: 'h-11 px-8 text-base',
        }[size],
        className
      )}
      {...props}
    />
  );
}
```

### Тёмная тема

Обязательна. Используй переменные shadcn — они автоматически переключаются:
- `bg-background` / `text-foreground` — основа
- `bg-card` / `text-card-foreground` — карточки
- `bg-muted` / `text-muted-foreground` — приглушённый
- `bg-primary` / `text-primary-foreground` — акцент
- `bg-destructive` / `text-destructive-foreground` — ошибки

**Никогда** не хардкодь `bg-white`, `text-black` — используй семантические.

---

## Правила компонентов

1. **Именованный экспорт**, не default
2. **Props через `interface`**, не `type` (для extends)
3. **Опциональный `className?: string`** — чтобы потребитель мог доопределить
4. **`cn()` для слияния классов**
5. **Без `any`** — типы из `@/types/database`
6. **Без `React.FC`** — просто функция с типизированными props

---

## Формы

Стандарт: React Hook Form + Zod через `@hookform/resolvers/zod` + компоненты `Form` из shadcn.

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';

import {
  submitAssignment,
  submitAssignmentSchema,
  type SubmitAssignmentInput,
} from '@/server/actions/submissions';

interface Props {
  assignmentId: string;
}

export function SubmitAssignmentForm({ assignmentId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<SubmitAssignmentInput>({
    resolver: zodResolver(submitAssignmentSchema),
    defaultValues: { assignmentId, videoUrl: '', comment: '' },
  });

  const onSubmit = (values: SubmitAssignmentInput) => {
    startTransition(async () => {
      const result = await submitAssignment(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Работа отправлена на проверку');
      router.push(`/submissions/${result.submissionId}`);
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="videoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ссылка на видео</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Комментарий (опционально)</FormLabel>
              <FormControl>
                <Textarea placeholder="Что хочешь сказать о работе" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending}>
          {pending ? 'Отправка...' : 'Отправить на проверку'}
        </Button>
      </form>
    </Form>
  );
}
```

### Правила форм

1. **Зод-схема импортируется из Server Action** — не дублируй
2. **`useTransition` для loading**, не отдельный `useState`
3. **Disable submit во время отправки**
4. **Toast через `sonner`**
5. **Редирект через `router.push`** после успеха

---

## Loading и пустые состояния

### Skeleton, не spinner
```tsx
{isLoading ? (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
  </div>
) : (
  <LessonList lessons={lessons} />
)}
```

### Пустое состояние с действием
```tsx
{lessons.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <BookOpen className="size-12 text-muted-foreground" />
    <h3 className="mt-4 text-lg font-medium">Уроков пока нет</h3>
    <p className="mt-1 text-sm text-muted-foreground">
      Вернись сюда позже или начни с другого курса
    </p>
    <Button asChild className="mt-4">
      <Link href="/courses">К списку курсов</Link>
    </Button>
  </div>
) : (
  <LessonList lessons={lessons} />
)}
```

### Ошибки страницы — `error.tsx`
```tsx
'use client';

export default function CourseError({
  error, reset,
}: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center py-12">
      <h2 className="text-xl font-medium">Не удалось загрузить курс</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset} className="mt-4">Попробовать снова</Button>
    </div>
  );
}
```

---

## Импорты и порядок

Алиас `@/` для всего из `src/`. Никаких `../../../`.

Порядок:
1. Внешние пакеты (`react`, `next`, библиотеки)
2. Внутренние модули `@/lib/...`, `@/server/...`
3. Компоненты `@/components/...`
4. Типы `@/types/...`

---

## Изображения

Только `next/image`, никогда `<img>`. Внешние домены прописывай в `next.config.js` → `images.remotePatterns`.

```tsx
import Image from 'next/image';

<Image
  src={course.cover_url}
  alt={course.title}
  width={400}
  height={225}
  className="rounded-md object-cover"
/>
```

---

## Доступность

- Semantic HTML: `<button>` для действий, `<a>` для навигации
- `aria-label` на иконках без текста
- Все формы с `<label>` (через FormLabel)
- Контраст AA по WCAG (даёт shadcn по умолчанию)
- Фокус видим — не убирай `focus-visible:ring`

---

## Что НЕ делать

- Не используй `dangerouslySetInnerHTML` без санитизации
- Не используй `useEffect` для запросов данных — это для React Query
- Не делай `useState` для серверных данных
- Не пиши свой fetch-клиент
- Не используй `getServerSideProps`, `getStaticProps`, `_app.tsx` — это Pages Router
- Не подключай Redux/MobX/Recoil — у нас Zustand
- Не делай `<button>` через `<div onClick>` — это ломает доступность
- Не используй `key={index}` в списках — только стабильные ID
- Не пиши компоненты >250 строк — разбивай
