import { getAllReviewsForAdmin } from '@/server/queries/reviews';

import { AdminReviewsClient } from './AdminReviewsClient';

/** Модерация отзывов (Server Component). */
export const dynamic = 'force-dynamic';

export default async function AdminReviewsPage() {
  const reviews = await getAllReviewsForAdmin();
  return <AdminReviewsClient initialReviews={reviews} />;
}
