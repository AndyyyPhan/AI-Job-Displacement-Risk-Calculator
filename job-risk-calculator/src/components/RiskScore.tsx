import { AnimatedNumber } from './ui/AnimatedNumber'
import { Dateline } from './ui/Dateline'
import { Kicker } from './ui/Kicker'
import { RiskDial } from './ui/RiskDial'
import { cn } from '../lib/cn'
import {
  formatDelta,
  riskColor,
  riskLabel,
  timelineLabel,
} from '../lib/formatters'
import type { InteractionType, RiskProfile } from '../types'

interface Props {
  risk: RiskProfile
  jobTitle: string
}

type SpectrumZone = 'augmentation' | 'mixed' | 'automation'

export function RiskScore({ risk, jobTitle }: Props) {
  const adjusted = Math.round(risk.adjusted_risk_score)
  const baseline = Math.round(risk.empirical_baseline_score)
  const delta = adjusted - baseline
  const accent = riskColor(adjusted)
  const label = riskLabel(adjusted)
  const horizon = timelineLabel(risk.timeline_category)
  const spectrum = computeSpectrum(
    risk.scored_tasks.map((t) => t.predicted_interaction_type),
  )

  return (
    <section
      className="anim-reveal panel relative overflow-hidden"
      style={{ animationDelay: '80ms' }}
    >
      {/* Corner marks */}
      <CornerMarks />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair-2 px-6 py-5 md:px-10 md:py-7">
        <Dateline rule>Assessment · Primary finding</Dateline>
        <Dateline className="shrink-0">Subject · {jobTitle}</Dateline>
      </div>

      {/* Hero: dial + score */}
      <div className="grid gap-12 px-6 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center md:gap-16 md:px-10 md:py-14">
        <div className="relative flex justify-center md:justify-start">
          <RiskDial score={adjusted} size={340}>
            <div className="flex flex-col items-center">
              <span
                className="display-serif text-[132px] leading-none text-ink"
                style={{ letterSpacing: '-0.04em' }}
              >
                <AnimatedNumber value={adjusted} duration={1600} />
              </span>
              <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                out of 100 · adjusted
              </span>
            </div>
          </RiskDial>
        </div>

        <div className="space-y-8">
          <div>
            <Kicker label={label} />
            <p
              className="display-serif mt-3 text-[34px] leading-[1.1] text-ink md:text-[40px]"
              style={{ letterSpacing: '-0.016em' }}
            >
              {headlineSentence(adjusted, risk)}
            </p>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
              <span style={{ color: accent }}>{horizon}</span>{' '}
              <span aria-hidden className="mx-1">·</span>{' '}
              <span className="num">
                +{risk.timeline_years_low}–{risk.timeline_years_high}y
              </span>
            </p>
          </div>

          <BaselineDelta baseline={baseline} adjusted={adjusted} delta={delta} />

          <blockquote
            className="relative border-l-2 pl-5 font-display text-[20px] leading-relaxed text-ink-2 md:text-[22px]"
            style={{ borderColor: accent, fontStyle: 'italic' }}
          >
            <span
              aria-hidden
              className="absolute -left-[6px] -top-2 font-display text-4xl leading-none"
              style={{ color: accent, fontStyle: 'normal' }}
            >
              “
            </span>
            {risk.risk_rationale}
          </blockquote>
        </div>
      </div>

      {/* Spectrum section */}
      {spectrum && (
        <div className="border-t border-hair-2 px-6 py-8 md:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Kicker index="§" label="Augmentation ↔ Automation spectrum" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              {Math.round(spectrum.automationShare * 100)}% tasks trend automation
            </span>
          </div>
          <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-ink-2">
            {risk.spectrum_summary}
          </p>
          <SpectrumBar zone={spectrum.zone} automationShare={spectrum.automationShare} />
        </div>
      )}

      {/* Adjustment rationale */}
      <div className="border-t border-hair-2 bg-paper-2/40 px-6 py-8 md:px-10">
        <div className="grid gap-8 md:grid-cols-[max-content_minmax(0,1fr)] md:gap-12">
          <Kicker index="◎" label="How the score was adjusted" />
          <p className="max-w-3xl text-[15px] leading-relaxed text-ink-2">
            {risk.adjustment_rationale}
          </p>
        </div>
      </div>
    </section>
  )
}

