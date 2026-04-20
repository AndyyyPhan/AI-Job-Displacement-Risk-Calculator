import { Chip } from './ui/Chip'
import { Dateline } from './ui/Dateline'
import { Kicker } from './ui/Kicker'
import { cn } from '../lib/cn'
import { formatGrowth, formatWage } from '../lib/formatters'
import { growthAdjustment, wageTierAdjustment } from '../agents/empiricalScorer'
import type { EmpiricalContext as EmpiricalContextData } from '../types'

interface Props {
  empirical: EmpiricalContextData
}

export function EmpiricalContext({ empirical }: Props) {
  const fallback = new Set(empirical.fallback_fields ?? [])
  const fallbackCount = empirical.fallback_fields?.length ?? 0
  const partialCoverage = fallbackCount >= 2

  return (
    <section
      className="anim-reveal panel"
      style={{ animationDelay: '120ms' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair-2 px-6 py-5 md:px-10 md:py-7">
        <Dateline rule>Record · Published empirical data</Dateline>
        {partialCoverage && (
          <Chip tone="caution" glyph="◦">
            Partial coverage
          </Chip>
        )}
      </div>

      <div className="px-6 py-8 md:px-10 md:py-10">
        <Kicker index="§" label="The empirical baseline in four numbers" />
        <p
          className="display-serif mt-3 max-w-[60ch] text-[22px] leading-[1.3] text-ink md:text-[26px]"
          style={{ letterSpacing: '-0.014em' }}
        >
          Before any LLM reasoning, this is what the published research already
          says about your occupation.
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-2 md:gap-12">
          {/* Group 1: Exposure */}
          <div className="space-y-4">
            <GroupHeader label="Exposure to AI" index="I" />
            <div className="grid grid-cols-2 gap-[1px] border border-hair bg-hair">
              <Stat
                label="Could do"
                value={`${Math.round(empirical.occupation_beta * 100)}%`}
                sub="Eloundou β"
                fallback={fallback.has('occupation_beta')}
              />
              <Stat
                label="Already does"
                value={`${Math.round(empirical.observed_exposure * 100)}%`}
                sub="Economic Index"
                fallback={fallback.has('observed_exposure')}
              />
            </div>
            {gapCallout(empirical.exposure_gap)}
          </div>

          {/* Group 2: Economic footprint */}
          <div className="space-y-4">
            <GroupHeader label="Economic footprint" index="II" />
            <div className="grid grid-cols-2 gap-[1px] border border-hair bg-hair">
              <Stat
                label="Median wage"
                value={formatWage(empirical.median_wage)}
                sub={`BLS OEWS · Q${empirical.wage_quartile}`}
                fallback={
                  fallback.has('median_wage') || fallback.has('wage_quartile')
                }
              />
              <Stat
                label="Job growth '24–'34"
                value={formatGrowth(empirical.bls_projected_growth_pct)}
                sub="BLS Projections"
                fallback={fallback.has('bls_projected_growth_pct')}
                negative={empirical.bls_projected_growth_pct < 0}
              />
            </div>
            <p className="text-[12px] leading-relaxed text-muted">
              Lower wage quartiles show earlier LLM exposure (Massenkoff & McCrory,
              2026); negative government growth projections sharpen the risk signal.
            </p>
          </div>
        </div>

        <BaselineComposition empirical={empirical} />
      </div>
    </section>
  )
}

function BaselineComposition({ empirical }: { empirical: EmpiricalContextData }) {
  const betaPct = empirical.occupation_beta * 100
  const observedPct = empirical.observed_exposure * 100
  const wageAdj = wageTierAdjustment(empirical.wage_quartile)
  const growthAdj = growthAdjustment(empirical.bls_projected_growth_pct)

  const terms = [
    {
      weight: 0.4,
      term: 'occupation β × 100',
      inputs: `β = ${empirical.occupation_beta.toFixed(2)} → ${betaPct.toFixed(1)}`,
      contribution: 0.4 * betaPct,
    },
    {
      weight: 0.3,
      term: 'observed × 100',
      inputs: `observed = ${empirical.observed_exposure.toFixed(2)} → ${observedPct.toFixed(1)}`,
      contribution: 0.3 * observedPct,
    },
    {
      weight: 0.15,
      term: 'wage tier',
      inputs: `{Q1:80, Q2:55, Q3:35, Q4:20}[Q${empirical.wage_quartile}] = ${wageAdj}`,
      contribution: 0.15 * wageAdj,
    },
    {
      weight: 0.15,
      term: 'growth adjustment',
      inputs: `map(${empirical.bls_projected_growth_pct.toFixed(1)}%, [−15,+30] → [100,0]) = ${growthAdj.toFixed(1)}`,
      contribution: 0.15 * growthAdj,
    },
  ]
  const sum = terms.reduce((acc, t) => acc + t.contribution, 0)
  const baseline = empirical.empirical_baseline_score

  return (
    <div className="mt-10 border-t border-hair-2 pt-8 md:mt-12 md:pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Dateline rule>Composition · how the four numbers combine</Dateline>
        <Dateline className="shrink-0">weights sum to 1.00</Dateline>
      </div>

      <div className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-[minmax(0,1fr)_minmax(180px,220px)]">
        <div className="space-y-3.5 font-mono text-[11.5px] leading-[1.55]">
          {terms.map((t, i) => (
            <WeightedTerm
              key={i}
              weight={t.weight.toFixed(2)}
              term={t.term}
              inputs={t.inputs}
              contribution={t.contribution.toFixed(1)}
            />
          ))}

          <div className="mt-2 border-t border-hair pt-4">
            <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5">
              <div className="text-muted">baseline</div>
              <div className="text-ink">clamp(sum, 0, 100)</div>
              <div className="num whitespace-nowrap text-ink">
                = {baseline.toFixed(1)}
              </div>
              <div />
              <div className="text-[10px] text-muted">sum = {sum.toFixed(1)}</div>
              <div />
            </div>
          </div>
        </div>

        <div className="md:border-l md:border-hair md:pl-8">
          <Dateline>Baseline</Dateline>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className="display-serif num text-ink"
              style={{ fontSize: '44px', lineHeight: 1, letterSpacing: '-0.02em' }}
            >
              {Math.round(baseline)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              / 100
            </span>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            The pre-LLM composite. Weights tune how much each published signal
            contributes to the risk anchor that the adjusted score refines.
          </p>
        </div>
      </div>
    </div>
  )
}

function WeightedTerm({
  weight,
  term,
  inputs,
  contribution,
}: {
  weight: string
  term: string
  inputs: string
  contribution: string
}) {
  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5">
      <div className="num text-muted">{weight}</div>
      <div className="text-ink/90">× {term}</div>
      <div className="num whitespace-nowrap text-ink">= {contribution}</div>
      <div />
      <div className="text-[10px] text-muted">{inputs}</div>
      <div />
    </div>
  )
}

function GroupHeader({ label, index }: { label: string; index: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-hair pb-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/70">
        {index}
      </span>
      <span className="font-display text-[18px] text-ink">{label}</span>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  fallback,
  negative,
}: {
  label: string
  value: string
  sub: string
  fallback?: boolean
  negative?: boolean
}) {
  return (
    <div className="bg-panel-2 p-5 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <Dateline>{label}</Dateline>
        {fallback && (
          <span
            title="Aggregated from SOC major-group average"
            className="font-mono text-[9px] uppercase tracking-[0.18em] text-caution"
          >
            ◦ est.
          </span>
        )}
      </div>
      <p
        className={cn(
          'display-serif mt-3 text-[42px] leading-none num md:text-[48px]',
          negative ? 'text-risk' : 'text-ink',
        )}
        style={{ letterSpacing: '-0.02em' }}
      >
        {value}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {sub}
      </p>
    </div>
  )
}

function gapCallout(gap: number) {
  if (gap > 0.1) {
    return (
      <div
        className="rounded-[2px] border p-4"
        style={{
          borderColor: 'color-mix(in srgb, var(--color-caution) 50%, transparent)',
          background:
            'color-mix(in srgb, var(--color-caution) 8%, transparent)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-warn">
            Adoption lag
          </span>
          <span className="font-mono text-[10px] tracking-[0.08em] text-warn/80">
            Δ {gap.toFixed(2)}
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-2">
          AI could theoretically do more of this job than it's actually doing
          today — adoption is lagging what the research says is possible.
        </p>
      </div>
    )
  }
  if (gap < -0.1) {
    return (
      <div
        className="rounded-[2px] border p-4"
        style={{
          borderColor: 'color-mix(in srgb, var(--color-risk) 50%, transparent)',
          background: 'color-mix(in srgb, var(--color-risk) 8%, transparent)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-risk">
            Adoption outpacing theory
          </span>
          <span className="font-mono text-[10px] tracking-[0.08em] text-risk/80">
            Δ {gap.toFixed(2)}
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-2">
          AI is already doing more of this job than task-level research
          predicted — real-world usage has outpaced the theoretical ceiling.
        </p>
      </div>
    )
  }
  return (
    <p className="text-[12px] leading-relaxed text-muted">
      Observed AI usage is tracking the theoretical β closely — the gap between
      capability and adoption is narrow for this occupation.
    </p>
  )
}
