import { notFound } from 'next/navigation';

import { getCourseBySlugForAdmin } from '@/server/queries/catalog';

import { EditCoursePageClient } from './EditCoursePageClient';

/**
 * Admin: edit course (Server Component).
 * Тянет курс с nested modules/lessons (включая черновики), передаёт в Client UI.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
}

export default async function AdminEditCoursePage({ params }: PageProps) {
  const course = await getCourseBySlugForAdmin(params.slug);
  if (!course) notFound();
  return <EditCoursePageClient course={course} />;
}
