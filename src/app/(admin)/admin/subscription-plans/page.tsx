import { getAllPlansForAdmin } from '@/server/queries/subscription-plans';

import { SubscriptionPlansClient } from './SubscriptionPlansClient';

/** Список планов подписки в админке (Server Component). */
export const dynamic = 'force-dynamic';

export default async function AdminSubscriptionPlansPage() {
  const plans = await getAllPlansForAdmin();
  return <SubscriptionPlansClient initialPlans={plans} />;
}
