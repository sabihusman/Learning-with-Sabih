'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Figure from './Figure'
import styles from './BigOViz.module.css'

// Number of calls the naive recursive Fibonacci makes for fib(n): 2*Fib(n+1) - 1,
// computed with a deterministic iterative Fibonacci (no floating-point powers). This is
// the true exponential-class count (~1.618^n), not Math.pow(2, n).
function fibCalls(n) {
  let a = 0 // Fib(0)
  let b = 1 // Fib(1)
  for (let i = 0; i < n + 1; i += 1) {
    const t = a + b
    a = b
    b = t
  }
  // a is now Fib(n + 1)
  return 2 * a - 1
}

// Growth functions are EXACT for each class. Only the lane below corrected from the
// prototype is O(2^n): it now uses the real naive-Fibonacci call count.
const LANES = [
  { key: 'O(1)', label: 'O(1)', algo: 'Hash table lookup', color: '#1e8449', f: () => 1 },
  { key: 'O(log n)', label: 'O(log n)', algo: 'Binary search', color: '#2980b9', f: (n) => Math.max(1, Math.log2(n)) },
  { key: 'O(n)', label: 'O(n)', algo: 'Linear scan', color: '#8e44ad', f: (n) => n },
  { key: 'O(n log n)', label: 'O(n log n)', algo: 'Merge sort', color: '#d68910', f: (n) => n * Math.max(1, Math.log2(n)) },
  { key: 'O(n^2)', label: 'O(n²)', algo: 'Bubble sort', color: '#c0392b', f: (n) => n * n },
  { key: 'O(2^n)', label: 'O(2ⁿ)', algo: 'Naive Fibonacci', color: '#7b241c', f: (n) => fibCalls(n) },
]

const OPS_PER_SECOND = 2e9
const N_MAX = 80
const BASE_DURATION_MS = 2500 // the O(n) reference lane finishes in this time

const fmtOps = (v) => {
  if (v < 1000) return Math.round(v).toString()
  if (v < 1e6) return (v / 1e3).toFixed(1) + 'K'
  if (v < 1e9) return (v / 1e6).toFixed(1) + 'M'
  if (v < 1e12) return (v / 1e9).toFixed(1) + 'B'
  return v.toExponential(1)
}
const fmtTime = (s) => {
  if (s < 1e-6) return '< 1 µs'
  if (s < 1e-3) return (s * 1e6).toFixed(0) + ' µs'
  if (s < 1) return (s * 1e3).toFixed(0) + ' ms'
  if (s < 60) return s.toFixed(1) + ' s'
  if (s < 3600) return (s / 60).toFixed(1) + ' min'
  if (s < 86400) return (s / 3600).toFixed(1) + ' hr'
  if (s < 3.15e7) return (s / 86400).toFixed(1) + ' days'
  if (s < 3.15e9) return (s / 3.15e7).toFixed(1) + ' yr'
  if (s < 3.15e14) return (s / 3.15e7).toExponential(1) + ' yr'
  return '> age of universe'
}

// curve chart geometry (log y so all six fit)
const W = 620
const H = 230
const padL = 40
const padR = 14
const padT = 14
const padB = 26
const plotW = W - padL - padR
const plotH = H - padT - padB
const sx = (xv) => padL + (xv / N_MAX) * plotW
const Y_CEIL = 2 ** N_MAX
const sy = (yv) => {
  const ly = Math.log10(Math.max(1, yv))
  const lc = Math.log10(Math.max(1, Y_CEIL))
  return padT + (1 - ly / lc) * plotH
}

