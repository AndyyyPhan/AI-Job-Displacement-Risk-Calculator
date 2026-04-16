import { z } from 'zod'

export const jobTaskSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  beta: z.number().min(0).max(1),
})

export const empiricalInputsSchema = z.object({
  occupation_beta: z.number().min(0).max(1),
  observed_exposure: z.number().min(0).max(1),
  exposure_gap: z.number().min(-1).max(1),
  median_wage: z.number().nonnegative(),
  wage_quartile: z.number().int().min(1).max(4),
  bls_projected_growth_pct: z.number(),
  fallback_fields: z.array(z.string()).optional(),
})

export const empiricalContextSchema = empiricalInputsSchema.extend({
  empirical_baseline_score: z.number().min(0).max(100),
})

export const jobProfileSchema = z.object({
  job_title: z.string().min(1),
  onet_match: z.string().min(1),
  soc_major_group: z.string().min(1),
  tasks: z.array(jobTaskSchema).min(1),
  skills: z.array(z.string()).min(1),
  additional_context: z.string(),
  empirical: empiricalContextSchema,
})

export const bottleneckTypeSchema = z.enum([
  'novel_problem_solving',
  'social_interpersonal',
  'physical_dexterity',
  'api_migration_signal',
])

export const interactionTypeSchema = z.enum([
  'directive',
  'feedback_loop',
  'task_iteration',
  'validation',
  'learning',
])

export const scoredTaskSchema = z.object({
  name: z.string().min(1),
  beta: z.number().min(0).max(1),
  bottleneck_score: z.number().min(0).max(100),
  automation_risk: z.number().min(0).max(100),
  rationale: z.string().min(1),
  bottleneck_types: z.array(bottleneckTypeSchema),
  predicted_interaction_type: interactionTypeSchema,
})

export const riskProfileSchema = z.object({
  empirical_baseline_score: z.number().min(0).max(100),
  adjusted_risk_score: z.number().min(0).max(100),
  adjustment_rationale: z.string().min(1),
  timeline_category: z.enum(['near-term', 'mid-term', 'long-term']),
  timeline_years_low: z.number().min(0).max(50),
  timeline_years_high: z.number().min(0).max(50),
  scored_tasks: z.array(scoredTaskSchema).min(1),
  risk_rationale: z.string().min(1),
  spectrum_summary: z.string().min(1),
})

export const recommendedJobSchema = z.object({
  title: z.string().min(1),
  risk_score: z.number().min(0).max(100),
  why_good_fit: z.string().min(1),
})

export const resourceSelectionSchema = z.object({
  registry_id: z.string().min(1),
  relevance: z.string().min(1),
})

export const metaSkillRecommendationSchema = z.object({
  headline: z.string().min(1),
  rationale: z.string().min(1),
  resources: z.array(resourceSelectionSchema).min(2).max(3),
})

export const reskillingPlanSchema = z.object({
  transferable_skills: z.array(z.string()).min(1),
  recommended_jobs: z.array(recommendedJobSchema).min(1),
  resources: z.array(resourceSelectionSchema).min(1),
  meta_skill_recommendation: metaSkillRecommendationSchema,
})

export const resourceRegistryEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  platform: z.enum([
    'coursera',
    'edx',
    'mit_ocw',
    'oreilly',
    'khan_academy',
    'udemy',
    'linkedin_learning',
    'anthropic_docs',
    'deeplearning_ai',
    'other',
  ]),
  url: z.string().url(),
  skill_categories: z.array(z.string()).min(1),
  occupational_families: z.array(z.string()).min(1),
  type: z.enum(['course', 'book', 'platform', 'certification', 'article']),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
})

export const resourceRegistrySchema = z.object({
  generatedAt: z.string(),
  entries: z.array(resourceRegistryEntrySchema),
})
