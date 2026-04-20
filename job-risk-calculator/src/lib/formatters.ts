export function formatWage(wage: number): string {
  if (wage >= 1000) return `$${Math.round(wage / 1000)}k`
  return `$${Math.round(wage)}`
}

export function formatGrowth(pct: number): string {
  const sign = pct >= 0 ? '+' : '\u2212'
  return `${sign}${Math.abs(pct).toFixed(1)}%`
}

export function formatPct(value: number, fraction = false): string {
  const n = fraction ? value * 100 : value
  return `${Math.round(n)}%`
}

export function formatScore(value: number): string {
  return Math.round(value).toString()
}

export function formatDelta(value: number): string {
  if (value === 0) return '0'
  const sign = value > 0 ? '+' : '\u2212'
  return `${sign}${Math.abs(Math.round(value))}`
}

export function parseSocCode(onetMatch: string): { code: string; title: string } {
  const match = onetMatch.match(/^([\d-]+(?:\.\d+)?)\s+(.*)$/)
  if (!match) return { code: '—', title: onetMatch }
  return { code: match[1], title: match[2] }
}

export function riskTier(score: number): 'safe' | 'caution' | 'warn' | 'risk' {
  if (score >= 75) return 'risk'
  if (score >= 55) return 'warn'
  if (score >= 35) return 'caution'
  return 'safe'
}

const TIER_TOKEN: Record<ReturnType<typeof riskTier>, string> = {
  safe: 'var(--color-safe)',
  caution: 'var(--color-caution)',
  warn: 'var(--color-warn)',
  risk: 'var(--color-risk)',
}

export function riskColor(score: number): string {
  return TIER_TOKEN[riskTier(score)]
}

export function riskLabel(score: number): string {
  if (score >= 80) return 'Critical exposure'
  if (score >= 65) return 'High exposure'
  if (score >= 45) return 'Moderate exposure'
  if (score >= 25) return 'Limited exposure'
  return 'Minimal exposure'
}

export function timelineLabel(
  category: 'near-term' | 'mid-term' | 'long-term',
): string {
  switch (category) {
    case 'near-term':
      return 'Near-term horizon'
    case 'mid-term':
      return 'Mid-term horizon'
    case 'long-term':
      return 'Long-term horizon'
  }
}
