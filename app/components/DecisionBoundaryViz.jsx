'use client'

import { useEffect, useReducer, useRef } from 'react'
import Figure from './Figure'
import styles from './DecisionBoundaryViz.module.css'
import {
  INITIAL_POINTS,
  ZERO_WEIGHTS,
  LR,
  STEPS_PER_TICK,
  TOTAL_ITERS,
  TICK_MS,
  NUDGE_STEP,
  SQUARE,
  trainSteps,
  lossOf,
  misclassifiedCount,
  clipHalfPlane,
  boundarySegment,
  CLASS0,
  CLASS1,
} from './decisionBoundaryData'

// ── plot geometry (a square plot over [-1, 1]^2, same convention as the
// activations figure) ──────────────────────────────────────────────────────
const T = 320
const PAD = 16
const PLOT = T - 2 * PAD
const px = (x) => PAD + ((x + 1) / 2) * PLOT
const py = (y) => PAD + (1 - (y + 1) / 2) * PLOT
const worldX = (viewX) => Math.max(-1, Math.min(1, ((viewX - PAD) / PLOT) * 2 - 1))
const worldY = (viewY) => Math.max(-1, Math.min(1, 2 * (1 - (viewY - PAD) / PLOT) - 1))

const initialState = { points: INITIAL_POINTS, weights: ZERO_WEIGHTS, iter: 0, running: true }

function reducer(state, action) {
  switch (action.type) {
    case 'TICK': {
      if (!state.running) return state
      const weights = trainSteps(state.weights, state.points, LR, STEPS_PER_TICK)
      const iter = Math.min(state.iter + STEPS_PER_TICK, TOTAL_ITERS)
      return { ...state, weights, iter, running: iter < TOTAL_ITERS }
    }
    case 'MOVE_POINT': {
      // moving a point restarts the timer, but weights carry over: the fit
      // resumes from where it was, chasing the moved point rather than
      // starting over from w = 0.
      const points = state.points.map((p) => (p.id === action.id ? { ...p, x: action.x, y: action.y } : p))
      return { ...state, points, iter: 0, running: true }
    }
    case 'REFIT':
      return { ...state, weights: ZERO_WEIGHTS, iter: 0, running: true }
    case 'RESET':
      return { ...state, points: INITIAL_POINTS, weights: ZERO_WEIGHTS, iter: 0, running: true }
    default:
      return state
  }
}

