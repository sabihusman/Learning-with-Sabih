'use client'

import { useEffect, useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './LinkedListArrayViz.module.css'

// One fixed, deterministic value set held by BOTH structures, so the array and the
// linked list run every operation on identical data and the costs are comparable.
const VALUES = [17, 4, 42, 8, 23, 15, 16]
const N = VALUES.length
const INSERT_VALUE = 99
const MIDDLE = 3 // fixed "middle" index for insert-in-middle and delete
const PLAY_MS = 650

const OPS = [
  { key: 'front', label: 'Insert at front' },
  { key: 'middle', label: 'Insert in middle' },
  { key: 'delete', label: 'Delete' },
  { key: 'access', label: 'Access by index' },
]

// ── real per-structure operation traces ───────────────────────────────────────────
// Each builder returns one snapshot per unit of real work. The array snapshots move
// elements between slots (what an array actually does); the list snapshots walk a
// cursor and rewire pointers (what a linked list actually does). Counters are the real
// counts: array = elements shifted; list = nodes walked + pointers written.
const cellsInit = () => VALUES.map((v, i) => ({ id: `c${i}`, value: v }))

function arrayStates(op, accessIndex) {
  if (op === 'front' || op === 'middle') {
    const pos = op === 'front' ? 0 : MIDDLE
    let slots = [...cellsInit(), null] // grows by one
    const out = [{ slots: [...slots], hi: null, shifts: 0, note: 'array ready' }]
    let shifts = 0
    for (let k = N - 1; k >= pos; k -= 1) {
      slots[k + 1] = slots[k]
      slots[k] = null
      shifts += 1
      out.push({ slots: [...slots], hi: k + 1, shifts, note: `shift element ${k} to ${k + 1}` })
    }
    slots[pos] = { id: 'cNew', value: INSERT_VALUE }
    out.push({ slots: [...slots], hi: pos, shifts, note: `write ${INSERT_VALUE} into the gap at ${pos}` })
    return out
  }
  if (op === 'delete') {
    const pos = MIDDLE
    let slots = [...cellsInit()]
    const out = [{ slots: [...slots], hi: null, shifts: 0, note: 'array ready' }]
    slots[pos] = null
    out.push({ slots: [...slots], hi: pos, shifts: 0, note: `remove element at ${pos}` })
    let shifts = 0
    for (let k = pos + 1; k < N; k += 1) {
      slots[k - 1] = slots[k]
      slots[k] = null
      shifts += 1
      out.push({ slots: [...slots], hi: k - 1, shifts, note: `shift element ${k} to ${k - 1}` })
    }
    return out
  }
  // access
  const slots = cellsInit()
  return [
    { slots: [...slots], hi: null, shifts: 0, note: 'array ready' },
    { slots: [...slots], hi: accessIndex, shifts: 0, note: `jump straight to index ${accessIndex}` },
  ]
}

function listStates(op, accessIndex) {
  const ids = VALUES.map((_, i) => i)
  const ready = { order: [...ids], newNode: null, deletedId: null, cursor: null, walked: 0, pointers: 0, note: 'list ready' }
  if (op === 'front') {
    return [ready, { order: ['new', ...ids], newNode: { after: null }, deletedId: null, cursor: null, walked: 0, pointers: 2, note: 'point new node at head, repoint head' }]
  }
  if (op === 'middle' || op === 'delete') {
    const pos = MIDDLE
    const predIdx = pos - 1
    const out = [ready]
    for (let w = 1; w <= predIdx; w += 1) {
      out.push({ order: [...ids], newNode: null, deletedId: null, cursor: w, walked: w, pointers: 0, note: `walk to node ${w}` })
    }
    if (op === 'middle') {
      const order = [...ids]
      order.splice(pos, 0, 'new')
      out.push({ order, newNode: { after: predIdx }, deletedId: null, cursor: predIdx, walked: predIdx, pointers: 2, note: `rewire node ${predIdx} and the new node` })
    } else {
      out.push({ order: ids.filter((x) => x !== pos), newNode: null, deletedId: pos, cursor: predIdx, walked: predIdx, pointers: 1, note: `point node ${predIdx} past the deleted node` })
    }
    return out
  }
  // access
  const out = [ready]
  if (accessIndex === 0) {
    out.push({ order: [...ids], newNode: null, deletedId: null, cursor: 0, walked: 0, pointers: 0, note: 'node at index 0 is the head' })
  } else {
    for (let w = 1; w <= accessIndex; w += 1) {
      out.push({ order: [...ids], newNode: null, deletedId: null, cursor: w, walked: w, pointers: 0, note: `walk to node ${w}` })
    }
  }
  return out
}

// ── geometry ───────────────────────────────────────────────────────────────────────
const VB_W = 580
const VB_H = 312
const ARR_Y = 40
const CELL_W = 52
const CELL_H = 40
const CELL_PITCH = 62
const ARR_MARGIN = 44
const arrCellX = (s) => ARR_MARGIN + s * CELL_PITCH

const ROW_Y = 214
const NODE_W = 50
const NODE_H = 38
const NODE_PITCH = 68
const LIST_MARGIN = 70
const listX = (i) => LIST_MARGIN + i * NODE_PITCH
const HEAD_X = LIST_MARGIN - 40
const NEW_Y = ROW_Y - 60
const DEL_Y = ROW_Y + 54

export default function LinkedListArrayViz() {
  const [op, setOp] = useState('front')
  const [accessIndex, setAccessIndex] = useState(N - 1)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const aStates = useMemo(() => arrayStates(op, accessIndex), [op, accessIndex])
  const lStates = useMemo(() => listStates(op, accessIndex), [op, accessIndex])
  const total = Math.max(aStates.length, lStates.length)
  const done = step >= total - 1
  const isPlaying = playing && !done

  const a = aStates[Math.min(step, aStates.length - 1)]
  const l = lStates[Math.min(step, lStates.length - 1)]
  const aDone = step >= aStates.length - 1
  const lDone = step >= lStates.length - 1

  // Auto-advance with setInterval (never requestAnimationFrame) so it keeps progressing
  // in a backgrounded tab. Keyed on `done` so it tears down at the end and on `total`
  // so it rebinds when the operation changes; no setState in the effect body.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(total - 1, s + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done, total])

  const onStep = () => setStep((s) => Math.min(total - 1, s + 1))
  const reset = () => {
    setPlaying(false)
    setStep(0)
  }
  const selectOp = (key) => {
    if (key === op) return
    setPlaying(false)
    setStep(0)
    setOp(key)
  }
  const selectIndex = (i) => {
    setPlaying(false)
    setStep(0)
    setAccessIndex(i)
  }

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]

  const readouts = [
    { label: 'array shifts', value: a.shifts },
    { label: 'list walked', value: l.walked },
    { label: 'list pointers', value: l.pointers },
  ]

  const status = `Array: ${a.note}  ·  List: ${l.note}`

  // list rendering helpers
  const newNodeX = l.newNode ? (l.newNode.after === null ? listX(0) : (listX(l.newNode.after) + listX(l.newNode.after + 1)) / 2) : 0
  const boxOf = (id) => (id === 'new' ? { x: newNodeX, y: NEW_Y } : { x: listX(id), y: ROW_Y })
  const links = []
  if (l.order.length) {
    links.push({ from: { x: HEAD_X + 14, y: ROW_Y + NODE_H / 2 }, to: boxLeft(boxOf(l.order[0])) })
    for (let i = 0; i < l.order.length - 1; i += 1) links.push({ from: boxRight(boxOf(l.order[i])), to: boxLeft(boxOf(l.order[i + 1])) })
    const lastBox = boxOf(l.order[l.order.length - 1])
    links.push({ from: boxRight(lastBox), to: { x: listX(N - 1) + NODE_PITCH * 0.62, y: ROW_Y + NODE_H / 2 } })
  }

  return (
    <Figure
      eyebrow="Data structures"
      title="Linked list vs array"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Run the same operation on both structures and read the costs. Insert at front: the array shifts every element while the list just repoints the head. Access by index: the array jumps straight to the cell while the list walks node by node. Neither structure wins everywhere, that is the whole point: pick the one whose cheap operations match what you do most."
    >
      <div className={styles.ops} role="group" aria-label="Operation">
        {OPS.map((o) => (
          <button key={o.key} type="button" className={`${styles.opBtn} ${o.key === op ? styles.opActive : ''}`} aria-pressed={o.key === op} onClick={() => selectOp(o.key)}>
            {o.label}
          </button>
        ))}
      </div>

      {op === 'access' && (
        <div className={styles.indexRow}>
          <span className={styles.indexLabel}>index</span>
          {VALUES.map((_, i) => (
            <button key={i} type="button" className={`${styles.indexBtn} ${i === accessIndex ? styles.indexActive : ''}`} aria-pressed={i === accessIndex} onClick={() => selectIndex(i)}>
              {i}
            </button>
          ))}
        </div>
      )}

      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={styles.svg} role="img" aria-label="An array row above a linked-list row, both holding the same values">
        <defs>
          <marker id="llva-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#8a8780" />
          </marker>
        </defs>

        <text x={ARR_MARGIN} y={22} className={styles.section}>ARRAY</text>
        <text x={ARR_MARGIN} y={150} className={styles.section}>LINKED LIST</text>
        {aDone && <text x={VB_W - ARR_MARGIN} y={22} className={styles.doneTag} textAnchor="end">done</text>}
        {lDone && <text x={VB_W - ARR_MARGIN} y={150} className={styles.doneTag} textAnchor="end">done</text>}

        {/* array cells (move between slots; CSS transform glide) */}
        {a.slots.map((cell, s) =>
          cell ? (
            <g key={cell.id} className={styles.cellG} style={{ transform: `translate(${arrCellX(s)}px, ${ARR_Y}px)` }}>
              <rect width={CELL_W} height={CELL_H} rx={3} fill={a.hi === s ? '#c0392b' : '#6b7f9e'} stroke="#ffffff" strokeWidth={1} />
              <text x={CELL_W / 2} y={CELL_H / 2 + 5} className={styles.cellText} fill="#ffffff" textAnchor="middle">{cell.value}</text>
            </g>
          ) : null
        )}
        {/* array index labels at fixed positions */}
        {Array.from({ length: a.slots.length }, (_, s) => (
          <text key={`idx${s}`} x={arrCellX(s) + CELL_W / 2} y={ARR_Y + CELL_H + 15} className={styles.idx} textAnchor="middle">{s}</text>
        ))}

        {/* linked-list pointers */}
        {links.map((ln, i) => (
          <line key={`ln${i}`} x1={ln.from.x} y1={ln.from.y} x2={ln.to.x} y2={ln.to.y} stroke="#8a8780" strokeWidth={1.5} markerEnd="url(#llva-arrow)" />
        ))}
        <text x={HEAD_X} y={ROW_Y + NODE_H / 2 + 4} className={styles.marker} textAnchor="middle">head</text>
        <text x={listX(N - 1) + NODE_PITCH * 0.62 + 6} y={ROW_Y + NODE_H / 2 + 4} className={styles.marker} textAnchor="start">null</text>

        {/* linked-list nodes at FIXED positions (they never move) */}
        {VALUES.map((v, i) =>
          l.deletedId === i ? null : (
            <g key={`n${i}`}>
              <rect x={listX(i)} y={ROW_Y} width={NODE_W} height={NODE_H} rx={4} fill={l.cursor === i ? '#c0392b' : '#3f7d68'} stroke="#ffffff" strokeWidth={1} />
              <text x={listX(i) + NODE_W / 2} y={ROW_Y + NODE_H / 2 + 5} className={styles.cellText} fill="#ffffff" textAnchor="middle">{v}</text>
            </g>
          )
        )}
        {/* deleted node, dropped below and greyed */}
        {l.deletedId != null && (
          <g key="deleted" className={styles.fade}>
            <rect x={listX(l.deletedId)} y={DEL_Y} width={NODE_W} height={NODE_H} rx={4} fill="#d7d4cc" stroke="#ffffff" strokeWidth={1} />
            <text x={listX(l.deletedId) + NODE_W / 2} y={DEL_Y + NODE_H / 2 + 5} className={styles.cellText} fill="#9b9892" textAnchor="middle">{VALUES[l.deletedId]}</text>
          </g>
        )}
        {/* newly inserted node, above the row */}
        {l.newNode && (
          <g key="newnode" className={styles.fade}>
            <rect x={newNodeX} y={NEW_Y} width={NODE_W} height={NODE_H} rx={4} fill="#2f8f63" stroke="#ffffff" strokeWidth={1} />
            <text x={newNodeX + NODE_W / 2} y={NEW_Y + NODE_H / 2 + 5} className={styles.cellText} fill="#ffffff" textAnchor="middle">{INSERT_VALUE}</text>
          </g>
        )}
      </svg>

      <p className={styles.caption}>
        Each cost is a real count of what happened on the structure above: array shifts are elements actually moved, and
        the list numbers are nodes actually walked and pointers actually rewritten. The structures are kept small for
        clarity; real ones hold far more, where these gaps become decisive.
      </p>
    </Figure>
  )
}

const boxLeft = (b) => ({ x: b.x, y: b.y + NODE_H / 2 })
const boxRight = (b) => ({ x: b.x + NODE_W, y: b.y + NODE_H / 2 })
