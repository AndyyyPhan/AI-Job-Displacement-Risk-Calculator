import { cn } from '../../lib/cn'
import { riskColor } from '../../lib/formatters'

interface Props {
  value: number
  max?: number
  delayMs?: number
  className?: string
  height?: number
  background?: 'ground' | 'accent'
  gradient?: boolean
}

export function Sparkbar({
  value,
  max = 100,
  delayMs = 0,
  className,
  height = 4,
  background = 'ground',
  gradient = true,
}: Props) {
  const pct = Math.max(0, Math.min(1, value / max))
  const accent = riskColor(value)

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-full',
        background === 'ground' ? 'bg-hair-2' : 'bg-accent/10',
        className,
      )}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className="bar-fill absolute inset-y-0 left-0 h-full rounded-full"
        style={{
          width: `${pct * 100}%`,
          background: gradient
            ? `linear-gradient(90deg, var(--color-safe) 0%, var(--color-caution) 55%, ${accent} 100%)`
            : accent,
          animationDelay: `${delayMs}ms`,
          ['--fill' as string]: '1',
        }}
      />
    </div>
  )
}
