'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import {
  actionsFor,
  initialState,
  isDone,
  isDeadlocked,
  applyStep,
  AUTO_PATTERN,
} from './deadlockData'
import styles from './DeadlockViz.module.css'

const PLAY_MS = 900

// ── SVG geometry: a fixed square with locks and threads alternating around it, so
// every possible (lock, thread) pairing is a side of the square and every edge is
// axis-aligned, whether it is a "held" edge (lock -> thread) or a "waiting" edge
// (thread -> lock, the reverse of the same segment). ────────────────────────────────
const VB_W = 400
const VB_H = 300

const NODE_POS = {
  lock1: { x: 100, y: 70 },
  lock2: { x: 300, y: 230 },
  A: { x: 300, y: 70 },
  B: { x: 100, y: 230 },
}

const LOCK_R = 36
const THREAD_W = 130
const THREAD_H = 54

// One entry per side of the square: which lock and which thread it connects, and the
// trimmed endpoints for the "held" direction (lock -> thread). The "waiting" edge for
// the same pair is just this segment reversed.
const PAIRS = [
  { lockId: 1, lockKey: 'lock1', threadId: 'A', held: { x1: 136, y1: 70, x2: 235, y2: 70 } },
  { lockId: 2, lockKey: 'lock2', threadId: 'A', held: { x1: 300, y1: 194, x2: 300, y2: 97 } },
  { lockId: 2, lockKey: 'lock2', threadId: 'B', held: { x1: 264, y1: 230, x2: 165, y2: 230 } },
  { lockId: 1, lockKey: 'lock1', threadId: 'B', held: { x1: 100, y1: 106, x2: 100, y2: 203 } },
]

// Compute, purely from state, whether this (lock, thread) pair currently shows a held
// edge, a waiting edge, or nothing at all. Nothing here is hand-set: a held edge only
// appears when state.locks really names this thread as the holder, and a waiting edge
// only appears when this thread's real next action is to acquire this exact lock and
// the lock is really held by the other thread.
function pairEdge(state, pair) {
  const holder = state.locks[pair.lockId]
  if (holder === pair.threadId) {
    return { kind: 'held', ...pair.held }
  }
  const thread = state.threads[pair.threadId]
  const actions = actionsFor(state.mode, pair.threadId)
  if (thread.pc < actions.length) {
    const action = actions[thread.pc]
    if (action.type === 'acquire' && action.lock === pair.lockId && holder !== null && holder !== pair.threadId) {
      return { kind: 'waiting', x1: pair.held.x2, y1: pair.held.y2, x2: pair.held.x1, y2: pair.held.y1 }
    }
  }
  return null
}

function describeThread(state, threadId) {
  const thread = state.threads[threadId]
  const actions = actionsFor(state.mode, threadId)
  if (thread.pc >= actions.length) return 'done'
  const action = actions[thread.pc]
  const holder = state.locks[action.lock]
  if (action.type === 'acquire' && holder !== null && holder !== threadId) {
    return `waiting for lock ${action.lock} (held by ${holder})`
  }
  return `next: ${action.type} lock ${action.lock}`
}

function nextActionBlocked(state, threadId) {
  const thread = state.threads[threadId]
  const actions = actionsFor(state.mode, threadId)
  if (thread.pc >= actions.length) return false
  const action = actions[thread.pc]
  if (action.type !== 'acquire') return false
  const holder = state.locks[action.lock]
  return holder !== null && holder !== threadId
}

