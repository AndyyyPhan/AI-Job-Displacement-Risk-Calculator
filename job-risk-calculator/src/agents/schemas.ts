import { z } from 'zod'

export const jobTaskSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
})

export const jobProfileSchema = z.object({
  job_title: z.string().min(1),
  onet_match: z.string().min(1),
  tasks: z.array(jobTaskSchema).min(1),
  skills: z.array(z.string()).min(1),
  additional_context: z.string(),
})

export const bottleneckTypeSchema = z.enum([
  'novel_problem_solving',
  'social_interpersonal',
  'physical_dexterity',
])

export const scoredTaskSchema = z.object({
  name: z.string().min(1),
  bottleneck_score: z.number().min(0).max(100),
  automation_risk: z.number().min(0).max(100),
  rationale: z.string().min(1),
  bottleneck_types: z.array(bottleneckTypeSchema),
})

export const riskProfileSchema = z.object({
  overall_risk_score: z.number().min(0).max(100),
  timeline_category: z.enum(['near-term', 'mid-term', 'long-term']),
  timeline_years_low: z.number().min(0).max(50),
  timeline_years_high: z.number().min(0).max(50),
  scored_tasks: z.array(scoredTaskSchema).min(1),
  risk_rationale: z.string().min(1),
})

export const recommendedJobSchema = z.object({
  title: z.string().min(1),
  risk_score: z.number().min(0).max(100),
  why_good_fit: z.string().min(1),
})

export const resourceSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['course', 'book', 'platform', 'article']),
  url: z.string().url(),
  relevance: z.string().min(1),
})

export const reskillingPlanSchema = z.object({
  transferable_skills: z.array(z.string()).min(1),
  recommended_jobs: z.array(recommendedJobSchema).min(1),
  resources: z.array(resourceSchema).min(1),
})
