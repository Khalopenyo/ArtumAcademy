import type { Metadata } from 'next';

import { LegalDocPage } from '@/components/shared/LegalDocPage';
import { Privacy_v1_0_draft } from '@/content/privacy';

export const metadata: Metadata = {
  title: 'Политика обработки персональных данных',
  description:
    'Политика обработки персональных данных VideoEdit Academy в соответствии с Федеральным законом 152-ФЗ',
  robots: { index: true, follow: false },
};

export default function PrivacyPage() {
  return (
    <LegalDocPage>
      <Privacy_v1_0_draft />
    </LegalDocPage>
  );
}
