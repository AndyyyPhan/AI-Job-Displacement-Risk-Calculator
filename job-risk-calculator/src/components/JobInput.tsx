import { useState } from 'react'

interface Props {
  onSubmit: (jobTitle: string, context: string) => void
}

export function JobInput({ onSubmit }: Props) {
  const [jobTitle, setJobTitle] = useState('')
  const [context, setContext] = useState('')

  const canSubmit = jobTitle.trim().length > 1

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit(jobTitle, context)
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          AI Job Displacement Risk Calculator
        </h1>
        <p className="mt-3 text-slate-600">
          Tell us about your job and we'll estimate how much of it AI could automate,
          on what timeline, and what you can do about it.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="job-title" className="block text-sm font-medium text-slate-800">
          Job title
        </label>
        <input
          id="job-title"
          type="text"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="e.g. Radiologist, Paralegal, Elementary School Teacher"
          className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="context" className="block text-sm font-medium text-slate-800">
          Additional context <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. I work in a hospital setting, mostly remote, heavy client calls, my day is 70% writing briefs"
          rows={3}
          className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Analyze my job
      </button>
    </form>
  )
}
