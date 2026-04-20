import { Chip } from './ui/Chip'
import { Dateline } from './ui/Dateline'
import { Kicker } from './ui/Kicker'
import { cn } from '../lib/cn'
import { resolveRegistryId } from '../lib/resourceRegistry'
import type {
  ResourceRegistryEntry,
  ResourceSelection,
  ReskillingPlan,
} from '../types'

interface Props {
  plan: ReskillingPlan
  registry: ResourceRegistryEntry[]
}

export function ReskillingPanel({ plan, registry }: Props) {
  const meta = plan.meta_skill_recommendation
  const metaEntries = resolveSelections(meta.resources, registry)
  const resourceEntries = resolveSelections(plan.resources, registry)

  return (
    <section
      className="anim-reveal panel"
      style={{ animationDelay: '220ms' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair-2 px-6 py-5 md:px-10 md:py-7">
        <Dateline rule>Figure 03 · Reskilling playbook</Dateline>
        <Dateline className="shrink-0">
          {plan.recommended_jobs.length} adjacent roles ·{' '}
          {resourceEntries.length + metaEntries.length} resources
        </Dateline>
      </div>

      {/* Meta-skill hero */}
      <article className="bg-accent px-6 py-10 text-panel-2 md:px-10 md:py-12">
        <div className="max-w-4xl">
          <Kicker
            index="◎"
            label="Meta-skill · Working alongside AI"
            tone="inverse"
          />
          <h3
            className="display-serif mt-4 text-[34px] leading-[1.08] md:text-[48px]"
            style={{ letterSpacing: '-0.018em' }}
          >
            {meta.headline}
          </h3>
          <p className="mt-5 max-w-[62ch] font-display text-[19px] italic leading-[1.45] text-panel-2/85 md:text-[21px]">
            {meta.rationale}
          </p>
        </div>

        {metaEntries.length > 0 && (
          <div className="mt-10 border-t border-panel-2/15 pt-8">
            <Dateline rule tone="inverse">
              Starting resources
            </Dateline>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {metaEntries.map(({ selection, entry }) => (
                <ResourceRow
                  key={selection.registry_id}
                  entry={entry}
                  relevance={selection.relevance}
                  inverse
                />
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Transferable skills */}
      <div className="border-b border-hair-2 px-6 py-10 md:px-10 md:py-12">
        <Kicker index="§" label="Skills that transfer" />
        <p
          className="display-serif mt-3 max-w-[55ch] text-[22px] leading-[1.3] text-ink md:text-[26px]"
          style={{ letterSpacing: '-0.014em' }}
        >
          Competencies you've already built that carry into lower-exposure work.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {plan.transferable_skills.map((skill) => (
            <Chip key={skill} tone="safe" size="md">
              {skill}
            </Chip>
          ))}
        </div>
      </div>

      {/* Recommended jobs */}
      <div className="border-b border-hair-2 px-6 py-10 md:px-10 md:py-12">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <Kicker index="§" label="Adjacent, lower-risk pathways" />
          <Dateline className="shrink-0">
            Higher bar = higher risk · 0–100
          </Dateline>
        </div>

        <ul className="mt-8 divide-y divide-hair">
          {plan.recommended_jobs.map((job, i) => (
            <li
              key={job.title}
              className="anim-reveal grid gap-4 py-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-center md:gap-8"
              style={{ animationDelay: `${260 + i * 40}ms` }}
            >
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="num font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h4 className="display-serif text-[22px] leading-tight text-ink md:text-[24px]">
                    {job.title}
                  </h4>
                </div>
                <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-ink-2">
                  {job.why_good_fit}
                </p>
              </div>
              <JobRiskBar score={job.risk_score} />
            </li>
          ))}
        </ul>
      </div>

      {/* Resources */}
      <div className="px-6 py-10 md:px-10 md:py-12">
        <Kicker index="§" label="Verified reskilling resources" />
        <p className="mt-3 max-w-[55ch] text-[14px] leading-relaxed text-muted">
          Curated from a vetted registry — URLs verified at build time. Hand-picked
          by the model from entries relevant to your SOC major group.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {resourceEntries.map(({ selection, entry }, i) => (
            <div
              key={selection.registry_id}
              className="anim-reveal"
              style={{ animationDelay: `${320 + i * 50}ms` }}
            >
              <ResourceRow entry={entry} relevance={selection.relevance} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function JobRiskBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        <span>Automation risk</span>
        <span
          className="display-serif num text-[22px] leading-none text-safe"
          style={{ letterSpacing: '-0.02em' }}
        >
          {Math.round(pct)}
        </span>
      </div>
      <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-hair-2">
        <div
          className="bar-fill h-full rounded-full"
          style={{
            width: `${pct}%`,
            background:
              'linear-gradient(90deg, var(--color-safe) 0%, var(--color-safe-2) 100%)',
            transformOrigin: 'left',
          }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-muted/70">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
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
  inverse = false,
}: {
  entry: ResourceRegistryEntry
  relevance: string
  inverse?: boolean
}) {
  return (
    <a
      href={entry.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group relative flex h-full flex-col justify-between gap-3 rounded-[2px] border p-4 transition-all duration-300',
        inverse
          ? 'border-panel-2/20 bg-panel-2/5 hover:border-panel-2/40 hover:bg-panel-2/10'
          : 'border-hair bg-panel-2 hover:-translate-y-0.5 hover:border-ink hover:shadow-[var(--shadow-sm)]',
      )}
    >
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={cn(
              'font-mono text-[10px] uppercase tracking-[0.2em]',
              inverse ? 'text-panel-2/60' : 'text-muted',
            )}
          >
            {platformLabel(entry.platform)}
          </span>
          <span
            className={cn(
              'font-mono text-[10px] uppercase tracking-[0.2em]',
              inverse ? 'text-panel-2/60' : 'text-muted',
            )}
          >
            {entry.type} · {entry.level}
          </span>
        </div>
        <h4
          className={cn(
            'display-serif mt-3 text-[19px] leading-[1.2] md:text-[20px]',
            inverse ? 'text-panel-2' : 'text-ink',
          )}
          style={{ letterSpacing: '-0.012em' }}
        >
          {entry.title}
        </h4>
      </div>
      <p
        className={cn(
          'text-[12px] leading-relaxed italic',
          inverse ? 'text-panel-2/80' : 'text-ink-2',
        )}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {relevance}
      </p>
      <div
        className={cn(
          'mt-1 flex items-center justify-end font-mono text-[10px] uppercase tracking-[0.2em] transition-transform duration-300',
          inverse ? 'text-panel-2/60' : 'text-muted',
        )}
      >
        <span className="transition-transform duration-300 group-hover:translate-x-1">
          Open ↗
        </span>
      </div>
    </a>
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
      return 'LinkedIn'
    case 'anthropic_docs':
      return 'Anthropic'
    case 'deeplearning_ai':
      return 'DeepLearning.AI'
    case 'other':
      return 'Other'
  }
}
