import Link from 'next/link';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  MVP_COURSE_PRICE_MINOR,
  MVP_COURSE_SLUG,
} from '@/lib/constants/course';
import { formatPrice } from '@/lib/utils';

const PRICING_FEATURES = [
  '24 урока · около 12 часов видео',
  'Доступ навсегда',
  'Фискальный чек по 54-ФЗ',
] as const;

/**
 * «Стоимость курса» — single-tier card с CTA «Купить».
 *
 * Server Component. UI-SPEC §4.1 — pricing block copy verbatim, bg-secondary section.
 * Anonymous CTA → /register?next=/courses/<MVP_COURSE_SLUG> (universal link in P2;
 * P3 заменит на Server Action checkout flow).
 */
export function PricingBlock() {
  return (
    <section
      aria-labelledby="pricing-title"
      className="bg-secondary/30 py-12 md:py-16"
    >
      <div className="container mx-auto">
        <h2
          id="pricing-title"
          className="text-center text-2xl font-semibold tracking-tight md:text-3xl"
        >
          Стоимость курса
        </h2>
        <Card className="mx-auto mt-8 max-w-md">
          <CardHeader>
            <CardTitle>Полный курс</CardTitle>
            <CardDescription>
              Единоразовый платёж — без подписок и автосписаний
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold">
              {formatPrice(MVP_COURSE_PRICE_MINOR / 100)}
            </div>
            <ul className="mt-6 space-y-2 text-sm">
              {PRICING_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full" size="lg">
              <Link href={`/register?next=/courses/${MVP_COURSE_SLUG}`}>
                Купить
              </Link>
            </Button>
          </CardFooter>
        </Card>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Оплата через ЮKassa — карты Visa, Mastercard, Мир и СБП.
        </p>
      </div>
    </section>
  );
}
