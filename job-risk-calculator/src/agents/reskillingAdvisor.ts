import { callAgent } from './anthropicClient'
import { reskillingPlanSchema } from './schemas'
import { RESKILLING_ADVISOR_SYSTEM } from './prompts'
import type { JobProfile, ReskillingPlan, RiskProfile } from '../types'

export async function generateReskillingPlan(
  profile: JobProfile,
  risk: RiskProfile,
): Promise<ReskillingPlan> {
  const userMessage = `Job profile JSON:\n\n${JSON.stringify(profile, null, 2)}\n\nRisk profile JSON:\n\n${JSON.stringify(risk, null, 2)}\n\nIdentify transferable skills, recommend alternative jobs, and list concrete reskilling resources. Return the structured plan JSON.`
  return callAgent({
    agentName: 'ReskillingAdvisor',
    systemPrompt: RESKILLING_ADVISOR_SYSTEM,
    userMessage,
    schema: reskillingPlanSchema,
    webSearch: true,
  })
}
