/**
 * План подписки — настраиваемый в админке набор курсов с ценой за месяц/год.
 * Подписка пользователя ссылается на план; доступ — по набору курсов плана
 * (или ко всему каталогу, если isAllCourses).
 */
export interface SubscriptionPlan {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceMonthlyMinor: number;
  priceYearlyMinor: number;
  /** true = доступ ко всему каталогу (набор курсов игнорируется). */
  isAllCourses: boolean;
  published: boolean;
  orderIndex: number;
  /** id курсов, входящих в план (для кураторских планов). */
  courseIds: string[];
}