function headlineSentence(score: number, risk: RiskProfile): string {
  const years = `${risk.timeline_years_low}–${risk.timeline_years_high} years`
  if (score >= 75) {
    return `Substantial portions of this role could be automated within ${years}.`
  }
  if (score >= 55) {
    return `Meaningful exposure across several core tasks on a ${years} horizon.`
  }
  if (score >= 35) {
    return `Moderate exposure concentrated in a handful of tasks.`
  }
  return `Largely insulated from near-term LLM displacement.`
}

function BaselineDelta({
  baseline,
  adjusted,
  delta,
}: {
  baseline: number
  adjusted: number
  delta: number
}) {
  const accent = riskColor(adjusted)
  const baselineColor = riskColor(baseline)
  const direction = delta === 0 ? 'aligned' : delta > 0 ? 'riskier' : 'safer'
  const arrow = delta === 0 ? '≈' : delta > 0 ? '↑' : '↓'
  const deltaTone = delta === 0 ? 'var(--color-muted)' : delta > 0 ? 'var(--color-risk)' : 'var(--color-safe)'

  return (
    <div className="grid grid-cols-2 gap-4 border-y border-hair-2 py-5">
      <div>
        <Dateline>Empirical baseline</Dateline>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className="display-serif text-[40px] leading-none num"
            style={{ color: baselineColor }}
          >
            {baseline}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            / 100
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted">
          From published data — Eloundou β, Anthropic Economic Index, BLS.
        </p>
      </div>
      <div className="relative pl-4 md:pl-6">
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full w-px bg-hair"
        />
        <Dateline>Δ from baseline</Dateline>
        <div className="mt-2 flex items-baseline gap-2" style={{ color: deltaTone }}>
          <span className="display-serif text-[40px] leading-none">{arrow}</span>
          <span className="font-mono text-[22px] font-medium num">
            {formatDelta(delta)}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
            {direction}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted">
          LLM contextual adjustment vs. the pure empirical anchor.
        </p>
      </div>
    </div>
  )
}

interface SpectrumResult {
  zone: SpectrumZone
  automationShare: number
}

function computeSpectrum(types: InteractionType[]): SpectrumResult | null {
  if (types.length === 0) return null
  const automationCount = types.filter(
    (t) => t === 'directive' || t === 'feedback_loop',
  ).length
  const automationShare = automationCount / types.length
  let zone: SpectrumZone
  if (automationShare < 1 / 3) zone = 'augmentation'
  else if (automationShare <= 2 / 3) zone = 'mixed'
  else zone = 'automation'
  return { zone, automationShare }
}

function SpectrumBar({ zone, automationShare }: SpectrumResult) {
  const zones: { key: SpectrumZone; label: string }[] = [
    { key: 'augmentation', label: 'Augmentation' },
    { key: 'mixed', label: 'Mixed' },
    { key: 'automation', label: 'Automation' },
  ]
  const markerPct = Math.min(Math.max(automationShare * 100, 0), 100)

  return (
    <div className="mt-8">
      <div className="relative h-5 w-full">
        <div
          className="absolute inset-y-[6px] left-0 right-0 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, var(--color-safe) 0%, var(--color-caution) 50%, var(--color-risk) 100%)',
            opacity: 0.35,
          }}
        />
        <div
          className="absolute top-0 h-full"
          style={{
            left: `calc(${markerPct}% - 1px)`,
            width: 2,
            background: 'var(--color-ink)',
          }}
        />
        <div
          className="absolute -top-[6px]"
          style={{
            left: `calc(${markerPct}% - 7px)`,
          }}
        >
          <div
            className="h-4 w-[14px]"
            style={{
              clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
              background: 'var(--color-ink)',
            }}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em]">
        {zones.map((z) => (
          <span
            key={z.key}
            className={cn(z.key === zone ? 'text-ink' : 'text-muted/60')}
          >
            {z.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function CornerMarks() {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-5 w-5"
        style={{
          borderTop: '1px solid var(--color-ink)',
          borderLeft: '1px solid var(--color-ink)',
          opacity: 0.35,
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-5 w-5"
        style={{
          borderTop: '1px solid var(--color-ink)',
          borderRight: '1px solid var(--color-ink)',
          opacity: 0.35,
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-5 w-5"
        style={{
          borderBottom: '1px solid var(--color-ink)',
          borderLeft: '1px solid var(--color-ink)',
          opacity: 0.35,
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-5 w-5"
        style={{
          borderBottom: '1px solid var(--color-ink)',
          borderRight: '1px solid var(--color-ink)',
          opacity: 0.35,
        }}
      />
    </>
  )
}
