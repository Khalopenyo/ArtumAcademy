import { getAllCoursesForAdmin } from '@/server/queries/catalog';

import AdminCoursesClient from './AdminCoursesClient';

/**
 * Список курсов в админке (Server Component).
 * Тянет ВСЕ курсы (включая черновики), передаёт в Client UI с фильтрами и delete.
 */
export const dynamic = 'force-dynamic'; // админ всегда видит свежие данные

export default async function AdminCoursesListPage() {
  const courses = await getAllCoursesForAdmin();
  return <AdminCoursesClient initialCourses={courses} />;
}
