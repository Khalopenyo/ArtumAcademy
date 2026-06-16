'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { Award, Download, ExternalLink, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/artum/CategoryIcon';
import { type Course, getCategory } from '@/lib/mock/courses';
import { downloadCertificatePdf } from '@/lib/pdf/certificate';
import type { CertificateRecord } from '@/server/queries/commerce';
import { cn } from '@/lib/utils';

/**
 * Единая карточка сертификата — используется на /certificates и в профиле
 * (раньше было три разных визуала). Скачивание PDF + проверка на /verify + к курсу.
 */
export function CertificateCard({
  cert,
  course,
}: {
  cert: CertificateRecord;
  course: Course | null;
}) {
  const category = course ? getCategory(course.category) : null;

  async function handleDownload() {
    try {
      await downloadCertificatePdf({
        certificate: cert,
        courseTitle: course?.title ?? cert.courseSlug,
        studentName: cert.studentName,
      });
      toast.success('Сертификат скачан');
    } catch (err) {
      toast.error('Не удалось сгенерировать PDF');
      console.error(err);
    }
  }

  return (
    <article
      id={cert.id}
      className="course-card-hover overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl"
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
          <div className="text-xs uppercase tracking-[0.2em] opacity-80">Сертификат</div>
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
            <CategoryIcon categoryId={category.id} className="size-3.5" />
            {category.label}
          </span>
        ) : null}
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Номер</div>
          <div className="mt-1 font-mono text-sm">{cert.verificationNumber}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Выдан</div>
          <div className="mt-1 text-sm">
            {new Date(cert.issuedAt).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-1 size-4" aria-hidden />
            Скачать PDF
          </Button>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm" className="flex-1">
              <Link href={`/verify/${cert.verificationNumber}`}>
                <ShieldCheck className="mr-1 size-4" aria-hidden />
                Проверить
              </Link>
            </Button>
            {course ? (
              <Button asChild variant="ghost" size="sm" className="flex-1">
                <Link href={`/courses/${cert.courseSlug}`}>
                  <ExternalLink className="mr-1 size-4" aria-hidden />К курсу
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
