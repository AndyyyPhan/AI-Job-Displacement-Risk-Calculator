import {
  matchOnetOccupation,
  buildJobProfileFromOccupation,
  OnetNoMatchError,
  type OnetOccupation,
} from '../lib/onet'
import type { JobCandidate, JobProfile } from '../types'

export interface JobResearcherInput {
  jobTitle: string
  context?: string
}

export type JobResearcherResult =
  | { type: 'strong'; profile: JobProfile }
  | { type: 'ambiguous'; candidates: JobCandidate[]; query: string }

export async function researchJob(
  input: JobResearcherInput,
): Promise<JobResearcherResult> {
  const result = await matchOnetOccupation(input.jobTitle)
  switch (result.type) {
    case 'none':
      throw new OnetNoMatchError(input.jobTitle)
    case 'strong':
      return {
        type: 'strong',
        profile: buildJobProfileFromOccupation(
          result.match.occupation,
          input.context,
        ),
      }
    case 'ambiguous':
      return {
        type: 'ambiguous',
        candidates: result.candidates.map((c) => ({
          occupation: c.occupation,
          score: c.score,
        })),
        query: input.jobTitle,
      }
  }
}

export function finalizeJobResearch(
  occupation: OnetOccupation,
  context: string,
): JobProfile {
  return buildJobProfileFromOccupation(occupation, context)
}
