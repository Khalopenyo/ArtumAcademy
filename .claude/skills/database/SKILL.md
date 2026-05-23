---
name: database
description: Правила работы с базой данных Supabase Postgres в проекте VideoEdit Academy. Используй при создании или изменении миграций SQL, добавлении или редактировании таблиц, настройке Row-Level Security политик, написании серверных запросов и RPC-функций. Также применяй когда нужно работать с типами БД, индексами, soft delete или транзакциями.
---

# База данных

## Миграции

Все изменения схемы — через миграции в `supabase/migrations/`. Никогда не правь схему через UI Supabase Studio на проде. Только на dev для эксперимента, потом всё равно оформить как миграцию.

### Именование
```
20260522143000_add_certificates_table.sql
20260522150000_alter_lessons_add_duration.sql
```

Префикс — UTC timestamp `YYYYMMDDHHMMSS` (получить: `date -u +%Y%m%d%H%M%S`). Описание — на английском, snake_case, глагол + что делаешь.

### Правила

1. **Только вперёд.** Не редактируй уже применённые миграции. Если ошибся — пиши новую, которая исправляет.
2. **Транзакции.** Оборачивай связанные изменения в `BEGIN; ... COMMIT;` если их несколько.
3. **Идемпотентность по возможности.** `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
4. **Не теряй данные.** Перед `DROP COLUMN` подумай. Если есть данные — сначала перенос, потом drop отдельной миграцией.
5. **RLS-политики в той же миграции, что и таблица.** Не разделяй создание таблицы и её защиту.

### Шаблон миграции

```sql
-- supabase/migrations/20260522143000_add_certificates_table.sql

CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  certificate_number text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON certificates(course_id);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own certificates"
  ON certificates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public verification by certificate number"
  ON certificates FOR SELECT
  USING (true);
```

После каждой миграции: `npm run db:types` для обновления TypeScript-типов.

---

## Row-Level Security

**RLS обязательно** на каждой таблице, к которой обращается клиент через Supabase JS SDK. Без RLS любой пользователь сможет читать/писать чужие данные.

### Базовые политики

**Пользователь видит только своё:**
```sql
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own submissions"
  ON submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own submissions"
  ON submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Куратор видит и обновляет, но не вставляет:**
```sql
CREATE POLICY "Reviewers see all submissions"
  ON submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('curator', 'admin')
    )
  );
```

**Публичные данные:**
```sql
CREATE POLICY "Courses are public"
  ON courses FOR SELECT
  USING (published = true);
```

### Когда RLS можно не делать
Только для таблиц, которые **никогда** не читаются через клиентский SDK — внутренние таблицы `webhook_events`, `audit_log`. Но даже там лучше включить RLS с пустыми политиками — двойной слой защиты.

### Тестирование RLS
Обязательно проверяй в тестах:
```ts
const otherUserClient = createClientWithToken(otherUserToken);
const { data } = await otherUserClient
  .from('submissions')
  .select('*')
  .eq('user_id', myUserId);
expect(data).toHaveLength(0);
```

---

## Типы из БД

После миграции **всегда**:
```bash
npm run db:types
```

Это сгенерирует `src/types/database.ts`. Используй:
```ts
import { Database } from '@/types/database';

type Submission = Database['public']['Tables']['submissions']['Row'];
type SubmissionInsert = Database['public']['Tables']['submissions']['Insert'];
type SubmissionUpdate = Database['public']['Tables']['submissions']['Update'];
```

Не пиши типы таблиц БД руками.

---

## Запросы

### Серверный vs клиентский клиент

| Где | Какой клиент | Зачем |
|---|---|---|
| Server Component, Server Action | `createServerSupabase()` из `@/lib/supabase/server` | Доступ к сессии через cookies |
| Client Component | `createBrowserSupabase()` из `@/lib/supabase/client` | Защита через RLS |
| Webhook, миграция данных | service_role | Полные права, в обход RLS |

### Запросы выносим из компонентов

```ts
// ❌ Не пиши Supabase в компонентах
export default async function Page() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from('courses').select('*');
  return <CourseList courses={data ?? []} />;
}

// ✅ Выноси в queries
// src/server/queries/courses.ts
export async function getPublishedCourses() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('courses')
    .select('id, slug, title, cover_url')
    .eq('published', true)
    .order('order_index');
  if (error) throw error;
  return data;
}
```

### Никаких N+1

Если на странице 10 курсов и для каждого нужен список модулей — **один запрос с join**:

```ts
// ✅
.select('id, title, modules(id, title)')

// ❌
for (const course of courses) {
  await supabase.from('modules').select('*').eq('course_id', course.id);
}
```

---

## Транзакции

Через Supabase JS SDK напрямую транзакции не делаются. Если нужна транзакция — пиши SQL-функцию (`CREATE FUNCTION ... LANGUAGE plpgsql`) и вызывай через `supabase.rpc('function_name', { ... })`.

Например, "выдать сертификат" должно атомарно: проверить завершение курса → создать запись в `certificates` → вставить уведомление. Одна функция, одна транзакция.

---

## Что НЕ делать

- Не используй `SELECT *` в продакшен-запросах — перечисляй колонки явно
- Не храни секреты/токены в БД в открытом виде — только хэши
- Не делай очень широкие таблицы (>30 колонок) — раздели
- Не используй `text` где можно `varchar(N)` или `enum`
- Не забывай индексы на FK-колонках, по которым джойнишь
- Не делай soft delete через `is_deleted boolean` — используй `deleted_at timestamptz`
