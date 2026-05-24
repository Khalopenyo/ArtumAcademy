import Link from 'next/link';
import { Mail, Send } from 'lucide-react';

import { Logo } from '@/components/shared/Logo';
import { cn } from '@/lib/utils';

interface FooterProps {
  className?: string;
}

/**
 * Public marketing footer — three columns: brand + docs + contacts.
 * Server Component (no interactivity).
 *
 * UI-SPEC §3.3 + §9.4 — Footer pattern with 152-ФЗ legal links + ИП реквизиты placeholder.
 * RESEARCH §Code Examples §Footer — mandatory /privacy + /oferta + contacts links.
 * [TODO: юрист-ревью P7] markers visible in source AND on page per UI-SPEC §0 drafts marker rule.
 */
export function Footer({ className }: FooterProps) {
  return (
    <footer className={cn('mt-auto border-t bg-secondary/30', className)}>
      <div className="container mx-auto grid gap-6 py-8 md:grid-cols-3 md:py-10">
        {/* Brand + copyright + ИП реквизиты */}
        <div className="space-y-3">
          <Logo className="text-base" />
          <p className="text-sm text-muted-foreground">© 2026 VideoEdit Academy</p>
          <p className="text-xs text-muted-foreground">
            ИП ФИО · ИНН ХХХХХХХХХХХХ · ОГРНИП ХХХХХХХХХХХХХХХ {/* [TODO: юрист-ревью P7 — реквизиты ИП] */}
          </p>
        </div>

        {/* Documents (152-ФЗ + ЗоЗПП) */}
        <div>
          <div className="text-sm font-semibold">Документы</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link
                href="/privacy"
                className="text-muted-foreground transition-colors hover:text-foreground hover:underline underline-offset-4"
              >
                Политика конфиденциальности
              </Link>
            </li>
            <li>
              <Link
                href="/oferta"
                className="text-muted-foreground transition-colors hover:text-foreground hover:underline underline-offset-4"
              >
                Публичная оферта
              </Link>
            </li>
          </ul>
        </div>

        {/* Contacts */}
        <div>
          <div className="text-sm font-semibold">Контакты</div>
          <ul className="mt-2 space-y-2 text-sm">
            <li>
              <a
                href="mailto:support@videoedit-academy.ru"
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Написать на email поддержки"
              >
                <Mail className="size-4" aria-hidden />
                <span>support@videoedit-academy.ru</span>
              </a>
            </li>
            <li>
              <a
                href="https://t.me/videoedit_academy"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Открыть Telegram-канал (новая вкладка)"
              >
                <Send className="size-4" aria-hidden />
                <span>@videoedit_academy</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
