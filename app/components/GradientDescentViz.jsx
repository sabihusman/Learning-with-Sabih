'use client'

import { useReducer, useEffect, useRef } from 'react'
import Figure from './Figure'

// ─── math ────────────────────────────────────────────────────────────────────
// 1D asymmetric double well (ported from the real study-guide-demo):
//   f(x)  = 0.08 * (x^2 - 4)^2 + 0.15 * x
//   f'(x) = 0.32 * x * (x^2 - 4) + 0.15
//
// It is 1D on purpose. The two wells let the demo show a LOCAL minimum versus
// the GLOBAL minimum, which a single convex bowl cannot teach.
//   global min: x ≈ -2.056  (f ≈ -0.304)   the deeper, left well
//   barrier   : x ≈ +0.118  (f ≈ +1.289)   local maximum between the wells
//   local min : x ≈ +1.939  (f ≈ +0.296)   the shallower, right well
//
// Plain gradient descent only moves downhill, so it cannot cross the barrier.
// Starting on the right settles in the local minimum; starting on the left
// reaches the global minimum. The starting point alone decides the outcome.

const f = (x) => 0.08 * (x * x - 4) ** 2 + 0.15 * x
const df = (x) => 0.32 * x * (x * x - 4) + 0.15

const STARTS = { right: 2.4, left: -2.4 }
const LR = 0.12
const MAX_STEPS = 60
const STEP_MS = 360
const SETTLE_SLOPE = 1e-3 // |f'(x)| below this counts as settled

// known extrema, for markers and the settled-state label
const GLOBAL_MIN = -2.0562
const LOCAL_MIN = 1.9386

const advance = (x) => x - LR * df(x)
const isSettled = (x) => Math.abs(df(x)) < SETTLE_SLOPE

// ─── reducer ─────────────────────────────────────────────────────────────────
const initial = (side) => ({ history: [STARTS[side]], running: false, side })

function reducer(state, action) {
  const last = state.history[state.history.length - 1]
  const done = state.history.length >= MAX_STEPS || isSettled(last)

  switch (action.type) {
    case 'PLAY':
      return done ? state : { ...state, running: true }
    case 'PAUSE':
      return { ...state, running: false }
    case 'STEP':
      if (done) return { ...state, running: false }
      return { ...state, running: false, history: [...state.history, advance(last)] }
    case 'AUTO_STEP':
      if (done) return { ...state, running: false }
      return { ...state, history: [...state.history, advance(last)] }
    case 'RESET':
      return initial(state.side)
    case 'SET_START':
      return initial(action.side)
    default:
      return state
  }
}

// ─── plot geometry ───────────────────────────────────────────────────────────
const X_MIN = -3.2
const X_MAX = 3.2
const Y_MIN = -0.6
const Y_MAX = 3.7

const PAD = { left: 44, right: 18, top: 22, bottom: 34 }
const VB_W = 600
const VB_H = 360
const PLOT_L = PAD.left
const PLOT_R = VB_W - PAD.right
const PLOT_T = PAD.top
const PLOT_B = VB_H - PAD.bottom

const sx = (x) => PLOT_L + ((x - X_MIN) / (X_MAX - X_MIN)) * (PLOT_R - PLOT_L)
const sy = (v) => PLOT_B - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * (PLOT_B - PLOT_T)

// precompute the loss curve path once
const CURVE_D = (() => {
  const N = 240
  let d = ''
  for (let i = 0; i <= N; i++) {
    const x = X_MIN + (i / N) * (X_MAX - X_MIN)
    d += `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(f(x)).toFixed(1)}`
  }
  return d
})()

