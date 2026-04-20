import { cn } from '../../lib/cn'

interface Props {
  index?: string
  label: string
  className?: string
  tone?: 'default' | 'inverse'
}

export function Kicker({ index, label, className, tone = 'default' }: Props) {
  const toneClass = tone === 'inverse' ? 'text-panel-2/80' : 'text-muted'
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]',
        toneClass,
        className,
      )}
    >
      {index && (
        <>
          <span className="text-ink/80">{index}</span>
          <span aria-hidden className="mx-1 h-[1px] w-6 bg-hair" />
        </>
      )}
      <span>{label}</span>
    </div>
  )
}
