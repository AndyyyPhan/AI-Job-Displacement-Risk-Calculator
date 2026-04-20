import { callAgent } from './anthropicClient'
import { agentRiskAssessmentSchema } from './schemas'
import { RISK_SCORER_SYSTEM } from './prompts'
import type { AgentRiskAssessment, JobProfile } from '../types'

export async function scoreRisk(profile: JobProfile): Promise<AgentRiskAssessment> {
  const userMessage = [
    `Job profile with empirical baseline and per-task β:`,
    ``,
    JSON.stringify(profile, null, 2),
    ``,
    `The empirical_baseline_score above is your anchor. Return the structured risk assessment JSON, pass through empirical_baseline_score and each task's beta unchanged, and explain where/why your adjusted_risk_score diverges from the baseline.`,
  ].join('\n')

  return callAgent({
    agentName: 'RiskScorer',
    systemPrompt: RISK_SCORER_SYSTEM,
    userMessage,
    schema: agentRiskAssessmentSchema,
  })
}
