---
name: testing
description: Правила написания тестов в проекте VideoEdit Academy. Используй при создании unit-тестов с Vitest, тестов компонентов с Testing Library, integration-тестов для Server Actions с тестовой БД Supabase, или E2E-тестов с Playwright. Описывает что покрывать, как структурировать тесты, как мокать зависимости, как тестировать RLS-политики, и какие критичные сценарии должны быть в E2E. По требованиям проекта тесты пишутся к каждой фиче — не "потом покроем".
---

# Тестирование

В проекте тесты пишутся к каждой фиче, не "потом покроем". Это явное требование.

## Что тестируем

| Тип | Чем | Когда |
|---|---|---|
| Unit | Vitest | Бизнес-логика, Zod-схемы, утилиты |
| Component | Vitest + Testing Library | UI-компоненты с логикой |
| Integration | Vitest + test Supabase | Server Actions, queries |
| E2E | Playwright | Критичные пользовательские сценарии |

---

## 1. Unit-тесты

### Что покрываем
- Чистые функции со сложной логикой (расчёт прогресса, скидки, форматирование)
- Zod-схемы — что валидно, что нет
- Утилиты (`formatPrice`, `calculateProgress`)

### Что НЕ покрываем
- Тривиальные геттеры/сеттеры
- JSX без логики
- Внешние библиотеки

### Шаблон

```ts
// src/lib/billing/calculateUpgrade.ts
export function calculateUpgrade(
  fromPrice: number,
  toPrice: number,
  alreadyPaid: number
): { canUpgrade: boolean; amountToPay: number } {
  if (toPrice <= fromPrice) return { canUpgrade: false, amountToPay: 0 };
  const amountToPay = Math.max(0, toPrice - alreadyPaid);
  return { canUpgrade: true, amountToPay };
}
```

```ts
// src/lib/billing/calculateUpgrade.test.ts
import { describe, it, expect } from 'vitest';
import { calculateUpgrade } from './calculateUpgrade';

describe('calculateUpgrade', () => {
  it('допускает апгрейд с младшего тарифа на старший', () => {
    const result = calculateUpgrade(4900, 19900, 4900);
    expect(result.canUpgrade).toBe(true);
    expect(result.amountToPay).toBe(15000);
  });

  it('отказывает в апгрейде на тариф той же цены', () => {
    expect(calculateUpgrade(19900, 19900, 19900).canUpgrade).toBe(false);
  });

  it('отказывает в апгрейде на младший тариф', () => {
    expect(calculateUpgrade(19900, 4900, 19900).canUpgrade).toBe(false);
  });

  it('возвращает 0 если уплачено больше, чем стоит новый тариф', () => {
    const result = calculateUpgrade(4900, 19900, 25000);
    expect(result.canUpgrade).toBe(true);
    expect(result.amountToPay).toBe(0);
  });
});
```

### Правила unit-тестов

1. **Файл теста** рядом с исходником: `Foo.test.ts`
2. **Описание на русском**
3. **AAA: Arrange, Act, Assert**
4. **Один assert на тест** где возможно
5. **Граничные случаи обязательно** — null, undefined, пустой массив, отрицательные числа
6. **Не мокай то, что можно вызвать напрямую**

---

## 2. Component-тесты

Тестируем компоненты с логикой (формы, dropdown с фильтром, плеер). Не тестируем "рисующие" компоненты.

```tsx
// src/components/lessons/SubmitForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SubmitAssignmentForm } from './SubmitForm';

vi.mock('@/server/actions/submissions', async () => {
  const actual = await vi.importActual('@/server/actions/submissions');
  return { ...actual, submitAssignment: vi.fn() };
});

describe('SubmitAssignmentForm', () => {
  it('показывает ошибку, если ссылка пустая', async () => {
    const user = userEvent.setup();
    render(<SubmitAssignmentForm assignmentId="11111111-1111-1111-1111-111111111111" />);

    await user.click(screen.getByRole('button', { name: /отправить/i }));

    expect(await screen.findByText(/введите корректную ссылку/i)).toBeInTheDocument();
  });

  it('блокирует кнопку во время отправки', async () => {
    const { submitAssignment } = await import('@/server/actions/submissions');
    vi.mocked(submitAssignment).mockImplementation(() => new Promise(() => {}));

    const user = userEvent.setup();
    render(<SubmitAssignmentForm assignmentId="11111111-1111-1111-1111-111111111111" />);

    await user.type(screen.getByLabelText(/ссылка/i), 'https://youtu.be/abc123');
    await user.click(screen.getByRole('button', { name: /отправить/i }));

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Правила component-тестов

1. **Тестируй поведение, не реализацию** — не смотри на классы, проверяй текст и роли
2. **`screen.getByRole`** предпочтительнее `getByTestId`
3. **`userEvent`**, не `fireEvent`
4. **Каждый тест изолирован**

---

## 3. Integration-тесты Server Actions

Идут к тестовой Supabase БД. Запускаются отдельно (медленнее unit).

```ts
// src/server/actions/submissions.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { submitAssignment } from './submissions';
import { testSupabase, createTestUser, createTestAssignment } from '@/tests/integration/setup';

