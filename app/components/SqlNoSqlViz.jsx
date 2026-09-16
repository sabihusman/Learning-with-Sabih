'use client'

import { useState } from 'react'
import Figure from './Figure'
import { usePacedInterval } from './usePacedInterval'
import {
  USERS,
  PLANS,
  ORDERS,
  DOCS,
  QUERIES,
  queryById,
  framesCount,
  highlightsAt,
  placesTouched,
  winnerOf,
} from './sqlNoSqlData'
import { INK, FADE, ACCENT, OK, MONO, AMBER_BG, OK_BG, ERR_BG, CONTROL_BG, RULE, MUTED_BG } from './vizPalette'
import shared from './vizShared.module.css'
import styles from './SqlNoSqlViz.module.css'

const PK_GREEN = OK
const PLAY_MS = 1300

// tone -> cell fill/text, shared by the relational tables and the JSON spans
const TONE = {
  touch: { bg: AMBER_BG, text: INK }, // a place the query has to visit
  clean: { bg: OK_BG, text: PK_GREEN }, // the single clean place (relational, change-price)
  copy: { bg: ERR_BG, text: ACCENT }, // a redundant copy (document, change-price)
}

// ── relational SVG geometry (same vocabulary as the Normalization split view) ──────
const REL_W = 444
const TOP = 24
const HEAD_H = 20
const ROW_H = 17
const PAD = 6
// PK/FK badge: sized from its label so the text renders >= 9px at the panel's
// max width (rendered px = raw x 440 / REL_W).
const BADGE_FONT = 9.5
const BADGE_H = 12
const badgeWidth = (role) => Math.round(role.length * BADGE_FONT * 0.62 + 6)
// smallest raw font in the SVG (column headers); sets the mobile scroll floor
const MIN_FONT = 8.5
const SVG_MIN_WIDTH = Math.min(600, Math.ceil((7 * REL_W) / MIN_FONT))

const USERS_COLS = [
  { key: 'user_id', label: 'user_id', w: 60, role: 'PK' },
  { key: 'name', label: 'name', w: 48 },
  { key: 'plan', label: 'plan', w: 52, role: 'FK' },
  { key: 'country', label: 'country', w: 48 },
]
const PLANS_COLS = [
  { key: 'plan', label: 'plan', w: 52, role: 'PK' },
  { key: 'plan_price', label: 'plan_price', w: 66 },
]
const ORDERS_COLS = [
  { key: 'order_id', label: 'order_id', w: 66, role: 'PK' },
  { key: 'user_id', label: 'user_id', w: 60, role: 'FK' },
  { key: 'order_total', label: 'order_total', w: 70 },
]

const roleColor = (role) => (role === 'PK' ? PK_GREEN : role === 'FK' ? ACCENT : null)
const tableWidth = (cols) => cols.reduce((s, c) => s + c.w, 0)