// ─── component ───────────────────────────────────────────────────────────────
export default function GradientDescentViz() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initial('right'))
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!state.running) return
    cancelledRef.current = false
    let lastStepTime = performance.now()
    let rafId

    const tick = (now) => {
      if (cancelledRef.current) return
      if (now - lastStepTime >= STEP_MS) {
        lastStepTime = now
        dispatch({ type: 'AUTO_STEP' })
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      cancelledRef.current = true
      cancelAnimationFrame(rafId)
    }
  }, [state.running])

  const x = state.history[state.history.length - 1]
  const slope = df(x)
  const done = state.history.length >= MAX_STEPS || isSettled(x)
  const cx = sx(x)
  const cy = sy(f(x))

  // descent direction along x is the sign of the negative gradient
  const dir = slope > 0 ? -1 : 1
  const ARROW = 26
  const arrowX2 = cx + dir * ARROW

  const trailD = state.history
    .map((xi, i) => `${i === 0 ? 'M' : 'L'}${sx(xi).toFixed(1)},${sy(f(xi)).toFixed(1)}`)
    .join(' ')

  // which basin did it settle in?
  let settledLabel = null
  if (done) {
    if (Math.abs(x - GLOBAL_MIN) < 0.05) settledLabel = 'Settled in the global minimum'
    else if (Math.abs(x - LOCAL_MIN) < 0.05) settledLabel = 'Settled in the local minimum'
    else settledLabel = 'Settled'
  }

  const controls = [
    {
      label: state.running ? 'Pause' : 'Play',
      onClick: () => dispatch({ type: state.running ? 'PAUSE' : 'PLAY' }),
      variant: 'primary',
      disabled: done && !state.running,
    },
    { label: 'Step', onClick: () => dispatch({ type: 'STEP' }), disabled: state.running || done },
    { label: 'Reset', onClick: () => dispatch({ type: 'RESET' }) },
    {
      label: 'Start right',
      onClick: () => dispatch({ type: 'SET_START', side: 'right' }),
      active: state.side === 'right',
    },
    {
      label: 'Start left',
      onClick: () => dispatch({ type: 'SET_START', side: 'left' }),
      active: state.side === 'left',
    },
  ]

  const readouts = [
    { label: 'step', value: `${state.history.length - 1} / ${MAX_STEPS - 1}` },
    { label: 'x', value: x.toFixed(3) },
    { label: 'f(x)', value: f(x).toFixed(4) },
    { label: "f'(x)", value: slope.toFixed(4) },
  ]

  const status = done ? settledLabel : state.running ? 'Running' : 'Paused'

  return (
    <Figure
      eyebrow="Optimization"
      title="Gradient descent on f(x) = 0.08(x² − 4)² + 0.15x"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Start on the right and run it: the point rolls into the nearer local minimum and stops, even though a deeper global minimum sits in the left well. Now switch to Start left and run again to reach the global minimum. Plain gradient descent only goes downhill, so where you begin decides which minimum you get."
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', maxWidth: 600, height: 'auto', display: 'block', margin: '0 auto' }}
        aria-label="Loss curve of a 1D double-well function with the gradient descent path settling in one of its two minima"
      >
        <defs>
          <marker id="gdArrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
            <path d="M0,0.5 L0,5.5 L6,3 z" fill="#c0392b" />
          </marker>
        </defs>

        {/* baseline at f = 0 */}
        <line x1={PLOT_L} y1={sy(0)} x2={PLOT_R} y2={sy(0)} stroke="#e7e3da" strokeWidth={1} />
        {/* x axis ticks */}
        {[-3, -2, -1, 0, 1, 2, 3].map((tx) => (
          <g key={tx}>
            <line x1={sx(tx)} y1={PLOT_B} x2={sx(tx)} y2={PLOT_B + 4} stroke="#c8c4bc" strokeWidth={0.8} />
            <text x={sx(tx)} y={PLOT_B + 16} fontSize={9} fill="#9b9892" textAnchor="middle" fontFamily="ui-monospace,monospace">{tx}</text>
          </g>
        ))}
        <text x={(PLOT_L + PLOT_R) / 2} y={VB_H - 2} fontSize={9} fill="#9b9892" textAnchor="middle" fontFamily="ui-monospace,monospace">x</text>

        {/* the loss curve */}
        <path d={CURVE_D} fill="none" stroke="#bdb8ad" strokeWidth={1.6} strokeLinejoin="round" />

        {/* minima markers */}
        <circle cx={sx(GLOBAL_MIN)} cy={sy(f(GLOBAL_MIN))} r={3} fill="#1a1a1a" />
        <text x={sx(GLOBAL_MIN)} y={sy(f(GLOBAL_MIN)) + 16} fontSize={8.5} fill="#6b6862" textAnchor="middle" fontFamily="ui-monospace,monospace">global min</text>
        <circle cx={sx(LOCAL_MIN)} cy={sy(f(LOCAL_MIN))} r={3} fill="none" stroke="#1a1a1a" strokeWidth={1.2} />
        <text x={sx(LOCAL_MIN)} y={sy(f(LOCAL_MIN)) - 9} fontSize={8.5} fill="#6b6862" textAnchor="middle" fontFamily="ui-monospace,monospace">local min</text>

        {/* descent trail */}
        {state.history.length > 1 && (
          <path d={trailD} fill="none" stroke="#9b9892" strokeWidth={1.4} strokeDasharray="3 2" strokeLinejoin="round" />
        )}

        {/* descent-direction arrow */}
        {!done && Math.abs(slope) > SETTLE_SLOPE && (
          <line x1={cx.toFixed(1)} y1={cy.toFixed(1)} x2={arrowX2.toFixed(1)} y2={cy.toFixed(1)} stroke="#c0392b" strokeWidth={1.6} markerEnd="url(#gdArrow)" />
        )}

        {/* current point */}
        <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={5} fill="#c0392b" stroke="#ffffff" strokeWidth={1.5} />
      </svg>
    </Figure>
  )
}
