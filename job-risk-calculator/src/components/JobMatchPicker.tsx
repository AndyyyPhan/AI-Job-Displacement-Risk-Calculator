import { useState } from 'react'
import { Chip } from './ui/Chip'
import { Kicker } from './ui/Kicker'
import { cn } from '../lib/cn'
import type { OnetOccupation } from '../lib/onet'
import type { JobCandidate } from '../types'

interface Props {
  query: string
  candidates: JobCandidate[]
  onSelect: (occupation: OnetOccupation) => void
  onBack: () => void
}

export function JobMatchPicker({ query, candidates, onSelect, onBack }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  return (
    <div className="anim-reveal">
      <button
        type="button"
        onClick={onBack}
        className="mb-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-ink"
      >
        <span aria-hidden>←</span> Start over
      </button>

      <Kicker index="§" label="Ambiguous match · choose below" />
      <h1
        className="display-serif mt-4 text-[44px] leading-[1.02] text-ink sm:text-[56px] md:text-[64px]"
        style={{ letterSpacing: '-0.022em' }}
      >
        Which of these <span className="italic font-light text-ink-2">actually</span>{' '}
        describes what you do?
      </h1>
      <p className="mt-4 max-w-[52ch] font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        Query ·{' '}
        <span className="text-ink">"{query}"</span>{' '}
        <span aria-hidden className="mx-1">/</span> {candidates.length} candidate
        occupations ·{' '}
        <span className="text-ink">top match shown first</span>
      </p>

      <ol className="mt-12 border-t border-hair">
        {candidates.map(({ occupation, score }, i) => {
          const isTop = i === 0
          const isHovered = hoverIdx === i
          const alts = occupation.altTitles.slice(0, 4)
          return (
            <li
              key={occupation.code}
              className={cn(
                'group relative border-b border-hair transition-colors',
                isHovered ? 'bg-panel-2' : 'bg-transparent',
              )}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              {isTop && (
                <span
                  aria-hidden
                  className="absolute left-0 top-0 h-full w-[3px] bg-accent"
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(occupation)}
                className="relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 px-2 py-6 text-left md:gap-8 md:px-4 md:py-8"
              >
                <div className="flex flex-col items-start pt-1">
                  <span className="num font-mono text-[12px] uppercase tracking-[0.2em] text-ink/60">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {isTop && (
                    <span className="mt-2 font-mono text-[9px] uppercase tracking-[0.22em] text-accent-2">
                      Top match
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2
                      className="display-serif text-[24px] leading-tight text-ink md:text-[28px]"
                      style={{ letterSpacing: '-0.012em' }}
                    >
                      {occupation.title}
                    </h2>
                    <span className="num font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                      {occupation.code}
                    </span>
                  </div>
                  {occupation.description && (
                    <p className="mt-2 line-clamp-3 max-w-[70ch] text-[13px] leading-relaxed text-ink-2">
                      {occupation.description}
                    </p>
                  )}
                  {alts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {alts.map((alt) => (
                        <Chip key={alt} tone="muted">
                          {alt}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 pt-2">
                  <ConfidenceArc value={score} />
                  <span
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-[0.2em] transition-transform duration-300',
                      isHovered ? 'translate-x-1 text-ink' : 'text-muted',
                    )}
                  >
                    Select →
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function ConfidenceArc({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value))
  const size = 56
  const stroke = 2
  const r = (size - stroke) / 2 - 1
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const dash = pct * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--color-hair)"
          strokeWidth={stroke}
        />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="butt"
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono num text-[11px] font-medium tracking-tighter text-ink">
          {Math.round(pct * 100)}
        </span>
      </div>
    </div>
  )
}
