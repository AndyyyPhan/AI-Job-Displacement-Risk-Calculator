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
  const label = scoreLabel(adjusted)
  const color = scoreColor(adjusted)
  const spectrum = computeSpectrum(
    risk.scored_tasks.map((t) => t.predicted_interaction_type),
  )

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Automation outlook for {jobTitle}
      </p>

      {spectrum && (
        <div className="mt-4">
          <p className="text-lg leading-relaxed text-slate-800">{risk.spectrum_summary}</p>
          <p className="mt-4 text-xs text-slate-500">
            Where this job falls between humans using AI as a tool (augmentation) and AI
            replacing human tasks (automation).
          </p>
          <SpectrumBar zone={spectrum.zone} automationShare={spectrum.automationShare} />
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Empirical baseline
          </p>
          <p className="text-[11px] text-slate-400">from published data</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-slate-700">
              {baseline}
            </span>
            <span className="text-sm text-slate-500">/ 100</span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Derived from Eloundou et al. β, Anthropic Economic Index observed exposure, BLS
            wage quartile, and BLS 2024–2034 projected growth.
          </p>
        </div>

        <div className="hidden items-center justify-center sm:flex">
          <DeltaArrow delta={delta} />
        </div>

        <div
          className="rounded-xl border px-5 py-4"
          style={{ borderColor: color, backgroundColor: `${color}0F` }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>
            Adjusted risk score
          </p>
          <p className="text-[11px] text-slate-500">personalized for your role</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums" style={{ color }}>
              {adjusted}
            </span>
            <span className="text-sm text-slate-500">/ 100</span>
            <span className="text-sm font-semibold" style={{ color }}>
              {label}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Displacement window: {risk.timeline_years_low}–{risk.timeline_years_high} years ·
            {' '}
            {risk.timeline_category}
          </p>
        </div>
      </div>

      <section className="mt-5 rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          How the score was adjusted
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {risk.adjustment_rationale}
        </p>
      </section>

      <p className="mt-4 text-sm leading-relaxed text-slate-700">{risk.risk_rationale}</p>
    </div>
  )
}

function DeltaArrow({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <div className="flex flex-col items-center text-slate-400">
        <span className="text-2xl leading-none">≈</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">no change</span>
      </div>
    )
  }
  const up = delta > 0
  const color = up ? '#b91c1c' : '#15803d'
  return (
    <div className="flex flex-col items-center" style={{ color }}>
      <span className="text-3xl leading-none">{up ? '↑' : '↓'}</span>
      <span className="text-xs font-semibold tabular-nums">
        {up ? '+' : ''}
        {delta}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide">
        {up ? 'riskier' : 'safer'}
      </span>
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
  const zones: { key: SpectrumZone; label: string; color: string }[] = [
    { key: 'augmentation', label: 'Augmentation', color: '#16a34a' },
    { key: 'mixed', label: 'Mixed', color: '#ca8a04' },
    { key: 'automation', label: 'Automation', color: '#b91c1c' },
  ]
  const markerLeftPct = Math.min(Math.max(automationShare * 100, 0), 100)

  return (
    <div className="mt-5">
      <div className="relative h-3 w-full overflow-hidden rounded-full">
        <div className="absolute inset-0 flex">
          {zones.map((z) => (
            <div
              key={z.key}
              className="h-full flex-1"
              style={{
                backgroundColor: z.color,
                opacity: z.key === zone ? 1 : 0.25,
              }}
            />
          ))}
        </div>
        <div
          className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded bg-slate-900 shadow"
          style={{ left: `calc(${markerLeftPct}% - 2px)` }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex justify-between text-xs font-medium text-slate-600">
        {zones.map((z) => (
          <span
            key={z.key}
            className={z.key === zone ? 'text-slate-900' : 'text-slate-400'}
          >
            {z.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Very high risk'
  if (score >= 60) return 'High risk'
  if (score >= 40) return 'Moderate risk'
  if (score >= 20) return 'Low risk'
  return 'Very low risk'
}

function scoreColor(score: number): string {
  if (score >= 80) return '#b91c1c'
  if (score >= 60) return '#ea580c'
  if (score >= 40) return '#ca8a04'
  if (score >= 20) return '#16a34a'
  return '#15803d'
}
