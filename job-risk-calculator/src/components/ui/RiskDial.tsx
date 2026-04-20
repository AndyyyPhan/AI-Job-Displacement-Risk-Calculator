import { useEffect, useRef, useState } from 'react'
import { riskColor } from '../../lib/formatters'

interface Props {
  score: number
  size?: number
  strokeWidth?: number
  children?: React.ReactNode
  showTicks?: boolean
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function RiskDial({
  score,
  size = 340,
  strokeWidth = 1.5,
  children,
  showTicks = true,
}: Props) {
  const clamped = Math.max(0, Math.min(100, score))
  const accent = riskColor(clamped)

  // geometry
  const cx = size / 2
  const cy = size / 2
  const innerStroke = 10
  const radius = size / 2 - innerStroke
  const circumference = 2 * Math.PI * radius
  // start at -90deg (top), rotate via transform
  const target = (clamped / 100) * circumference

  const [progress, setProgress] = useState(prefersReducedMotion() ? target : 0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(target)
      return
    }
    const duration = 1600
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setProgress(target * eased)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    }
  }, [target])

  // tick marks every 10
  const ticks = Array.from({ length: 11 }, (_, i) => i)

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        <defs>
          <linearGradient id="risk-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-safe)" />
            <stop offset="45%" stopColor="var(--color-caution)" />
            <stop offset="100%" stopColor="var(--color-risk)" />
          </linearGradient>
        </defs>

        {/* Outer hairline */}
        <circle
          cx={cx}
          cy={cy}
          r={radius + 6}
          fill="none"
          stroke="var(--color-hair-2)"
          strokeWidth={1}
        />
        {/* Inner ground ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--color-hair)"
          strokeWidth={strokeWidth}
        />

        {/* Gradient fill arc */}
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="url(#risk-gradient)"
            strokeWidth={9}
            strokeLinecap="butt"
            strokeDasharray={`${progress} ${circumference}`}
            style={{ filter: `drop-shadow(0 0 12px ${accent}55)` }}
          />
        </g>

        {/* Tick marks */}
        {showTicks &&
          ticks.map((i) => {
            const angle = (i / 10) * Math.PI * 2 - Math.PI / 2
            const r1 = radius + 10
            const r2 = radius + (i % 5 === 0 ? 17 : 13)
            const x1 = cx + Math.cos(angle) * r1
            const y1 = cy + Math.sin(angle) * r1
            const x2 = cx + Math.cos(angle) * r2
            const y2 = cy + Math.sin(angle) * r2
            const isMajor = i === 0 || i === 5 || i === 10
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--color-ink)"
                strokeWidth={isMajor ? 1.25 : 0.75}
                opacity={isMajor ? 0.5 : 0.22}
              />
            )
          })}

        {/* Marker at current progress */}
        <g transform={`rotate(${(clamped / 100) * 360 - 90} ${cx} ${cy})`}>
          <line
            x1={cx + radius - 6}
            y1={cy}
            x2={cx + radius + 18}
            y2={cy}
            stroke={accent}
            strokeWidth={1.5}
            opacity={0.9}
          />
          <circle
            cx={cx + radius + 18}
            cy={cy}
            r={3}
            fill={accent}
            opacity={0.9}
          />
        </g>
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}
