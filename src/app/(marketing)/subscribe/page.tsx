import { getCurrentUser } from '@/server/queries/auth';
import { getMyActiveSubscription } from '@/server/queries/commerce';

import { SubscribeClient } from './SubscribeClient';

/**
 * /subscribe — лендинг тарифов подписки.
 * Server-fetched: текущий пользователь + активная подписка (для гейтинга
 * кнопок оформления / отмены).
 */
export default async function SubscribePage() {
  const [user, activeSubscription] = await Promise.all([
    getCurrentUser(),
    getMyActiveSubscription(),
  ]);

  return (
    <SubscribeClient
      isLoggedIn={!!user}
      activeSubscription={activeSubscription}
    />
  );
}
