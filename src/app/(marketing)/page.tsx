import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { Hero } from '@/components/marketing/Hero';
import { PricingBlock } from '@/components/marketing/PricingBlock';
import { ProgramOutline } from '@/components/marketing/ProgramOutline';

/**
 * Landing page `/` — first visible UI of the product.
 *
 * Composes 4 marketing sections under (marketing)/layout.tsx chrome
 * (Header + Footer from plan-01). UI-SPEC §4.1.
 *
 * Note: metadata (title, description, OG image) is owned by plan-05 (LAND-04 SEO baseline).
 * Replaces the P1 placeholder at src/app/page.tsx.
 */
export default function MarketingHomePage() {
  return (
    <>
      <Hero />
      <ProgramOutline />
      <PricingBlock />
      <FaqAccordion />
    </>
  );
}
