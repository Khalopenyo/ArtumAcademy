import { cn } from '@/lib/utils';

interface GlassCardProps {
  className?: string;
  /** Подсветка (subtle aurora glow за карточкой) */
  glow?: boolean;
  children: React.ReactNode;
}

/**
 * Полупрозрачная карточка с blur и фиолетовым акцентом —
 * базовый строительный блок космической темы Artum.
 *
 * Использование:
 *   <GlassCard className="p-6">...</GlassCard>
 *   <GlassCard glow className="p-8">...</GlassCard>
 */
export function GlassCard({ className, glow = false, children }: GlassCardProps) {
  return (
    <div className="relative">
      {glow ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px -z-10 rounded-2xl opacity-60 blur-2xl"
          style={{
            background:
              'radial-gradient(circle at 30% 0%, rgba(168, 85, 247, 0.25), transparent 60%),' +
              'radial-gradient(circle at 70% 100%, rgba(196, 168, 255, 0.15), transparent 60%)',
          }}
        />
      ) : null}
      <div
        className={cn(
          'relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
