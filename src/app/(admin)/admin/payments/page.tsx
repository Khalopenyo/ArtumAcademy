import { getAdminPayments } from '@/server/queries/admin';

import { AdminPaymentsClient } from './AdminPaymentsClient';

/**
 * Админ: платежи/заказы (Server Component).
 * Тянет последние транзакции (включая pending/refunded), передаёт в Client UI.
 */
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Платежи' };

export default async function AdminPaymentsPage() {
  const payments = await getAdminPayments();
  return <AdminPaymentsClient payments={payments} />;
}