export default function DeadlockViz() {
  const [mode, setMode] = useState('OPPOSITE')
  const [run, setRun] = useState(() => ({ state: initialState('OPPOSITE'), tick: 0 }))
  const [playing, setPlaying] = useState(false)
  const svgRef = useRef(null)

  const { state } = run
  const done = isDone(state)
  const deadlocked = isDeadlocked(state)
  const idle = state.threads.A.pc === 0 && state.threads.B.pc === 0

  // Auto-advance with setInterval (never requestAnimationFrame), so a backgrounded tab
  // still catches up on resume. Keyed on done/deadlocked/mode so it tears down the
  // instant either terminal condition is reached and rebinds when the mode toggle
  // resets the run; each tick reads fresh state through the functional setState
  // updater. No setState in the effect body itself.
  useEffect(() => {
    if (!playing || done || deadlocked) return undefined
    const id = setInterval(() => {
      setRun((prev) => {
        if (isDone(prev.state) || isDeadlocked(prev.state)) return prev
        const threadId = AUTO_PATTERN[prev.tick % AUTO_PATTERN.length]
        return { state: applyStep(prev.state, threadId), tick: prev.tick + 1 }
      })
    }, PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done, deadlocked, mode])

  // Cosmetic flourish only: pulse the cycle edges once when a deadlock first appears.
  // Pure animation, no state change; the cycle itself is drawn from state above.
  useEffect(() => {
    if (!deadlocked || !svgRef.current) return
    const edges = Array.from(svgRef.current.querySelectorAll('[data-cycle-edge]'))
    if (edges.length === 0) return
    animate(edges, {
      opacity: [1, 0.3, 1],
      duration: 550,
      ease: 'inOutQuad',
    })
  }, [deadlocked])

  const stepManual = (threadId) => {
    setRun((prev) => ({ state: applyStep(prev.state, threadId), tick: prev.tick }))
  }

  const reset = () => {
    setPlaying(false)
    setRun({ state: initialState(mode), tick: 0 })
  }

  const setModeValue = (value) => {
    setPlaying(false)
    setMode(value)
    setRun({ state: initialState(value), tick: 0 })
  }

  const blockedA = nextActionBlocked(state, 'A')
  const blockedB = nextActionBlocked(state, 'B')
  const doneA = state.threads.A.pc >= actionsFor(state.mode, 'A').length
  const doneB = state.threads.B.pc >= actionsFor(state.mode, 'B').length
  const disabledA = doneA || blockedA || playing
  const disabledB = doneB || blockedB || playing

  const controls = [
    { label: 'Step A', onClick: () => stepManual('A'), disabled: disabledA },
    { label: 'Step B', onClick: () => stepManual('B'), disabled: disabledB },
    { label: playing ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done || deadlocked },
    { label: 'Reset', onClick: reset, disabled: idle && run.tick === 0 },
  ]

  const readouts = [
    { label: 'lock 1', value: state.locks[1] === null ? 'free' : `held by ${state.locks[1]}` },
    { label: 'lock 2', value: state.locks[2] === null ? 'free' : `held by ${state.locks[2]}` },
    { label: 'thread A', value: describeThread(state, 'A') },
    { label: 'thread B', value: describeThread(state, 'B') },
  ]

  let status
  if (deadlocked) {
    status = 'Deadlock. Thread A and thread B are each waiting for a lock the other holds; neither can proceed.'
  } else if (done) {
    status = 'Both threads finished. No deadlock.'
  } else if (idle) {
    status =
      mode === 'OPPOSITE'
        ? 'Idle. Opposite acquire order: step or play to see whether the threads deadlock.'
        : 'Idle. Same acquire order: step or play and try to cause a deadlock.'
  } else {
    status = 'In progress. Keep stepping or watch auto-play to see how the locks resolve.'
  }

  const edges = PAIRS.map((pair) => ({ pair, edge: pairEdge(state, pair) })).filter((e) => e.edge)

  return (
    <Figure
      eyebrow="Deadlock"
      title="Two threads, two locks, a wait-for graph"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Leave the order on opposite and run auto-play, or step A then B then A then B by hand. Watch the arrows close into a loop: lock 1 held by A, A waiting on lock 2, lock 2 held by B, B waiting on lock 1. Neither thread's buttons work anymore, because neither can proceed. Now switch to same order and try again: the loop never closes, because whichever thread arrives second always waits on a lock the first thread is about to release, never on a lock it is itself waiting for."
    >
      <div className={styles.controlsRow}>
        <span className={styles.groupLabel}>acquire order</span>
        <button
          type="button"
          className={`${styles.btn} ${mode === 'OPPOSITE' ? styles.btnOn : ''}`}
          aria-pressed={mode === 'OPPOSITE'}
          onClick={() => setModeValue('OPPOSITE')}
        >
          opposite
        </button>
        <button
          type="button"
          className={`${styles.btn} ${mode === 'SAME' ? styles.btnOn : ''}`}
          aria-pressed={mode === 'SAME'}
          onClick={() => setModeValue('SAME')}
        >
          same (fix)
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        role="img"
        aria-label={`Wait-for graph. Lock 1 ${state.locks[1] === null ? 'free' : `held by ${state.locks[1]}`}, lock 2 ${state.locks[2] === null ? 'free' : `held by ${state.locks[2]}`}. Thread A ${describeThread(state, 'A')}. Thread B ${describeThread(state, 'B')}. ${status}`}
      >
        <defs>
          <marker id="dl-held" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#2f6f8f" />
          </marker>
          <marker id="dl-waiting" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#c0392b" />
          </marker>
        </defs>

        {edges.map(({ pair, edge }) => (
          <line
            key={`${pair.lockKey}-${pair.threadId}`}
            data-cycle-edge={deadlocked ? 'true' : undefined}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke={deadlocked ? '#c0392b' : edge.kind === 'held' ? '#2f6f8f' : '#c0392b'}
            strokeWidth={deadlocked ? 2.6 : 1.8}
            strokeDasharray={edge.kind === 'waiting' ? '5 4' : undefined}
            markerEnd={edge.kind === 'held' ? 'url(#dl-held)' : 'url(#dl-waiting)'}
          />
        ))}

        {[
          { key: 'lock1', label: 'Lock 1', held: state.locks[1] !== null },
          { key: 'lock2', label: 'Lock 2', held: state.locks[2] !== null },
        ].map((lock) => (
          <g key={lock.key}>
            <circle
              cx={NODE_POS[lock.key].x}
              cy={NODE_POS[lock.key].y}
              r={LOCK_R}
              fill={lock.held ? '#e9f1ee' : '#faf9f6'}
              stroke={lock.held ? '#2f6f8f' : '#d8d4cc'}
              strokeWidth={lock.held ? 2 : 1}
            />
            <text x={NODE_POS[lock.key].x} y={NODE_POS[lock.key].y - 2} textAnchor="middle" className={styles.nodeLabel}>
              {lock.label}
            </text>
            <text x={NODE_POS[lock.key].x} y={NODE_POS[lock.key].y + 14} textAnchor="middle" className={styles.nodeSub}>
              {lock.held ? 'held' : 'free'}
            </text>
          </g>
        ))}

        {['A', 'B'].map((threadId) => {
          const waiting = nextActionBlocked(state, threadId)
          const finished = state.threads[threadId].pc >= actionsFor(state.mode, threadId).length
          const pos = NODE_POS[threadId]
          const isStuck = deadlocked
          return (
            <g key={threadId}>
              <rect
                x={pos.x - THREAD_W / 2}
                y={pos.y - THREAD_H / 2}
                width={THREAD_W}
                height={THREAD_H}
                rx={8}
                fill={isStuck ? '#fbecea' : finished ? '#e9f1ee' : waiting ? '#fdf3ee' : '#fffefb'}
                stroke={isStuck ? '#c0392b' : finished ? '#1f6f5c' : waiting ? '#c0392b' : '#d8d4cc'}
                strokeWidth={isStuck || finished || waiting ? 2 : 1}
              />
              <text x={pos.x} y={pos.y - 4} textAnchor="middle" className={styles.nodeLabel}>
                {`Thread ${threadId}`}
              </text>
              <text x={pos.x} y={pos.y + 14} textAnchor="middle" className={styles.nodeSub}>
                {finished ? 'done' : waiting ? 'waiting' : 'active'}
              </text>
            </g>
          )
        })}

        {deadlocked && (
          <text x={VB_W / 2} y={VB_H / 2 + 5} textAnchor="middle" className={styles.deadlockLabel}>
            DEADLOCK
          </text>
        )}
      </svg>

      <p className={styles.note}>
        Lock ownership and each thread&apos;s waiting status are real state; deadlock is detected from that state as a
        closed circular wait, not scripted. The wait-for graph above is drawn straight from the current lock and
        thread state on every render: a held edge means the lock really is held by that thread, and a waiting edge
        means that thread&apos;s next action really is blocked on that lock. This is the two-thread, two-lock case;
        real deadlocks can involve many threads and resources.
      </p>
    </Figure>
  )
}
