import type { z } from 'zod'
import type {
  jobProfileSchema,
  jobTaskSchema,
  riskProfileSchema,
  scoredTaskSchema,
  bottleneckTypeSchema,
  interactionTypeSchema,
  reskillingPlanSchema,
  recommendedJobSchema,
  resourceSchema,
  metaSkillRecommendationSchema,
} from '../agents/schemas'

import type { OnetOccupation } from '../lib/onet'

export interface JobCandidate {
  occupation: OnetOccupation
  score: number
}

export type JobTask = z.infer<typeof jobTaskSchema>
export type JobProfile = z.infer<typeof jobProfileSchema>
export type BottleneckType = z.infer<typeof bottleneckTypeSchema>
export type InteractionType = z.infer<typeof interactionTypeSchema>
export type ScoredTask = z.infer<typeof scoredTaskSchema>
export type RiskProfile = z.infer<typeof riskProfileSchema>
export type RecommendedJob = z.infer<typeof recommendedJobSchema>
export type Resource = z.infer<typeof resourceSchema>
export type MetaSkillRecommendation = z.infer<typeof metaSkillRecommendationSchema>
export type ReskillingPlan = z.infer<typeof reskillingPlanSchema>

export type Step =
  | { kind: 'input' }
  | { kind: 'researching' }
  | { kind: 'pickMatch'; candidates: JobCandidate[]; query: string; context: string }
  | { kind: 'confirm'; profile: JobProfile }
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
