---
name: api-conventions
description: Правила написания серверной логики в проекте VideoEdit Academy на Next.js App Router. Используй при создании Server Actions для мутаций данных из форм, написании Route Handlers для вебхуков и OAuth callback, разработке серверных запросов для чтения данных, или при работе с обёртками внешних API (ЮKassa, Kinescope, Unisender). Описывает структуру файлов, валидацию Zod, обработку ошибок и идемпотентность вебхуков.
---

# API-конвенции

## Где живёт серверная логика

| Тип | Где | Когда |
|---|---|---|
| Server Action | `src/server/actions/<module>.ts` | Мутация из формы или кнопки UI |
| Route Handler | `src/app/api/<path>/route.ts` | Webhook, OAuth callback, скачивание файлов |
| Server Query | `src/server/queries/<module>.ts` | Чтение для Server Components |
| Edge Function | `supabase/functions/<name>/` | Долгие фоновые задачи, cron |

REST API наружу не делаем (кроме вебхуков). Внутри фронта — Server Actions и Supabase JS SDK напрямую (защищён RLS).

---

## Server Actions — структура

```ts
// src/server/actions/submissions.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/require';

// 1. Схема Zod
export const submitAssignmentSchema = z.object({
  assignmentId: z.string().uuid('Некорректный ID задания'),
  videoUrl: z.string().url('Введите корректную ссылку').max(500),
  comment: z.string().max(2000, 'Не больше 2000 символов').optional(),
});

export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;

// 2. Тип результата (discriminated union)
type SubmitAssignmentResult =
  | { ok: true; submissionId: string }
  | { ok: false; error: string };

// 3. Сама функция
export async function submitAssignment(
  input: SubmitAssignmentInput
): Promise<SubmitAssignmentResult> {
  const parsed = submitAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const user = await requireUser();
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from('submissions')
    .insert({
      user_id: user.id,
      assignment_id: parsed.data.assignmentId,
      video_url: parsed.data.videoUrl,
      comment: parsed.data.comment,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    console.error('submitAssignment failed', error);
    return { ok: false, error: 'Не удалось сохранить работу' };
  }

  revalidatePath('/submissions');
  return { ok: true, submissionId: data.id };
}
```

### Правила Server Actions

1. **`'use server'`** наверху файла
2. **Zod-валидация всегда** — даже если форма валидирует на клиенте
3. **Проверка авторизации** через `requireUser()` или `requireRole(...)`
4. **Возврат результата, не throw** для бизнес-ошибок
5. **`revalidatePath` / `revalidateTag`** после мутации
6. **Не логируй чувствительное** — пароли, токены, полные номера карт
7. **Никаких `console.log`** в продакшен-коде кроме `console.error`

### Возврат ошибок

Discriminated union → клиент проверяет:
```tsx
const result = await submitAssignment(data);
if (!result.ok) {
  toast.error(result.error);
  return;
}
toast.success('Работа отправлена');
router.push(`/submissions/${result.submissionId}`);
```

`throw` — только для системных сбоев (отказ БД, отсутствие сессии). Бизнес-ошибка = `{ ok: false }`.

---

## Route Handlers — для webhook и OAuth

Используй когда:
- `/api/webhooks/yookassa` — webhook от ЮKassa
- `/api/webhooks/cloudpayments`
- `/api/webhooks/kinescope`
- `/api/auth/callback/[provider]` — OAuth callbacks
- `/api/download/submission/[id]` — отдача файла с проверкой прав

### Шаблон

```ts
// src/app/api/webhooks/yookassa/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyYookassaSignature } from '@/lib/yookassa/verify';
import { handlePaymentEvent } from '@/server/payments/handler';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-yookassa-signature');

  if (!signature || !verifyYookassaSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    await handlePaymentEvent(event);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('YooKassa webhook failed', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
```

### Правила Route Handlers

1. **Подпись вебхука обязательно проверять** — без неё любой подделает платёж
2. **Идемпотентность** — сохраняй `event_id` в `webhook_events`, при повторе → 200 без действий
3. **Быстрый 2xx** — долгое в очередь, иначе провайдер ретраит
4. **Логируй каждый webhook** в audit_log
5. **Sentry должен поймать любую 500**

---

## Server Queries — чтение

```ts
// src/server/queries/courses.ts
import { createServerSupabase } from '@/lib/supabase/server';
import { Database } from '@/types/database';

type Course = Database['public']['Tables']['courses']['Row'];

export async function getPublishedCourses(): Promise<Course[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('courses')
    .select('id, slug, title, description, cover_url, order_index')
    .eq('published', true)
    .order('order_index');

  if (error) throw error;
  return data ?? [];
}
```

### Правила queries

1. **Имя начинается с глагола** — `getCourseBySlug`, `listSubmissionsByUser`, `findActivePromo`
2. **Типизированный результат** — используй сгенерированные типы из БД
3. **`.maybeSingle()` для "может быть один или ноль"**, `.single()` для "обязательно один"
4. **Никаких queries вне `src/server/queries/`**

---

## Внешние API

Обёртки в `src/lib/<service>/`. Никогда не вызывай внешний API из компонента или Server Action — через обёртку.

```ts
// src/lib/yookassa/client.ts
const YOOKASSA_API = 'https://api.yookassa.ru/v3';

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const idempotenceKey = crypto.randomUUID();

  const response = await fetch(`${YOOKASSA_API}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotence-Key': idempotenceKey,
      Authorization: `Basic ${getAuthHeader()}`,
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`YooKassa createPayment failed: ${response.status}`);
  }

  return response.json();
}
```

### Правила внешних API

1. **Таймаут на каждом запросе** — `AbortSignal.timeout(5000)`
2. **Idempotency-ключ** для мутаций (если провайдер поддерживает)
3. **Не логируй sensitive поля**
4. **Retry с экспоненциальной задержкой** для сетевых сбоев, не более 3 попыток
5. **Ключи только из `process.env`**

---

## Валидация через Zod

Каждая схема — один экспорт. Переиспользуется в форме и Server Action:

```ts
// src/server/actions/schemas/submissions.ts
import { z } from 'zod';

export const submitAssignmentSchema = z.object({
  assignmentId: z.string().uuid('Некорректный ID задания'),
  videoUrl: z.string().url('Введите корректную ссылку').max(500),
  comment: z.string().max(2000, 'Не больше 2000 символов').optional(),
});

export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
```

На клиенте: `useForm({ resolver: zodResolver(submitAssignmentSchema) })`.
На сервере: `submitAssignmentSchema.safeParse(input)`.

Сообщения на русском, понятно человеку.
