'use client'

import { useMemo, useState } from 'react'
import Figure from './Figure'
import { usePacedInterval } from './usePacedInterval'
import { PRESETS, HEAP_SIZE, buildFrames, shuffledValues, leftOf, depthOf, offsetInDepth } from './heapsData'
import { INK, FADE, RULE, ACCENT, OK, OK_SOFT, OK_BG, ERR_BG, PANEL, CONTROL_BG, MONO } from './vizPalette'
import shared from './vizShared.module.css'
import styles from './HeapsViz.module.css'

const PLAY_MS = 420

// Shared palette: ACCENT marks the two cells being compared, OK the two being
// swapped, OK_SOFT/OK_BG the tail locked into sorted order.

// The smallest label (index digits, 8.5 units) must render at >= 7px on a phone:
// ceil(7 x 480 / 8.5) = 396, so the drawing scrolls sideways below that width.
const SVG_MIN_WIDTH = 396

// ── geometry ────────────────────────────────────────────────────────────────────
// 15 nodes is exactly a full tree of depth 4, so every level is complete and the
// tree and the array line up index for index with no gaps to explain away.
const VB_W = 480
const VB_H = 296
const LEVEL_Y = [28, 82, 136, 190]
const R = 17

const nodeX = (i) => (offsetInDepth(i) + 0.5) * (VB_W / 2 ** depthOf(i))
const nodeY = (i) => LEVEL_Y[depthOf(i)]

const PAD = 10
const CELL_PITCH = (VB_W - 2 * PAD) / HEAP_SIZE
const CELL_W = CELL_PITCH - 4
const CELL_H = 30
const CELL_Y = 232
const cellX = (i) => PAD + i * CELL_PITCH + (CELL_PITCH - CELL_W) / 2

// One state per index, shared by BOTH views so a highlight always lands on the
// same value twice: once in the tree, once in the array.
function stateOf(i, f) {
  if (f.swap && (i === f.swap[0] || i === f.swap[1])) return 'swap'
  if (i >= f.heapSize) return 'locked'
  if (f.compare && (i === f.compare[0] || i === f.compare[1])) return 'compare'
  if (f.focus === i) return 'focus'
  return 'plain'
}

const FILL = { swap: OK_BG, compare: ERR_BG, locked: OK_BG, focus: '#ffffff', plain: PANEL }
const STROKE = { swap: OK, compare: ACCENT, locked: OK_SOFT, focus: INK, plain: RULE }
const TEXT = { swap: OK, compare: ACCENT, locked: OK, focus: INK, plain: INK }
const WEIGHT = { swap: 2, compare: 2, locked: 1.4, focus: 2, plain: 1 }

const PHASE_LABEL = { build: 'build', sort: 'empty', done: 'done' }

