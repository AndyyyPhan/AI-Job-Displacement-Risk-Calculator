import { cn } from '../../lib/cn'

export type RailPhase = 'intake' | 'match' | 'tasks' | 'analysis' | 'dossier'

interface Props {
  active: RailPhase
  className?: string
}

const PHASES: { key: RailPhase; index: string; label: string }[] = [
  { key: 'intake', index: '01', label: 'Intake' },
  { key: 'match', index: '02', label: 'Match' },
  { key: 'tasks', index: '03', label: 'Tasks' },
  { key: 'analysis', index: '04', label: 'Analysis' },
  { key: 'dossier', index: '05', label: 'Dossier' },
]

export function StepRail({ active, className }: Props) {
  const activeIdx = PHASES.findIndex((p) => p.key === active)
  return (
    <nav aria-label="Progress" className={cn('w-full', className)}>
      <ol className="grid grid-cols-5 gap-2 md:gap-4">
        {PHASES.map((phase, i) => {
          const state: 'done' | 'active' | 'pending' =
            i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending'
          return (
            <li key={phase.key} className="relative">
              <div
                className={cn(
                  'h-[2px] w-full rounded-full transition-colors duration-500',
                  state === 'active'
                    ? 'bg-ink'
                    : state === 'done'
                      ? 'bg-ink/70'
                      : 'bg-hair',
                )}
              />
              <div className="mt-3 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                <span
                  className={cn(
                    'num tabular-nums transition-colors duration-500',
                    state === 'pending' ? 'text-muted/60' : 'text-ink',
                  )}
                >
                  {phase.index}
                </span>
                <span
                  className={cn(
                    'transition-colors duration-500',
                    state === 'active'
                      ? 'text-ink'
                      : state === 'done'
                        ? 'text-ink/70'
                        : 'text-muted/60',
                  )}
                >
                  {phase.label}
                </span>
                {state === 'active' && (
                  <span
                    aria-hidden
                    className="anim-dot ml-auto inline-block h-1 w-1 rounded-full bg-risk"
                  />
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
