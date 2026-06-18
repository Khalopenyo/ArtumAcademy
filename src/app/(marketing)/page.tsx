import { getPublishedCourses } from '@/server/queries/catalog';
import {
  getMyCertificates,
  getMyCompletedLessonIds,
  getMyPurchasedCourseSlugs,
  getMySubscribedCourseSlugs,
  getMyWishlistSlugs,
} from '@/server/queries/commerce';
import { getCurrentUser } from '@/server/queries/auth';

import { DashboardClient } from './DashboardClient';

/**
 * Главная (Server Component): тянет каталог опубликованных курсов из Supabase,
 * user-specific commerce данные (покупки, прогресс, wishlist, сертификаты, подписка)
 * и передаёт всё в Client-обёртку.
 *
 * Не используем revalidate — страница зависит от cookies (через getCurrentUser
 * в Header), поэтому Next автоматически делает её динамической. user-specific
 * данные читаются под RLS (anon-юзер получает пустые Set'ы).
 */
export default async function DashboardPage() {
  const [
    courses,
    user,
    purchasedSlugs,
    wishlistSlugs,
    completedLessonIds,
    certificates,
    subscribedSlugs,
  ] = await Promise.all([
    getPublishedCourses(),
    getCurrentUser(),
    getMyPurchasedCourseSlugs(),
    getMyWishlistSlugs(),
    getMyCompletedLessonIds(),
    getMyCertificates(),
    getMySubscribedCourseSlugs(),
  ]);

  return (
    <DashboardClient
      courses={courses}
      userFirstName={user ? (user.name.split(' ')[0] ?? 'друг') : null}
      purchasedSlugs={Array.from(purchasedSlugs)}
      wishlistSlugs={Array.from(wishlistSlugs)}
      completedLessonIds={Array.from(completedLessonIds)}
      certificatesCount={certificates.length}
      subscribedSlugs={Array.from(subscribedSlugs)}
    />
  );
}
