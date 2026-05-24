import type { Metadata } from 'next';

import { LegalDocPage } from '@/components/shared/LegalDocPage';
import { Oferta_v1_0_draft } from '@/content/oferta';

export const metadata: Metadata = {
  title: 'Публичная оферта',
  description:
    'Публичная оферта VideoEdit Academy — условия предоставления доступа к платным образовательным курсам',
  robots: { index: true, follow: false },
};

export default function OfertaPage() {
  return (
    <LegalDocPage>
      <Oferta_v1_0_draft />
    </LegalDocPage>
  );
}
