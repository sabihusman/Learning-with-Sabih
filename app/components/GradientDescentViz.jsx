'use client'

import { useReducer, useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
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
// STEP_MS doubles as the per-step glide duration AND the stepping cadence:
// the next optimizer step is dispatched when the current glide completes.
// At ~140ms/step the descent settles (right: 20 steps, left: 17) in ~2.4-2.8s.
const STEP_MS = 140
const SETTLE_SLOPE = 1e-3 // |f'(x)| below this counts as settled

// known extrema, for markers and the settled-state label
const GLOBAL_MIN = -2.0562
const LOCAL_MIN = 1.9386

const advance = (x) => x - LR * df(x)
const isSettled = (x) => Math.abs(df(x)) < SETTLE_SLOPE

// ─── reducer ─────────────────────────────────────────────────────────────────
const DEFAULT_SIDE = 'right'
// Tolerate an unknown side (e.g. 'custom' after a drag) so RESET always lands on
// a valid default start rather than STARTS[undefined].
const initial = (side) => {
  const key = side in STARTS ? side : DEFAULT_SIDE
  return { history: [STARTS[key]], running: false, side: key }
}

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
    case 'SET_X':
      // drag-to-place: start a fresh run from an arbitrary x (already clamped).
      // 'custom' side means no preset button is active and RESET falls back to default.
      return { history: [action.x], running: false, side: 'custom' }
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

  // renderX is the *displayed* dot position, smoothly tweened by anime.js
  // between discrete optimizer steps. The optimizer math (state.history) is
  // unchanged and still advances in exact discrete steps; only the pixels glide.
  const [renderX, setRenderX] = useState(() => STARTS.right)
  const displayRef = useRef(STARTS.right) // where the dot currently is (glide start)
  const animRef = useRef(null) // current anime.js instance, so we can cancel it
  const runningRef = useRef(false) // latest running flag for the onComplete chain

  // ── drag-to-place ──────────────────────────────────────────────────────────
  // While paused, the dot can be dragged along the curve to set the start x.
  // svgRef converts a pointer position into a viewBox coordinate; draggingRef is
  // the synchronous flag the pointer handlers read; isDragging is render-only
  // (for the cursor), kept separate because refs must not be read during render.
  const svgRef = useRef(null)
  const draggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  // pointer clientX -> world x (clamped to the plotted domain)
  const pointerToX = (clientX) => {
    const rect = svgRef.current.getBoundingClientRect()
    const viewX = ((clientX - rect.left) / rect.width) * VB_W
    const wx = X_MIN + ((viewX - PLOT_L) / (PLOT_R - PLOT_L)) * (X_MAX - X_MIN)
    return Math.max(X_MIN, Math.min(X_MAX, wx))
  }

  // Move the dot to the pointer immediately. Cancelling the in-flight glide and
  // writing renderX/displayRef here is what stops the animation from fighting
  // the drag: the reducer's single-point history makes the glide effect a no-op
  // (duration 0), and the dot tracks the pointer with no lag.
  const dragTo = (clientX) => {
    const wx = pointerToX(clientX)
    if (animRef.current) animRef.current.cancel()
    displayRef.current = wx
    setRenderX(wx)
    dispatch({ type: 'SET_X', x: wx })
  }

  const onPointerDown = (e) => {
    if (state.running) return // only draggable while paused
    draggingRef.current = true
    setIsDragging(true)
    // capture so move/up keep firing if the pointer leaves the handle
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // ignore: capture is a nicety, drag still works without it
    }
    dragTo(e.clientX)
  }
  const onPointerMove = (e) => {
    if (!draggingRef.current) return
    dragTo(e.clientX)
  }
  const onPointerUp = (e) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
      // ignore
    }
  }

  // Keep runningRef in sync after each commit so the anime.js onComplete chain
  // reads the current Play/Pause state (refs must not be written during render).
  useEffect(() => {
    runningRef.current = state.running
  })

  // Kick the first step when Play starts; the glide's onComplete chains the rest.
  useEffect(() => {
    if (state.running) dispatch({ type: 'AUTO_STEP' })
  }, [state.running])

  // Glide the dot to each newly committed step using anime.js. When the glide
  // finishes, advance the optimizer (if still running), which appends the next
  // step and re-runs this effect — that chain is the stepping loop.
  const targetX = state.history[state.history.length - 1]
  useEffect(() => {
    if (animRef.current) animRef.current.cancel()

    // anime.js drives every transition. On a fresh step it glides over STEP_MS;
    // on reset / start-switch (history back to one point) it animates from the
    // current dot position to the new start. All setState happens inside anime's
    // callbacks, never synchronously in this effect body.
    const proxy = { x: displayRef.current }
    animRef.current = animate(proxy, {
      x: targetX,
      duration: state.history.length <= 1 ? 0 : STEP_MS,
      ease: 'out(2)', // anime.js v4 power ease-out (the engine default)
      onUpdate: () => {
        displayRef.current = proxy.x
        setRenderX(proxy.x)
      },
      onComplete: () => {
        displayRef.current = targetX
        setRenderX(targetX)
        if (runningRef.current) dispatch({ type: 'AUTO_STEP' })
      },
    })

    return () => {
      if (animRef.current) animRef.current.cancel()
    }
  }, [state.history, targetX])

  // Discrete current step — drives readouts, settling, and status (unchanged).
  const x = state.history[state.history.length - 1]
  const slope = df(x)
  const done = state.history.length >= MAX_STEPS || isSettled(x)

  // Animated visual position — drives the dot, arrow, and trail tip.
  const vSlope = df(renderX)
  const cx = sx(renderX)
  const cy = sy(f(renderX))

  // descent direction along x is the sign of the negative gradient
  const dir = vSlope > 0 ? -1 : 1
  const ARROW = 26
  const arrowX2 = cx + dir * ARROW

  // Trail follows the gliding dot: committed points, with the live dot as the tip.
  const trailD = [...state.history.slice(0, -1), renderX]
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
      tryThis="While paused, drag the red point anywhere along the curve to set the starting position, then press Play. Where you let go decides which valley it falls into: release it on the right slope and it settles in the local minimum, release it left of the central ridge and it reaches the deeper global minimum. Reset returns to the default start."
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', maxWidth: 600, height: 'auto', display: 'block', margin: '0 auto', touchAction: 'none' }}
        aria-label="Loss curve of a 1D double-well function. Drag the red point along the curve while paused to set the starting position, then run gradient descent."
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

        {/* descent-direction arrow (uses the animated slope so it fades on arrival) */}
        {!done && Math.abs(vSlope) > SETTLE_SLOPE && (
          <line x1={cx.toFixed(1)} y1={cy.toFixed(1)} x2={arrowX2.toFixed(1)} y2={cy.toFixed(1)} stroke="#c0392b" strokeWidth={1.6} markerEnd="url(#gdArrow)" />
        )}

        {/* current point (visual only; the grab handle below receives pointer events) */}
        <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={5} fill="#c0392b" stroke="#ffffff" strokeWidth={1.5} pointerEvents="none" />

        {/* drag handle: a generous transparent hit area over the dot. Draggable
            only while paused; sets the start x and tracks the pointer instantly. */}
        <circle
          cx={cx.toFixed(1)}
          cy={cy.toFixed(1)}
          r={16}
          fill="transparent"
          style={{ cursor: state.running ? 'default' : isDragging ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </svg>
    </Figure>
  )
}
