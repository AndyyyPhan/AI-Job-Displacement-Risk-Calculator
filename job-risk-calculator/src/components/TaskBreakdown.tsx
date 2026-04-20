import { Chip } from './ui/Chip'
import { Dateline } from './ui/Dateline'
import { Kicker } from './ui/Kicker'
import { Sparkbar } from './ui/Sparkbar'
import { cn } from '../lib/cn'
import { riskColor } from '../lib/formatters'
import type {
  BottleneckType,
  InteractionType,
  ScoredTask,
} from '../types'

interface Props {
  tasks: ScoredTask[]
}

export function TaskBreakdown({ tasks }: Props) {
  const sorted = [...tasks].sort((a, b) => b.automation_risk - a.automation_risk)
  return (
    <section
      className="anim-reveal panel"
      style={{ animationDelay: '180ms' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair-2 px-6 py-5 md:px-10 md:py-7">
        <Dateline rule>Figure 02 · Task dossier</Dateline>
        <Dateline className="shrink-0">
          {tasks.length} tasks · sorted by automation risk
        </Dateline>
      </div>

      <div className="px-6 py-8 md:px-10 md:py-10">
        <Kicker index="§" label="Where the risk concentrates" />
        <p
          className="display-serif mt-3 max-w-[55ch] text-[22px] leading-[1.3] text-ink md:text-[26px]"
          style={{ letterSpacing: '-0.014em' }}
        >
          Each task scored against the theoretical Eloundou β and the bottleneck
          dimensions that might keep it human.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:gap-8">
          {sorted.map((task, i) => (
            <TaskCard key={`${task.name}-${i}`} task={task} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function TaskCard({ task, index }: { task: ScoredTask; index: number }) {
  const accent = riskColor(task.automation_risk)
  const isTop = index < 3
  const hasExtendedRationale = task.rationale.length > 120

  return (
    <article
      className={cn(
        'anim-reveal relative overflow-hidden rounded-[3px] border border-hair bg-panel-2 p-5 md:p-6',
      )}
      style={{
        animationDelay: `${220 + index * 60}ms`,
      }}
    >
      {/* Left accent rule for top items */}
      {isTop && (
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full w-[3px]"
          style={{ background: accent }}
        />
      )}

      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="num font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            {String(index + 1).padStart(2, '0')}
          </span>
          <Chip tone="muted" glyph="β">
            {task.beta.toFixed(2)}
          </Chip>
        </div>
        <div className="flex flex-col items-end">
          <span
            className="display-serif text-[34px] leading-none num"
            style={{ color: accent, letterSpacing: '-0.02em' }}
          >
            {Math.round(task.automation_risk)}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
            automation risk
          </span>
        </div>
      </div>

      <h3
        className="display-serif mt-4 text-[22px] leading-[1.25] text-ink md:text-[24px]"
        style={{ letterSpacing: '-0.012em' }}
      >
        {task.name}
      </h3>

      <div className="mt-5">
        <Sparkbar value={task.automation_risk} delayMs={320 + index * 60} height={5} />
        <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-muted/70">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {hasExtendedRationale ? (
        <details className="group mt-5">
          <summary
            className={cn(
              'flex cursor-pointer items-center justify-between gap-3 text-[13px] leading-relaxed text-ink-2 list-none',
              'marker:hidden',
            )}
          >
            <span className="line-clamp-2 flex-1 pr-2">{task.rationale}</span>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors group-open:text-ink">
              <span className="group-open:hidden">Expand ↓</span>
              <span className="hidden group-open:inline">Collapse ↑</span>
            </span>
          </summary>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
            {task.rationale}
          </p>
        </details>
      ) : (
        <p className="mt-5 text-[13px] leading-relaxed text-ink-2">
          {task.rationale}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hair-2 pt-4">
        <Chip tone={interactionTone(task.predicted_interaction_type)} glyph={interactionGlyph(task.predicted_interaction_type)}>
          {interactionLabel(task.predicted_interaction_type)}
        </Chip>
        {task.bottleneck_types.map((bt) => (
          <Chip key={bt} tone={bottleneckTone(bt)} glyph={bottleneckGlyph(bt)}>
            {bottleneckLabel(bt)}
          </Chip>
        ))}
      </div>
    </article>
  )
}

function bottleneckLabel(bt: BottleneckType): string {
  switch (bt) {
    case 'novel_problem_solving':
      return 'Novel problem-solving'
    case 'social_interpersonal':
      return 'Social / interpersonal'
    case 'physical_dexterity':
      return 'Physical dexterity'
    case 'api_migration_signal':
      return 'API migration signal'
  }
}

function bottleneckGlyph(bt: BottleneckType): string {
  switch (bt) {
    case 'novel_problem_solving':
      return '●'
    case 'social_interpersonal':
      return '◆'
    case 'physical_dexterity':
      return '▲'
    case 'api_migration_signal':
      return '↗'
  }
}

function bottleneckTone(bt: BottleneckType): 'accent' | 'warn' {
  return bt === 'api_migration_signal' ? 'warn' : 'accent'
}

function interactionLabel(t: InteractionType): string {
  switch (t) {
    case 'directive':
      return 'Directive'
    case 'feedback_loop':
      return 'Feedback loop'
    case 'task_iteration':
      return 'Task iteration'
    case 'validation':
      return 'Validation'
    case 'learning':
      return 'Learning'
  }
}

function interactionGlyph(t: InteractionType): string {
  switch (t) {
    case 'directive':
      return '→'
    case 'feedback_loop':
      return '↻'
    case 'task_iteration':
      return '≡'
    case 'validation':
      return '✓'
    case 'learning':
      return '◇'
  }
}

function interactionTone(
  t: InteractionType,
): 'safe' | 'caution' | 'risk' | 'muted' {
  if (t === 'directive' || t === 'feedback_loop') return 'risk'
  if (t === 'task_iteration') return 'caution'
  return 'safe'
}
