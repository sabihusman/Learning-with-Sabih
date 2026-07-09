'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Figure from './Figure'
import {
  DATA,
  H,
  LR,
  GRID_N,
  EPOCHS_PER_FRAME,
  STEP_EPOCHS,
  MAX_EPOCH,
  CONVERGE_LOSS,
  makeNet,
  forward,
  trainEpoch,
  meanLoss,
  predictGrid,
  snapshotWeights,
  PAPER,
  INK,
  FADE,
  CLASS0,
  CLASS1,
  POS_EDGE,
  NEG_EDGE,
} from './neuralNetData'

// ── network-diagram geometry ────────────────────────────────────────────────
const NN_W = 250
const NN_H = 300
const IN_X = 46
const IN_Y = [112, 188]
const HID_X = 130
const hidY = (j) => 46 + (j * (NN_H - 92)) / (H - 1)
const OUT_X = 208
const OUT_Y = 150

const edgeWidth = (w) => Math.min(5, 0.5 + Math.abs(w) * 2.2)
const edgeOpacity = (w) => Math.min(0.95, 0.18 + Math.abs(w) * 0.3)
const edgeColor = (w) => (w >= 0 ? POS_EDGE : NEG_EDGE)

// ── task-panel geometry ──────────────────────────────────────────────────────
const T = 300
const PADT = 16
const PLOTW = T - 2 * PADT
const CELL = PLOTW / GRID_N
const dpx = (x) => PADT + ((x + 1) / 2) * PLOTW
const dpy = (y) => PADT + (1 - (y + 1) / 2) * PLOTW

const accuracyOf = (net) => {
  let c = 0
  for (const p of DATA) if ((forward(net, p.x, p.y).yhat >= 0.5 ? 1 : 0) === p.label) c++
  return c / DATA.length
}

