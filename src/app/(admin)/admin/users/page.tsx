import { requireAdmin } from '@/server/queries/auth';
import { getAdminUsersList } from '@/server/queries/admin';
import { getAllCoursesForAdmin } from '@/server/queries/catalog';

import { UsersListClient } from './UsersListClient';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  await requireAdmin();
  const [users, courses] = await Promise.all([getAdminUsersList(), getAllCoursesForAdmin()]);
  const courseOptions = courses.map((c) => ({ slug: c.slug, title: c.title }));
  return <UsersListClient users={users} courses={courseOptions} />;
}
