import type { EmpiricalContext as EmpiricalContextData } from '../types'

interface Props {
  empirical: EmpiricalContextData
}

export function EmpiricalContext({ empirical }: Props) {
  const fallbackCount = empirical.fallback_fields?.length ?? 0
  const partialCoverage = fallbackCount >= 2

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Empirical context from published data
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Bundled at build time from Eloundou et al. (2023), Anthropic Economic Index
            (Massenkoff &amp; McCrory 2026), BLS OEWS, and BLS Employment Projections
            2024–2034.
          </p>
        </div>
        {partialCoverage && (
          <span
            className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800"
            title={`Missing direct data for: ${empirical.fallback_fields?.join(', ')}. Values were aggregated from SOC major-group averages.`}
          >
            Partial coverage
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="How much of this job AI could do"
          value={`${Math.round(empirical.occupation_beta * 100)}%`}
          sub="Eloundou et al. employment-weighted β"
          fallback={empirical.fallback_fields?.includes('occupation_beta')}
        />
        <Stat
          label="How much of this job AI is already doing"
          value={`${Math.round(empirical.observed_exposure * 100)}%`}
          sub="Anthropic Economic Index"
          fallback={empirical.fallback_fields?.includes('observed_exposure')}
        />
        <Stat
          label="Median annual wage"
          value={formatWage(empirical.median_wage)}
          sub={`BLS OEWS · quartile ${empirical.wage_quartile}`}
          fallback={
            empirical.fallback_fields?.includes('median_wage') ||
            empirical.fallback_fields?.includes('wage_quartile')
          }
        />
        <Stat
          label="Government job growth forecast (2024–2034)"
          value={formatGrowth(empirical.bls_projected_growth_pct)}
          sub="BLS Employment Projections"
          fallback={empirical.fallback_fields?.includes('bls_projected_growth_pct')}
          highlightNegative
        />
      </div>

      {gapNote(empirical.exposure_gap) && (
        <p className="mt-5 text-sm leading-relaxed text-slate-600">
          {gapNote(empirical.exposure_gap)}
        </p>
      )}
    </div>
  )
}

function gapNote(gap: number): string | null {
  if (gap > 0.1) {
    return 'AI could theoretically do more of this job than it’s actually doing today — adoption is lagging behind what the research says is possible.'
  }
  if (gap < -0.1) {
    return 'AI is already doing more of this job than task-level research predicted — real-world usage has outpaced the theoretical ceiling.'
  }
  return null
}

function Stat({
  label,
  value,
  sub,
  fallback,
  highlightNegative,
}: {
  label: string
  value: string
  sub: string
  fallback?: boolean
  highlightNegative?: boolean
}) {
  const isNegative = highlightNegative && value.startsWith('−')
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          isNegative ? 'text-rose-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {sub}
        {fallback && (
          <span
            className="ml-1 text-amber-700"
            title="Aggregated from SOC major-group average"
          >
            · est.
          </span>
        )}
      </p>
    </div>
  )
}

function formatWage(wage: number): string {
  if (wage >= 1000) {
    return `$${Math.round(wage / 1000)}k`
  }
  return `$${Math.round(wage)}`
}

function formatGrowth(pct: number): string {
  const sign = pct >= 0 ? '+' : '−'
  return `${sign}${Math.abs(pct).toFixed(1)}%`
}
