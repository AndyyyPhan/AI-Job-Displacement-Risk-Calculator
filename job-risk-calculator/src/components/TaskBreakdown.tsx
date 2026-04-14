import type { BottleneckType, ScoredTask } from '../types'

interface Props {
  tasks: ScoredTask[]
}

export function TaskBreakdown({ tasks }: Props) {
  const sorted = [...tasks].sort((a, b) => b.automation_risk - a.automation_risk)
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Task-by-task breakdown</h2>
      <p className="mt-1 text-sm text-slate-500">
        Sorted by automation risk. Higher bars = easier to automate.
      </p>
      <ul className="mt-6 space-y-4">
        {sorted.map((task, i) => (
          <li key={`${task.name}-${i}`} className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-medium text-slate-900">{task.name}</p>
              <span className="text-sm font-semibold tabular-nums text-slate-600">
                {Math.round(task.automation_risk)}% risk
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(task.automation_risk)}%`,
                  backgroundColor: riskColor(task.automation_risk),
                }}
              />
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{task.rationale}</p>
            {task.bottleneck_types.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {task.bottleneck_types.map((bt) => (
                  <span
                    key={bt}
                    className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
                  >
                    {bottleneckLabel(bt)}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function riskColor(risk: number): string {
  if (risk >= 80) return '#dc2626'
  if (risk >= 60) return '#ea580c'
  if (risk >= 40) return '#eab308'
  if (risk >= 20) return '#22c55e'
  return '#16a34a'
}

function bottleneckLabel(bt: BottleneckType): string {
  switch (bt) {
    case 'novel_problem_solving':
      return 'Novel problem-solving'
    case 'social_interpersonal':
      return 'Social / interpersonal'
    case 'physical_dexterity':
      return 'Physical dexterity'
  }
}
