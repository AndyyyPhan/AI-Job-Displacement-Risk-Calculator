import { useState } from 'react'
import type { JobProfile, JobTask } from '../types'

interface Props {
  profile: JobProfile
  onConfirm: (updatedProfile: JobProfile) => void
  onBack: () => void
}

export function TaskConfirmation({ profile, onConfirm, onBack }: Props) {
  const [tasks, setTasks] = useState<JobTask[]>(profile.tasks)
  const [draftName, setDraftName] = useState('')

  function removeTask(index: number) {
    setTasks((prev) => prev.filter((_, i) => i !== index))
  }

  function addTask() {
    const name = draftName.trim()
    if (!name) return
    setTasks((prev) => [...prev, { name, description: name }])
    setDraftName('')
  }

  function handleConfirm() {
    onConfirm({ ...profile, tasks })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Start over
        </button>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          Is this what you actually do?
        </h1>
        <p className="mt-2 text-slate-600">
          We found <span className="font-semibold">{profile.onet_match}</span>. Remove
          anything that doesn't apply to your day-to-day, or add tasks we missed.
        </p>
      </div>

      <ul className="space-y-3">
        {tasks.map((task, i) => (
          <li
            key={`${task.name}-${i}`}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex-1">
              <p className="font-medium text-slate-900">{task.name}</p>
              {task.description && (
                <p className="mt-1 text-sm text-slate-600">{task.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeTask(i)}
              className="shrink-0 rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-red-600"
              aria-label={`Remove ${task.name}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
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
          placeholder="Add a task we missed…"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <button
          type="button"
          onClick={addTask}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Add
        </button>
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={tasks.length === 0}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Score my automation risk
      </button>
    </div>
  )
}
