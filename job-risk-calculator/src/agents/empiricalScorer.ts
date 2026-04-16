import type {
  EmpiricalContext,
  EmpiricalInputs,
  JobProfile,
  RiskProfile,
  ScoredTask,
} from '../types'

export const WAGE_TIER_ADJUSTMENT: Record<1 | 2 | 3 | 4, number> = {
  1: 80,
  2: 55,
  3: 35,
  4: 20,
}

const GROWTH_LOW = -15
const GROWTH_HIGH = 30

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function wageTierAdjustment(quartile: number): number {
  const q = clamp(Math.round(quartile), 1, 4) as 1 | 2 | 3 | 4
  return WAGE_TIER_ADJUSTMENT[q]
}

export function growthAdjustment(growthPct: number): number {
  const span = GROWTH_HIGH - GROWTH_LOW
  const clamped = clamp(growthPct, GROWTH_LOW, GROWTH_HIGH)
  const normalized = (clamped - GROWTH_LOW) / span
  return clamp(100 - normalized * 100, 0, 100)
}

export function computeEmpiricalBaselineScore(inputs: EmpiricalInputs): number {
  const baseline =
    0.4 * inputs.occupation_beta * 100 +
    0.3 * inputs.observed_exposure * 100 +
    0.15 * wageTierAdjustment(inputs.wage_quartile) +
    0.15 * growthAdjustment(inputs.bls_projected_growth_pct)
  return round1(clamp(baseline, 0, 100))
}

export function enrichEmpiricalContext(inputs: EmpiricalInputs): EmpiricalContext {
  return {
    ...inputs,
    empirical_baseline_score: computeEmpiricalBaselineScore(inputs),
  }
}

export function shouldSkipRiskScorer(
  profile: JobProfile,
  userCustomizedTasks: boolean,
  userContextProvided: boolean,
): boolean {
  if (userCustomizedTasks) return false
  if (userContextProvided) return false
  const score = profile.empirical.empirical_baseline_score
  if (score < 85 && score > 15) return false
  const betas = profile.tasks.map((t) => t.beta)
  if (betas.length === 0) return false
  // The Eloundou bundle ships occupation-level β values, spread uniformly
  // across all of an occupation's tasks. So "no mixed signals" becomes
  // "all task betas are equal" — which is always true in this data but the
  // check stays in place so a future switch to task-level β still works.
  const first = betas[0]
  const allEqual = betas.every((b) => b === first)
  return allEqual
}

interface BandConfig {
  automationRisk: number
  bottleneckScore: number
  interactionType: ScoredTask['predicted_interaction_type']
  bottleneckTypes: ScoredTask['bottleneck_types']
  rationaleSuffix: string
}

function taskBandForBeta(beta: number): BandConfig {
  if (beta >= 1) {
    return {
      automationRisk: 90,
      bottleneckScore: 15,
      interactionType: 'directive',
      bottleneckTypes: ['api_migration_signal'],
      rationaleSuffix:
        'Eloundou β = 1, meaning an LLM alone can halve this task — near-term automation is plausible.',
    }
  }
  if (beta >= 0.5) {
    return {
      automationRisk: 55,
      bottleneckScore: 45,
      interactionType: 'task_iteration',
      bottleneckTypes: ['api_migration_signal'],
      rationaleSuffix:
        'Eloundou β = 0.5 — an LLM halves this task only with additional tooling, so augmentation leads automation.',
    }
  }
  return {
    automationRisk: 20,
    bottleneckScore: 80,
    interactionType: 'validation',
    bottleneckTypes: ['novel_problem_solving'],
    rationaleSuffix:
      'Eloundou β = 0 — LLMs do not halve completion time for this task, leaving substantial human bottleneck.',
  }
}

function timelineFromScore(score: number): {
  category: RiskProfile['timeline_category']
  low: number
  high: number
} {
  if (score >= 85) return { category: 'near-term', low: 2, high: 5 }
  if (score <= 15) return { category: 'long-term', low: 15, high: 25 }
  if (score >= 60) return { category: 'near-term', low: 3, high: 8 }
  if (score >= 40) return { category: 'mid-term', low: 5, high: 12 }
  return { category: 'long-term', low: 10, high: 20 }
}

export function synthesizeRiskFromBaseline(profile: JobProfile): RiskProfile {
  const score = profile.empirical.empirical_baseline_score
  const timeline = timelineFromScore(score)
  const scored_tasks: ScoredTask[] = profile.tasks.map((task) => {
    const band = taskBandForBeta(task.beta)
    return {
      name: task.name,
      beta: task.beta,
      automation_risk: band.automationRisk,
      bottleneck_score: band.bottleneckScore,
      rationale: band.rationaleSuffix,
      bottleneck_types: band.bottleneckTypes,
      predicted_interaction_type: band.interactionType,
    }
  })

  const wageTierLabel =
    profile.empirical.wage_quartile <= 2
      ? 'lower-wage'
      : profile.empirical.wage_quartile === 3
        ? 'upper-middle-wage'
        : 'high-wage'

  return {
    empirical_baseline_score: score,
    adjusted_risk_score: score,
    adjustment_rationale:
      'This score is based entirely on published employment data — no contextual adjustment was needed for this occupation. Add details about your specific role for a more personalized assessment.',
    timeline_category: timeline.category,
    timeline_years_low: timeline.low,
    timeline_years_high: timeline.high,
    scored_tasks,
    risk_rationale: `Empirical baseline of ${score}/100 derived from Eloundou et al. task β (${Math.round(
      profile.empirical.occupation_beta * 100,
    )}% theoretical exposure), Anthropic Economic Index observed exposure (${Math.round(
      profile.empirical.observed_exposure * 100,
    )}%), BLS wage quartile ${profile.empirical.wage_quartile} (${wageTierLabel}), and BLS projected growth of ${profile.empirical.bls_projected_growth_pct.toFixed(
      1,
    )}%. The empirical signal is decisive enough that contextual adjustment was skipped.`,
    spectrum_summary:
      score >= 85
        ? 'This occupation sits near the automation end of the spectrum — observed AI exposure and theoretical task β both indicate that directive / feedback-loop interactions dominate already.'
        : 'This occupation sits near the augmentation end of the spectrum — theoretical exposure is low and observed AI usage is limited, so human-in-the-loop interactions dominate.',
  }
}
