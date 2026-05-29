import { FileText, Mail, MessageCircle, Phone, Send, User } from 'lucide-react';

import { GlassCard } from '@/components/shared/GlassCard';

export const metadata = {
  title: 'Контакты и реквизиты',
  description:
    'Контактные данные и реквизиты Исполнителя сервиса Artum Academy. Самозанятый Юнусов Х. Х., ИНН 201402064844.',
};

/**
 * /contacts — публичная страница с реквизитами Исполнителя.
 * Используется ЮKassa-модератором для верификации (поле "Ссылка на
 * страницу с реквизитами" при подключении магазина).
 *
 * ИНН и ФИО должны быть видны на этой странице открыто (требование
 * 152-ФЗ + договор с ЮKassa). Если изменишь рег. форму (например,
 * с самозанятого на ИП) — поправь блок «Реквизиты» ниже.
 */
export default function ContactsPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-10 sm:py-14">
      {/* Контакты */}
      <GlassCard glow className="p-7 sm:p-10">
        <div className="text-center">
          <div
            className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"
            aria-hidden
          >
            <MessageCircle className="size-6" />
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">Контакты</h1>
          <p className="mt-2 text-sm text-[#C4A8FF]/70">
            Напишите — отвечаем в рабочие часы по МСК.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <ContactRow
            icon={<Mail className="size-5" aria-hidden />}
            label="Email"
            value="tkes777@mail.ru"
            href="mailto:tkes777@mail.ru"
          />
          <ContactRow
            icon={<Phone className="size-5" aria-hidden />}
            label="Телефон"
            value="+7 (928) 087-33-32"
            href="tel:+79280873332"
          />
          <ContactRow
            icon={<Send className="size-5" aria-hidden />}
            label="Telegram"
            value="@artum_academy"
            href="https://t.me/artum_academy"
            external
          />
        </div>
      </GlassCard>

      {/* Реквизиты Исполнителя */}
      <GlassCard className="mt-6 p-7 sm:p-10">
        <header className="flex items-start gap-3">
          <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <FileText className="size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Реквизиты Исполнителя</h2>
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
              Юнусов Халид Хаважбаудиевич
            </span>
          </Field>
          <Field label="ИНН">
            <code className="font-mono text-base font-semibold tracking-wider text-foreground">
              201402064844
            </code>
          </Field>
          <Field label="Email">
            <a href="mailto:tkes777@mail.ru" className="text-primary hover:underline">
              tkes777@mail.ru
            </a>
          </Field>
          <Field label="Телефон">
            <a href="tel:+79280873332" className="text-primary hover:underline">
              +7 (928) 087-33-32
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

function ContactRow({
  icon,
  label,
  value,
  href,
  external = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer noopener' : undefined}
      className="flex items-center gap-4 rounded-xl border border-border/50 bg-background/30 p-4 backdrop-blur transition-all hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        {icon}
      </span>
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
      </div>
    </a>
  );
}
