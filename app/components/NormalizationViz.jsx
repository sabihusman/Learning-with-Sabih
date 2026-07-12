'use client'

import { useEffect, useState } from 'react'
import Figure from './Figure'
import {
  flatRows,
  oneNFRows,
  splitTables,
  tableCount,
  placesPriceLives,
  LAST_STEP,
  PRO_PLAN,
} from './normalizationData'
import styles from './NormalizationViz.module.css'

const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b'
const PK_GREEN = '#1f6f5c'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
const PLAY_MS = 1600

// mark styles for cell highlighting
const MARK = {
  smell: { bg: '#f6e7c8', text: INK },
  error: { bg: '#fbecea', text: ACCENT },
  ok: { bg: '#e6f2ec', text: PK_GREEN },
}

const VB_W = 560
const TOP = 30
const HEAD_H = 20
const ROW_H = 17
const PAD = 6

const WIDE_COLS = [
  { key: 'user_id', label: 'user_id', w: 52 },
  { key: 'name', label: 'name', w: 56 },
  { key: 'plan', label: 'plan', w: 42 },
  { key: 'plan_price', label: 'plan_price', w: 70 },
  { key: 'country', label: 'country', w: 54 },
  { key: 'order_ids', label: 'order_ids', w: 86 },
]
const ONE_NF_COLS = [
  { key: 'user_id', label: 'user_id', w: 52 },
  { key: 'name', label: 'name', w: 56 },
  { key: 'plan', label: 'plan', w: 42 },
  { key: 'plan_price', label: 'plan_price', w: 70 },
  { key: 'country', label: 'country', w: 54 },
  { key: 'order_id', label: 'order_id', w: 70 },
]
const USERS_COLS = [
  { key: 'user_id', label: 'user_id', w: 56, role: 'PK' },
  { key: 'name', label: 'name', w: 56 },
  { key: 'plan', label: 'plan', w: 44, role: 'FK' },
  { key: 'country', label: 'country', w: 54 },
]
const PLANS_COLS = [
  { key: 'plan', label: 'plan', w: 44, role: 'PK' },
  { key: 'plan_price', label: 'plan_price', w: 72 },
]
const ORDERS_COLS = [
  { key: 'order_id', label: 'order_id', w: 64, role: 'PK' },
  { key: 'user_id', label: 'user_id', w: 56, role: 'FK' },
  { key: 'order_total', label: 'order_total', w: 80 },
]

const roleColor = (role) => (role === 'PK' ? PK_GREEN : role === 'FK' ? ACCENT : null)
const tableWidth = (cols) => cols.reduce((s, c) => s + c.w, 0)

const STATUS = [
  'Press Step to walk this one wide table into normal forms.',
  'This one table is doing three jobs. Two smells: a list crammed into a cell, and plan_price repeated on every row.',
  '1NF means every cell holds a single atomic value, so the order list becomes one row per order.',
  'An update anomaly: the same fact stored in several places can disagree. pro reads 25 in one row and 20 in the others.',
  "Third normal form: every non-key column depends on its own table's key, so plan_price lives in exactly one place.",
  'Replay the same price update on the split shape: one cell changes, and nothing can disagree.',
]

