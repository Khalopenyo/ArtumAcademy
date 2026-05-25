import Link from 'next/link';
import { Mail, Send } from 'lucide-react';

import { Logo } from '@/components/shared/Logo';
import { cn } from '@/lib/utils';

interface FooterProps {
  className?: string;
}

/**
 * Главный футер Artum Academy.
 * Скелетный вариант: бренд + ссылки на категории + контакты.
 * Юридические страницы (/privacy + /oferta) добавятся на этапе 2 после
 * выбора рынка (РФ vs мировой → 152-ФЗ vs GDPR).
 */
export function Footer({ className }: FooterProps) {
  return (
    <footer className={cn('mt-auto border-t border-border bg-card/30', className)}>
      <div className="container mx-auto grid gap-8 py-10 md:grid-cols-4">
        {/* Brand */}
        <div className="space-y-3 md:col-span-2">
          <Logo className="text-lg" />
          <p className="max-w-md text-sm text-muted-foreground">
            Онлайн-курсы по нейросетям, фото, видео, монтажу, дизайну, визуалу
            и копирайтингу. От профессионалов — для тех, кто учится новому.
          </p>
        </div>

        {/* Categories */}
        <div>
          <div className="text-sm font-semibold text-foreground">Категории</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li><FooterLink href="/?category=ai">AI / Нейросети</FooterLink></li>
            <li><FooterLink href="/?category=photo">Фото</FooterLink></li>
            <li><FooterLink href="/?category=video">Видео</FooterLink></li>
            <li><FooterLink href="/?category=editing">Монтаж</FooterLink></li>
            <li><FooterLink href="/?category=design">Дизайн</FooterLink></li>
            <li><FooterLink href="/?category=visual">Визуал</FooterLink></li>
            <li><FooterLink href="/?category=copy">Копирайтинг</FooterLink></li>
          </ul>
        </div>

        {/* Contacts */}
        <div>
          <div className="text-sm font-semibold text-foreground">Связаться</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                href="mailto:hello@artum.academy"
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="size-4" aria-hidden />
                hello@artum.academy
              </a>
            </li>
            <li>
              <a
                href="https://t.me/artum_academy"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Send className="size-4" aria-hidden />
                @artum_academy
              </a>
            </li>
            <li className="pt-3">
              <Link
                href="/subscribe"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Подписка
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                О платформе
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 py-4 text-xs text-muted-foreground md:flex-row">
          <span>© 2026 Artum Academy. Скелет сайта (этап 1 ТЗ §9).</span>
          <span className="opacity-70">Юридические страницы появятся на этапе 2.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  );
}
