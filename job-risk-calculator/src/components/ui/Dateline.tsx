import { cn } from '../../lib/cn'

interface Props {
  children: React.ReactNode
  rule?: boolean
  className?: string
  tone?: 'default' | 'inverse' | 'ink'
}

export function Dateline({
  children,
  rule = false,
  className,
  tone = 'default',
}: Props) {
  const toneClass =
    tone === 'inverse'
      ? 'text-panel-2/80'
      : tone === 'ink'
        ? 'text-ink'
        : 'text-muted'
  return (
    <div
      className={cn(
        'flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em]',
        toneClass,
        className,
      )}
    >
      <span className="whitespace-nowrap">{children}</span>
      {rule && (
        <span
          aria-hidden
          className={cn(
            'h-px flex-1',
            tone === 'inverse' ? 'bg-panel-2/30' : 'bg-hair',
          )}
        />
      )}
    </div>
  )
}