export default function SqlNoSqlViz() {
  const [queryId, setQueryId] = useState(QUERIES[0].id)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const lastStep = framesCount(queryId)
  const done = step >= lastStep
  const isPlaying = playing && !done

  // Auto-advance through the shared paced-interval hook (setInterval, never
  // requestAnimationFrame): gated on playing until done, paced by the shared
  // animation-speed multiplier.
  usePacedInterval(playing && !done, PLAY_MS, () => setStep((s) => Math.min(lastStep, s + 1)))

  const onStep = () => setStep((s) => Math.min(lastStep, s + 1))
  const reset = () => {
    setPlaying(false)
    setStep(0)
  }
  const pickQuery = (id) => {
    setPlaying(false)
    setStep(0)
    setQueryId(id)
  }

  const query = queryById(queryId)
  const { rel, doc } = highlightsAt(queryId, step)
  const pt = placesTouched(queryId, step)
  const winner = winnerOf(queryId)

  // ── relational highlight lookups ──
  const relTone = queryId === 'change-price' ? 'clean' : 'touch'
  const usersHot = (row) => rel.some((h) => h.table === 'users' && h.match.user_id === row.user_id)
  const ordersHot = (row) => rel.some((h) => h.table === 'orders' && h.match.order_id === row.order_id)
  const plansCellHot = (row, colKey) =>
    rel.some((h) => h.table === 'plans' && h.match.plan === row.plan && (!h.cell || h.cell === colKey))

  function markFor(tableName, row, colKey) {
    if (tableName === 'users' && usersHot(row)) return relTone
    if (tableName === 'orders' && ordersHot(row)) return relTone
    if (tableName === 'plans' && plansCellHot(row, colKey)) return relTone
    return null
  }

  // ── draw one relational table (returns nodes + geometry) ──
  function drawTable(idp, x, y, title, cols, rows, tableName) {
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
      <text key={`${idp}-t`} x={x} y={y + 8} fontSize={11} fill={INK} fontFamily={MONO} fontWeight="bold">
        {title}
      </text>
    )
    nodes.push(<rect key={`${idp}-hb`} x={x} y={headTop} width={width} height={HEAD_H} fill={CONTROL_BG} stroke={RULE} strokeWidth={0.5} />)
    cols.forEach((c, ci) => {
      const rc = roleColor(c.role)
      nodes.push(
        <text key={`${idp}-h-${c.key}`} x={colLeft(ci) + PAD} y={headTop + 13} fontSize={8.5} fill={rc || FADE} fontFamily={MONO} fontWeight={c.role ? 700 : 400}>
          {c.label}
        </text>
      )
      if (c.role) {
        const bx = colLeft(ci) + PAD + c.label.length * 4.7 + 3
        const bw = badgeWidth(c.role)
        nodes.push(
          <g key={`${idp}-b-${c.key}`}>
            <rect x={bx} y={headTop + (HEAD_H - BADGE_H) / 2} width={bw} height={BADGE_H} rx={2} fill={rc} />
            <text x={bx + bw / 2} y={headTop + HEAD_H / 2 + 3.4} fontSize={BADGE_FONT} fill="#ffffff" fontFamily={MONO} fontWeight={700} textAnchor="middle">
              {c.role}
            </text>
          </g>
        )
      }
    })
    rows.forEach((r, ri) => {
      const top = rowsTop + ri * ROW_H
      cols.forEach((c, ci) => {
        const tone = markFor(tableName, r, c.key)
        const style = tone ? TONE[tone] : null
        const rc = roleColor(c.role)
        nodes.push(
          <rect key={`${idp}-c-${ri}-${c.key}`} x={colLeft(ci)} y={top} width={c.w} height={ROW_H} fill={style ? style.bg : '#ffffff'} stroke={MUTED_BG} strokeWidth={0.5} />
        )
        nodes.push(
          <text key={`${idp}-x-${ri}-${c.key}`} x={colLeft(ci) + PAD} y={top + ROW_H / 2 + 3.3} fontSize={9.5} fill={style ? style.text : rc || INK} fontFamily={MONO} fontWeight={c.role ? 600 : 400}>
            {String(r[c.key])}
          </text>
        )
      })
    })
    return { nodes, width, height, top: y, bottom: y + height, colCenter, x }
  }

  const uT = drawTable('users', 8, TOP, 'users', USERS_COLS, USERS, 'users')
  const pT = drawTable('plans', 8, uT.bottom + 20, 'plans', PLANS_COLS, PLANS, 'plans')
  const oX = 238
  const oT = drawTable('orders', oX, TOP, 'orders', ORDERS_COLS, ORDERS, 'orders')
  const relVbH = Math.max(pT.bottom, oT.bottom) + 8
  const connectors = [
    <line key="c-plan" x1={pT.colCenter('plan')} y1={pT.top + 14} x2={uT.colCenter('plan')} y2={uT.bottom} stroke={ACCENT} strokeWidth={1.2} strokeDasharray="3 2" strokeOpacity={0.65} />,
    <line key="c-user" x1={uT.x + uT.width} y1={TOP + 52} x2={oX} y2={TOP + 72} stroke={ACCENT} strokeWidth={1.2} strokeDasharray="3 2" strokeOpacity={0.65} />,
  ]

  // ── document card rendering ──
  function docState(d) {
    const hs = doc.filter((h) => h.docId === d.docId)
    return {
      whole: hs.some((h) => h.kind === 'whole'),
      price: hs.find((h) => h.kind === 'plan-price') || null,
      orderIds: new Set(hs.filter((h) => h.kind === 'order').map((h) => h.order_id)),
    }
  }
  const span = (value, tone) => (
    <span className={styles.hl} style={{ background: TONE[tone].bg, color: TONE[tone].text }}>
      {value}
    </span>
  )

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]
  const readouts = [
    { label: 'relational places', value: pt.relational },
    { label: 'document places', value: pt.document },
  ]
  const status =
    step === 0
      ? `Query: ${query.label}. Press Step to trace where each shape has to look.`
      : `${query.status}${done ? ` Fewer places wins here: ${winner}.` : ''}`

  return (
    <Figure
      eyebrow="SQL vs NoSQL modeling"
      title="Same data, two shapes"
      controls={controls}
      speedControl
      status={status}
      readouts={readouts}
      tryThis="Run the first query, then the second, and watch the winner flip. Fetching everything about one user is cheaper in the document shape, because the data that is read together is stored together. Changing a shared fact is cheaper in the relational shape, because it is stored once instead of copied into every document. Neither shape is better in general; the right one depends on how you read and write the data."
    >
      {/* query picker (in-body segmented control, keyboard-reachable buttons) */}
      <div className={shared.group}>
        <span className={shared.groupLabel}>query</span>
        {QUERIES.map((q, i) => (
          <button
            key={q.id}
            type="button"
            className={shared.btn}
            aria-pressed={queryId === q.id}
            onClick={() => pickQuery(q.id)}
          >
            {`${i + 1}. ${q.label}`}
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        {/* RELATIONAL */}
        <div className={styles.panel}>
          <div className={styles.panelTag}>relational: normalized tables</div>
          <div className={shared.scroll}>
            <svg
              viewBox={`0 0 ${REL_W} ${relVbH}`}
              className={styles.relSvg}
              style={{ minWidth: SVG_MIN_WIDTH }}
              role="img"
              aria-label={`Relational shape: three tables. This query touches ${pt.relational} of them.`}
            >
              {connectors}
              {uT.nodes}
              {pT.nodes}
              {oT.nodes}
            </svg>
          </div>
        </div>

        {/* DOCUMENT */}
        <div className={styles.panel}>
          <div className={styles.panelTag}>document: one document per user</div>
          <div className={styles.docs}>
            {DOCS.map((d) => {
              const st = docState(d)
              return (
                <div key={d.docId} className={`${styles.docCard} ${st.whole ? styles.docCardHot : ''}`}>
                  <div className={styles.json}>
                    <div>{'{'}</div>
                    <div>{`  "user_id": ${d.user_id},`}</div>
                    <div>{`  "name": "${d.name}",`}</div>
                    <div>{`  "country": "${d.country}",`}</div>
                    <div>
                      {`  "plan": { "name": "${d.plan.name}", "price": `}
                      {st.price ? span(d.plan.price, st.price.tone || 'touch') : d.plan.price}
                      {` },`}
                    </div>
                    <div>{'  "orders": ['}</div>
                    {d.orders.map((o, oi) => (
                      <div key={o.order_id}>
                        {`    { "order_id": ${o.order_id}, "total": `}
                        {st.orderIds.has(o.order_id) ? span(o.total, 'touch') : o.total}
                        {` }${oi < d.orders.length - 1 ? ',' : ''}`}
                      </div>
                    ))}
                    <div>{'  ]'}</div>
                    <div>{'}'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className={shared.caption}>
        Places touched counts the distinct containers each shape must open for the query,
        the tables on the left and the documents on the right, counted from what lights up,
        not typed in. The data is a fixed, deterministic excerpt, and the claims are about
        these two layouts as drawn, not about any particular database.
      </p>
    </Figure>
  )
}
