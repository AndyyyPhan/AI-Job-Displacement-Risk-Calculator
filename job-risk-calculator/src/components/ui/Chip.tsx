import { cn } from '../../lib/cn'

type Tone = 'ink' | 'muted' | 'safe' | 'caution' | 'warn' | 'risk' | 'accent'

interface Props {
  children: React.ReactNode
  tone?: Tone
  glyph?: string
  size?: 'sm' | 'md'
  className?: string
}

const TONE_CLASS: Record<Tone, string> = {
  ink: 'border-hair bg-panel-2 text-ink',
  muted: 'border-hair bg-panel text-muted',
  safe: 'border-safe/40 bg-safe/10 text-safe',
  caution: 'border-caution/40 bg-caution/10 text-warn',
  warn: 'border-warn/50 bg-warn/10 text-warn',
  risk: 'border-risk/40 bg-risk/10 text-risk',
  accent: 'border-accent/50 bg-accent/10 text-accent',
}

export function Chip({ children, tone = 'ink', glyph, size = 'sm', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[2px] border font-mono uppercase tracking-[0.14em]',
        size === 'sm' ? 'px-2 py-[2px] text-[10px]' : 'px-2.5 py-1 text-[11px]',
        TONE_CLASS[tone],
        className,
      )}
    >
      {glyph && <span aria-hidden className="-mt-[1px]">{glyph}</span>}
      <span>{children}</span>
    </span>
  )
}
