import { callAgent } from './anthropicClient'
import { riskProfileSchema } from './schemas'
import { RISK_SCORER_SYSTEM } from './prompts'
import type { JobProfile, RiskProfile } from '../types'

export async function scoreRisk(profile: JobProfile): Promise<RiskProfile> {
  const userMessage = `Job profile JSON:\n\n${JSON.stringify(profile, null, 2)}\n\nScore each task and return the structured risk profile JSON.`
  return callAgent({
    agentName: 'RiskScorer',
    systemPrompt: RISK_SCORER_SYSTEM,
    userMessage,
    schema: riskProfileSchema,
  })
}
