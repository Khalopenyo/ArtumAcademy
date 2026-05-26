import { requireAdmin } from '@/server/queries/auth';
import { getAdminUsersList } from '@/server/queries/admin';

import { UsersListClient } from './UsersListClient';

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await getAdminUsersList();
  return <UsersListClient users={users} />;
}
