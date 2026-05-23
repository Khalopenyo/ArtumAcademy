---
name: security
description: Критичные правила безопасности проекта VideoEdit Academy. Используй при работе с авторизацией, секретами и переменными окружения, RLS-политиками, платежами через ЮKassa, обработкой персональных данных по 152-ФЗ, защитой контента от скачивания, audit-логированием, rate-limiting и любыми задачами связанными с защитой данных пользователей. Нарушение этих правил приведёт к проблемам с деньгами, регуляторами или утечкой данных.
---

# Безопасность

## 1. Секреты

### Где хранить
- `.env.local` для разработки — НЕ коммитится
- Vercel / Yandex Cloud — переменные через UI
- Supabase — `service_role` ключ только в Server Actions / Route Handlers, **никогда** в клиенте

### Список переменных проекта

| Имя | Где используется |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | клиент + сервер |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | клиент + сервер |
| `SUPABASE_SERVICE_ROLE_KEY` | **только сервер** |
| `YOOKASSA_SHOP_ID` | сервер |
| `YOOKASSA_SECRET_KEY` | сервер |
| `KINESCOPE_API_TOKEN` | сервер |
| `UNISENDER_API_KEY` | сервер |
| `TELEGRAM_BOT_TOKEN` | сервер |
| `YANDEX_OAUTH_CLIENT_ID` | клиент + сервер |
| `YANDEX_OAUTH_CLIENT_SECRET` | **только сервер** |
| `VK_OAUTH_CLIENT_ID` | клиент + сервер |
| `VK_OAUTH_CLIENT_SECRET` | **только сервер** |
| `YANDEX_CAPTCHA_SERVER_KEY` | сервер |
| `NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY` | клиент |
| `SENTRY_DSN` | сервер |
| `NEXT_PUBLIC_SENTRY_DSN` | клиент |

### Правила
- **Без `NEXT_PUBLIC_` префикса — не попадает в клиентский бандл**
- **Не пиши секреты в логи**, даже частично
- **`.env.example`** — только имена и описания, без значений

---

## 2. Аутентификация

### Сессии
- Supabase Auth через cookies
- `httpOnly`, `SameSite=Lax`, `Secure` в проде
- 30 дней, refresh автоматический

### Middleware
`src/middleware.ts` обновляет сессию — не отключай:
```ts
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
```

### Защита роутов

```tsx
// src/app/(app)/layout.tsx
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <>{children}</>;
}
```

### Хелперы

```ts
// src/lib/auth/require.ts
export async function requireUser() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

export async function requireRole(...roles: Array<'admin' | 'curator' | 'content_manager'>) {
  const user = await requireUser();
  const userRoles = await getUserRoles(user.id);
  if (!userRoles.some((r) => roles.includes(r))) throw new Error('FORBIDDEN');
  return user;
}
```

Используй в каждом Server Action и серверной query.

---

## 3. Защита от типовых атак

### SQL Injection
Невозможен при использовании Supabase SDK или параметризованных RPC. Не строй SQL конкатенацией:
```ts
// ❌
supabase.rpc('search', { query: `SELECT * WHERE name = '${input}'` });

// ✅
supabase.from('courses').select('*').ilike('title', `%${input}%`);
```

### XSS
React по умолчанию экранирует. Опасно:
- `dangerouslySetInnerHTML` — не используй
- Markdown из БД — через `react-markdown` + `rehype-sanitize`
- HTML из БД — через `DOMPurify`

### CSRF
Server Actions защищены автоматически origin-check. Webhook — подписью. Самостоятельно ничего не нужно.

### Open Redirect
```ts
// ❌
redirect(searchParams.get('next') ?? '/');

// ✅
const next = searchParams.get('next');
const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/';
redirect(safeNext);
```

### Rate Limiting
Через `@upstash/ratelimit` с Upstash Redis или Vercel KV:

| Эндпоинт | Лимит |
|---|---|
| `POST /login` | 5 / 15 мин на IP |
| `POST /register` | 3 / час на IP |
| `POST /forgot-password` | 3 / час на email |
| Webhook | 100 / мин на источник |
| Прочие Server Actions с мутацией | 60 / мин на user_id |

---

## 4. Платежи

### Никогда не доверяй клиенту
Цена тарифа берётся **из БД по id**, не из тела запроса.

