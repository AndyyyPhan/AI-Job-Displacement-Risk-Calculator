import type {
  ResourceRegistryEntry,
  ResourceSelection,
  ReskillingPlan,
} from '../types'
import { resolveRegistryId } from '../lib/resourceRegistry'

interface Props {
  plan: ReskillingPlan
  registry: ResourceRegistryEntry[]
}

export function ReskillingPanel({ plan, registry }: Props) {
  const meta = plan.meta_skill_recommendation
  const metaEntries = resolveSelections(meta.resources, registry)
  const resourceEntries = resolveSelections(plan.resources, registry)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Your reskilling playbook</h2>

      <section className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Meta-skill · learn to work with AI
        </p>
        <p className="mt-2 text-base font-semibold text-slate-900">{meta.headline}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{meta.rationale}</p>
        <ul className="mt-4 space-y-2">
          {metaEntries.map(({ selection, entry }) => (
            <li
              key={selection.registry_id}
              className="rounded-lg border border-indigo-100 bg-white p-3"
            >
              <ResourceRow entry={entry} relevance={selection.relevance} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Skills that transfer
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {plan.transferable_skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800"
            >
              {skill}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Lower-risk jobs that could fit you
        </h3>
        <ul className="mt-3 space-y-3">
          {plan.recommended_jobs.map((job) => (
            <li
              key={job.title}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-semibold text-slate-900">{job.title}</p>
                <span className="text-sm font-semibold tabular-nums text-emerald-700">
                  {Math.round(job.risk_score)}% risk
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{job.why_good_fit}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Reskilling resources
        </h3>
        <ul className="mt-3 space-y-3">
          {resourceEntries.map(({ selection, entry }) => (
            <li key={selection.registry_id} className="rounded-xl border border-slate-200 p-4">
              <ResourceRow entry={entry} relevance={selection.relevance} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

interface ResolvedResource {
  selection: ResourceSelection
  entry: ResourceRegistryEntry
}

function resolveSelections(
  selections: ResourceSelection[],
  registry: ResourceRegistryEntry[],
): ResolvedResource[] {
  const resolved: ResolvedResource[] = []
  for (const selection of selections) {
    const entry = resolveRegistryId(registry, selection.registry_id)
    if (!entry) {
      console.warn(
        `[ReskillingPanel] registry_id "${selection.registry_id}" not found in bundled registry; skipping`,
      )
      continue
    }
    resolved.push({ selection, entry })
  }
  return resolved
}

function ResourceRow({
  entry,
  relevance,
}: {
  entry: ResourceRegistryEntry
  relevance: string
}) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-indigo-700 hover:underline"
        >
          {entry.title}
        </a>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600">
            {platformLabel(entry.platform)}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600">
            {entry.type}
          </span>
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{relevance}</p>
    </>
  )
}

function platformLabel(platform: ResourceRegistryEntry['platform']): string {
  switch (platform) {
    case 'coursera':
      return 'Coursera'
    case 'edx':
      return 'edX'
    case 'mit_ocw':
      return 'MIT OCW'
    case 'oreilly':
      return "O'Reilly"
    case 'khan_academy':
      return 'Khan Academy'
    case 'udemy':
      return 'Udemy'
    case 'linkedin_learning':
      return 'LinkedIn Learning'
    case 'anthropic_docs':
      return 'Anthropic Docs'
    case 'deeplearning_ai':
      return 'DeepLearning.AI'
    case 'other':
      return 'Other'
  }
}
