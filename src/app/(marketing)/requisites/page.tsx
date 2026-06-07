import { FileText, User } from 'lucide-react';

import { GlassCard } from '@/components/shared/GlassCard';

export const metadata = {
  title: 'Реквизиты',
  description: 'Реквизиты Исполнителя сервиса Artum Academy.',
};

/**
 * /requisites — реквизиты Исполнителя на отдельной странице (ссылка в футере).
 * Используется ЮKassa-модератором (поле «Ссылка на страницу с реквизитами»).
 * ИНН/ФИО открыто — требование 152-ФЗ + договор с ЮKassa. При смене рег. формы
 * (самозанятый → ИП) поправь блок ниже.
 */
export default function RequisitesPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <GlassCard glow className="p-7 sm:p-10">
        <header className="flex items-start gap-3">
          <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <FileText className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Реквизиты Исполнителя</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Информация для договора и юридически значимой переписки.
            </p>
          </div>
        </header>

        <dl className="mt-6 divide-y divide-border/40 text-sm">
          <Field label="Статус">
            Самозанятый — плательщик налога на профессиональный доход (НПД)
          </Field>
          <Field label="ФИО">
            <span className="inline-flex items-center gap-2">
              <User className="size-4 text-muted-foreground" aria-hidden />
              Абдулкадыров Ясин Дагаевич
            </span>
          </Field>
          <Field label="ИНН">
            <code className="font-mono text-base font-semibold tracking-wider text-foreground">
              201302285050
            </code>
          </Field>
          <Field label="Email">
            <a href="mailto:support@artumacademy.ru" className="text-primary hover:underline">
              support@artumacademy.ru
            </a>
          </Field>
          <Field label="Телефон">
            <a href="tel:+79389944599" className="text-primary hover:underline">
              +7 (938) 994-45-99
            </a>
          </Field>
          <Field label="Сайт">
            <a href="https://artumacademy.ru" className="text-primary hover:underline">
              artumacademy.ru
            </a>
          </Field>
        </dl>

        <p className="mt-6 text-xs text-muted-foreground">
          Чек по 54-ФЗ за каждую покупку формирует приложение «Мой налог» и
          направляется на email Покупателя.
        </p>
      </GlassCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
      <dt className="w-32 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}
