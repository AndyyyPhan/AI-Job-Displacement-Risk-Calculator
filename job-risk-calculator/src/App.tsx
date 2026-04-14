import { useState } from 'react'
import { JobInput } from './components/JobInput'
import { TaskConfirmation } from './components/TaskConfirmation'
import { RiskScore } from './components/RiskScore'
import { TimelineChart } from './components/TimelineChart'
import { TaskBreakdown } from './components/TaskBreakdown'
import { ReskillingPanel } from './components/ReskillingPanel'
import { LoadingState } from './components/LoadingState'
import { ErrorState } from './components/ErrorState'
import { researchJob } from './agents/jobResearcher'
import { scoreRisk } from './agents/riskScorer'
import { generateReskillingPlan } from './agents/reskillingAdvisor'
import { AgentAPIError, AgentValidationError } from './agents/anthropicClient'
import type { JobProfile, RetryableStep, RiskProfile, Step } from './types'

interface LastInput {
  jobTitle: string
  context: string
}

function App() {
  const [step, setStep] = useState<Step>({ kind: 'input' })
  const [lastInput, setLastInput] = useState<LastInput | null>(null)
  const [confirmedProfile, setConfirmedProfile] = useState<JobProfile | null>(null)
  const [pendingRisk, setPendingRisk] = useState<RiskProfile | null>(null)

  async function runResearch(jobTitle: string, context: string) {
    setLastInput({ jobTitle, context })
    setStep({ kind: 'researching' })
    try {
      const profile = await researchJob({ jobTitle, context })
      setStep({ kind: 'confirm', profile })
    } catch (err) {
      setStep(makeErrorStep(err, 'research'))
    }
  }

  async function runScoring(profile: JobProfile) {
    setConfirmedProfile(profile)
    setStep({ kind: 'scoring', profile })
    try {
      const risk = await scoreRisk(profile)
      setPendingRisk(risk)
      setStep({ kind: 'advising', profile, risk })
      await runAdvising(profile, risk)
    } catch (err) {
      setStep(makeErrorStep(err, 'score'))
    }
  }

  async function runAdvising(profile: JobProfile, risk: RiskProfile) {
    try {
      const plan = await generateReskillingPlan(profile, risk)
      setStep({ kind: 'results', profile, risk, plan })
    } catch (err) {
      setStep(makeErrorStep(err, 'advise'))
    }
  }

  function handleRetry() {
    if (step.kind !== 'error') return
    switch (step.retryStep) {
      case 'research':
        if (lastInput) runResearch(lastInput.jobTitle, lastInput.context)
        break
      case 'score':
        if (confirmedProfile) runScoring(confirmedProfile)
        break
      case 'advise':
        if (confirmedProfile && pendingRisk) {
          setStep({
            kind: 'advising',
            profile: confirmedProfile,
            risk: pendingRisk,
          })
          runAdvising(confirmedProfile, pendingRisk)
        }
        break
    }
  }

  function handleStartOver() {
    setStep({ kind: 'input' })
    setLastInput(null)
    setConfirmedProfile(null)
    setPendingRisk(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-5xl">
        {renderStep(step, {
          onJobSubmit: runResearch,
          onTasksConfirmed: runScoring,
          onRetry: handleRetry,
          onStartOver: handleStartOver,
        })}
      </main>
    </div>
  )
}

interface Handlers {
  onJobSubmit: (jobTitle: string, context: string) => void
  onTasksConfirmed: (profile: JobProfile) => void
  onRetry: () => void
  onStartOver: () => void
}

function renderStep(step: Step, h: Handlers) {
  switch (step.kind) {
    case 'input':
      return <JobInput onSubmit={h.onJobSubmit} />
    case 'researching':
      return (
        <LoadingState
          label="Researching your job"
          sublabel="Looking up the O*NET entry and scanning the literature…"
        />
      )
    case 'confirm':
      return (
        <TaskConfirmation
          profile={step.profile}
          onConfirm={h.onTasksConfirmed}
          onBack={h.onStartOver}
        />
      )
    case 'scoring':
      return (
        <LoadingState
          label="Scoring automation risk"
          sublabel="Evaluating each task against the three bottleneck dimensions…"
        />
      )
    case 'advising':
      return (
        <LoadingState
          label="Building your reskilling playbook"
          sublabel="Finding transferable skills, adjacent roles, and learning resources…"
        />
      )
    case 'results':
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Results for <span className="font-medium text-slate-800">{step.profile.job_title}</span>
            </p>
            <button
              type="button"
              onClick={h.onStartOver}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Analyze another job
            </button>
          </div>
          <RiskScore risk={step.risk} jobTitle={step.profile.job_title} />
          <TimelineChart risk={step.risk} />
          <TaskBreakdown tasks={step.risk.scored_tasks} />
          <ReskillingPanel plan={step.plan} />
        </div>
      )
    case 'error':
      return (
        <ErrorState
          message={step.message}
          onRetry={h.onRetry}
          onStartOver={h.onStartOver}
        />
      )
  }
}

function makeErrorStep(err: unknown, retryStep: RetryableStep): Step {
  const message = errorMessage(err)
  console.error(`[${retryStep}]`, err)
  return { kind: 'error', message, retryStep }
}

function errorMessage(err: unknown): string {
  if (err instanceof AgentValidationError) {
    return `${err.agent} returned data we couldn't parse after one retry. This usually means the model drifted off-spec — try again.`
  }
  if (err instanceof AgentAPIError) {
    if (err.status === 0) return err.body
    return `API call failed (${err.status}). ${truncate(err.body, 180)}`
  }
  if (err instanceof Error) return err.message
  return 'Unknown error.'
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

export default App
