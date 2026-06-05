import Link from 'next/link';
import { Send } from 'lucide-react';

import { cn } from '@/lib/utils';

interface FooterProps {
  className?: string;
}

/**
 * Footer по макету artum_academy_homepage_cosmic — 5 колонок:
 *   1) бренд + слоган + соцсети (Telegram / VK)
 *   2) Главная: ссылки на разделы
 *   3) Курсы: ссылки на категории
 *   4) Кейсы: проекты / отзывы (заглушки)
 *   5) Контакты: email + телефон
 */
export function Footer({ className }: FooterProps) {
  return (
    <footer className={cn('mt-auto border-t border-border/40 bg-[#06040F]/60 backdrop-blur-md', className)}>
      <div className="container mx-auto grid gap-6 px-4 py-8 sm:px-9 md:grid-cols-[1.5fr_1fr_1fr_1fr_1.2fr]">
        {/* Бренд */}
        <div className="space-y-3">
          <div className="text-[14px] font-bold tracking-[0.04em]">
            <span className="text-primary">ARTUM</span>{' '}
            <span className="text-foreground">Academy</span>
          </div>
          <p className="max-w-xs text-[10px] leading-relaxed text-muted-foreground/80">
            Онлайн-платформа видеокурсов по креативным навыкам и цифровым инструментам.
          </p>
          <div className="flex gap-2 pt-1">
            <a
              href="https://t.me/artum_academy"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Telegram"
              className="inline-flex size-7 items-center justify-center rounded-md bg-card/60 text-muted-foreground transition-all hover:bg-primary/20 hover:text-[#C4A8FF]"
            >
              <Send className="size-3.5" aria-hidden />
            </a>
            <a
              href="https://vk.com/artum_academy"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="VK"
              className="inline-flex size-7 items-center justify-center rounded-md bg-card/60 text-[11px] font-bold text-muted-foreground transition-all hover:bg-primary/20 hover:text-[#C4A8FF]"
            >
              VK
            </a>
          </div>
        </div>

        {/* Главная */}
        <FooterColumn title="Главная">
          <FooterLink href="/">Все курсы</FooterLink>
          <FooterLink href="/?category=ai">Нейросети</FooterLink>
          <FooterLink href="/?category=photo">Фотография</FooterLink>
          <FooterLink href="/?category=video">Видео</FooterLink>
        </FooterColumn>

        {/* Курсы */}
        <FooterColumn title="Курсы">
          <FooterLink href="/?category=editing">Монтаж</FooterLink>
          <FooterLink href="/?category=design">Дизайн</FooterLink>
          <FooterLink href="/?category=visual">Визуал</FooterLink>
          <FooterLink href="/?category=copy">Копирайтинг</FooterLink>
        </FooterColumn>

        {/* Кейсы */}
        <FooterColumn title="Кейсы">
          <FooterLink href="/cases">Наши проекты</FooterLink>
          <FooterLink href="/cases#reviews">Отзывы</FooterLink>
        </FooterColumn>

        {/* Контакты */}
        <div>
          <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Контакты
          </h4>
          <p className="text-[11px] text-primary">ramzan.aliev.97@mail.ru</p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">+7 (938) 994-45-99</p>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/60">
            Самозанятый Абдулкадыров Я. Д.<br />
            ИНН 201302285050
          </p>
        </div>
      </div>

      {/* Юр-бар */}
      <div className="border-t border-border/30">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-3 text-[10px] text-muted-foreground/70 sm:flex-row sm:px-9">
          <span>© 2026 Artum Academy. Все права защищены.</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="transition-colors hover:text-[#C4A8FF]">
              Политика конфиденциальности
            </Link>
            <Link href="/oferta" className="transition-colors hover:text-[#C4A8FF]">
              Оферта
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h4>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-[11px] text-muted-foreground/70 transition-colors hover:text-[#C4A8FF]"
      >
        {children}
      </Link>
    </li>
  );
}