export default function DecisionBoundaryViz() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const svgRef = useRef(null)
  const draggingIdRef = useRef(null)

  // Training cadence: a real setInterval, not rAF. Each tick is a fixed
  // batch of gradient steps; the run always stops after exactly TOTAL_ITERS
  // steps. No synchronous setState in the effect body: the interval callback
  // is the only place that dispatches.
  useEffect(() => {
    if (!state.running) return undefined
    const id = window.setInterval(() => dispatch({ type: 'TICK' }), TICK_MS)
    return () => window.clearInterval(id)
  }, [state.running])

  const pointerToWorld = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect()
    const viewX = ((clientX - rect.left) / rect.width) * T
    const viewY = ((clientY - rect.top) / rect.height) * T
    return { x: worldX(viewX), y: worldY(viewY) }
  }

  const dragTo = (id, clientX, clientY) => {
    const { x, y } = pointerToWorld(clientX, clientY)
    dispatch({ type: 'MOVE_POINT', id, x, y })
  }

  const onPointerDown = (id) => (e) => {
    draggingIdRef.current = id
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // ignore: capture is a nicety, drag still works without it
    }
    dragTo(id, e.clientX, e.clientY)
  }
  const onPointerMove = (id) => (e) => {
    if (draggingIdRef.current !== id) return
    dragTo(id, e.clientX, e.clientY)
  }
  const onPointerUp = (id) => (e) => {
    if (draggingIdRef.current !== id) return
    draggingIdRef.current = null
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
      // ignore
    }
  }

  // Keyboard equivalent of dragging: each point is a real, focusable element,
  // so Tab cycles through them (the point-picker) and arrow keys nudge
  // whichever one is focused.
  const onKeyDown = (p) => (e) => {
    let dx = 0
    let dy = 0
    if (e.key === 'ArrowLeft') dx = -NUDGE_STEP
    else if (e.key === 'ArrowRight') dx = NUDGE_STEP
    else if (e.key === 'ArrowUp') dy = NUDGE_STEP
    else if (e.key === 'ArrowDown') dy = -NUDGE_STEP
    else return
    e.preventDefault()
    const x = Math.max(-1, Math.min(1, p.x + dx))
    const y = Math.max(-1, Math.min(1, p.y + dy))
    dispatch({ type: 'MOVE_POINT', id: p.id, x, y })
  }

  const { weights, points, iter, running } = state
  const { w1, w2, b } = weights
  const loss = lossOf(weights, points)
  const mis = misclassifiedCount(weights, points)

  const segment = boundarySegment(w1, w2, b)
  const posPoly = clipHalfPlane(SQUARE, w1, w2, b, 1)
  const negPoly = clipHalfPlane(SQUARE, w1, w2, b, -1)
  const toSvgPoints = (poly) => poly.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(' ')

  const equation = `${w1.toFixed(2)}x + ${w2.toFixed(2)}y + ${b.toFixed(2)} = 0`

  const controls = [
    { label: 'Refit', onClick: () => dispatch({ type: 'REFIT' }) },
    { label: 'Reset', onClick: () => dispatch({ type: 'RESET' }) },
  ]

  const readouts = [
    { label: 'loss', value: loss.toFixed(4) },
    { label: 'iterations', value: `${iter}/${TOTAL_ITERS}` },
    { label: 'misclassified', value: `${mis} of ${points.length}` },
  ]

  const status = running ? 'Training' : 'Converged'

  return (
    <Figure
      eyebrow="Classification"
      title="The line that learning draws"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Drag one point deep into the other class's territory and watch the boundary chase it. The line rotates to compromise, but if the point can no longer be separated by any straight line, the misclassified count stops at 1 and stays there, because a straight line cannot always be accommodated. That is a feature, not a failure: the Overfitting topic is about what happens when a model refuses to make that compromise."
    >
      <div className={styles.plotWrap}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${T} ${T}`}
          className={styles.svg}
          style={{ touchAction: 'none' }}
          role="img"
          aria-label="14 points in two classes on a 2D plane, with a logistic regression decision boundary line fit live by gradient descent. Points are draggable and the boundary refits as they move."
        >
          <rect x={PAD} y={PAD} width={PLOT} height={PLOT} fill="#f7f6f2" stroke="#e2e0d8" strokeWidth={1} />

          {/* faint half-plane shading: which side is predicted class 0 vs class 1 */}
          {negPoly.length > 0 && <polygon points={toSvgPoints(negPoly)} fill={CLASS0} opacity={0.08} />}
          {posPoly.length > 0 && <polygon points={toSvgPoints(posPoly)} fill={CLASS1} opacity={0.08} />}

          {/* the boundary line itself */}
          {segment && (
            <line
              x1={px(segment[0][0]).toFixed(1)}
              y1={py(segment[0][1]).toFixed(1)}
              x2={px(segment[1][0]).toFixed(1)}
              y2={py(segment[1][1]).toFixed(1)}
              stroke="#1a1a1a"
              strokeWidth={1.6}
            />
          )}

          {points.map((p, idx) => (
            <circle
              key={p.id}
              cx={px(p.x).toFixed(1)}
              cy={py(p.y).toFixed(1)}
              r={6}
              fill={p.label ? CLASS1 : CLASS0}
              stroke="#ffffff"
              strokeWidth={1.2}
              className={styles.point}
              tabIndex={0}
              role="button"
              aria-label={`${p.label ? 'Class 1' : 'Class 0'} point ${idx + 1}. Drag or use arrow keys to move it.`}
              onPointerDown={onPointerDown(p.id)}
              onPointerMove={onPointerMove(p.id)}
              onPointerUp={onPointerUp(p.id)}
              onPointerCancel={onPointerUp(p.id)}
              onKeyDown={onKeyDown(p)}
            />
          ))}

          <rect x={PAD} y={PAD} width={PLOT} height={PLOT} fill="none" stroke="#d4d0c8" strokeWidth={1} />
        </svg>
      </div>

      <p className={styles.equation}>{equation}</p>

      <p className={styles.caption}>
        Fit live in the browser: binary cross-entropy loss, full-batch gradient descent, learning rate {LR}, {STEPS_PER_TICK} steps per tick, {TOTAL_ITERS} steps per run. Weights start at w1 = w2 = b = 0 every time the run restarts from Refit or Reset; moving a point restarts the timer but keeps the current weights, so the fit resumes instead of starting over.
      </p>
    </Figure>
  )
}
