import type { JobProfile } from '../types'

interface OnetTask {
  id: number | null
  text: string
}

interface OnetOccupation {
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

export async function findJobProfile(
  jobTitle: string,
  context?: string,
): Promise<JobProfile> {
  const dataset = await loadDataset()
  const match = bestMatch(dataset.occupations, jobTitle)
  if (!match) throw new OnetNoMatchError(jobTitle)

  return {
    job_title: match.title,
    onet_match: `${match.code} ${match.title}`,
    tasks: match.tasks.slice(0, 15).map((t) => ({
      name: t.text,
      description: '',
    })),
    skills: match.skills.slice(0, 12),
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

// Return the single highest-scoring occupation for a free-text job title.
// Scoring favors, in order:
//   exact title match → exact alt/reported title → substring match → token overlap.
function bestMatch(
  occupations: OnetOccupation[],
  query: string,
): OnetOccupation | null {
  const q = normalize(query)
  if (!q) return null
  const qTokens = tokenize(query)

  let best: { occ: OnetOccupation; score: number } | null = null

  for (const occ of occupations) {
    const score = scoreOccupation(occ, q, qTokens)
    if (score <= 0) continue
    if (!best || score > best.score) best = { occ, score }
  }

  return best?.occ ?? null
}

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

  // Token overlap fallback: count matching tokens against the title.
  const titleTokens = new Set(tokenize(occ.title))
  let overlap = 0
  for (const t of qTokens) if (titleTokens.has(t)) overlap++
  if (overlap > 0) {
    score = Math.max(score, 100 + overlap * 30)
  }

  return score
}
