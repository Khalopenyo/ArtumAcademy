import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { SubscriptionPlanForm } from '@/components/artum/SubscriptionPlanForm';
import { getAllCoursesForAdmin } from '@/server/queries/catalog';

export const dynamic = 'force-dynamic';

export default async function AdminNewPlanPage() {
  const courses = await getAllCoursesForAdmin();
  const options = courses.map((c) => ({ id: c.id, title: c.title }));

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <Link
        href="/admin/subscription-plans"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        К планам подписки
      </Link>

      <h1 className="mb-6 text-3xl font-bold tracking-tight">Новый план подписки</h1>

      <SubscriptionPlanForm allCourses={options} />
    </div>
  );
}
