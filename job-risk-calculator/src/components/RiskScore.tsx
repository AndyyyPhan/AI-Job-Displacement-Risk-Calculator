import type { InteractionType, RiskProfile } from '../types'

interface Props {
  risk: RiskProfile
  jobTitle: string
}

type SpectrumZone = 'augmentation' | 'mixed' | 'automation'

export function RiskScore({ risk, jobTitle }: Props) {
  const score = Math.round(risk.overall_risk_score)
  const label = scoreLabel(score)
  const color = scoreColor(score)
  const spectrum = computeSpectrum(risk.scored_tasks.map((t) => t.predicted_interaction_type))

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Automation outlook for {jobTitle}
      </p>

      {spectrum && (
        <div className="mt-4">
          <p className="text-lg leading-relaxed text-slate-800">
            {risk.spectrum_summary}
          </p>
          <SpectrumBar zone={spectrum.zone} automationShare={spectrum.automationShare} />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-6 rounded-xl bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Overall risk score
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums" style={{ color }}>
              {score}
            </span>
            <span className="text-sm text-slate-500">/ 100</span>
            <span className="ml-2 text-sm font-semibold" style={{ color }}>
              {label}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Displacement window
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {risk.timeline_years_low}–{risk.timeline_years_high} years
          </p>
          <p className="text-xs text-slate-500">({risk.timeline_category})</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-700">
        {risk.risk_rationale}
      </p>
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
