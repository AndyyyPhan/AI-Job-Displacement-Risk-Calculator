import type { JobProfile } from '../types'

interface OnetTask {
  id: number | null
  text: string
}

export interface OnetOccupation {
  code: string
  title: string
  description: string
  altTitles: string[]
  reportedTitles: string[]
  tasks: OnetTask[]
  skills: string[]
}

interface OnetDataset {
  generatedAt: string
  occupationCount: number
  coreTaskCount: number
  occupations: OnetOccupation[]
}

export interface RankedMatch {
  occupation: OnetOccupation
  score: number
}

export type OnetMatchResult =
  | { type: 'strong'; match: RankedMatch }
  | { type: 'ambiguous'; candidates: RankedMatch[] }
  | { type: 'none' }

// Anything at or above this normalized score is auto-accepted on its own —
// it corresponds to exact title / alt-title / reported-title hits in the
// underlying raw scoring.
const EXACT_TIER = 0.85
// Below EXACT_TIER we still auto-accept a strong lead: the top score must
// clear STRONG_CONFIDENCE and beat the runner-up by at least STRONG_GAP.
const STRONG_CONFIDENCE = 0.7
const STRONG_GAP = 0.15
// Candidates below this confidence are not worth showing in the picker.
const MIN_CANDIDATE = 0.1
const MAX_CANDIDATES = 5

let cachedDataset: OnetDataset | null = null

async function loadDataset(): Promise<OnetDataset> {
  if (cachedDataset) return cachedDataset
  const mod = await import('../data/onet.json')
  cachedDataset = mod.default as OnetDataset
  return cachedDataset
}

export class OnetNoMatchError extends Error {
  constructor(query: string) {
    super(`No O*NET occupation matched "${query}".`)
    this.name = 'OnetNoMatchError'
  }
}

export async function matchOnetOccupation(
  jobTitle: string,
): Promise<OnetMatchResult> {
  const dataset = await loadDataset()
  const q = normalize(jobTitle)
  if (!q) return { type: 'none' }
  const qTokens = tokenize(jobTitle)

  const ranked: RankedMatch[] = dataset.occupations
    .map((occupation) => ({
      occupation,
      score: scoreOccupation(occupation, q, qTokens) / 1000,
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)

  if (ranked.length === 0) return { type: 'none' }

  const top = ranked[0]
  const runnerUp = ranked[1]?.score ?? 0
  const isStrong =
    top.score >= EXACT_TIER ||
    (top.score >= STRONG_CONFIDENCE && top.score - runnerUp >= STRONG_GAP)

  if (isStrong) return { type: 'strong', match: top }

  const candidates = ranked
    .filter((m) => m.score >= MIN_CANDIDATE)
    .slice(0, MAX_CANDIDATES)

  if (candidates.length === 0) return { type: 'none' }
  return { type: 'ambiguous', candidates }
}

export function buildJobProfileFromOccupation(
  occupation: OnetOccupation,
  context?: string,
): JobProfile {
  return {
    job_title: occupation.title,
    onet_match: `${occupation.code} ${occupation.title}`,
    tasks: occupation.tasks.slice(0, 15).map((t) => ({
      name: t.text,
      description: '',
    })),
    skills: occupation.skills.slice(0, 12),
    additional_context: context?.trim() ?? '',
  }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean)
}

// Raw-score hierarchy (returned unnormalized, divided by 1000 by caller):
//   exact title → exact alt/reported title → substring → token overlap.
function scoreOccupation(
  occ: OnetOccupation,
  q: string,
  qTokens: string[],
): number {
  const title = normalize(occ.title)
  if (title === q) return 1000
  const alts = occ.altTitles.map(normalize)
  if (alts.includes(q)) return 900
  const reported = occ.reportedTitles.map(normalize)
  if (reported.includes(q)) return 850

  let score = 0
  if (title.includes(q)) score = Math.max(score, 700 - (title.length - q.length))
  if (q.includes(title)) score = Math.max(score, 650)
  for (const alt of alts) {
    if (alt.includes(q)) score = Math.max(score, 550 - (alt.length - q.length))
    if (q.includes(alt) && alt.length > 3) score = Math.max(score, 500)
  }
  for (const rep of reported) {
    if (rep.includes(q)) score = Math.max(score, 450 - (rep.length - q.length))
  }

  const titleTokens = new Set(tokenize(occ.title))
  let overlap = 0
  for (const t of qTokens) if (titleTokens.has(t)) overlap++
  if (overlap > 0) {
    score = Math.max(score, 100 + overlap * 30)
  }

  return score
}
