import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  duration?: number
  format?: (n: number) => string
  startDelayMs?: number
  className?: string
  ariaLabel?: string
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function AnimatedNumber({
  value,
  duration = 1400,
  format = (n) => Math.round(n).toString(),
  startDelayMs = 0,
  className,
  ariaLabel,
}: Props) {
  const [display, setDisplay] = useState(prefersReducedMotion() ? value : 0)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value)
      return
    }

    fromRef.current = display
    const start = performance.now()

    function tick(now: number) {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      const eased = easeOutExpo(t)
      const next = fromRef.current + (value - fromRef.current) * eased
      setDisplay(next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    timerRef.current = window.setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick)
    }, startDelayMs)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, startDelayMs])

  return (
    <span className={className} aria-label={ariaLabel}>
      {format(display)}
    </span>
  )
}
