import { getAllCasesForAdmin } from '@/server/queries/cases';

import { AdminCasesClient } from './AdminCasesClient';

/**
 * Список кейсов в админке (Server Component).
 * Тянет ВСЕ кейсы (включая черновики), отдаёт в Client UI с фильтром и delete.
 */
export const dynamic = 'force-dynamic';

export default async function AdminCasesListPage() {
  const cases = await getAllCasesForAdmin();
  return <AdminCasesClient initialCases={cases} />;
}
