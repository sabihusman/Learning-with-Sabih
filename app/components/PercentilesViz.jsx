'use client'

import { useState } from 'react'
import Figure from './Figure'
import {
  SAMPLE,
  N,
  MEAN,
  MARKERS,
  percentileValue,
  countSlowerThan,
} from './percentilesData'
import styles from './PercentilesViz.module.css'

// Palette: the site family (ink / fade / accent) plus the ok-green already used by
// other figures. No new colors for the section.
const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b' // the mean, and the live handle label
const OK = '#1f6f5c' // a request inside the current percentile
const OK_BG = '#e6f2ec'
const LINE = '#e2e0d8'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 460
const VB_H = 172
const PLOT_L = 40
const PLOT_R = 440
const PLOT_W = PLOT_R - PLOT_L
const AXIS_Y = 126
const DOT_CY = 76 // dot band center
const MARK_TOP = 32 // top of marker/handle lines

// Log ms axis. The main cluster (20-80) and the tail (up to ~1080) only both stay
// legible on a log scale; on a linear axis the cluster collapses into a few pixels.
const AXIS_MIN = 15
const AXIS_MAX = 1300
const LOG_MIN = Math.log10(AXIS_MIN)
const LOG_SPAN = Math.log10(AXIS_MAX) - LOG_MIN
const xForMs = (ms) => PLOT_L + ((Math.log10(ms) - LOG_MIN) / LOG_SPAN) * PLOT_W
const TICKS = [20, 50, 100, 200, 500, 1000]

// Deterministic vertical jitter so overlapping dots in the dense cluster separate
// into a readable cloud (no randomness; purely a function of the fixed index).
const jitterY = (i) => DOT_CY + (((i * 13) % 9) - 4) * 5

const clamp = (p) => Math.min(100, Math.max(1, p))

