import type { ReskillingPlan, Resource } from '../types'

interface Props {
  plan: ReskillingPlan
}

export function ReskillingPanel({ plan }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Your reskilling playbook</h2>

      <section className="mt-6">
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
          {plan.resources.map((r) => (
            <li key={r.url} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {r.title}
                </a>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-600">
                  {typeLabel(r.type)}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{r.relevance}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function typeLabel(type: Resource['type']): string {
  switch (type) {
    case 'course':
      return 'Course'
    case 'book':
      return 'Book'
    case 'platform':
      return 'Platform'
    case 'article':
      return 'Article'
  }
}
