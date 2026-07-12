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
const DEFAULT_LR = 0.12 // the rate that settles the right start in the local minimum
const LR_MIN = 0.02
const LR_MAX = 2 // low end: smooth; mid: overshoot/oscillate; top: blows up fast
const MAX_STEPS = 80
// STEP_MS is the per-step glide duration AND the stepping cadence: the next
// optimizer step is dispatched when the current glide completes. Steps shrink as
// f'(x) -> 0, so at a fixed time per step the dot decelerates on its own.
const STEP_MS = 600
const SETTLE_SLOPE = 1e-3 // |f'(x)| below this counts as settled
const DIVERGE_BOUND = 4.2 // |x| past this means the steps blew up (flew off the chart)
// Steps whose on-screen movement is below this collapse instantly, so the run
// eases to a gentle stop instead of crawling through a long sub-pixel tail.
const MIN_STEP_PX = 0.6

// known extrema, for markers and the settled-state label
const GLOBAL_MIN = -2.0562
const LOCAL_MIN = 1.9386

const advance = (x, lr) => x - lr * df(x)
const isSettled = (x) => Math.abs(df(x)) < SETTLE_SLOPE

// ─── reducer ─────────────────────────────────────────────────────────────────
const DEFAULT_SIDE = 'right'
// Tolerate an unknown side (e.g. 'custom' after a drag) so RESET always lands on
// a valid default start rather than STARTS[undefined]. lr is carried across
// resets so the user can re-run from a start without re-setting the slider.
const initial = (side, lr) => {
  const key = side in STARTS ? side : DEFAULT_SIDE
  return { history: [STARTS[key]], running: false, side: key, lr, diverged: false }
}

const isDone = (state) =>
  state.diverged || state.history.length >= MAX_STEPS || isSettled(state.history[state.history.length - 1])

// one optimizer step, with a divergence guard for large learning rates
const stepOnce = (state) => {
  const last = state.history[state.history.length - 1]
  const nx = advance(last, state.lr)
  if (!Number.isFinite(nx) || Math.abs(nx) > DIVERGE_BOUND) {
    const clamped = Math.max(-DIVERGE_BOUND, Math.min(DIVERGE_BOUND, nx || DIVERGE_BOUND))
    return { ...state, running: false, diverged: true, history: [...state.history, clamped] }
  }
  return { ...state, history: [...state.history, nx] }
}

function reducer(state, action) {
  switch (action.type) {
    case 'PLAY':
      return isDone(state) ? state : { ...state, running: true }
    case 'PAUSE':
      return { ...state, running: false }
    case 'STEP':
      return isDone(state) ? { ...state, running: false } : { ...stepOnce(state), running: false }
    case 'AUTO_STEP':
      return isDone(state) ? { ...state, running: false } : stepOnce(state)
    case 'RESET':
      return initial(state.side, state.lr)
    case 'SET_START':
      return initial(action.side, state.lr)
    case 'SET_X':
      // drag-to-place: start a fresh run from an arbitrary x (already clamped).
      // 'custom' side means no preset button is active and RESET falls back to default.
      return { ...state, history: [action.x], running: false, side: 'custom', diverged: false }
    case 'SET_LR':
      // the learning-rate control: changing it returns the dot to the current
      // start so each rate can be compared from the same place.
      return { ...state, lr: action.lr, history: [state.history[0]], running: false, diverged: false }
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

// ─── presentational helpers ──────────────────────────────────────────────────
// Pure, behavior-preserving helpers pulled out of the component so its body stays
// simple to read (and under the cognitive-complexity limit).

// Trail path: sample f(x) between consecutive nodes so each segment hugs the
// curve instead of cutting a straight chord.
function buildTrailPath(nodes) {
  if (nodes.length < 2) return ''
  const pts = []
  const K = 8
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i]
    const b = nodes[i + 1]
    for (let k = 0; k < K; k++) {
      const xi = a + ((b - a) * k) / K
      pts.push([sx(xi), sy(f(xi))])
    }
  }
  const tip = nodes[nodes.length - 1]
  pts.push([sx(tip), sy(f(tip))])
  return pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
}

// Which basin a settled run landed in, or null if not near a known minimum.
function basinLabel(x) {
  if (Math.abs(x - GLOBAL_MIN) < 0.05) return 'Settled in the global minimum'
  if (Math.abs(x - LOCAL_MIN) < 0.05) return 'Settled in the local minimum'
  return null
}