export default function HeapsViz() {
  const [presetKey, setPresetKey] = useState(PRESETS[0].key)
  const [shuffleSeed, setShuffleSeed] = useState(0)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const values = useMemo(
    () => (presetKey === 'shuffle' ? shuffledValues(shuffleSeed) : PRESETS.find((p) => p.key === presetKey).values),
    [presetKey, shuffleSeed],
  )
  const sim = useMemo(() => buildFrames(values), [values])
  const frames = sim.frames
  const last = frames.length - 1
  const f = frames[step]
  const done = step >= last
  const isPlaying = playing && !done

  // Auto-advance through the shared paced-interval hook (setInterval, never
  // requestAnimationFrame): gated on playing until done, paced by the shared
  // animation-speed multiplier that AnimationSpeedControl drives.
  usePacedInterval(playing && !done, PLAY_MS, () => setStep((s) => Math.min(last, s + 1)))

  const restart = () => {
    setPlaying(false)
    setStep(0)
  }
  const pickPreset = (key) => {
    if (key === presetKey) return
    restart()
    setPresetKey(key)
  }
  const shuffle = () => {
    restart()
    setShuffleSeed((s) => s + 1)
    setPresetKey('shuffle')
  }

  const controls = [
    { label: 'Step', onClick: () => setStep((s) => Math.min(last, s + 1)), variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: restart, disabled: step === 0 },
  ]

  const readouts = [
    { label: 'phase', value: PHASE_LABEL[f.phase] },
    { label: 'step', value: `${step} / ${last}` },
    { label: 'comparisons', value: f.comparisons },
    { label: 'swaps', value: f.swaps },
  ]

  return (
    <Figure
      eyebrow="Heaps"
      title="A max-heap, built then emptied"
      controls={controls}
      speedControl
      status={f.note}
      readouts={readouts}
      tryThis="Build with each preset and compare the swap counts. Descending takes none, because a descending array already satisfies the heap rule. Ascending takes the most, in both phases. Watch both views as you step: every swap in the tree is the same swap in the array, and the tree is only ever a picture of the indexes."
    >
      <div className={styles.heapFigure}>
        <div className={shared.group}>
          <span className={shared.groupLabel}>array</span>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={shared.btn}
              aria-pressed={presetKey === p.key}
              onClick={() => pickPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
          <button type="button" className={shared.btn} aria-pressed={presetKey === 'shuffle'} onClick={shuffle}>
            Shuffle
          </button>
        </div>

        <div className={shared.scroll}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={styles.svg}
          style={{ minWidth: SVG_MIN_WIDTH }}
          role="img"
          aria-label={`Max-heap of ${HEAP_SIZE} values, phase ${PHASE_LABEL[f.phase]}, step ${step} of ${last}, ${f.comparisons} comparisons and ${f.swaps} swaps so far. Array is ${f.arr.join(', ')}.`}
        >
          {/* tree view: parent above its two children */}
          {f.arr.map((_, i) => {
            const l = leftOf(i)
            return [l, l + 1]
              .filter((c) => c < HEAP_SIZE)
              .map((c) => (
                <line
                  key={`edge-${i}-${c}`}
                  x1={nodeX(i)}
                  y1={nodeY(i)}
                  x2={nodeX(c)}
                  y2={nodeY(c)}
                  stroke={c >= f.heapSize || i >= f.heapSize ? CONTROL_BG : RULE}
                  strokeWidth={1.3}
                />
              ))
          })}
          {f.arr.map((v, i) => {
            const st = stateOf(i, f)
            return (
              <g key={`node-${i}`}>
                <circle cx={nodeX(i)} cy={nodeY(i)} r={R} fill={FILL[st]} stroke={STROKE[st]} strokeWidth={WEIGHT[st]} />
                <text
                  x={nodeX(i)}
                  y={nodeY(i) + 4}
                  fontSize={12}
                  fontFamily={MONO}
                  fontWeight={700}
                  fill={TEXT[st]}
                  textAnchor="middle"
                >
                  {v}
                </text>
              </g>
            )
          })}

          {/* array view: same order, same index */}
          <text x={PAD} y={CELL_Y - 8} fontSize={9} fill={FADE} fontFamily={MONO} letterSpacing="0.1em">
            SAME VALUES, FLAT: INDEX i HAS CHILDREN 2i+1 AND 2i+2
          </text>
          {f.arr.map((v, i) => {
            const st = stateOf(i, f)
            return (
              <g key={`cell-${i}`}>
                <rect
                  x={cellX(i)}
                  y={CELL_Y}
                  width={CELL_W}
                  height={CELL_H}
                  rx={4}
                  fill={FILL[st]}
                  stroke={STROKE[st]}
                  strokeWidth={WEIGHT[st]}
                />
                <text
                  x={cellX(i) + CELL_W / 2}
                  y={CELL_Y + 19}
                  fontSize={11}
                  fontFamily={MONO}
                  fontWeight={700}
                  fill={TEXT[st]}
                  textAnchor="middle"
                >
                  {v}
                </text>
                <text
                  x={cellX(i) + CELL_W / 2}
                  y={CELL_Y + CELL_H + 12}
                  fontSize={8.5}
                  fontFamily={MONO}
                  fill={FADE}
                  textAnchor="middle"
                >
                  {i}
                </text>
              </g>
            )
          })}
        </svg>
        </div>

        <p className={shared.caption}>
          Both phases are real. The array, the tree, the counters, and every swap are computed from the input rather
          than replayed from a recording, and the tree and array views are drawn from the same state. The presets are
          kept small so the tree fits on screen; real priority queues hold far more.
        </p>
      </div>
    </Figure>
  )
}
