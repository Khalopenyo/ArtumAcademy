import { notFound } from 'next/navigation';

import { getCourseBySlugFromDb } from '@/server/queries/catalog';

import EditCoursePageClient from './EditCoursePageClient';

/**
 * Admin: edit course (Server Component).
 * Тянет курс с nested modules/lessons из Supabase, передаёт в Client UI.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
}

export default async function AdminEditCoursePage({ params }: PageProps) {
  const course = await getCourseBySlugFromDb(params.slug);
  if (!course) notFound();
  return <EditCoursePageClient course={course} />;
}