export default function PercentilesViz() {
  const [p, setP] = useState(50)

  const handleValue = percentileValue(p)
  const handleX = xForMs(handleValue)
  const slower = countSlowerThan(handleValue)

  // Native range arrows already move by 1; intercept Shift+Arrow to move by 5 so the
  // whole interaction (drag, click, and keyboard) works without a mouse.
  const onKeyDown = (e) => {
    if (!e.shiftKey) return
    let d = 0
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = 5
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -5
    if (d !== 0) {
      e.preventDefault()
      setP((v) => clamp(v + d))
    }
  }

  const controls = [{ label: 'Reset', onClick: () => setP(50), disabled: p === 50 }]

  const readouts = [
    { label: `latency at p${p}`, value: `${handleValue} ms` },
    { label: 'requests slower', value: `${slower} of ${N}` },
    { label: 'mean', value: `${Math.round(MEAN)} ms` },
    { label: 'p99', value: `${percentileValue(99)} ms` },
  ]

  // clamp the handle's text label so it stays inside the viewBox at the extremes
  const labelX = Math.min(PLOT_R - 4, Math.max(PLOT_L + 4, handleX))
  const labelAnchor = handleX > PLOT_R - 70 ? 'end' : handleX < PLOT_L + 70 ? 'start' : 'middle'

  return (
    <Figure
      eyebrow="Percentiles and tail latency"
      title="The average is lying to you"
      controls={controls}
      status={`Drag the percentile handle (or use the slider below, arrow keys to nudge). p${p} = ${handleValue} ms: ${slower} of ${N} requests were slower than that.`}
      readouts={readouts}
      tryThis="Drag slowly up from p50 and find where the latency stops creeping and leaps: the jump from the main cluster into the tail. Here it happens around p93, at 160 ms. That means the slowest 5 of these 60 requests live in the tail. Five users out of sixty sounds ignorable. Now imagine sixty million: the same fraction is five million people having the worst experience, all of them invisible in the mean."
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        role="img"
        aria-label={`Latency distribution of ${N} requests on a log millisecond axis. Mean ${Math.round(MEAN)} ms, p50 ${percentileValue(50)} ms, p95 ${percentileValue(95)} ms, p99 ${percentileValue(99)} ms. The handle is at p${p}, ${handleValue} ms, with ${slower} requests slower.`}
      >
        {/* axis line + ticks */}
        <line x1={PLOT_L} y1={AXIS_Y} x2={PLOT_R} y2={AXIS_Y} stroke={LINE} strokeWidth={1} />
        {TICKS.map((t) => (
          <g key={`tick-${t}`}>
            <line x1={xForMs(t)} y1={AXIS_Y} x2={xForMs(t)} y2={AXIS_Y + 4} stroke={FADE} strokeWidth={1} />
            <text x={xForMs(t)} y={AXIS_Y + 15} fontSize={8.5} fill={FADE} fontFamily={MONO} textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        <text x={PLOT_R} y={AXIS_Y + 15} fontSize={8.5} fill={FADE} fontFamily={MONO} textAnchor="end">
          ms
        </text>

        {/* fixed markers: mean (red, the distorted stat) and p50/p95/p99 (grey) */}
        {MARKERS.map((m) => {
          const mx = xForMs(m.value)
          const isMean = m.key === 'mean'
          const color = isMean ? ACCENT : FADE
          return (
            <g key={m.key}>
              <line x1={mx} y1={MARK_TOP} x2={mx} y2={AXIS_Y} stroke={color} strokeWidth={isMean ? 1.4 : 1} strokeDasharray="3 3" opacity={isMean ? 0.9 : 0.7} />
              <text x={mx} y={MARK_TOP - 12} fontSize={9} fill={isMean ? ACCENT : INK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                {m.label}
              </text>
              <text x={mx} y={MARK_TOP - 2} fontSize={8} fill={FADE} fontFamily={MONO} textAnchor="middle">
                {m.value}
              </text>
            </g>
          )
        })}

        {/* the 60 request tokens, highlighted when inside the current percentile */}
        {SAMPLE.map((v, i) => {
          const inside = v <= handleValue
          return (
            <circle
              key={`req-${i}`}
              cx={xForMs(v)}
              cy={jitterY(i)}
              r={3.3}
              fill={inside ? OK_BG : '#ffffff'}
              stroke={inside ? OK : FADE}
              strokeWidth={inside ? 1.3 : 1}
            />
          )
        })}

        {/* the draggable percentile handle */}
        <line x1={handleX} y1={MARK_TOP - 4} x2={handleX} y2={AXIS_Y} stroke={INK} strokeWidth={2} />
        <path d={`M ${handleX - 5} ${MARK_TOP - 4} L ${handleX + 5} ${MARK_TOP - 4} L ${handleX} ${MARK_TOP + 4} z`} fill={INK} />
        <text x={labelX} y={AXIS_Y + 30} fontSize={10} fill={ACCENT} fontFamily={MONO} fontWeight={700} textAnchor={labelAnchor}>
          {`p${p} = ${handleValue} ms`}
        </text>
      </svg>

      {/* percentile control: a native range in percentile space (linear and fully
          keyboard reachable); the strip above shows where that percentile lands in
          milliseconds, so the nonlinear jump into the tail is visible as you drag. */}
      <div className={styles.sliderRow}>
        <span className={styles.sliderLabel}>percentile</span>
        <input
          type="range"
          className={styles.slider}
          min={1}
          max={100}
          step={1}
          value={p}
          onChange={(e) => setP(clamp(Number(e.target.value)))}
          onKeyDown={onKeyDown}
          aria-label="percentile"
          aria-valuetext={`p${p}, ${handleValue} milliseconds`}
        />
        <span className={styles.sliderValue}>{`p${p} = ${handleValue} ms`}</span>
      </div>

      <p className={styles.caption}>
        Percentiles here use the nearest-rank method on the sorted sample: pXX is the
        value at rank ceil(XX/100 of {N}). Monitoring tools that interpolate between
        ranks may report a slightly different number for the same data. The {N}-request
        sample is fixed and hand-built to be instructive; every statistic above is
        computed from it at runtime, not typed in.
      </p>
    </Figure>
  )
}
