import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { CaseForm } from '@/components/artum/CaseForm';
import { getCaseByIdForAdmin } from '@/server/queries/cases';

export const dynamic = 'force-dynamic';

export default async function AdminEditCasePage({ params }: { params: { id: string } }) {
  const caseItem = await getCaseByIdForAdmin(params.id);
  if (!caseItem) notFound();

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <Link
        href="/admin/cases"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        К списку кейсов
      </Link>

      <h1 className="mb-6 text-3xl font-bold tracking-tight">Редактировать кейс</h1>

      <CaseForm initial={caseItem} />
    </div>
  );
}
