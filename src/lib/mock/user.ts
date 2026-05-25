/**
 * Mock-данные текущего пользователя.
 *
 * Только для этапа 1 ТЗ (скелет). Когда появится реальный auth
 * (этап 2 ТЗ §9), этот файл удаляется и заменяется на server-side
 * `getCurrentUser()` через Supabase Auth.
 *
 * На скелете предполагаем, что пользователь всегда залогинен —
 * это даёт визуальный продукт (приветствие, аватар, прогресс),
 * а не пустой landing для гостя.
 */

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  /** Инициалы для fallback-аватара (когда avatarUrl = null) */
  initials: string;
  /** Когда зарегистрировался — для блока статистики в ЛК */
  registeredAt: string;
}

export const MOCK_CURRENT_USER: MockUser = {
  id: 'user-mock-001',
  name: 'Иван Петров',
  email: 'ivan.petrov@example.com',
  avatarUrl: null,
  initials: 'ИП',
  registeredAt: '2026-01-15',
};

/**
 * Уведомления для иконки в хедере (ТЗ §4.1).
 * Скелетная имитация — потом придёт через Supabase Realtime или polling.
 */
export interface MockNotification {
  id: string;
  title: string;
  body: string;
  /** Относительное время (например: «2 часа назад») */
  ago: string;
  unread: boolean;
}

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: 'notif-1',
    title: 'Новый курс в категории AI',
    body: 'Промптинг Midjourney v7 — обновлённая программа',
    ago: '2 часа назад',
    unread: true,
  },
  {
    id: 'notif-2',
    title: 'Сертификат готов',
    body: 'Курс «Lightroom для начинающих» завершён на 100%',
    ago: 'вчера',
    unread: true,
  },
  {
    id: 'notif-3',
    title: 'Скидка 30% на подписку',
    body: 'Только до конца недели — годовая подписка со скидкой',
    ago: '3 дня назад',
    unread: false,
  },
];

export const MOCK_UNREAD_COUNT = MOCK_NOTIFICATIONS.filter((n) => n.unread).length;
