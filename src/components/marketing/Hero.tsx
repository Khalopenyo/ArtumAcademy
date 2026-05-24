import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MVP_COURSE_SLUG } from '@/lib/constants/course';

/**
 * Landing hero — H1 display + lead + primary CTA → /courses/<MVP_COURSE_SLUG>.
 *
 * Server Component. UI-SPEC §4.1 (hero copy verbatim) + §6.2 (mobile-first sizing).
 * UI-SPEC §10.6 — text-only hero (no illustration in M1).
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="bg-background py-16 md:py-24 lg:py-32"
    >
      <div className="container mx-auto max-w-4xl">
        <h1
          id="hero-title"
          className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
        >
          Профессиональный монтаж видео — за 8 недель
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Авторский курс с разбором реальных проектов. DaVinci Resolve, цветокор,
          звук и графика — от первого реза до экспорта.
        </p>
        <div className="mt-8">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={`/courses/${MVP_COURSE_SLUG}`}>
              Подробнее о курсе
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
