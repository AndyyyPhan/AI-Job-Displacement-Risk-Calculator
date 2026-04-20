import { useEffect, useState } from 'react'
import { cn } from '../lib/cn'
import { Dateline } from './ui/Dateline'
import { Kicker } from './ui/Kicker'

type Phase = 'research' | 'score' | 'advise'

interface Props {
  phase: Phase
  jobTitle?: string
}

interface LedgerLine {
  code: string
  headline: string
  detail: string
  activity: string[]
}

const LEDGER: LedgerLine[] = [
  {
    code: '01',
    headline: 'Cross-referencing O*NET taxonomy',
    detail: '1,016 occupations · 16,700 tasks · 35 skill families',
    activity: [
      'Fuzzy-matching against alt-titles',
      'Loading core tasks & high-importance skills',
      'Joining Eloundou β · Economic Index · BLS OEWS',
    ],
  },
  {
    code: '02',
    headline: 'Adjusting empirical baseline for your role',
    detail: 'Eloundou exposure × Economic Index × wage tier × BLS growth',
    activity: [
      'Weighing task-level β against bottleneck dimensions',
      'Resolving API-migration signals',
      'Scoring augmentation ↔ automation spectrum',
    ],
  },
  {
    code: '03',
    headline: 'Composing reskilling playbook',
    detail: 'Meta-skills · transferable competencies · verified resources',
    activity: [
      'Ranking adjacent lower-risk occupations',
      'Filtering resource registry by SOC group',
      'Pairing pathways to your transferable skills',
    ],
  },
]

const PHASE_INDEX: Record<Phase, number> = {
  research: 0,
  score: 1,
  advise: 2,
}

export function LoadingState({ phase, jobTitle }: Props) {
  const activeIndex = PHASE_INDEX[phase]
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1700)
    return () => window.clearInterval(id)
  }, [])

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const id = window.setInterval(() => {
      setElapsed(Math.floor((performance.now() - start) / 1000))
    }, 250)
    return () => window.clearInterval(id)
  }, [phase])

  return (
    <div className="anim-fade mx-auto max-w-2xl py-6">
      <div className="mb-10 flex items-center justify-between gap-4">
        <Dateline rule>System · Running · Phase {LEDGER[activeIndex].code}</Dateline>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          <span className="num">{String(elapsed).padStart(2, '0')}s</span>
        </span>
      </div>

      <div>
        <Kicker label={jobTitle ? `Assessing · ${jobTitle}` : 'Preparing assessment'} />
        <h2
          className="display-serif mt-4 text-[42px] leading-[1.05] text-ink md:text-[52px]"
          style={{ letterSpacing: '-0.02em' }}
        >
          {phaseHeadline(phase)}
        </h2>
      </div>

      <ol className="mt-12 space-y-10">
        {LEDGER.map((line, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending'
          const subline = line.activity[tick % line.activity.length]
          return (
            <li
              key={line.code}
              className={cn(
                'relative flex gap-6 border-l pl-6 transition-all duration-500',
                state === 'done'
                  ? 'border-hair opacity-50'
                  : state === 'active'
                    ? 'border-ink'
                    : 'border-hair opacity-30',
              )}
            >
              <div className="absolute -left-[7px] top-[6px]">
                <div
                  className={cn(
                    'h-[12px] w-[12px] rounded-full transition-all duration-500',
                    state === 'done'
                      ? 'bg-ink/60'
                      : state === 'active'
                        ? 'bg-risk anim-glow shadow-[0_0_16px_var(--color-risk)]'
                        : 'bg-transparent ring-1 ring-hair',
                  )}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-3 font-mono text-[10px] uppercase tracking-[0.22em]">
                  <span className="num text-ink/70">{line.code}</span>
                  <span className="h-[1px] w-6 bg-hair" aria-hidden />
                  <span
                    className={cn(
                      state === 'done'
                        ? 'text-muted line-through decoration-hair'
                        : state === 'active'
                          ? 'text-ink'
                          : 'text-muted',
                    )}
                  >
                    {state === 'done' ? 'Complete' : state === 'active' ? 'In progress' : 'Queued'}
                  </span>
                </div>
                <p
                  className={cn(
                    'mt-2 font-display text-[22px] leading-[1.2] md:text-[26px]',
                    state === 'done' ? 'text-muted' : 'text-ink',
                  )}
                  style={{ letterSpacing: '-0.012em' }}
                >
                  {line.headline}
                </p>
                <p className="mt-2 font-mono text-[11px] tracking-[0.08em] text-muted">
                  {line.detail}
                </p>
                {state === 'active' && (
                  <p className="mt-4 flex min-h-[1.4em] items-baseline font-mono text-[12px] text-ink-2">
                    <span className="anim-caret">
                      <span key={subline} className="anim-fade">
                        {subline}
                      </span>
                    </span>
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function phaseHeadline(phase: Phase): string {
  switch (phase) {
    case 'research':
      return 'Assembling the empirical record.'
    case 'score':
      return 'Reasoning through your specific task mix.'
    case 'advise':
      return 'Charting safer adjacent pathways.'
  }
}
