import { HelpCircle } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { GlassCard } from '@/components/shared/GlassCard';

export const metadata = {
  title: 'Частые вопросы',
  description: 'Ответы на частые вопросы об оплате, доступе к курсам, сертификатах и поддержке Artum Academy.',
};

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Как купить курс и получить доступ?',
    a: 'Зарегистрируйтесь, выберите курс и нажмите «Купить». После оплаты доступ ко всем урокам откроется сразу в личном кабинете.',
  },
  {
    q: 'Какие есть способы оплаты?',
    a: 'Оплата банковской картой и через СБП. Чек по 54-ФЗ формируется автоматически и приходит на вашу почту.',
  },
  {
    q: 'Сколько действует доступ к курсу?',
    a: 'Доступ к купленному курсу — бессрочный. Подписка даёт доступ ко всем курсам на период её действия.',
  },
  {
    q: 'Чем подписка отличается от покупки курса?',
    a: 'Покупка — это один курс навсегда. Подписка — доступ ко всем курсам платформы на месяц или год.',
  },
  {
    q: 'Как получить сертификат?',
    a: 'Сертификат выдаётся автоматически, когда вы пройдёте все уроки курса на 100%. Скачать его можно в разделе «Сертификаты», а его подлинность любой может проверить по номеру на странице «Проверка сертификата».',
  },
  {
    q: 'В каком формате проходят уроки?',
    a: 'Это видеоуроки, которые можно смотреть в любом темпе с любого устройства. Прогресс сохраняется автоматически — продолжите с того места, где остановились.',
  },
  {
    q: 'Можно ли вернуть деньги?',
    a: 'Да, в соответствии с законом о защите прав потребителей. Напишите на support@artumacademy.ru — рассмотрим обращение.',
  },
  {
    q: 'Как связаться с поддержкой?',
    a: 'Напишите на support@artumacademy.ru или в Telegram @artum_academy — отвечаем в рабочие часы по МСК.',
  },
];

export default function FaqPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <div className="text-center">
        <div
          className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"
          aria-hidden
        >
          <HelpCircle className="size-7" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight">Частые вопросы</h1>
        <p className="mt-2 text-sm text-primary-light/70">Не нашли ответ? Напишите на support@artumacademy.ru</p>
      </div>

      <GlassCard className="mt-8 p-2 sm:p-4">
        <Accordion type="single" collapsible className="w-full">
          {FAQ.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="px-4">
              <AccordionTrigger className="text-left text-base">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </GlassCard>
    </div>
  );
}
