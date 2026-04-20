import { useState } from 'react'
import { cn } from '../lib/cn'
import { Dateline } from './ui/Dateline'
import { Kicker } from './ui/Kicker'

interface Props {
  onSubmit: (jobTitle: string, context: string) => void
}

const EXAMPLES = [
  'Radiologist',
  'Paralegal',
  'Elementary School Teacher',
  'Industrial Designer',
  'Machinist',
]

export function JobInput({ onSubmit }: Props) {
  const [jobTitle, setJobTitle] = useState('')
  const [context, setContext] = useState('')
  const [titleFocused, setTitleFocused] = useState(false)

  const canSubmit = jobTitle.trim().length > 1
  const showContext = jobTitle.trim().length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit(jobTitle, context)
  }

  return (
    <div className="relative">
      <div className="anim-reveal">
        <Kicker index="§" label="An empirical assessment of LLM exposure" />
        <h1
          className="display-serif mt-5 text-[56px] leading-[0.95] text-ink sm:text-[72px] md:text-[92px]"
          style={{ letterSpacing: '-0.028em' }}
        >
          What does <span className="italic font-light text-ink-2">AI</span> mean
          for{' '}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-[0.12em] h-[0.28em]"
              style={{
                background: 'var(--color-highlight)',
                opacity: 0.55,
                transform: 'skewX(-6deg)',
              }}
            />
            <span className="relative">your job</span>
          </span>
          ?
        </h1>
        <p className="mt-6 max-w-[34ch] font-display text-[20px] leading-[1.4] text-ink-2 md:text-[22px]">
          Tell us what you do. We'll return a dossier grounded in published
          research — task-level exposure, a displacement horizon, and a path forward.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="anim-reveal mt-14 space-y-10"
        style={{ animationDelay: '140ms' }}
      >
        {/* Primary input */}
        <div>
          <label htmlFor="job-title" className="block">
            <Dateline>01 · Occupation</Dateline>
          </label>
          <div className="relative mt-4 flex items-center">
            <input
              id="job-title"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              onFocus={() => setTitleFocused(true)}
              onBlur={() => setTitleFocused(false)}
              placeholder="Radiologist"
              autoComplete="off"
              className={cn(
                'w-full border-0 border-b border-hair bg-transparent pb-4 pr-14 font-display text-[32px] text-ink placeholder:text-muted/60',
                'focus:outline-none focus:ring-0 md:text-[44px]',
              )}
              style={{
                letterSpacing: '-0.016em',
                borderBottomColor: titleFocused ? 'var(--color-ink)' : undefined,
                transition: 'border-color 300ms ease',
              }}
            />
            <button
              type="submit"
              disabled={!canSubmit}
              aria-label="Analyze my job"
              className={cn(
                'absolute right-0 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300',
                canSubmit
                  ? 'bg-ink text-panel-2 shadow-[0_6px_20px_-6px_rgba(20,20,25,0.4)] hover:-translate-y-px hover:bg-accent'
                  : 'bg-hair text-muted/60',
              )}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 12h14M13 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] text-muted">
            <span className="uppercase tracking-[0.18em]">Try</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setJobTitle(ex)}
                className="border-b border-hair pb-px text-ink-2 transition-colors hover:border-ink hover:text-ink"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary input — reveals when title is entered */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-500 ease-out',
            showContext
              ? 'max-h-[300px] opacity-100'
              : 'max-h-0 opacity-0',
          )}
        >
          <label htmlFor="context" className="block">
            <Dateline>02 · Context (optional)</Dateline>
          </label>
          <textarea
            id="context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="I work in a hospital setting · mostly remote · heavy client calls · 70% writing briefs…"
            rows={3}
            className={cn(
              'mt-4 w-full resize-none border-0 border-b border-hair bg-transparent pb-4 font-display text-[20px] leading-[1.35] text-ink placeholder:text-muted/60',
              'focus:outline-none focus:ring-0 focus:[border-bottom-color:var(--color-ink)] md:text-[22px]',
            )}
            style={{ letterSpacing: '-0.006em', transition: 'border-color 300ms ease' }}
          />
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            We'll use this to adjust the baseline to your specific role.
          </p>
        </div>

        {/* Sources */}
        <div className="mt-16 grid gap-6 border-t border-hair pt-8 md:grid-cols-3">
          <SourceCredit
            num="01"
            label="Task exposure"
            title="Eloundou et al. 2023"
            detail="GPTs are GPTs — employment-weighted β for every O*NET task."
          />
          <SourceCredit
            num="02"
            label="Observed AI use"
            title="Anthropic Economic Index"
            detail="Massenkoff & McCrory — measured AI coverage in professional work."
          />
          <SourceCredit
            num="03"
            label="Labor market data"
            title="BLS OEWS · Projections 2024–34"
            detail="Wage distribution + government employment forecasts."
          />
        </div>
      </form>
    </div>
  )
}

function SourceCredit({
  num,
  label,
  title,
  detail,
}: {
  num: string
  label: string
  title: string
  detail: string
}) {
  return (
    <div className="space-y-2 border-l border-hair pl-4">
      <div className="flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
        <span className="num text-ink/70">{num}</span>
        <span className="text-muted">{label}</span>
      </div>
      <p className="font-display text-[17px] leading-snug text-ink">{title}</p>
      <p className="text-[12px] leading-snug text-muted">{detail}</p>
    </div>
  )
}
