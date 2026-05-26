import { Mail, MessageCircle, Phone, Send } from 'lucide-react';

import { GlassCard } from '@/components/shared/GlassCard';

export const metadata = { title: 'Контакты' };

export default function ContactsPage() {
  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-12">
      <GlassCard glow className="w-full max-w-xl p-10 sm:p-12">
        <div className="text-center">
          <div
            className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"
            aria-hidden
          >
            <MessageCircle className="size-6" />
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">Контакты</h1>
          <p className="mt-2 text-sm text-[#C4A8FF]/70">
            Напишите нам — отвечаем в рабочие часы по МСК.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <ContactRow
            icon={<Mail className="size-5" aria-hidden />}
            label="Email"
            value="hello@artum.academy"
            href="mailto:hello@artum.academy"
          />
          <ContactRow
            icon={<Send className="size-5" aria-hidden />}
            label="Telegram"
            value="@artum_academy"
            href="https://t.me/artum_academy"
            external
          />
          <ContactRow
            icon={<Phone className="size-5" aria-hidden />}
            label="Телефон"
            value="+7 (999) 123-45-67"
            href="tel:+79991234567"
          />
        </div>
      </GlassCard>
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
