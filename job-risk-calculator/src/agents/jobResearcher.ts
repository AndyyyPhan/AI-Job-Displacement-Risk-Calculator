import { findJobProfile } from '../lib/onet'
import type { JobProfile } from '../types'

export interface JobResearcherInput {
  jobTitle: string
  context?: string
}

export async function researchJob(
  input: JobResearcherInput,
): Promise<JobProfile> {
  return findJobProfile(input.jobTitle, input.context)
}