export default function BigOViz() {
  const [n, setN] = useState(20)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(() => Object.fromEntries(LANES.map((l) => [l.key, 0])))
  const timerRef = useRef(null)
  const startRef = useRef(0)

  const totals = useMemo(() => Object.fromEntries(LANES.map((l) => [l.key, l.f(n)])), [n])
  const refTotal = Math.max(1, totals['O(n)'])

  const reset = useCallback(() => {
    setRunning(false)
    if (timerRef.current) clearInterval(timerRef.current)
    setProgress(Object.fromEntries(LANES.map((l) => [l.key, 0])))
  }, [])

  // Timer-driven cadence (setInterval), never requestAnimationFrame, so the race keeps
  // advancing in a backgrounded tab. Each lane fills at ops/ms set by the O(n) lane
  // finishing in BASE_DURATION_MS; the slow lanes simply never catch up.
  const start = useCallback(() => {
    reset()
    startRef.current = Date.now()
    setRunning(true)
    const opsPerMs = refTotal / BASE_DURATION_MS
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      setProgress(() => {
        const next = {}
        let allDone = true
        for (const l of LANES) {
          const done = Math.min(totals[l.key], opsPerMs * elapsed)
          next[l.key] = done
          if (done < totals[l.key]) allDone = false
        }
        if (allDone) {
          clearInterval(timerRef.current)
          setRunning(false)
        }
        return next
      })
    }, 40)
  }, [totals, refTotal, reset])

  // Only cleanup lives in an effect (no setState in the effect body). The race is reset
  // from the slider's onChange handler below, NOT from an effect on [n].
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const onSlide = (e) => {
    setN(parseInt(e.target.value, 10))
    reset()
  }

  const controls = [{ label: running ? 'Reset' : 'Start race', onClick: running ? reset : start, variant: 'primary' }]
  const status = running
    ? 'Racing: the fast lanes finish, the slow ones keep crawling'
    : 'Press Start to race the six classes, then slide n'
  const readouts = [
    { label: 'input size', value: `n = ${n}` },
    { label: 'O(2ⁿ) at n', value: fmtTime(totals['O(2^n)'] / OPS_PER_SECOND) },
  ]

  // curve paths, recomputed only when geometry constants change (not per n)
  const paths = useMemo(
    () =>
      LANES.map((c) => {
        let d = ''
        let started = false
        let leftChart = false
        for (let i = 0; i <= 200; i += 1) {
          const xv = (i / 200) * N_MAX
          const py = sy(c.f(xv))
          if (py < padT) {
            leftChart = true
            if (started) d += ` L ${sx(xv).toFixed(1)} ${padT}`
            break
          }
          d += `${started ? 'L' : 'M'} ${sx(xv).toFixed(1)} ${py.toFixed(1)} `
          started = true
        }
        return { ...c, d, leftChart }
      }),
    []
  )

  return (
    <Figure
      eyebrow="Complexity"
      title="Big-O and time complexity"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Six real algorithms race on the same input. Press Start, then drag the input size n and watch the gap explode: the fast lanes finish in an instant while the slow ones crawl. The same n moves the marker on the curve below, so the race and the exact picture stay in sync."
    >
      {/* PART 1: the race */}
      <div className={styles.raceCard}>
        {LANES.map((l) => {
          const done = progress[l.key]
          const total = totals[l.key]
          const pct = Math.max(0, Math.min(1, done / total))
          const finished = done >= total
          return (
            <div key={l.key} className={styles.lane}>
              <div className={styles.laneHead}>
                <span className={styles.laneLabel} style={{ color: l.color }}>
                  {l.label}
                  <span className={styles.laneAlgo}>{l.algo}</span>
                </span>
                <span className={styles.laneStat} style={{ color: finished ? l.color : 'var(--fade)' }}>
                  {finished ? 'done' : `${fmtOps(done)} / ${fmtOps(total)}`}
                </span>
              </div>
              <div className={styles.bar}>
                <div className={styles.barFill} style={{ width: `${pct * 100}%`, background: l.color }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* shared input-size slider: drives all three parts */}
      <div className={styles.sliderRow}>
        <div className={styles.sliderHead}>
          <span>input size n</span>
          <strong>{n}</strong>
        </div>
        <input className={styles.slider} type="range" min="1" max={N_MAX} step="1" value={n} onChange={onSlide} aria-label="Input size n" />
      </div>

      {/* PART 2: wall-clock estimate at the current n */}
      <div className={styles.wallClock}>
        <div className={styles.wallClockLabel}>time at n = {n} (at 2 billion ops/sec)</div>
        <div className={styles.wallGrid}>
          {LANES.map((l) => (
            <div key={l.key} className={styles.wallRow}>
              <span className={styles.wallRowLabel} style={{ color: l.color }}>{l.label}</span>
              <span>{fmtTime(totals[l.key] / OPS_PER_SECOND)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PART 3: the exact log-scale curve */}
      <div className={styles.curveLabel}>the exact picture</div>
      <p className={styles.curveIntro}>
        The race shows the feel; here is the precise shape. Same six classes, operation count against input size, on a
        log scale so all six fit.
      </p>
      <div className={styles.curveCard}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} aria-label="Operation count versus input size n for six complexity classes, on a log scale. A dashed marker tracks the current n.">
          <text x={12} y={padT + plotH / 2} fontFamily="ui-monospace, monospace" fontSize="9" fill="var(--fade)" textAnchor="middle" transform={`rotate(-90 12 ${padT + plotH / 2})`}>
            ops (log)
          </text>
          <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="var(--rule)" />
          <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="var(--rule)" />
          <line x1={sx(n)} y1={padT} x2={sx(n)} y2={padT + plotH} stroke="var(--accent)" strokeDasharray="3 4" opacity="0.5" />
          <text x={sx(n)} y={padT + plotH + 18} fontFamily="ui-monospace, monospace" fontSize="10" fill="var(--accent)" textAnchor="middle">
            n={n}
          </text>
          {[0, 20, 40, 60, 80].map((t) => (
            <text key={t} x={sx(t)} y={padT + plotH + 18} fontFamily="ui-monospace, monospace" fontSize="9" fill="var(--fade)" textAnchor="middle">
              {t}
            </text>
          ))}
          {paths.map((c) => (
            <g key={c.key}>
              <path d={c.d} fill="none" stroke={c.color} strokeWidth="1.8" />
              {c.leftChart && (
                <text x={W - padR - 4} y={padT + 10} fontFamily="ui-monospace, monospace" fontSize="9" fill={c.color} textAnchor="end">
                  {c.label} &#8593; off-chart
                </text>
              )}
            </g>
          ))}
          {LANES.map((c) => {
            const py = sy(c.f(n))
            if (py < padT) return null
            return <circle key={c.key} cx={sx(n)} cy={py} r="3" fill={c.color} stroke="#fff" strokeWidth="1.3" />
          })}
        </svg>
      </div>
    </Figure>
  )
}
