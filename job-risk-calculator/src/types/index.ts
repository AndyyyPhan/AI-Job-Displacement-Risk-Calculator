import type { z } from 'zod'
import type {
  agentRiskAssessmentSchema,
  jobProfileSchema,
  jobTaskSchema,
  riskProfileSchema,
  scoredTaskSchema,
  bottleneckTypeSchema,
  interactionTypeSchema,
  reskillingPlanSchema,
  recommendedJobSchema,
  resourceSelectionSchema,
  metaSkillRecommendationSchema,
  empiricalContextSchema,
  empiricalInputsSchema,
  resourceRegistryEntrySchema,
  resourceRegistrySchema,
} from '../agents/schemas'

import type { OnetOccupation } from '../lib/onet'

export interface JobCandidate {
  occupation: OnetOccupation
  score: number
}

export type JobTask = z.infer<typeof jobTaskSchema>
export type JobProfile = z.infer<typeof jobProfileSchema>
export type EmpiricalInputs = z.infer<typeof empiricalInputsSchema>
export type EmpiricalContext = z.infer<typeof empiricalContextSchema>
export type BottleneckType = z.infer<typeof bottleneckTypeSchema>
export type InteractionType = z.infer<typeof interactionTypeSchema>
export type ScoredTask = z.infer<typeof scoredTaskSchema>
export type AgentRiskAssessment = z.infer<typeof agentRiskAssessmentSchema>
export type RiskProfile = z.infer<typeof riskProfileSchema>
export type RecommendedJob = z.infer<typeof recommendedJobSchema>
export type ResourceSelection = z.infer<typeof resourceSelectionSchema>
export type MetaSkillRecommendation = z.infer<typeof metaSkillRecommendationSchema>
export type ReskillingPlan = z.infer<typeof reskillingPlanSchema>
export type ResourceRegistryEntry = z.infer<typeof resourceRegistryEntrySchema>
export type ResourceRegistry = z.infer<typeof resourceRegistrySchema>

export type Step =
  | { kind: 'input' }
  | { kind: 'researching' }
  | { kind: 'pickMatch'; candidates: JobCandidate[]; query: string; context: string }
  | { kind: 'confirm'; profile: JobProfile; userContextProvided: boolean }
  | { kind: 'scoring'; profile: JobProfile }
  | { kind: 'advising'; profile: JobProfile; risk: RiskProfile }
  | {
      kind: 'results'
      profile: JobProfile
      risk: RiskProfile
      plan: ReskillingPlan
    }
  | { kind: 'error'; message: string; retryStep: RetryableStep }

export type RetryableStep = 'research' | 'score' | 'advise'
