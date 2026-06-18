import { notFound } from 'next/navigation';

import {
  getCourseBySlugFromDb,
  getRelatedCourses,
} from '@/server/queries/catalog';
import {
  getMyCertificates,
  getMyCompletedLessonIds,
  getMyPurchasedCourseSlugs,
  getMySubscribedCourseSlugs,
  getMyWishlistSlugs,
} from '@/server/queries/commerce';
import { getCourseReviews, getMyReviewForCourse } from '@/server/queries/reviews';
import { getCurrentUser } from '@/server/queries/auth';

import { CoursePageClient } from './CoursePageClient';

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
    subscribedSlugs,
    reviews,
    myReview,
  ] = await Promise.all([
    getRelatedCourses(course.category, course.slug, 3),
    getCurrentUser(),
    getMyPurchasedCourseSlugs(),
    getMyCompletedLessonIds(),
    getMyWishlistSlugs(),
    getMyCertificates(),
    getMySubscribedCourseSlugs(),
    getCourseReviews(course.id),
    getMyReviewForCourse(course.id),
  ]);

  const hasCertificate = certificates.some((c) => c.courseSlug === course.slug);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://artumacademy.ru';
  const courseJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.shortDescription || course.longDescription || course.title,
    provider: { '@type': 'Organization', name: 'Artum Academy', url: siteUrl },
    url: `${siteUrl}/courses/${course.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }}
      />
      <CoursePageClient
        course={course}
        similar={similar}
        isLoggedIn={!!user}
        purchasedSlugs={Array.from(purchasedSlugs)}
        completedLessonIds={Array.from(completedLessonIds)}
        wishlistSlugs={Array.from(wishlistSlugs)}
        hasCertificate={hasCertificate}
        subscribedSlugs={Array.from(subscribedSlugs)}
        reviews={reviews}
        myReview={myReview}
      />
    </>
  );
}
