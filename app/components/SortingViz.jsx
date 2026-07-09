'use client'

import { useEffect, useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './SortingViz.module.css'

// Fixed, deterministic shuffled start: a permutation of 1..14, hardcoded (never
// Math.random) so every visit is byte-for-byte identical and the three algorithms are
// compared on exactly the same input. Distinct values keep each bar readable.
const SEED = [8, 3, 11, 6, 14, 1, 9, 4, 13, 7, 2, 12, 5, 10]
const PLAY_MS = 120

// ── real, instrumented sorts ────────────────────────────────────────────────────────
// Each builder runs the genuine algorithm and emits one frame per operation. A frame is
// a full snapshot the view can render directly; counters are accumulated for real.
const initFrame = (a) => ({ arr: [...a], compare: null, write: null, mergeRange: null, settledFrom: a.length, settledTo: 0, comparisons: 0, secondary: 0, note: 'Press Step or Play to sort' })
const doneFrame = (a, c, s, label) => ({ arr: [...a], compare: null, write: null, mergeRange: null, settledFrom: 0, settledTo: a.length, comparisons: c, secondary: s, done: true, note: `Sorted: ${c} comparisons, ${s} ${label}` })

function bubbleFrames(a0) {
  const a = [...a0]
  const n = a.length
  const frames = [initFrame(a)]
  let c = 0
  let s = 0
  for (let i = 0; i < n - 1; i += 1) {
    let swappedThisPass = false
    for (let j = 0; j < n - 1 - i; j += 1) {
      c += 1
      const swapped = a[j] > a[j + 1]
      if (swapped) {
        ;[a[j], a[j + 1]] = [a[j + 1], a[j]]
        s += 1
        swappedThisPass = true
      }
      frames.push({ arr: [...a], compare: [j, j + 1], write: null, mergeRange: null, settledFrom: n - i, settledTo: 0, comparisons: c, secondary: s, note: swapped ? `Swap positions ${j} and ${j + 1}` : `Compare positions ${j} and ${j + 1}` })
    }
    // standard early exit: a full pass with no swaps means the array is already sorted
    if (!swappedThisPass) break
  }
  frames.push(doneFrame(a, c, s, 'swaps'))
  return { frames, label: 'swaps' }
}

function insertionFrames(a0) {
  const a = [...a0]
  const n = a.length
  const frames = [initFrame(a)]
  let c = 0
  let m = 0
  for (let i = 1; i < n; i += 1) {
    let j = i
    while (j > 0) {
      c += 1
      const shift = a[j - 1] > a[j]
      if (shift) {
        ;[a[j - 1], a[j]] = [a[j], a[j - 1]]
        m += 1
      }
      frames.push({ arr: [...a], compare: [j - 1, j], write: null, mergeRange: null, settledFrom: n, settledTo: i, comparisons: c, secondary: m, note: shift ? `Shift position ${j} left` : `Compare positions ${j - 1} and ${j}` })
      if (!shift) break
      j -= 1
    }
  }
  frames.push(doneFrame(a, c, m, 'moves'))
  return { frames, label: 'moves' }
}

function mergeFrames(a0) {
  const a = [...a0]
  const n = a.length
  const frames = [initFrame(a)]
  let c = 0
  let m = 0
  function mergeRange(lo, mid, hi) {
    const left = a.slice(lo, mid + 1)
    const right = a.slice(mid + 1, hi + 1)
    let i = 0
    let j = 0
    let k = lo
    const place = (val) => {
      a[k] = val
      m += 1
      frames.push({ arr: [...a], compare: null, write: k, mergeRange: [lo, hi], settledFrom: n, settledTo: 0, comparisons: c, secondary: m, note: `Merge range ${lo}..${hi}` })
      k += 1
    }
    while (i < left.length && j < right.length) {
      c += 1
      if (left[i] <= right[j]) place(left[i++])
      else place(right[j++])
    }
    while (i < left.length) place(left[i++])
    while (j < right.length) place(right[j++])
  }
  function sort(lo, hi) {
    if (lo >= hi) return
    const mid = (lo + hi) >> 1
    sort(lo, mid)
    sort(mid + 1, hi)
    mergeRange(lo, mid, hi)
  }
  sort(0, n - 1)
  frames.push(doneFrame(a, c, m, 'moves'))
  return { frames, label: 'moves' }
}

const ALGOS = [
  { key: 'bubble', name: 'Bubble sort', build: bubbleFrames },
  { key: 'insertion', name: 'Insertion sort', build: insertionFrames },
  { key: 'merge', name: 'Merge sort', build: mergeFrames },
]

// ── bar geometry ────────────────────────────────────────────────────────────────────
const VB_W = 560
const VB_H = 168
const PAD = 8
const PLOT_TOP = 12
const PLOT_H = 134
const BASE_Y = PLOT_TOP + PLOT_H
const N = SEED.length
const PITCH = (VB_W - 2 * PAD) / N
const BAR_W = PITCH - 7
const MAX_VAL = N

const COLOR = { base: '#6b7f9e', compare: '#c0392b', settled: '#9cc3ab', done: '#2f8f63' }

function barColor(i, f) {
  if (f.done) return COLOR.done
  if (f.compare && (i === f.compare[0] || i === f.compare[1])) return COLOR.compare
  if (f.write === i) return COLOR.compare
  if (i < f.settledTo || i >= f.settledFrom) return COLOR.settled
  return COLOR.base
}

export default function SortingViz() {
  const [algoKey, setAlgoKey] = useState('bubble')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [lastRun, setLastRun] = useState(null)

  const { frames, label } = useMemo(() => ALGOS.find((a) => a.key === algoKey).build(SEED), [algoKey])
  const last = frames.length - 1
  const f = frames[step]
  const done = step >= last
  const isPlaying = playing && !done
  const algoName = ALGOS.find((a) => a.key === algoKey).name

  // Auto-advance with setInterval (never requestAnimationFrame) so it keeps progressing
  // in a backgrounded tab. Keyed on `done` so the interval tears down when the sort
  // finishes and on `last` so it rebinds when the algorithm changes; no setState in the
  // effect body, only interval cleanup. Any bar glide is a CSS transition, not here.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(last, s + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done, last])

  // snapshot the current run into "last run" memory so two algorithms can be compared
  const snapshot = () => {
    if (step > 0) setLastRun({ name: algoName, comparisons: f.comparisons, secondary: f.secondary, label, complete: done })
  }
  const onStep = () => setStep((s) => Math.min(last, s + 1))
  const reset = () => {
    snapshot()
    setPlaying(false)
    setStep(0)
  }
  const selectAlgo = (key) => {
    if (key === algoKey) return
    snapshot()
    setPlaying(false)
    setStep(0)
    setAlgoKey(key)
  }

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]

  const readouts = [
    { label: 'comparisons', value: f.comparisons },
    { label, value: f.secondary },
    { label: 'step', value: `${step} / ${last}` },
  ]

  const mergeBand = f.mergeRange
    ? { x: PAD + f.mergeRange[0] * PITCH + 1, w: (f.mergeRange[1] - f.mergeRange[0] + 1) * PITCH - 2 }
    : null

  return (
    <Figure
      eyebrow="Sorting"
      title="Sorting"
      controls={controls}
      status={f.note}
      readouts={readouts}
      tryThis="Pick an algorithm and step or play through it. Watch the compared bars light up and the array settle into order. The teaching move: run Bubble sort to the end and note its comparisons, then switch to Merge sort (same starting bars) and compare. The slow sort does far more comparisons than the fast one on identical input."
    >
      <div className={styles.toggle} role="group" aria-label="Sorting algorithm">
        {ALGOS.map((a) => (
          <button
            key={a.key}
            type="button"
            className={`${styles.toggleBtn} ${a.key === algoKey ? styles.toggleActive : ''}`}
            aria-pressed={a.key === algoKey}
            onClick={() => selectAlgo(a.key)}
          >
            {a.name}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={styles.svg} role="img" aria-label={`${algoName} on a fixed array of ${N} bars`}>
        {mergeBand && <rect x={mergeBand.x} y={PLOT_TOP - 4} width={mergeBand.w} height={PLOT_H + 8} rx={3} fill="rgba(192,57,43,0.08)" />}
        {f.arr.map((v, i) => (
          <rect
            key={i}
            className={styles.bar}
            x={PAD + i * PITCH + (PITCH - BAR_W) / 2}
            y={PLOT_TOP}
            width={BAR_W}
            height={PLOT_H}
            rx={2}
            fill={barColor(i, f)}
            style={{ transform: `scaleY(${v / MAX_VAL})` }}
          />
        ))}
        <line x1={PAD} y1={BASE_Y} x2={VB_W - PAD} y2={BASE_Y} stroke="#e2e0d8" strokeWidth={1} />
      </svg>

      {lastRun && (
        <p className={styles.lastRun}>
          Last run, {lastRun.name}: <strong>{lastRun.comparisons}</strong> comparisons, <strong>{lastRun.secondary}</strong> {lastRun.label}
          {!lastRun.complete && ' (partial)'}
        </p>
      )}

      <p className={styles.caption}>
        All three sorts are real implementations running on the same fixed array, and every counter is computed live as
        the algorithm runs. The array is kept small for clarity; real datasets are far larger, where the gap between a
        slow sort and a fast one is enormous.
      </p>
    </Figure>
  )
}