describe('submitAssignment (integration)', () => {
  let userId: string;
  let assignmentId: string;

  beforeEach(async () => {
    userId = await createTestUser('test@example.com');
    assignmentId = await createTestAssignment();
  });

  it('создаёт submission в статусе pending', async () => {
    const result = await submitAssignment({
      assignmentId,
      videoUrl: 'https://youtu.be/test',
      comment: 'Готово',
    });

    expect(result.ok).toBe(true);

    const { data } = await testSupabase
      .from('submissions')
      .select('*')
      .eq('id', (result as any).submissionId)
      .single();

    expect(data?.status).toBe('pending');
    expect(data?.user_id).toBe(userId);
  });

  it('отклоняет невалидный videoUrl', async () => {
    const result = await submitAssignment({
      assignmentId,
      videoUrl: 'not-a-url',
    });
    expect(result.ok).toBe(false);
  });
});
```

### RLS-тесты обязательно

```ts
it('RLS: пользователь не видит чужие submissions', async () => {
  const user1 = await createTestUser('u1@test.com');
  const user2 = await createTestUser('u2@test.com');
  // user1 создаёт submission
  // user2 пытается прочитать
  const user2Client = createTestClientFor(user2);
  const { data } = await user2Client.from('submissions').select('*');
  expect(data).toHaveLength(0);
});
```

---

## 4. E2E-тесты

Покрываем критичные сценарии:

| Сценарий | Приоритет |
|---|---|
| Регистрация + подтверждение email + вход | P0 |
| Покупка тарифа (тестовая среда ЮKassa) | P0 |
| Просмотр урока | P0 |
| Сдача ДЗ + проверка куратором | P0 |
| Восстановление пароля | P1 |
| Применение промокода | P1 |
| Получение сертификата | P1 |
| Удаление аккаунта | P2 |

### Шаблон

```ts
// tests/e2e/registration.spec.ts
import { test, expect } from '@playwright/test';
import { generateEmail } from './helpers/email';

test('новый пользователь может зарегистрироваться и войти', async ({ page }) => {
  const email = generateEmail();
  const password = 'TestPass1234';

  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('checkbox', { name: /согласен/i }).check();
  await page.getByRole('button', { name: /зарегистрироваться/i }).click();

  await expect(page).toHaveURL(/\/verify-email/);
  await expect(page.getByText(/проверьте почту/i)).toBeVisible();
});
```

### Правила E2E

1. **Изолированные тесты** — каждый создаёт свои данные
2. **Уникальные email через timestamp** — `test-${Date.now()}@example.com`
3. **Не завись от внешних сервисов** — ЮKassa только тестовая, email перехватываем
4. **`page.goto` в начале** — не полагайся на предыдущий тест
5. **Не используй `page.waitForTimeout`** — используй `expect(...).toBeVisible()`

---

## 5. Команды

```bash
npm run test            # unit + component, watch
npm run test:ci         # один прогон
npm run test:integration
npm run test:e2e
npm run test:e2e:ui     # UI-mode Playwright
npm run test:coverage
```

CI прогоняет unit + integration + e2e на каждый PR.

---

## 6. Покрытие

Цель — **не процент, а покрытие риска**:
- 100% Zod-схем (валидация — явная бизнес-логика)
- 100% утилит из `src/lib/billing/`, `src/lib/auth/`
- Все Server Actions, меняющие БД
- Все критичные сценарии E2E из списка выше

80% бесполезного покрытия (моки моков) хуже 60% осмысленного.

---

## Что НЕ делать

- Не пиши тест ради теста
- Не тестируй типы TypeScript — компилятор уже это сделал
- Не делай "тесты на моках всего" — тестируешь моки, не код
- Не оставляй `it.only` / `describe.only` в коммите
- Не делай тесты, зависящие от системного времени, без `vi.useFakeTimers()`
- Не используй боевые ключи внешних сервисов в тестах
