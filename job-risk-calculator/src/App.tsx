import { useEffect, useState } from 'react'
import { JobInput } from './components/JobInput'
import { JobMatchPicker } from './components/JobMatchPicker'
import { TaskConfirmation } from './components/TaskConfirmation'
import { RiskScore } from './components/RiskScore'
import { EmpiricalContext } from './components/EmpiricalContext'
import { TimelineChart } from './components/TimelineChart'
import { TaskBreakdown } from './components/TaskBreakdown'
import { ReskillingPanel } from './components/ReskillingPanel'
import { LoadingState } from './components/LoadingState'
import { ErrorState } from './components/ErrorState'
import { finalizeJobResearch, researchJob } from './agents/jobResearcher'
import { scoreRisk } from './agents/riskScorer'
import { generateReskillingPlan } from './agents/reskillingAdvisor'
import {
  shouldSkipRiskScorer,
  synthesizeRiskFromBaseline,
} from './agents/empiricalScorer'
import { AgentAPIError, AgentValidationError } from './agents/anthropicClient'
import { loadResourceRegistry } from './lib/resourceRegistry'
import type { OnetOccupation } from './lib/onet'
import type {
  JobProfile,
  ResourceRegistryEntry,
  RetryableStep,
  RiskProfile,
  Step,
} from './types'

interface LastInput {
  jobTitle: string
  context: string
}

interface PendingConfirm {
  profile: JobProfile
  userCustomizedTasks: boolean
}

function App() {
  const [step, setStep] = useState<Step>({ kind: 'input' })
  const [lastInput, setLastInput] = useState<LastInput | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  const [pendingRisk, setPendingRisk] = useState<RiskProfile | null>(null)
  const [registry, setRegistry] = useState<ResourceRegistryEntry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    loadResourceRegistry()
      .then((reg) => {
        if (!cancelled) setRegistry(reg.entries)
      })
      .catch((err) => {
        console.error('[resources] failed to load registry:', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function runResearch(jobTitle: string, context: string) {
    setLastInput({ jobTitle, context })
    setStep({ kind: 'researching' })
    try {
      const result = await researchJob({ jobTitle, context })
      const userContextProvided = context.trim().length > 0
      if (result.type === 'strong') {
        setStep({
          kind: 'confirm',
          profile: result.profile,
          userContextProvided,
        })
      } else {
        setStep({
          kind: 'pickMatch',
          candidates: result.candidates,
          query: result.query,
          context,
        })
      }
    } catch (err) {
      setStep(makeErrorStep(err, 'research'))
    }
  }

  function handleMatchPicked(occupation: OnetOccupation) {
    setStep((prev) => {
      if (prev.kind !== 'pickMatch') return prev
      const profile = finalizeJobResearch(occupation, prev.context)
      return {
        kind: 'confirm',
        profile,
        userContextProvided: prev.context.trim().length > 0,
      }
    })
  }

  async function runScoring(profile: JobProfile, userCustomizedTasks: boolean) {
    const userContextProvided = profile.additional_context.trim().length > 0
    setPendingConfirm({ profile, userCustomizedTasks })

    if (shouldSkipRiskScorer(profile, userCustomizedTasks, userContextProvided)) {
      const synthesized = synthesizeRiskFromBaseline(profile)
      setPendingRisk(synthesized)
      setStep({ kind: 'advising', profile, risk: synthesized })
      await runAdvising(profile, synthesized)
      return
    }

    setStep({ kind: 'scoring', profile })
    try {
      const risk = await scoreRisk(profile)
      const delta = Math.abs(risk.adjusted_risk_score - risk.empirical_baseline_score)
      if (delta > 40) {
        console.warn(
          `[riskScorer] large divergence from baseline (${delta.toFixed(
            1,
          )} points) — consider recalibrating empiricalScorer weights`,
        )
      }
      setPendingRisk(risk)
      setStep({ kind: 'advising', profile, risk })
      await runAdvising(profile, risk)
    } catch (err) {
      setStep(makeErrorStep(err, 'score'))
    }
  }

  async function runAdvising(profile: JobProfile, risk: RiskProfile) {
    try {
      if (!registry) {
        throw new Error('Resource registry is not loaded yet. Please try again in a moment.')
      }
      const plan = await generateReskillingPlan(profile, risk, registry)
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
        if (pendingConfirm) {
          runScoring(pendingConfirm.profile, pendingConfirm.userCustomizedTasks)
        }
        break
      case 'advise':
        if (pendingConfirm && pendingRisk) {
          setStep({
            kind: 'advising',
            profile: pendingConfirm.profile,
            risk: pendingRisk,
          })
          runAdvising(pendingConfirm.profile, pendingRisk)
        }
        break
    }
  }

  function handleStartOver() {
    setStep({ kind: 'input' })
    setLastInput(null)
    setPendingConfirm(null)
    setPendingRisk(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-5xl">
        {renderStep(step, registry, {
          onJobSubmit: runResearch,
          onMatchPicked: handleMatchPicked,
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
  onMatchPicked: (occupation: OnetOccupation) => void
  onTasksConfirmed: (profile: JobProfile, userCustomizedTasks: boolean) => void
  onRetry: () => void
  onStartOver: () => void
}

function renderStep(
  step: Step,
  registry: ResourceRegistryEntry[] | null,
  h: Handlers,
) {
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
    case 'pickMatch':
      return (
        <JobMatchPicker
          query={step.query}
          candidates={step.candidates}
          onSelect={h.onMatchPicked}
          onBack={h.onStartOver}
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
          sublabel="Adjusting the empirical baseline against your specific task mix and context…"
        />
      )
    case 'advising':
      return (
        <LoadingState
          label="Building your reskilling playbook"
          sublabel="Selecting transferable skills, adjacent roles, and verified resources…"
        />
      )
    case 'results':
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Results for{' '}
              <span className="font-medium text-slate-800">{step.profile.job_title}</span>
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
          <EmpiricalContext empirical={step.profile.empirical} />
          <TimelineChart risk={step.risk} />
          <TaskBreakdown tasks={step.risk.scored_tasks} />
          {registry && <ReskillingPanel plan={step.plan} registry={registry} />}
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
