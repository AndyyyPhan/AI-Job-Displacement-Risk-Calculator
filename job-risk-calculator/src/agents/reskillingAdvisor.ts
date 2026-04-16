import { callAgent } from './anthropicClient'
import { reskillingPlanSchema } from './schemas'
import { RESKILLING_ADVISOR_SYSTEM } from './prompts'
import type {
  JobProfile,
  ReskillingPlan,
  ResourceRegistryEntry,
  RiskProfile,
} from '../types'
import { filterRegistryForProfile } from '../lib/resourceRegistry'

const REGISTRY_CAP = 50

export async function generateReskillingPlan(
  profile: JobProfile,
  risk: RiskProfile,
  registry: ResourceRegistryEntry[],
): Promise<ReskillingPlan> {
  const filtered = filterRegistryForProfile(registry, profile.soc_major_group, REGISTRY_CAP)

  const compactRegistry = filtered.map((entry) => ({
    id: entry.id,
    title: entry.title,
    platform: entry.platform,
    type: entry.type,
    level: entry.level,
    skill_categories: entry.skill_categories,
  }))

  const userMessage = [
    `Job profile JSON:`,
    JSON.stringify(profile, null, 2),
    ``,
    `Risk profile JSON:`,
    JSON.stringify(risk, null, 2),
    ``,
    `Resource registry (filtered to this occupation's SOC major group ${profile.soc_major_group}, capped at ${REGISTRY_CAP} entries). Every resource you recommend MUST reference one of these \`id\` values:`,
    JSON.stringify(compactRegistry, null, 2),
    ``,
    `Identify transferable skills, recommend alternative jobs, and select 3-6 resources by id. Return the structured plan JSON.`,
  ].join('\n')

  return callAgent({
    agentName: 'ReskillingAdvisor',
    systemPrompt: RESKILLING_ADVISOR_SYSTEM,
    userMessage,
    schema: reskillingPlanSchema,
  })
}