export default function NeuralNetViz() {
  // Build the initial network once inside a state initializer (not by reading a
  // ref during render) and seed all the display state from it.
  const [init] = useState(() => {
    const net = makeNet()
    return {
      net,
      loss: meanLoss(net, DATA),
      weights: snapshotWeights(net),
      field: predictGrid(net, GRID_N),
      accuracy: accuracyOf(net),
    }
  })
  const netRef = useRef(init.net)

  const [epoch, setEpoch] = useState(0)
  const [loss, setLoss] = useState(init.loss)
  const [weights, setWeights] = useState(init.weights)
  const [field, setField] = useState(init.field)
  const [accuracy, setAccuracy] = useState(init.accuracy)
  const [running, setRunning] = useState(false)
  const [converged, setConverged] = useState(false)

  const epochRef = useRef(0)
  const lastFieldRef = useRef(0)
  const timerRef = useRef(null)

  // training loop: timer-driven, NOT requestAnimationFrame. Browsers suspend rAF in
  // a hidden/backgrounded tab, which would freeze training mid-run; setTimeout keeps
  // firing (just throttled), so the network keeps converging. ~60 ticks/sec in the
  // foreground matches the old rAF pacing. Cleared on pause and on unmount, so no
  // loop leaks. Runs a few epochs per tick; the decision field (the costliest redraw)
  // refreshes on a throttle while loss/epoch/weights update every tick.
  useEffect(() => {
    if (!running) return undefined
    let active = true
    const FRAME_MS = 16
    const FIELD_MS = 70

    const loop = () => {
      if (!active) return
      let l = 0
      for (let i = 0; i < EPOCHS_PER_FRAME; i++) l = trainEpoch(netRef.current, DATA, LR)
      epochRef.current += EPOCHS_PER_FRAME
      setEpoch(epochRef.current)
      setLoss(l)
      setWeights(snapshotWeights(netRef.current))
      setAccuracy(accuracyOf(netRef.current))

      const now = performance.now()
      if (now - lastFieldRef.current > FIELD_MS) {
        lastFieldRef.current = now
        setField(predictGrid(netRef.current, GRID_N))
      }

      if (l < CONVERGE_LOSS || epochRef.current >= MAX_EPOCH) {
        setField(predictGrid(netRef.current, GRID_N))
        setConverged(true)
        setRunning(false)
        return
      }
      timerRef.current = setTimeout(loop, FRAME_MS)
    }

    timerRef.current = setTimeout(loop, FRAME_MS)
    return () => {
      active = false
      clearTimeout(timerRef.current)
    }
  }, [running])

  const onStep = () => {
    if (running || converged) return
    let l = 0
    for (let i = 0; i < STEP_EPOCHS; i++) l = trainEpoch(netRef.current, DATA, LR)
    epochRef.current += STEP_EPOCHS
    setEpoch(epochRef.current)
    setLoss(l)
    setWeights(snapshotWeights(netRef.current))
    setAccuracy(accuracyOf(netRef.current))
    setField(predictGrid(netRef.current, GRID_N))
    if (l < CONVERGE_LOSS) setConverged(true)
  }

  const onReset = () => {
    clearTimeout(timerRef.current)
    setRunning(false)
    setConverged(false)
    netRef.current = makeNet()
    epochRef.current = 0
    setEpoch(0)
    setLoss(meanLoss(netRef.current, DATA))
    setWeights(snapshotWeights(netRef.current))
    setAccuracy(accuracyOf(netRef.current))
    setField(predictGrid(netRef.current, GRID_N))
  }

  // static data points: positions never change, so memoize once
  const pointEls = useMemo(
    () =>
      DATA.map((p, i) => (
        <circle
          key={i}
          cx={dpx(p.x).toFixed(1)}
          cy={dpy(p.y).toFixed(1)}
          r={3.1}
          fill={p.label ? CLASS1 : CLASS0}
          stroke="#ffffff"
          strokeWidth={0.8}
        />
      )),
    []
  )

  // decision field: rebuilt only when the throttled `field` changes
  const fieldEls = useMemo(() => {
    const rects = []
    for (let iy = 0; iy < GRID_N; iy++) {
      for (let ix = 0; ix < GRID_N; ix++) {
        const p = field[iy * GRID_N + ix]
        const inside = p >= 0.5
        const op = (inside ? p - 0.5 : 0.5 - p) * 2 * 0.5
        rects.push(
          <rect
            key={iy * GRID_N + ix}
            x={(PADT + ix * CELL).toFixed(2)}
            y={(PADT + iy * CELL).toFixed(2)}
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

  const controls = [
    { label: running ? 'Pause' : 'Play', onClick: () => setRunning((r) => !r), variant: 'primary', disabled: converged },
    { label: 'Step', onClick: onStep, disabled: running || converged },
    { label: 'Reset', onClick: onReset },
  ]

  const readouts = [
    { label: 'epoch', value: epoch },
    { label: 'loss', value: loss.toFixed(4) },
    { label: 'accuracy', value: `${(accuracy * 100).toFixed(0)}%` },
  ]

  const status = converged ? 'Converged: loss is low and the classes are separated' : running ? 'Training...' : 'Paused'

  // hidden-to-output edges and input-to-hidden edges from the live weight snapshot
  return (
    <Figure
      eyebrow="Deep learning"
      title="A tiny neural network learning to separate two classes"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Press Play and watch the loss fall as the network trains. The connection lines thicken and change color (black for positive weights, red for negative) as the weights update, and the shaded decision boundary bends from a straight guess into a ring that wraps the inner class. Reset restores the same seeded starting weights and starts over. Step advances training a little at a time."
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', alignItems: 'center' }}>
        {/* network diagram */}
        <svg
          viewBox={`0 0 ${NN_W} ${NN_H}`}
          style={{ width: '100%', maxWidth: 250, height: 'auto', flex: '1 1 220px' }}
          aria-label="Network diagram: two inputs, one hidden layer of six neurons, one output. Edge thickness shows weight magnitude and color shows sign."
        >
          {/* edges: inputs -> hidden */}
          {weights.W1.map((row, j) =>
            row.map((w, i) => (
              <line
                key={`i${i}h${j}`}
                x1={IN_X}
                y1={IN_Y[i]}
                x2={HID_X}
                y2={hidY(j)}
                stroke={edgeColor(w)}
                strokeWidth={edgeWidth(w)}
                strokeOpacity={edgeOpacity(w)}
              />
            ))
          )}
          {/* edges: hidden -> output */}
          {weights.W2.map((w, j) => (
            <line
              key={`h${j}o`}
              x1={HID_X}
              y1={hidY(j)}
              x2={OUT_X}
              y2={OUT_Y}
              stroke={edgeColor(w)}
              strokeWidth={edgeWidth(w)}
              strokeOpacity={edgeOpacity(w)}
            />
          ))}
          {/* nodes */}
          {IN_Y.map((y, i) => (
            <g key={`in${i}`}>
              <circle cx={IN_X} cy={y} r={11} fill={PAPER} stroke={INK} strokeWidth={1.4} />
              <text x={IN_X} y={y + 3.5} fontSize={10} fill={INK} textAnchor="middle" fontFamily="ui-monospace,monospace">
                {i === 0 ? 'x' : 'y'}
              </text>
            </g>
          ))}
          {Array.from({ length: H }, (_, j) => (
            <circle key={`hid${j}`} cx={HID_X} cy={hidY(j)} r={9} fill={PAPER} stroke={INK} strokeWidth={1.3} />
          ))}
          <g>
            <circle cx={OUT_X} cy={OUT_Y} r={11} fill={PAPER} stroke={INK} strokeWidth={1.4} />
            <text x={OUT_X} y={OUT_Y + 3.5} fontSize={8} fill={INK} textAnchor="middle" fontFamily="ui-monospace,monospace">
              out
            </text>
          </g>
          <text x={IN_X} y={NN_H - 8} fontSize={8} fill={FADE} textAnchor="middle" fontFamily="ui-monospace,monospace">
            inputs
          </text>
          <text x={HID_X} y={NN_H - 8} fontSize={8} fill={FADE} textAnchor="middle" fontFamily="ui-monospace,monospace">
            hidden
          </text>
          <text x={OUT_X} y={NN_H - 8} fontSize={8} fill={FADE} textAnchor="middle" fontFamily="ui-monospace,monospace">
            output
          </text>
        </svg>

        {/* task panel: points + decision field */}
        <svg
          viewBox={`0 0 ${T} ${T}`}
          style={{ width: '100%', maxWidth: 300, height: 'auto', flex: '1 1 260px' }}
          aria-label="Two classes of 2D points (inside vs outside a circle) with the network's current decision boundary shaded behind them."
        >
          <rect x={PADT} y={PADT} width={PLOTW} height={PLOTW} fill={PAPER} stroke="#e2e0d8" strokeWidth={1} />
          {fieldEls}
          {pointEls}
          <rect x={PADT} y={PADT} width={PLOTW} height={PLOTW} fill="none" stroke="#d4d0c8" strokeWidth={1} />
        </svg>
      </div>
    </Figure>
  )
}
