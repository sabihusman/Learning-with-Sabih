'use client'

import { useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './ActivationViz.module.css'
import {
  DATA,
  GRID_N,
  MIN_UNITS,
  MAX_UNITS,
  DEFAULT_UNITS,
  fitCached,
  predictGrid,
  accuracy,
  PAPER,
  CLASS0,
  CLASS1,
} from './activationData'

// ── task-panel geometry (a square plot over [-1, 1]^2) ────────────────────────────
const T = 320
const PAD = 16
const PLOT = T - 2 * PAD
const CELL = PLOT / GRID_N
const px = (x) => PAD + ((x + 1) / 2) * PLOT
const py = (y) => PAD + (1 - (y + 1) / 2) * PLOT

export default function ActivationViz() {
  const [useRelu, setUseRelu] = useState(true)
  const [units, setUnits] = useState(DEFAULT_UNITS)

  // Fit the tiny network for the current (activation, unit-count) and read its real
  // decision field. Memoized on the two controls and cached across the session, so a
  // setting trains once and every later visit is instant. No timer: the figure just
  // recomputes when a control changes.
  const { field, acc } = useMemo(() => {
    const { net } = fitCached(units, useRelu)
    return { field: predictGrid(net, GRID_N, useRelu), acc: accuracy(net, useRelu) }
  }, [useRelu, units])

  const separated = acc >= 0.995

  // static data points never move, so build them once
  const pointEls = useMemo(
    () =>
      DATA.map((p, i) => (
        <circle
          key={i}
          cx={px(p.x).toFixed(1)}
          cy={py(p.y).toFixed(1)}
          r={3.1}
          fill={p.label ? CLASS1 : CLASS0}
          stroke="#ffffff"
          strokeWidth={0.8}
        />
      )),
    []
  )

  // decision field: one shaded cell per grid square, colour by predicted class and
  // opacity by confidence, so the boundary reads as the seam between the two colours
  const fieldEls = useMemo(() => {
    const rects = []
    for (let iy = 0; iy < GRID_N; iy += 1) {
      for (let ix = 0; ix < GRID_N; ix += 1) {
        const p = field[iy * GRID_N + ix]
        const inside = p >= 0.5
        const op = (inside ? p - 0.5 : 0.5 - p) * 2 * 0.5
        rects.push(
          <rect
            key={iy * GRID_N + ix}
            x={(PAD + ix * CELL).toFixed(2)}
            y={(PAD + iy * CELL).toFixed(2)}
            width={(CELL + 0.6).toFixed(2)}
            height={(CELL + 0.6).toFixed(2)}
            fill={inside ? CLASS1 : CLASS0}
            opacity={op.toFixed(3)}
          />
        )
      }
    }
    return rects
  }, [field])

  const readouts = [
    { label: 'activation', value: useRelu ? 'ReLU' : 'none (linear)' },
    { label: 'accuracy', value: `${(acc * 100).toFixed(0)}%` },
    { label: 'separates?', value: separated ? 'yes' : 'no' },
  ]

  const status = useRelu
    ? 'ReLU on: the boundary bends into a piecewise shape and can wrap the inner class.'
    : 'Activation off: the network is linear, so the boundary is a straight line and cannot separate the ring.'

  return (
    <Figure
      eyebrow="Non-linearity"
      title="Why a non-linear activation lets the boundary bend"
      status={status}
      readouts={readouts}
      tryThis="Turn the activation off: the boundary is a straight line and adding hidden units changes nothing, because a stack of linear layers is still just one linear layer. Turn ReLU on and the same boundary bends to wrap the inner ring. Then drag the hidden-units slider up and watch the boundary gain more bends and fit more tightly."
    >
      <div className={styles.controls}>
        <div className={styles.toggle} role="group" aria-label="Activation">
          {[
            [false, 'Activation off'],
            [true, 'ReLU on'],
          ].map(([val, label]) => (
            <button
              key={label}
              type="button"
              className={`${styles.toggleBtn} ${val === useRelu ? styles.toggleActive : ''}`}
              aria-pressed={val === useRelu}
              onClick={() => setUseRelu(val)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className={styles.slider}>
          <label htmlFor="act-units" className={styles.sliderLabel}>
            hidden units
          </label>
          <input
            id="act-units"
            className={styles.range}
            type="range"
            min={MIN_UNITS}
            max={MAX_UNITS}
            step={1}
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
          />
          <span className={styles.sliderValue}>{units}</span>
        </span>
      </div>

      <div className={styles.plotWrap}>
        <svg
          viewBox={`0 0 ${T} ${T}`}
          className={styles.svg}
          role="img"
          aria-label="Two classes of 2D points arranged as an inner disc inside an outer ring, with the network's current decision boundary shaded behind them."
        >
          <rect x={PAD} y={PAD} width={PLOT} height={PLOT} fill={PAPER} stroke="#e2e0d8" strokeWidth={1} />
          {fieldEls}
          {pointEls}
          <rect x={PAD} y={PAD} width={PLOT} height={PLOT} fill="none" stroke="#d4d0c8" strokeWidth={1} />
        </svg>
      </div>

      <p className={styles.caption}>
        The network is trained for real in the browser (a tiny two-input network, one hidden layer, seeded so the result
        is identical every time). The decision boundary shown is computed from that trained network, not drawn by hand.
        The point set is fixed and cannot be split by any straight line.
      </p>
    </Figure>
  )
}
