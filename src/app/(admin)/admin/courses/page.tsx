import { getPublishedCourses } from '@/server/queries/catalog';

import AdminCoursesClient from './AdminCoursesClient';

/**
 * Список курсов в админке (Server Component).
 * Тянет каталог из Supabase, передаёт в Client UI с фильтрами и delete.
 */
export const dynamic = 'force-dynamic'; // админ всегда видит свежие данные

export default async function AdminCoursesListPage() {
  const courses = await getPublishedCourses();
  return <AdminCoursesClient initialCourses={courses} />;
}
