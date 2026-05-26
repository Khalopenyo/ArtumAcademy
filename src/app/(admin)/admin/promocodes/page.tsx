import { requireAdmin } from '@/server/queries/auth';
import { getAdminPromocodes } from '@/server/queries/admin';

import { PromocodesClient } from './PromocodesClient';

export default async function AdminPromocodesPage() {
  await requireAdmin();
  const promocodes = await getAdminPromocodes();
  return <PromocodesClient promocodes={promocodes} />;
}
