import type { RiskProfile } from '../types'

interface Props {
  risk: RiskProfile
  jobTitle: string
}

export function RiskScore({ risk, jobTitle }: Props) {
  const score = Math.round(risk.overall_risk_score)
  const label = scoreLabel(score)
  const color = scoreColor(score)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Automation risk for {jobTitle}
      </p>
      <div className="mt-4 flex items-end gap-4">
        <span
          className="text-7xl font-bold tracking-tight"
          style={{ color }}
        >
          {score}
        </span>
        <div className="pb-2">
          <p className="text-lg font-semibold" style={{ color }}>
            {label}
          </p>
          <p className="text-sm text-slate-500">out of 100</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">
        Estimated displacement window:{' '}
        <span className="font-medium text-slate-900">
          {risk.timeline_years_low}–{risk.timeline_years_high} years
        </span>{' '}
        ({risk.timeline_category})
      </p>
      <p className="mt-4 text-sm leading-relaxed text-slate-700">
        {risk.risk_rationale}
      </p>
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
