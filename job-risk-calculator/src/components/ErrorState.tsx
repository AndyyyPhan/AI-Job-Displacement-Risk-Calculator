import { Dateline } from './ui/Dateline'
import { Kicker } from './ui/Kicker'

interface Props {
  message: string
  onRetry: () => void
  onStartOver: () => void
}

export function ErrorState({ message, onRetry, onStartOver }: Props) {
  return (
    <div
      className="anim-reveal relative mx-auto max-w-2xl overflow-hidden border border-risk/30 bg-panel-2"
      style={{ boxShadow: 'var(--shadow-md)' }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px] bg-risk"
      />
      <div className="border-b border-hair-2 px-8 py-5">
        <Dateline rule>Interrupt · Assessment halted</Dateline>
      </div>
      <div className="px-8 py-10">
        <Kicker label="Something went wrong" />
        <h2
          className="display-serif mt-4 text-[32px] leading-[1.1] text-ink md:text-[38px]"
          style={{ letterSpacing: '-0.018em' }}
        >
          The pipeline returned an error.
        </h2>
        <p className="mt-5 max-w-[55ch] text-[14px] leading-relaxed text-ink-2">
          {message}
        </p>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          If this persists, the Anthropic API may be rate-limited or your key may
          be missing.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onRetry}
            className="arrow-right inline-flex items-center justify-center rounded-[2px] bg-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-panel-2 transition-all hover:-translate-y-px hover:bg-accent"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onStartOver}
            className="inline-flex items-center justify-center border border-hair px-5 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink transition-colors hover:border-ink"
          >
            Start over
          </button>
        </div>
      </div>
    </div>
  )
}
