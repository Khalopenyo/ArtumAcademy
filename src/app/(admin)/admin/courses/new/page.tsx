import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { CourseForm } from '@/components/artum/CourseForm';

export default function AdminNewCoursePage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <Link
        href="/admin/courses"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        К списку курсов
      </Link>

      <h1 className="mb-6 text-3xl font-bold tracking-tight">Новый курс</h1>

      <CourseForm />
    </div>
  );
}
