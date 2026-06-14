'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { CaseForm } from '@/components/artum/CaseForm';

export default function AdminNewCasePage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <Link
        href="/admin/cases"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        К списку кейсов
      </Link>

      <h1 className="mb-6 text-3xl font-bold tracking-tight">Новый кейс</h1>

      <CaseForm />
    </div>
  );
}
