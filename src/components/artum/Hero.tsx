import Link from 'next/link';
import { Eye, Play, Sparkles } from 'lucide-react';

interface HeroProps {
  /** null = гость; иначе показываем personalized greeting */
  userFirstName: string | null;
}

/**
 * Большой hero-блок на главной — фиолетовый градиент с орбами,
 * слоганом и двумя CTA. Дизайн по макету artum_academy_homepage_cosmic.
 */
export function Hero({ userFirstName }: HeroProps) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-primary/15 px-7 py-10 sm:px-12 sm:py-14"
      style={{
        background:
          'linear-gradient(135deg, #1E1235 0%, #2D1B52 35%, #1A1035 70%, #0D0D0F 100%)',
      }}
    >
      {/* Декоративные орбы */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 size-56"
        style={{
          background: 'radial-gradient(circle, rgba(168,85,247,0.35), transparent 65%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 left-[8%] size-48"
        style={{
          background: 'radial-gradient(circle, rgba(196,168,255,0.18), transparent 65%)',
        }}
      />

      <div className="relative max-w-2xl">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C4A8FF]">
          <Sparkles className="size-3.5" aria-hidden />
          {userFirstName ? `Привет, ${userFirstName}` : 'Онлайн-академия'}
        </span>
        <h1 className="mt-4 text-2xl font-extrabold leading-[1.15] tracking-tight sm:text-4xl">
          Создавай. Снимай.
          <br />
          <span className="bg-gradient-to-r from-[#E8DEFF] to-primary bg-clip-text text-transparent">
            Монетизируй навыки.
          </span>
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#C4A8FF]/75 sm:text-base">
          Видеокурсы по нейросетям, фото, видео, монтажу, дизайну, визуалу
          и копирайтингу — от практиков индустрии.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {userFirstName ? (
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Play className="size-4" fill="currentColor" aria-hidden />
              Продолжить обучение
            </Link>
          ) : (
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Play className="size-4" fill="currentColor" aria-hidden />
              Начать обучение
            </Link>
          )}
          <a
            href="#catalog"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-transparent px-5 py-2.5 text-sm font-medium text-[#C4A8FF] transition-all hover:border-primary hover:text-white"
          >
            <Eye className="size-4" aria-hidden />
            Смотреть каталог
          </a>
        </div>
      </div>
    </section>
  );
}
