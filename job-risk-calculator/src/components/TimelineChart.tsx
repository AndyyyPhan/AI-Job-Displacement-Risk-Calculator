import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RiskProfile } from '../types'

interface Props {
  risk: RiskProfile
}

// Curve model: we synthesize a sigmoid (logistic) from 0% at year 0 to
// overall_risk_score% at timeline_years_high, with low/high bounds offset by
// ±15 percentage points (clamped to [0, 100]). This is a product modeling
// decision, not a prediction — tune BAND_WIDTH if you want a tighter or
// looser confidence band.
const BAND_WIDTH = 15

export function TimelineChart({ risk }: Props) {
  const data = buildCurve(risk)
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Displacement timeline</h2>
      <p className="mt-1 text-sm text-slate-500">
        Projected share of your job's tasks that could be automated over time. The
        shaded band is a ±{BAND_WIDTH}pp confidence range.
      </p>
      <div className="mt-6 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="year"
              tickFormatter={(v) => `+${v}y`}
              stroke="#64748b"
              fontSize={12}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              stroke="#64748b"
              fontSize={12}
            />
            <Tooltip
              formatter={(value, name) => [
                `${Math.round(Number(value))}%`,
                labelFor(String(name)),
              ]}
              labelFormatter={(year) => `Year +${year}`}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="lowBase"
              stackId="band"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="bandHeight"
              stackId="band"
              stroke="none"
              fill="url(#bandFill)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="mid"
              stroke="#4338ca"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface CurvePoint {
  year: number
  mid: number
  low: number
  high: number
  lowBase: number
  bandHeight: number
}

function buildCurve(risk: RiskProfile): CurvePoint[] {
  const target = risk.adjusted_risk_score
  const high = Math.max(risk.timeline_years_high, risk.timeline_years_low + 1, 1)
  const points: CurvePoint[] = []

  // Sigmoid centered at midpoint of the window, scaled so year=high lands at
  // ~95% of target. k controls steepness.
  const midpoint = (risk.timeline_years_low + risk.timeline_years_high) / 2
  const k = 6 / Math.max(high - risk.timeline_years_low, 1)

  const yearCount = Math.ceil(high) + 2
  for (let year = 0; year <= yearCount; year++) {
    const sigmoid = 1 / (1 + Math.exp(-k * (year - midpoint)))
    const mid = clamp(target * sigmoid, 0, 100)
    const low = clamp(mid - BAND_WIDTH, 0, 100)
    const highVal = clamp(mid + BAND_WIDTH, 0, 100)
    points.push({
      year,
      mid,
      low,
      high: highVal,
      lowBase: low,
      bandHeight: highVal - low,
    })
  }
  return points
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function labelFor(key: string): string {
  switch (key) {
    case 'mid':
      return 'Projected'
    case 'bandHeight':
      return 'Confidence band'
    default:
      return key
  }
}
