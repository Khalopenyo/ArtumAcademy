import { Check } from 'lucide-react';

const PROGRAM_ITEMS = [
  'DaVinci Resolve с нуля — установка, интерфейс, рабочий процесс',
  'Цветокоррекция и грейдинг для разных типов видео',
  'Звук: чистка, эквалайзер, музыкальное сопровождение',
  'Графика, титры и базовый motion-дизайн',
  'Экспорт под YouTube, Reels, TikTok и заказчиков',
] as const;

/**
 * «Что вы освоите» — 5 bullets с check-иконками.
 *
 * Server Component. UI-SPEC §4.1 — program section copy verbatim.
 */
export function ProgramOutline() {
  return (
    <section
      aria-labelledby="program-title"
      className="bg-background py-12 md:py-16"
    >
      <div className="container mx-auto">
        <h2
          id="program-title"
          className="text-2xl font-semibold tracking-tight md:text-3xl"
        >
          Что вы освоите
        </h2>
        <ul className="mt-6 max-w-2xl space-y-3">
          {PROGRAM_ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-3 text-base">
              <Check
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
