import { useEffect, useState } from 'react'
import { JobInput } from './components/JobInput'
import { JobMatchPicker } from './components/JobMatchPicker'
import { TaskConfirmation } from './components/TaskConfirmation'
import { RiskScore } from './components/RiskScore'
import { EmpiricalContext } from './components/EmpiricalContext'
import { TaskBreakdown } from './components/TaskBreakdown'
import { ReskillingPanel } from './components/ReskillingPanel'
import { LoadingState } from './components/LoadingState'
import { ErrorState } from './components/ErrorState'
import { Grain } from './components/ui/Grain'
import { StepRail, type RailPhase } from './components/ui/StepRail'
import { Dateline } from './components/ui/Dateline'
import { finalizeJobResearch, researchJob } from './agents/jobResearcher'
import { scoreRisk } from './agents/riskScorer'
import { generateReskillingPlan } from './agents/reskillingAdvisor'
import {
  computeTimelineWindow,
  shouldSkipRiskScorer,
  synthesizeRiskFromBaseline,
} from './agents/empiricalScorer'
import { AgentAPIError, AgentValidationError } from './agents/anthropicClient'
import { loadResourceRegistry } from './lib/resourceRegistry'
import { parseSocCode } from './lib/formatters'
import { cn } from './lib/cn'
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

const FILING_DATE = new Date()
  .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  .toUpperCase()

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
      const assessment = await scoreRisk(profile)
      const timeline = computeTimelineWindow(
        profile.empirical,
        assessment.adjusted_risk_score,
      )
      const risk: RiskProfile = { ...assessment, ...timeline }
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

  const phase = phaseForStep(step)
  const socCode = socFromStep(step)
  const wide = step.kind === 'results'

  return (
    <div className="relative min-h-screen">
      <Grain />

      <div className="relative z-10">
        <header className="border-b border-hair">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-8">
            <Colophon socCode={socCode} />
            <Dateline className="hidden sm:flex">
              <span>Filed</span>
              <span aria-hidden className="inline-block h-[3px] w-[3px] rounded-full bg-ink/40" />
              <span>{FILING_DATE}</span>
            </Dateline>
          </div>
          <div className="mx-auto max-w-6xl px-4 pb-5 sm:px-8">
            <StepRail active={phase} />
          </div>
        </header>

        <main
          className={cn(
            'relative z-10 mx-auto px-4 py-12 sm:px-8 sm:py-16',
            wide ? 'max-w-6xl' : 'max-w-3xl',
          )}
        >
          {renderStep(step, registry, {
            onJobSubmit: runResearch,
            onMatchPicked: handleMatchPicked,
            onTasksConfirmed: runScoring,
            onRetry: handleRetry,
            onStartOver: handleStartOver,
          })}
        </main>

        <footer className="mx-auto max-w-6xl px-4 pb-12 pt-4 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-4 border-t border-hair pt-6 text-[11px] text-muted sm:flex-row sm:items-center">
            <span className="font-mono uppercase tracking-[0.18em]">
              Anchored in Eloundou et al. 2023 · Anthropic Economic Index 2026 · BLS OEWS · BLS Employment Projections
            </span>
            <span className="font-mono uppercase tracking-[0.2em]">
              v1 · prototype
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Colophon({ socCode }: { socCode: string | null }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-display text-xl font-medium tracking-tight text-ink">
        Displacement Dossier
      </span>
      <span aria-hidden className="hidden h-4 w-px bg-hair sm:inline-block" />
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-muted sm:inline-block">
        {socCode ? `SOC · ${socCode}` : 'SOC · ——————'}
      </span>
    </div>
  )
}

function phaseForStep(step: Step): RailPhase {
  switch (step.kind) {
    case 'input':
      return 'intake'
    case 'researching':
    case 'pickMatch':
      return 'match'
    case 'confirm':
      return 'tasks'
    case 'scoring':
    case 'advising':
      return 'analysis'
    case 'results':
      return 'dossier'
    case 'error':
      switch (step.retryStep) {
        case 'research':
          return 'match'
        case 'score':
        case 'advise':
          return 'analysis'
      }
  }
}

function socFromStep(step: Step): string | null {
  switch (step.kind) {
    case 'confirm':
    case 'scoring':
    case 'advising':
    case 'results':
      return parseSocCode(step.profile.onet_match).code
    default:
      return null
  }
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
      return <LoadingState phase="research" />
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
      return <LoadingState phase="score" jobTitle={step.profile.job_title} />
    case 'advising':
      return <LoadingState phase="advise" jobTitle={step.profile.job_title} />
    case 'results':
      return (
        <div className="space-y-10">
          <ResultsHeader
            jobTitle={step.profile.job_title}
            onetMatch={step.profile.onet_match}
            onStartOver={h.onStartOver}
          />
          <RiskScore risk={step.risk} jobTitle={step.profile.job_title} />
          <EmpiricalContext empirical={step.profile.empirical} />
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

function ResultsHeader({
  jobTitle,
  onetMatch,
  onStartOver,
}: {
  jobTitle: string
  onetMatch: string
  onStartOver: () => void
}) {
  const { code, title } = parseSocCode(onetMatch)
  return (
    <div className="anim-reveal flex flex-col gap-6 border-b border-hair pb-8 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <div className="kicker mb-4">Dossier · assessment complete</div>
        <h1 className="display-serif text-5xl text-ink md:text-6xl">
          {jobTitle}
        </h1>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          <span>Matched to</span>{' '}
          <span className="text-ink">{title}</span>{' '}
          <span aria-hidden className="mx-1 inline-block h-[3px] w-[3px] rounded-full bg-ink/40 align-middle" />{' '}
          <span className="num">{code}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onStartOver}
        className="arrow-right group inline-flex w-fit items-center self-start border-b border-ink/40 pb-[3px] font-mono text-[11px] uppercase tracking-[0.2em] text-ink transition-colors hover:border-ink hover:text-ink md:self-auto"
      >
        Analyze another job
      </button>
    </div>
  )
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
