import { CasesPageClient } from '@/components/artum/CasesPageClient';
import { getPublishedCases } from '@/server/queries/cases';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Кейсы студентов',
  description:
    'Истории и проекты студентов Artum Academy: чему научились и каких результатов достигли.',
};

export default async function CasesPage() {
  const cases = await getPublishedCases();
  return <CasesPageClient cases={cases} />;
}