```ts
// ❌
async function createPayment(input: { planId: string; amount: number }) {
  await yookassa.createPayment({ amount: input.amount, ... });
}

// ✅
async function createPayment(input: { planId: string }) {
  const plan = await getPlanById(input.planId);
  if (!plan) return { ok: false, error: 'Тариф не найден' };
  await yookassa.createPayment({ amount: plan.price, ... });
}
```

### Webhook идемпотентность
Каждый webhook может прийти дважды. Сохраняй `event_id`:

```sql
CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_id text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (provider, external_id)
);
```

В обработчике:
```ts
const { error } = await supabase
  .from('webhook_events')
  .insert({ provider: 'yookassa', external_id: event.object.id, payload: event });

if (error?.code === '23505') {
  return NextResponse.json({ ok: true }); // уже обработано
}
// обрабатываем event...
```

### Проверка подписи
Каждый webhook — проверка HMAC через секрет провайдера. Без подписи → 401.

### Чеки 54-ФЗ
ЮKassa отправляет автоматически. Проверь:
- В payload передаётся `receipt` с items
- В ЛК ЮKassa включена интеграция с фискальным накопителем

---

## 5. Защита контента

### Видео уроков
- Загружаются на Kinescope
- Раздаются через signed URL с TTL 4 часа
- Watermark с email пользователя
- На клиенте не храним URL — запрашиваем по `lessonId` перед воспроизведением

### Файлы ДЗ
- Supabase Storage, bucket `submissions/{user_id}/...`
- Bucket приватный
- Доступ через signed URL только для владельца и кураторов
- Размер ограничен на стороне Supabase и на клиенте

### Капча
На формах регистрации, восстановления, ДЗ — Yandex SmartCaptcha. Проверка токена **на сервере**:

```ts
const captchaResponse = await fetch(
  `https://smartcaptcha.yandexcloud.net/validate?secret=${process.env.YANDEX_CAPTCHA_SERVER_KEY}&token=${captchaToken}&ip=${ip}`
);
const { status } = await captchaResponse.json();
if (status !== 'ok') return { ok: false, error: 'Капча не пройдена' };
```

---

## 6. Логирование

### Audit log
Действия админов и кураторов:
```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  meta jsonb,
  ip_address inet,
  created_at timestamptz DEFAULT now()
);
```

### НЕ логировать
- Пароли (даже хеши)
- Полные номера карт, CVV
- Токены сессии
- Токены внешних сервисов
- Содержание личных сообщений

### Логировать
- ID операции, user_id, IP, timestamp
- Тип события (`login.success`, `payment.created`, `submission.approved`)
- Для финансов: amount, currency, provider_id

---

## 7. Персональные данные (152-ФЗ)

### Минимум данных
Собирай только необходимое.

### Право на удаление
Пользователь удаляет аккаунт через `/profile/danger`:
1. Soft delete: `deleted_at = now()` через триггер на `profiles`
2. Через 30 дней — реальное удаление через cron-функцию
3. Файлы пользователя — удаляются из Storage в момент soft delete

### Право на выгрузку
Server Action в `/profile/export` собирает данные из всех связанных таблиц, возвращает JSON-архив.

### Хранение данных
Supabase region eu-central-1 (Frankfurt) — формально вне РФ. Допустимо при выполнении условий первичного хранения в РФ. **Уточняй у юриста перед запуском.**

---

## Чек-лист перед запуском в прод

- [ ] Все `.env.*` в `.gitignore`
- [ ] `.env.example` актуален
- [ ] RLS включено на публичных таблицах
- [ ] RLS-политики покрыты тестами
- [ ] Middleware сессии включено
- [ ] Защищённые группы роутов проверяют auth
- [ ] Webhook проверяют подпись и идемпотентны
- [ ] Rate limiting на login, register, forgot-password
- [ ] Капча на формах
- [ ] Цены берутся из БД
- [ ] Чеки 54-ФЗ настроены
- [ ] HTTPS обязателен (HSTS в headers)
- [ ] CSP в `next.config.js`
- [ ] Cookies: httpOnly, Secure, SameSite=Lax
- [ ] Audit log пишется
- [ ] Регистрация в РКН как оператора ПД
- [ ] Политика конфиденциальности, оферта опубликованы
- [ ] Sentry собирает ошибки на проде
