import { getCurrentUser } from '@/server/queries/auth';
import { getMyActiveSubscription } from '@/server/queries/commerce';
import { getAllCoursesForAdmin } from '@/server/queries/catalog';
import { getPublishedPlans } from '@/server/queries/subscription-plans';

import { SubscribeClient, type PlanView } from './SubscribeClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Подписка' };

/**
 * /subscribe — витрина планов подписки (из БД).
 * Server-fetched: пользователь + активная подписка + опубликованные планы
 * с названиями входящих курсов.
 */
export default async function SubscribePage() {
  const [user, activeSubscription, plans, courses] = await Promise.all([
    getCurrentUser(),
    getMyActiveSubscription(),
    getPublishedPlans(),
    getAllCoursesForAdmin(),
  ]);

  const titleById = new Map(courses.map((c) => [c.id, c.title]));
  const planViews: PlanView[] = plans.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    priceMonthlyMinor: p.priceMonthlyMinor,
    priceYearlyMinor: p.priceYearlyMinor,
    isAllCourses: p.isAllCourses,
    courseTitles: p.isAllCourses
      ? []
      : p.courseIds.map((id) => titleById.get(id)).filter((t): t is string => !!t),
  }));

  return (
    <SubscribeClient
      isLoggedIn={!!user}
      activeSubscription={activeSubscription}
      plans={planViews}
    />
  );
}
