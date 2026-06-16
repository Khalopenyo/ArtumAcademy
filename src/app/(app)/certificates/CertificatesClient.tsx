'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Award, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CertificateCard } from '@/components/artum/CertificateCard';
import type { Course } from '@/lib/mock/courses';
import type { CertificateRecord } from '@/server/queries/commerce';

interface CertificatesClientProps {
  certificates: CertificateRecord[];
  courses: Course[];
}

export function CertificatesClient({ certificates, courses }: CertificatesClientProps) {
  const courseBySlug = useMemo(() => {
    const m = new Map<string, Course>();
    for (const c of courses) m.set(c.slug, c);
    return m;
  }, [courses]);

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Мои сертификаты</h1>
        <p className="text-sm text-muted-foreground">
          Сертификаты выдаются автоматически при 100% прохождении курса.
        </p>
      </div>

      {certificates.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <CertificateCard
              key={cert.id}
              cert={cert}
              course={courseBySlug.get(cert.courseSlug) ?? null}
            />
          ))}
        </div>
      )}

      <section className="mt-12 flex items-start gap-4 rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl">
        <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="size-6" aria-hidden />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Проверка подлинности</h2>
          <p className="text-sm text-muted-foreground">
            У каждого сертификата уникальный номер. Подлинность можно проверить на публичной
            странице по кнопке «Проверить» на карточке (или по QR-коду в самом PDF).
          </p>
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/60 bg-card/40 p-12 text-center backdrop-blur">
      <div className="inline-flex items-center justify-center rounded-2xl bg-secondary p-4 text-muted-foreground">
        <Award className="size-10" aria-hidden />
      </div>
      <div>
        <h3 className="text-base font-semibold">Пока нет сертификатов</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Завершите любой купленный курс на 100%, и сертификат появится здесь
          автоматически.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Каталог курсов</Link>
      </Button>
    </div>
  );
}
