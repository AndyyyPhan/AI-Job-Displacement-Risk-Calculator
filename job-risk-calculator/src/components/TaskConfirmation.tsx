import { useRef, useState } from 'react'
import { Chip } from './ui/Chip'
import { Dateline } from './ui/Dateline'
import { Kicker } from './ui/Kicker'
import { cn } from '../lib/cn'
import { parseSocCode } from '../lib/formatters'
import type { JobProfile, JobTask } from '../types'

interface Props {
  profile: JobProfile
  onConfirm: (updatedProfile: JobProfile, userCustomizedTasks: boolean) => void
  onBack: () => void
}

export function TaskConfirmation({ profile, onConfirm, onBack }: Props) {
  const [tasks, setTasks] = useState<JobTask[]>(profile.tasks)
  const [draftName, setDraftName] = useState('')
  const [customized, setCustomized] = useState(false)
  const originalTasksRef = useRef(profile.tasks)
  const { code, title } = parseSocCode(profile.onet_match)

  function markCustomized() {
    if (!customized) setCustomized(true)
  }

  function removeTask(index: number) {
    markCustomized()
    setTasks((prev) => prev.filter((_, i) => i !== index))
  }

  function addTask() {
    const name = draftName.trim()
    if (!name) return
    markCustomized()
    setTasks((prev) => [
      ...prev,
      { name, description: name, beta: profile.empirical.occupation_beta },
    ])
    setDraftName('')
  }

  function handleConfirm() {
    const wasCustomized =
      customized ||
      tasks.length !== originalTasksRef.current.length ||
      tasks.some((t, i) => t.name !== originalTasksRef.current[i]?.name)
    onConfirm({ ...profile, tasks }, wasCustomized)
  }

  return (
    <div className="anim-reveal">
      <button
        type="button"
        onClick={onBack}
        className="mb-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-ink"
      >
        <span aria-hidden>←</span> Start over
      </button>

      <Kicker index="§" label="Confirm the task record" />
      <h1
        className="display-serif mt-4 text-[44px] leading-[1.02] text-ink sm:text-[56px] md:text-[64px]"
        style={{ letterSpacing: '-0.022em' }}
      >
        Is this <span className="italic font-light text-ink-2">actually</span>{' '}
        your day?
      </h1>

      <div className="mt-6 grid gap-4 border-t border-hair pt-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8">
        <Dateline>Matched occupation</Dateline>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="display-serif text-[22px] leading-tight text-ink md:text-[26px]">
            {title}
          </span>
          <span className="num font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            {code}
          </span>
        </p>
      </div>
      <p className="mt-6 max-w-[58ch] text-[14px] leading-relaxed text-ink-2">
        Remove anything that doesn't apply to your day-to-day, or add tasks we
        missed. The β values come from Eloundou et al. — higher means more
        theoretically LLM-exposed.
      </p>

      {profile.additional_context.trim() && (
        <aside className="mt-6 flex items-start gap-4 border border-hair-2 bg-panel-2 p-5">
          <Dateline>Your context</Dateline>
          <p
            className="relative flex-1 font-display text-[16px] italic leading-[1.45] text-ink-2"
            style={{ letterSpacing: '-0.004em' }}
          >
            <span
              aria-hidden
              className="absolute -left-1 -top-1 font-display text-2xl not-italic text-ink/30"
            >
              “
            </span>
            <span className="pl-3">{profile.additional_context}</span>
          </p>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Will adjust score
          </span>
        </aside>
      )}

      <ol className="mt-10 border-t border-hair">
        {tasks.map((task, i) => (
          <li
            key={`${task.name}-${i}`}
            className="group grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4 border-b border-hair py-5 md:gap-6"
          >
            <div className="flex flex-col items-start gap-2 pt-1">
              <span className="num font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
                {String(i + 1).padStart(2, '0')}
              </span>
              <Chip tone={betaTone(task.beta)} glyph="β">
                {task.beta.toFixed(2)}
              </Chip>
            </div>
            <div className="min-w-0">
              <p
                className="display-serif text-[19px] leading-snug text-ink md:text-[20px]"
                style={{ letterSpacing: '-0.01em' }}
              >
                {task.name}
              </p>
              {task.description && task.description !== task.name && (
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
                  {task.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeTask(i)}
              className="ml-auto self-start rounded-[2px] border border-transparent px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted opacity-0 transition-all duration-200 hover:border-risk/40 hover:bg-risk/5 hover:text-risk focus:opacity-100 group-hover:opacity-100"
              aria-label={`Remove ${task.name}`}
            >
              × Remove
            </button>
          </li>
        ))}
      </ol>

      {/* Add task */}
      <div className="mt-8">
        <Dateline>Add a task we missed</Dateline>
        <div className="mt-3 flex gap-3 border-b border-hair">
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTask()
              }
            }}
            placeholder="e.g. Reviewing diagnostic imaging reports…"
            className={cn(
              'flex-1 border-0 bg-transparent py-3 font-display text-[18px] text-ink placeholder:text-muted/60',
              'focus:outline-none focus:ring-0 md:text-[20px]',
            )}
          />
          <button
            type="button"
            onClick={addTask}
            disabled={!draftName.trim()}
            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ink disabled:text-muted/50"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Confirm CTA */}
      <div className="mt-14 flex flex-col items-stretch gap-4 border-t border-hair pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          {tasks.length} task{tasks.length === 1 ? '' : 's'} will be analyzed
          {customized ? ' · customized' : ''}
        </p>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={tasks.length === 0}
          className={cn(
            'arrow-right inline-flex items-center justify-center gap-3 rounded-[2px] px-6 py-4 font-mono text-[11px] uppercase tracking-[0.22em] transition-all duration-300',
            tasks.length === 0
              ? 'cursor-not-allowed bg-hair text-muted/60'
              : 'bg-ink text-panel-2 shadow-[0_10px_30px_-10px_rgba(20,20,25,0.4)] hover:-translate-y-px hover:bg-accent',
          )}
        >
          Run analysis
        </button>
      </div>
    </div>
  )
}

function betaTone(beta: number): 'safe' | 'caution' | 'warn' | 'risk' {
  if (beta >= 0.75) return 'risk'
  if (beta >= 0.5) return 'warn'
  if (beta >= 0.25) return 'caution'
  return 'safe'
}