// One-line status shown in the figure header.
function statusLabel(state, done) {
  if (state.diverged) return 'Diverged: the steps blew up and left the chart'
  if (done) return basinLabel(state.history[state.history.length - 1]) ?? 'Stopped without converging'
  return state.running ? 'Running' : 'Paused'
}

// Cursor for the drag handle (grab when idle, grabbing while dragging).
function cursorFor(running, dragging) {
  if (running) return 'default'
  return dragging ? 'grabbing' : 'grab'
}

// ─── component ───────────────────────────────────────────────────────────────
export default function GradientDescentViz() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initial('right', DEFAULT_LR))

  // renderX is the *displayed* dot position, smoothly tweened by anime.js
  // between discrete optimizer steps. The optimizer math (state.history) is
  // unchanged and still advances in exact discrete steps; only the pixels glide.
  const [renderX, setRenderX] = useState(() => STARTS.right)
  const displayRef = useRef(STARTS.right) // where the dot currently is (glide start)
  const animRef = useRef(null) // current anime.js glide instance, so we can cancel it

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

  // Optimizer cadence. The run advances on a timer, NOT on anime's rAF callbacks,
  // so the optimization keeps progressing even when rAF is paused or throttled
  // (a backgrounded or hidden tab). The first step fires immediately; the rest
  // follow every STEP_MS. The reducer stops appending once the run has settled or
  // diverged, which flips `running` off and tears this timer down.
  useEffect(() => {
    if (!state.running) return undefined
    let id = 0
    const tick = () => {
      dispatch({ type: 'AUTO_STEP' })
      id = window.setTimeout(tick, STEP_MS)
    }
    id = window.setTimeout(tick, 0)
    return () => window.clearTimeout(id)
  }, [state.running])

  // Visual glide. anime.js v4 interpolates the dot's x from the previous committed
  // step to the new one over STEP_MS; the dot's y is recomputed from f(x) every
  // frame in render (see cy below), so the motion rides the curve instead of cutting
  // a straight chord across it. The ease is LINEAR per step; because the optimizer's
  // steps shrink as f'(x) -> 0, the dot decelerates on its own and settles rather
  // than slamming to a halt.
  //
  // Each glide starts from the PREVIOUS committed step, not the live mid-glide
  // position, so it covers exactly one step. Snapping renderX to that start also
  // means that if anime cannot run (paused rAF), the dot still advances one step
  // per commit instead of freezing in place.
  const targetX = state.history[state.history.length - 1]
  const prevTarget = state.history.length >= 2 ? state.history[state.history.length - 2] : targetX
  useEffect(() => {
    if (animRef.current) animRef.current.cancel()
    const startX = prevTarget
    const stepPx = Math.abs((targetX - startX) / (X_MAX - X_MIN)) * (PLOT_R - PLOT_L)

    // single-point history (reset / drag / lr change) or a sub-pixel step: snap with
    // no glide. The snap is deferred to a 0ms timer so it is not a synchronous
    // setState in the effect body, and because a timer (unlike rAF) still fires when
    // the tab is hidden.
    if (state.history.length <= 1 || stepPx < MIN_STEP_PX) {
      const snap = window.setTimeout(() => {
        displayRef.current = targetX
        setRenderX(targetX)
      }, 0)
      return () => window.clearTimeout(snap)
    }

    // anime.js v4 glides the dot across exactly one optimizer step (prevTarget ->
    // targetX). The dot's y is recomputed from f(x) every frame in render, so the
    // motion rides the curve. The previous glide ended at prevTarget, so starting the
    // proxy there continues smoothly with no jump. The ease is LINEAR; deceleration
    // (and the settle) come from the optimizer steps shrinking as f'(x) -> 0.
    const proxy = { x: startX }
    animRef.current = animate(proxy, {
      x: targetX,
      duration: STEP_MS,
      ease: 'linear',
      onUpdate: () => {
        displayRef.current = proxy.x
        setRenderX(proxy.x)
      },
      onComplete: () => {
        displayRef.current = targetX
        setRenderX(targetX)
      },
    })

    // Robustness floor: rAF-driven animations are paused in a hidden/backgrounded
    // tab, so if the glide has not arrived by the time the step is over, snap the dot
    // to the step's target. On a visible tab anime has already arrived, so this is a
    // no-op; it just guarantees the dot keeps advancing instead of freezing.
    const floor = window.setTimeout(() => {
      if (displayRef.current !== targetX) {
        displayRef.current = targetX
        setRenderX(targetX)
      }
    }, STEP_MS + 60)

    return () => {
      if (animRef.current) animRef.current.cancel()
      window.clearTimeout(floor)
    }
  }, [state.history, targetX, prevTarget])

  // Discrete current step — drives readouts, settling, and status.
  const x = state.history[state.history.length - 1]
  const slope = df(x)
  const done = isDone(state)

  // Animated visual position. Clamp the displayed x to the chart so a diverged
  // run parks the dot at the edge rather than rendering off-screen. y is derived
  // from f(x) every frame, so the dot always rides the curve.
  const dispX = Math.max(X_MIN, Math.min(X_MAX, renderX))
  const vSlope = df(dispX)
  const cx = sx(dispX)
  const cy = sy(f(dispX))

  // descent direction along x is the sign of the negative gradient
  const dir = vSlope > 0 ? -1 : 1
  const ARROW = 26
  const arrowX2 = cx + dir * ARROW

  // Trail rides the curve: sample f(x) between consecutive points (and out to the
  // live dot) so each segment hugs the curve instead of cutting a straight chord.
  const trailNodes = [...state.history.slice(0, -1), dispX]
  const trailD = buildTrailPath(trailNodes)

  const status = statusLabel(state, done)

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
    { label: 'lr', value: state.lr.toFixed(2) },
    { label: 'x', value: x.toFixed(3) },
    { label: 'f(x)', value: f(x).toFixed(4) },
    { label: "f'(x)", value: slope.toFixed(4) },
  ]

  return (
    <Figure
      eyebrow="Optimization"
      title="Gradient descent on f(x) = 0.08(x² − 4)² + 0.15x"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="While paused, drag the red point anywhere along the curve to set the start, then press Play. Where you release it decides the outcome: on the right slope it settles in the local minimum, left of the central ridge it reaches the deeper global minimum. Then raise the learning rate. A small rate takes slow, careful steps; a large one overshoots the valley, bounces, and eventually blows up and leaves the chart entirely."
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', maxWidth: 600, height: 'auto', display: 'block', margin: '0 auto', touchAction: 'none' }}
        role="img"
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
            <text x={sx(tx)} y={PLOT_B + 16} fontSize={11.5} fill="#9b9892" textAnchor="middle" fontFamily="ui-monospace,monospace">{tx}</text>
          </g>
        ))}
        <text x={(PLOT_L + PLOT_R) / 2} y={VB_H - 2} fontSize={11.5} fill="#9b9892" textAnchor="middle" fontFamily="ui-monospace,monospace">x</text>

        {/* the loss curve */}
        <path d={CURVE_D} fill="none" stroke="#bdb8ad" strokeWidth={1.6} strokeLinejoin="round" />

        {/* minima markers */}
        <circle cx={sx(GLOBAL_MIN)} cy={sy(f(GLOBAL_MIN))} r={3} fill="#1a1a1a" />
        <text x={sx(GLOBAL_MIN)} y={sy(f(GLOBAL_MIN)) + 16} fontSize={11} fill="#6b6862" textAnchor="middle" fontFamily="ui-monospace,monospace">global min</text>
        <circle cx={sx(LOCAL_MIN)} cy={sy(f(LOCAL_MIN))} r={3} fill="none" stroke="#1a1a1a" strokeWidth={1.2} />
        <text x={sx(LOCAL_MIN)} y={sy(f(LOCAL_MIN)) - 9} fontSize={11} fill="#6b6862" textAnchor="middle" fontFamily="ui-monospace,monospace">local min</text>

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
          style={{ cursor: cursorFor(state.running, isDragging) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </svg>

      {/* learning-rate slider — the key teaching control. Changing it returns the
          dot to the current start so each rate is compared from the same place. */}
      <div style={{ maxWidth: 600, margin: '14px auto 4px', padding: '0 4px' }}>
        <label
          htmlFor="gd-lr"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#9b9892',
            marginBottom: 6,
          }}
        >
          <span>Learning rate</span>
          <span style={{ color: '#1a1a1a' }}>{state.lr.toFixed(2)}</span>
        </label>
        <input
          id="gd-lr"
          type="range"
          min={LR_MIN}
          max={LR_MAX}
          step={0.01}
          value={state.lr}
          onChange={(e) => dispatch({ type: 'SET_LR', lr: Number(e.target.value) })}
          style={{ width: '100%', accentColor: '#c0392b', cursor: 'pointer' }}
          aria-label="Learning rate"
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 9,
            color: '#9b9892',
            marginTop: 2,
          }}
        >
          <span>small, careful steps</span>
          <span>overshoot, then diverge</span>
        </div>
      </div>
    </Figure>
  )
}
