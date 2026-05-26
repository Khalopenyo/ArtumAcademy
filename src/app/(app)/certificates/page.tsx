import { requireUser } from '@/server/queries/auth';
import { getPublishedCourses } from '@/server/queries/catalog';
import { getMyCertificates } from '@/server/queries/commerce';

import { CertificatesClient } from './CertificatesClient';

export default async function CertificatesPage() {
  await requireUser('/certificates');
  const [certificates, courses] = await Promise.all([
    getMyCertificates(),
    getPublishedCourses(),
  ]);
  return <CertificatesClient certificates={certificates} courses={courses} />;
}
