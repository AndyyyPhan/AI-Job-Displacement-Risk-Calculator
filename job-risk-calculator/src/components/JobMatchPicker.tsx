import type { OnetOccupation } from '../lib/onet'
import type { JobCandidate } from '../types'

interface Props {
  query: string
  candidates: JobCandidate[]
  onSelect: (occupation: OnetOccupation) => void
  onBack: () => void
}

export function JobMatchPicker({ query, candidates, onSelect, onBack }: Props) {
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
          Which job best matches yours?
        </h1>
        <p className="mt-2 text-slate-600">
          We found a few O*NET occupations that could match{' '}
          <span className="font-semibold text-slate-800">"{query}"</span>. Pick
          the one that most closely describes what you actually do — the risk
          assessment will be based on this choice.
        </p>
      </div>

      <ul className="space-y-3">
        {candidates.map(({ occupation, score }) => {
          const alts = occupation.altTitles.slice(0, 3)
          return (
            <li key={occupation.code}>
              <button
                type="button"
                onClick={() => onSelect(occupation)}
                className="block w-full rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-slate-900">
                      {occupation.title}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">
                      {occupation.code}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                    {Math.round(score * 100)}% match
                  </span>
                </div>
                {occupation.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                    {occupation.description}
                  </p>
                )}
                {alts.length > 0 && (
                  <p className="mt-3 truncate text-xs text-slate-500">
                    Also known as: {alts.join(', ')}
                  </p>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
