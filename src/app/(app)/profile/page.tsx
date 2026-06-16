import { requireUser } from '@/server/queries/auth';
import { getPublishedCourses } from '@/server/queries/catalog';
import {
  getMyCertificates,
  getMyCompletedLessonIds,
  getMyPayments,
  getMyPurchases,
  getMySubscribedCourseSlugs,
  getMyWishlistSlugs,
} from '@/server/queries/commerce';

import { ProfilePageClient } from './ProfilePageClient';

/**
 * /profile — server entrypoint. Auth gate в (app)/layout.tsx уже сработал;
 * здесь дополнительный requireUser() даёт нам non-null user typecheck.
 *
 * Параллельно тянем: каталог, покупки, прогресс, wishlist, сертификаты,
 * платежи, активную подписку.
 */
export default async function ProfilePage() {
  const user = await requireUser('/profile');

  const [
    courses,
    purchases,
    completedLessonIds,
    wishlistSlugs,
    certificates,
    payments,
    subscribedSlugs,
  ] = await Promise.all([
    getPublishedCourses(),
    getMyPurchases(),
    getMyCompletedLessonIds(),
    getMyWishlistSlugs(),
    getMyCertificates(),
    getMyPayments(),
    getMySubscribedCourseSlugs(),
  ]);

  return (
    <ProfilePageClient
      user={user}
      courses={courses}
      purchases={purchases}
      completedLessonIds={Array.from(completedLessonIds)}
      wishlistSlugs={Array.from(wishlistSlugs)}
      certificates={certificates}
      payments={payments}
      subscribedSlugs={Array.from(subscribedSlugs)}
    />
  );
}
