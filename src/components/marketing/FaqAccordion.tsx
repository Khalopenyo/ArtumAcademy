'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/**
 * 7 Russian Q&A — UI-SPEC §4.1 Q1-Q7 verbatim. Q5 keeps the visible
 * `[TODO: юрист-ревью wording]` marker per spec convention.
 */
const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'q-0',
    question: 'Сколько длится курс и сколько уделять времени?',
    answer:
      '24 урока — около 12 часов видео. В удобном темпе 1-2 часа в неделю — за 8 недель пройдёте полностью.',
  },
  {
    id: 'q-1',
    question: 'Какое нужно ПО?',
    answer:
      'DaVinci Resolve — бесплатная версия покрывает 95% курса. Платный Studio только если планируете коммерческий монтаж.',
  },
  {
    id: 'q-2',
    question: 'Как происходит оплата?',
    answer:
      'Через ЮKassa: карты Мир, Visa, Mastercard и СБП. Фискальный чек по 54-ФЗ приходит на email сразу после оплаты.',
  },
  {
    id: 'q-3',
    question: 'Можно вернуть деньги?',
    answer:
      'Да, в течение 14 дней, если урок ещё не начат. Подробности — в Публичной оферте.',
  },
  {
    id: 'q-4',
    question: 'Получу ли я сертификат?',
    answer:
      'В MVP-версии — нет. Это образовательный контент, не лицензированная программа. [TODO: юрист-ревью wording]',
  },
  {
    id: 'q-5',
    question: 'Можно скачать уроки?',
    answer:
      'Нет — видео защищены и доступны только в плеере на сайте после покупки. Это защищает контент и сохраняет цену курса для всех.',
  },
  {
    id: 'q-6',
    question: 'С какого устройства смотреть?',
    answer:
      'С любого: телефон, планшет, ноутбук. Сайт адаптирован под мобильный.',
  },
];

/**
 * FAQ accordion — 7 Russian Q&A, one open at a time.
 *
 * Client Component (Radix Accordion использует React state). UI-SPEC §4.1 FAQ-секция.
 */
export function FaqAccordion() {
  return (
    <section
      aria-labelledby="faq-title"
      className="container mx-auto py-12 md:py-16"
    >
      <h2
        id="faq-title"
        className="text-2xl font-semibold tracking-tight md:text-3xl"
      >
        Частые вопросы
      </h2>
      <Accordion
        type="single"
        collapsible
        className="mt-6 max-w-3xl"
      >
        {FAQ_ITEMS.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger className="text-left">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
