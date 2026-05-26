import { notFound } from 'next/navigation';

import {
  getCourseBySlugFromDb,
  getRelatedCourses,
} from '@/server/queries/catalog';
import {
  getMyActiveSubscription,
  getMyCertificates,
  getMyCompletedLessonIds,
  getMyPurchasedCourseSlugs,
  getMyWishlistSlugs,
} from '@/server/queries/commerce';
import { getCurrentUser } from '@/server/queries/auth';

import CoursePageClient from './CoursePageClient';

/**
 * Страница курса (Server Component).
 * Тянет курс + nested modules/lessons из Supabase, выбирает похожие курсы
 * той же категории, и user-specific commerce данные (покупки, прогресс,
 * сертификаты, wishlist, подписка) — всё за один parallel fetch.
 */

interface CoursePageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: CoursePageProps) {
  const course = await getCourseBySlugFromDb(params.slug);
  if (!course) return { title: 'Курс не найден' };
  return {
    title: course.title,
    description: course.shortDescription,
  };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const course = await getCourseBySlugFromDb(params.slug);
  if (!course) notFound();

  const [
    similar,
    user,
    purchasedSlugs,
    completedLessonIds,
    wishlistSlugs,
    certificates,
    activeSubscription,
  ] = await Promise.all([
    getRelatedCourses(course.category, course.slug, 3),
    getCurrentUser(),
    getMyPurchasedCourseSlugs(),
    getMyCompletedLessonIds(),
    getMyWishlistSlugs(),
    getMyCertificates(),
    getMyActiveSubscription(),
  ]);

  const hasCertificate = certificates.some((c) => c.courseSlug === course.slug);

  return (
    <CoursePageClient
      course={course}
      similar={similar}
      isLoggedIn={!!user}
      purchasedSlugs={Array.from(purchasedSlugs)}
      completedLessonIds={Array.from(completedLessonIds)}
      wishlistSlugs={Array.from(wishlistSlugs)}
      hasCertificate={hasCertificate}
      hasActiveSubscription={!!activeSubscription}
    />
  );
}
