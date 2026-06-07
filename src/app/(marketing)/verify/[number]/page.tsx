import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';

import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { verifyCertificateByNumber } from '@/server/queries/commerce';

export const metadata = { title: 'Проверка сертификата' };

export default async function VerifyCertificatePage({ params }: { params: { number: string } }) {
  const number = decodeURIComponent(params.number);
  const cert = await verifyCertificateByNumber(number);

  return (
    <div className="container mx-auto max-w-xl px-4 py-12 sm:py-16">
      <GlassCard glow className="p-8 text-center sm:p-10">
        {cert ? (
          <>
            <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-green-500/15 text-green-400 ring-1 ring-green-500/30">
              <CheckCircle2 className="size-7" aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Сертификат действителен</h1>
            <dl className="mx-auto mt-6 max-w-sm space-y-3 text-left text-sm">
              <Row label="Выдан" value={cert.studentName} />
              <Row label="Курс" value={cert.courseTitle} />
              <Row label="Дата выдачи" value={new Date(cert.issuedAt).toLocaleDateString('ru-RU')} />
              <Row label="Номер" value={cert.verificationNumber} mono />
            </dl>
          </>
        ) : (
          <>
            <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive ring-1 ring-destructive/30">
              <XCircle className="size-7" aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Сертификат не найден</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Сертификата с номером <span className="font-mono text-foreground">{number}</span> не
              существует. Проверьте правильность номера.
            </p>
          </>
        )}
        <Button asChild variant="outline" className="mt-8">
          <Link href="/verify">Проверить другой номер</Link>
        </Button>
      </GlassCard>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-foreground' : 'font-medium text-foreground'}>{value}</dd>
    </div>
  );
}