export default function NormalizationViz() {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const done = step >= LAST_STEP
  const isPlaying = playing && !done

  // Auto-advance with setInterval (never a rAF/anime chain); tears down when done. The
  // effect body only sets/clears the interval, never setState directly.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(LAST_STEP, s + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done])

  const onStep = () => setStep((s) => Math.min(LAST_STEP, s + 1))
  const reset = () => {
    setPlaying(false)
    setStep(0)
  }

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]

  const readouts = [
    { label: 'tables', value: tableCount(step) },
    { label: 'places the price lives', value: placesPriceLives(step) },
  ]

  // Draw one titled table at (x, y). markFn(rowIndex, colKey, value) -> 'smell'|'error'|'ok'|null.
  // Returns the SVG nodes plus geometry so connectors can anchor to key columns.
  function drawTable(id, x, y, title, cols, rows, markFn) {
    const width = tableWidth(cols)
    const headTop = y + 14
    const rowsTop = headTop + HEAD_H
    const colLeft = (ci) => x + cols.slice(0, ci).reduce((s, c) => s + c.w, 0)
    const colCenter = (key) => {
      const ci = cols.findIndex((c) => c.key === key)
      return ci < 0 ? x : colLeft(ci) + cols[ci].w / 2
    }
    const height = 14 + HEAD_H + rows.length * ROW_H
    const nodes = []

    nodes.push(
      <text key={`${id}-t`} x={x} y={y + 8} fontSize={15} fill={INK} fontFamily={MONO} fontWeight="bold">
        {title}
      </text>
    )
    // header
    nodes.push(
      <rect key={`${id}-hb`} x={x} y={headTop} width={width} height={HEAD_H} fill="#f0ede6" stroke="#e2e0d8" strokeWidth={0.5} />
    )
    cols.forEach((c, ci) => {
      const rc = roleColor(c.role)
      nodes.push(
        <text
          key={`${id}-h-${c.key}`}
          x={colLeft(ci) + PAD}
          y={headTop + 13}
          fontSize={11.5}
          fill={rc || FADE}
          fontFamily={MONO}
          fontWeight={c.role ? 700 : 400}
          letterSpacing="0.02em"
        >
          {c.label}
        </text>
      )
      if (c.role) {
        const bx = colLeft(ci) + PAD + c.label.length * 4.7 + 3
        nodes.push(
          <g key={`${id}-b-${c.key}`}>
            <rect x={bx} y={headTop + 4} width={15} height={10} rx={2} fill={rc} />
            <text x={bx + 7.5} y={headTop + 12} fontSize={9.5} fill="#f7f5f0" fontFamily={MONO} fontWeight={700} textAnchor="middle">
              {c.role}
            </text>
          </g>
        )
      }
    })
    // rows
    rows.forEach((r, ri) => {
      const top = rowsTop + ri * ROW_H
      cols.forEach((c, ci) => {
        const mk = markFn ? markFn(ri, c.key, r[c.key]) : null
        const style = mk ? MARK[mk] : null
        const rc = roleColor(c.role)
        nodes.push(
          <rect
            key={`${id}-c-${ri}-${c.key}`}
            x={colLeft(ci)}
            y={top}
            width={c.w}
            height={ROW_H}
            fill={style ? style.bg : '#ffffff'}
            stroke="#eceae3"
            strokeWidth={0.5}
          />
        )
        nodes.push(
          <text
            key={`${id}-x-${ri}-${c.key}`}
            x={colLeft(ci) + PAD}
            y={top + ROW_H / 2 + 3.3}
            fontSize={13}
            fill={style ? style.text : rc || INK}
            fontFamily={MONO}
            fontWeight={c.role ? 600 : 400}
          >
            {String(r[c.key])}
          </text>
        )
      })
    })

    return { nodes, width, height, top: y, bottom: y + height, colCenter, x }
  }

  // Build the current scene: a single wide table (steps 0-3) or the three split tables
  // with key connectors (steps 4-5).
  let scene
  let vbH
  if (step <= 3) {
    const wide = step <= 1
    const cols = wide ? WIDE_COLS : ONE_NF_COLS
    const rows = wide ? flatRows() : oneNFRows(step === 3)
    const markFn = (ri, key, value) => {
      if (step === 1) {
        if (key === 'order_ids' && rows[ri].multi) return 'smell'
        if (key === 'plan_price' && rows[ri].plan === PRO_PLAN) return 'smell'
      }
      if (step === 3 && key === 'plan_price' && rows[ri].plan === PRO_PLAN) return 'error'
      return null
    }
    const tw = tableWidth(cols)
    const t = drawTable('wide', (VB_W - tw) / 2, TOP, wide ? 'user_orders  (one wide table)' : 'user_orders  (1NF: one row per order)', cols, rows, markFn)
    scene = t.nodes
    vbH = t.bottom + 8
  } else {
    const { users, plans, orders } = splitTables(step === 5)
    const uT = drawTable('users', 8, TOP, 'users', USERS_COLS, users, null)
    const pT = drawTable('plans', 8, uT.bottom + 22, 'plans', PLANS_COLS, plans, (ri, key) =>
      step === 5 && key === 'plan_price' && plans[ri].plan === PRO_PLAN ? 'ok' : null
    )
    const oX = 300
    const oT = drawTable('orders', oX, TOP, 'orders', ORDERS_COLS, orders, null)

    // key connectors (cosmetic): plans.plan PK -> users.plan FK, users.user_id PK -> orders.user_id FK
    const connectors = [
      <line
        key="conn-plan"
        x1={pT.colCenter('plan')}
        y1={pT.top + 14}
        x2={uT.colCenter('plan')}
        y2={uT.bottom}
        stroke={ACCENT}
        strokeWidth={1.3}
        strokeDasharray="3 2"
        strokeOpacity={0.7}
      />,
      <line
        key="conn-user"
        x1={uT.x + uT.width}
        y1={TOP + 60}
        x2={oX}
        y2={TOP + 90}
        stroke={ACCENT}
        strokeWidth={1.3}
        strokeDasharray="3 2"
        strokeOpacity={0.7}
      />,
    ]
    scene = [...connectors, ...uT.nodes, ...pT.nodes, ...oT.nodes]
    vbH = Math.max(pT.bottom, oT.bottom) + 8
  }

  return (
    <Figure
      eyebrow="Normalization"
      title="One table becomes three"
      controls={controls}
      status={STATUS[step]}
      readouts={readouts}
      tryThis="Run the price update in step 3, then again in step 5, and compare what can go wrong. In the wide table the pro price is copied onto every pro row, so changing it in one place leaves the other copies stale and the data contradicts itself. After the split, plan_price lives once in the plans table, so the same update touches a single cell and there is no copy left to disagree. That is what normalizing buys you: each fact in exactly one place."
    >
      <svg
        viewBox={`0 0 ${VB_W} ${vbH}`}
        style={{ width: '100%', maxWidth: 620, height: 'auto', display: 'block', margin: '0 auto' }}
        role="img"
        aria-label={`Normalization step ${step} of ${LAST_STEP}. ${STATUS[step]}`}
      >
        {scene}
      </svg>

      <p className={styles.note}>
        The table count and the number of places the pro price lives are counted from the
        live shape at each step, not typed in, so they always match the tables drawn. The
        does-not-agree and price-update steps are simulated, and the data is a fixed,
        deterministic excerpt, not the shared SQL dataset.
      </p>
    </Figure>
  )
}
