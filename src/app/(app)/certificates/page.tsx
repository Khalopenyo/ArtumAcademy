'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Award, Download, ExternalLink, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getCategory } from '@/lib/mock/courses';
import { getAllCoursesEffective, useArtumStore } from '@/lib/store';
import { useCurrentUser } from '@/lib/store/hooks';
import { cn } from '@/lib/utils';

export default function CertificatesPage() {
  const user = useCurrentUser()!;
  const state = useArtumStore();
  const allCourses = useMemo(() => getAllCoursesEffective(state), [state]);
  const myCerts = useMemo(
    () => state.certificates.filter((c) => c.userId === user.id),
    [state.certificates, user.id],
  );

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Мои сертификаты</h1>
        <p className="text-sm text-muted-foreground">
          Сертификаты выдаются автоматически при 100% прохождении курса.
        </p>
      </div>

      {myCerts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {myCerts.map((cert) => {
            const course = allCourses.find((c) => c.slug === cert.courseSlug);
            const category = course ? getCategory(course.category) : null;
            return (
              <article
                key={cert.id}
                id={cert.id}
                className="overflow-hidden rounded-2xl border border-border bg-card course-card-hover"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <div
                    aria-hidden
                    className={cn(
                      'absolute inset-0 bg-gradient-to-br opacity-80',
                      course?.coverGradient ?? 'from-primary via-purple-500 to-fuchsia-500',
                    )}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white">
                    <Award className="size-10 opacity-90" aria-hidden />
                    <div className="text-xs uppercase tracking-[0.2em] opacity-80">
                      Сертификат
                    </div>
                    <div className="line-clamp-2 text-sm font-semibold">
                      {course?.title ?? cert.courseSlug}
                    </div>
                    <div className="mt-2 text-xs opacity-70">{cert.studentName}</div>
                  </div>
                </div>

                <div className="space-y-3 p-5">
                  {category ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        category.tagBgClass,
                        category.tagTextClass,
                      )}
                    >
                      <span aria-hidden>{category.emoji}</span>
                      {category.label}
                    </span>
                  ) : null}
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Номер
                    </div>
                    <div className="mt-1 font-mono text-sm">{cert.verificationNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Выдан
                    </div>
                    <div className="mt-1 text-sm">
                      {new Date(cert.issuedAt).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                    <Button variant="outline" size="sm" className="flex-1" disabled>
                      <Download className="mr-1 size-4" aria-hidden />
                      PDF (позже)
                    </Button>
                    {course ? (
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link href={`/courses/${cert.courseSlug}`}>
                          <ExternalLink className="mr-1 size-4" aria-hidden />К курсу
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="mt-12 flex items-start gap-4 rounded-2xl border border-border bg-card p-6">
        <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="size-6" aria-hidden />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Проверка подлинности</h2>
          <p className="text-sm text-muted-foreground">
            Каждый сертификат имеет уникальный номер — публичная страница верификации
            появится позже.
          </p>
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
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
