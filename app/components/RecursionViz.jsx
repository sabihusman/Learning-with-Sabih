'use client'

import { useEffect, useMemo, useState } from 'react'
import Figure from './Figure'
import CallStackPanel from './CallStackPanel'
import styles from './RecursionViz.module.css'

const MIN_DISKS = 3
const MAX_DISKS = 6
const DEFAULT_DISKS = 3
const PLAY_MS = 700
const PEGS = ['A', 'B', 'C']

// The real recursive Towers of Hanoi solver, instrumented to record, at each move, the
// stack of active calls at that instant. Every move pops the top disk of `from` onto
// `to`; the classic algorithm guarantees that is always legal. The disk moved is the
// recursion parameter k (the base case moves disk 1; the middle move moves disk k).
function buildHanoi(n) {
  const moves = []
  const stack = [] // active hanoi(k, from, to, via) frames, base-first
  function rec(k, from, to, via) {
    stack.push({ n: k, from, to, via })
    if (k === 1) {
      moves.push({ disk: 1, from, to, stack: stack.map((f) => ({ ...f })) })
    } else {
      rec(k - 1, from, via, to)
      moves.push({ disk: k, from, to, stack: stack.map((f) => ({ ...f })) })
      rec(k - 1, via, to, from)
    }
    stack.pop()
  }
  rec(n, 'A', 'C', 'B')

  // peg configuration after each move (states[0] is the start), bottom-first per peg
  const cur = { A: [], B: [], C: [] }
  for (let d = n; d >= 1; d -= 1) cur.A.push(d)
  const states = [{ A: [...cur.A], B: [...cur.B], C: [...cur.C] }]
  for (const mv of moves) {
    cur[mv.to].push(cur[mv.from].pop())
    states.push({ A: [...cur.A], B: [...cur.B], C: [...cur.C] })
  }
  return { moves, states }
}

// ── peg SVG geometry ──────────────────────────────────────────────────────────────
const VB_W = 340
const VB_H = 184
const PEG_X = { A: 58, B: 170, C: 282 }
const BASE_Y = 150
const PEG_TOP = 40
const DISK_H = 15
const diskWidth = (size) => 20 + size * 11 // size 1 -> 31, size 6 -> 86 (fits 112px pitch)
const DISK_COLORS = ['#4f6d9c', '#2c7a7b', '#1f8a5b', '#b07a2e', '#9a5a86', '#c0392b']

export default function RecursionViz() {
  const [disks, setDisks] = useState(DEFAULT_DISKS)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const { moves, states } = useMemo(() => buildHanoi(disks), [disks])
  const total = moves.length // exactly 2^disks - 1
  const done = step >= total
  const isPlaying = playing && !done

  // Auto-advance with setInterval (never requestAnimationFrame) so it keeps progressing
  // in a backgrounded tab. Keyed on `done` so the interval tears down the moment the
  // solve finishes, and on `disks` so it rebinds to the new total; no setState in the
  // effect body, only interval cleanup.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(total, s + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done, total])

  const onStep = () => setStep((s) => Math.min(total, s + 1))
  const reset = () => {
    setPlaying(false)
    setStep(0)
  }
  const onDisks = (n) => {
    setPlaying(false)
    setStep(0)
    setDisks(n)
  }

  const state = states[step]
  const lastMove = step > 0 ? moves[step - 1] : null

  // translate the Hanoi-specific frame snapshot into the panel's generic frame shape
  const frames = lastMove
    ? lastMove.stack.map((f, depth) => ({
        id: `${depth}:${f.n}:${f.from}${f.to}${f.via}`,
        name: 'hanoi',
        args: `${f.n}, ${f.from}→${f.to}`,
      }))
    : []
  const depth = frames.length

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]

  const status = done
    ? `Solved ${disks} disks in ${total} moves`
    : step === 0
      ? `Press Step to solve ${disks} disks in ${total} moves`
      : `Move ${step} of ${total}: disk ${lastMove.disk} from ${lastMove.from} to ${lastMove.to}`

  const readouts = [
    { label: 'stack depth', value: depth },
    { label: 'total moves', value: total },
    { label: 'moves made', value: `${step} / ${total}` },
  ]

  return (
    <Figure
      eyebrow="Recursion"
      title="Recursion and the call stack"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Step through the solve. Each move is one disk; watch the call stack on the right grow as the recursion descends to move a small disk, then shrink as those calls return so a larger disk can move. The deepest the stack ever gets equals the disk count, and the total number of moves is exactly two to the power of the disks, minus one."
    >
      <div className={styles.layout}>
        <div className={styles.board}>
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={styles.svg} role="img" aria-label={`Towers of Hanoi with ${disks} disks across three pegs`}>
            {PEGS.map((peg) => (
              <g key={peg}>
                <line x1={PEG_X[peg]} y1={PEG_TOP} x2={PEG_X[peg]} y2={BASE_Y} stroke="#cfcbc2" strokeWidth={3} strokeLinecap="round" />
                <text x={PEG_X[peg]} y={BASE_Y + 22} fontSize="11" fontFamily="ui-monospace, monospace" fill="#9b9892" textAnchor="middle">
                  {peg}
                </text>
                {state[peg].map((size, j) => {
                  const w = diskWidth(size)
                  const moved = lastMove && peg === lastMove.to && j === state[peg].length - 1 && size === lastMove.disk
                  return (
                    <rect
                      key={size}
                      x={PEG_X[peg] - w / 2}
                      y={BASE_Y - (j + 1) * DISK_H}
                      width={w}
                      height={DISK_H - 2}
                      rx={3}
                      fill={DISK_COLORS[(size - 1) % DISK_COLORS.length]}
                      stroke={moved ? '#1a1a1a' : '#ffffff'}
                      strokeWidth={moved ? 2 : 1}
                    />
                  )
                })}
              </g>
            ))}
            <rect x={14} y={BASE_Y} width={VB_W - 28} height={7} rx={2} fill="#cfcbc2" />
          </svg>
        </div>

        <div className={styles.panel}>
          <CallStackPanel frames={frames} label="Call stack" reserve={disks} />
        </div>
      </div>

      <div className={styles.diskRow}>
        <label className={styles.diskLabel} htmlFor="disk-count">
          disks
        </label>
        <input
          id="disk-count"
          className={styles.slider}
          type="range"
          min={MIN_DISKS}
          max={MAX_DISKS}
          step={1}
          value={disks}
          onChange={(e) => onDisks(Number(e.target.value))}
        />
        <span className={styles.diskValue}>{disks}</span>
      </div>

      <p className={styles.caption}>
        The solve and every readout are computed for real from the recursive algorithm, and the total is exactly two to
        the power of the disk count, minus one. The disk count is kept small so the stack stays readable; the move count
        still doubles with each disk added.
      </p>
    </Figure>
  )
}
