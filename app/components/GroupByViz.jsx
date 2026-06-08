'use client'

import { useState } from 'react'
import Figure from './Figure'
import {
  ROWS,
  GROUP_COLUMNS,
  AGGREGATES,
  AGG_LABEL,
  MAX_COUNT,
  computeGroups,
  aggValue,
  passesHaving,
  buildSql,
} from './groupByData'
import styles from './GroupByViz.module.css'

const INK = '#1a1a1a'
const FADE = '#9b9892'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

// Muted, distinct group colors (only up to 4 groups are ever shown at once).
const PALETTE = ['#c0392b', '#2f6f7e', '#9a6b1f', '#4a5db0', '#5f7a4f']

// ── SVG geometry ──────────────────────────────────────────────────────────────
const VB_W = 600
const TITLE_Y = 14
const TOP = 42
const RH = 16
const ROW_GAP = 2
const GROUP_GAP = 12

const X_L = 8
const W_L = 188
const COL = { uid: 10, country: 58, plan: 102, events: 150 }

const X_R = 360
const W_R = 232
const CARD_H = 36
const BAR_X = 150 // within the card, where the value bar starts
const BAR_MAX = W_R - BAR_X - 10

export default function GroupByViz() {
  const [groupCol, setGroupCol] = useState('country')
  const [agg, setAgg] = useState('COUNT')
  const [havingN, setHavingN] = useState(0)

  const groups = computeGroups(groupCol).map((g, i) => ({ ...g, color: PALETTE[i % PALETTE.length] }))

  // Lay clusters out top to bottom. Computed functionally (no mutable cursor):
  // each group's top is TOP plus the full height of every earlier group and its
  // trailing gap; each row sits a fixed step below its group's top.
  const groupSpan = (g) => g.rows.length * (RH + ROW_GAP) - ROW_GAP
  const placed = groups.map((g, gi) => {
    const startY = TOP + groups.slice(0, gi).reduce((s, pg) => s + groupSpan(pg) + GROUP_GAP, 0)
    const rows = g.rows.map((r, ri) => ({ ...r, y: startY + ri * (RH + ROW_GAP) }))
    const endY = startY + groupSpan(g)
    return { ...g, rows, startY, endY, centerY: (startY + endY) / 2 }
  })
  const vbH = (placed.length ? placed[placed.length - 1].endY : TOP) + 6

  const visible = placed.filter((g) => passesHaving(g, havingN))
  const maxVal = Math.max(...visible.map((g) => aggValue(g, agg)), 1)

  // Per-row layout, keyed by session_id so rows keep identity and CSS-transition
  // their position/colour when the grouping column changes.
  const rowLayout = new Map()
  placed.forEach((g) => {
    const removed = !passesHaving(g, havingN)
    g.rows.forEach((r) => rowLayout.set(r.session_id, { y: r.y, color: g.color, isDup: r.isDup, removed }))
  })

  const aggControls = AGGREGATES.map((a) => ({
    label: a === 'DISTINCT' ? 'COUNT(DISTINCT)' : a === 'COUNT' ? 'COUNT(*)' : a,
    onClick: () => setAgg(a),
    active: agg === a,
  }))

  const readouts = [
    { label: 'group by', value: groupCol },
    { label: 'groups shown', value: `${visible.length} of ${placed.length}` },
    { label: 'source rows', value: ROWS.length },
  ]
  const status = `${ROWS.length} rows collapse into ${visible.length} group${visible.length === 1 ? '' : 's'}`

  return (
    <Figure
      eyebrow="Databases and SQL"
      title="Grouping sessions and aggregating them"
      controls={aggControls}
      status={status}
      readouts={readouts}
      tryThis="GROUP BY collapses every row in a group into one summary row. Switch the grouping column to recluster the rows, then pick an aggregate. COUNT(*) counts rows, but COUNT(DISTINCT user_id) folds a user's repeat sessions into one (watch the faded rows), so it is smaller wherever a group has repeat users. Drag the HAVING slider to drop whole groups by their COUNT(*): HAVING filters groups after aggregating, whereas WHERE would filter rows before. Window functions, covered separately, instead keep every row."
    >
      <svg
        viewBox={`0 0 ${VB_W} ${vbH}`}
        style={{ width: '100%', maxWidth: 620, height: 'auto', display: 'block', margin: '0 auto' }}
        aria-label="A table of per-session rows on the left clusters by the chosen column and collapses into one summary row per group on the right, showing the selected aggregate. A HAVING slider removes whole groups."
      >
        {/* panel titles */}
        <text x={X_L} y={TITLE_Y} fontSize={10} fill={INK} fontFamily={MONO} fontWeight="bold">
          session_stats
        </text>
        <text x={X_L + 88} y={TITLE_Y} fontSize={9} fill={FADE} fontFamily={MONO}>
          (one row per session)
        </text>
        <text x={X_R} y={TITLE_Y} fontSize={10} fill={INK} fontFamily={MONO} fontWeight="bold">
          {`GROUP BY ${groupCol}`}
        </text>

        {/* left column headers */}
        {[
          ['user', COL.uid],
          ['country', COL.country],
          ['plan', COL.plan],
          ['events', COL.events],
        ].map(([label, cx]) => (
          <text
            key={label}
            x={X_L + cx}
            y={TOP - 8}
            fontSize={8.5}
            fill={label === groupCol ? INK : FADE}
            fontFamily={MONO}
            letterSpacing="0.04em"
            fontWeight={label === groupCol ? 700 : 400}
          >
            {label}
          </text>
        ))}

        {/* funnels: each visible cluster collapses toward its summary card */}
        {visible.map((g) => {
          const cardTop = g.centerY - CARD_H / 2
          return (
            <polygon
              key={`funnel-${groupCol}-${g.key}`}
              className={styles.funnel}
              points={`${X_L + W_L},${g.startY} ${X_L + W_L},${g.endY} ${X_R},${cardTop + CARD_H} ${X_R},${cardTop}`}
              fill={g.color}
              opacity={0.09}
            />
          )
        })}

        {/* left detail rows (stable keys, animate position + colour) */}
        {ROWS.map((r) => {
          const L = rowLayout.get(r.session_id)
          const dupFold = agg === 'DISTINCT' && L.isDup
          const faded = L.removed || dupFold
          return (
            <g
              key={r.session_id}
              style={{
                transform: `translate(${X_L}px, ${L.y}px)`,
                transition: 'transform 480ms cubic-bezier(.4,0,.2,1), opacity 280ms ease',
                opacity: faded ? 0.3 : 1,
              }}
            >
              <rect x={0} y={0} width={4} height={RH} fill={L.color} style={{ transition: 'fill 480ms ease' }} />
              <rect x={0} y={0} width={W_L} height={RH} fill="#ffffff" stroke="#eceae3" strokeWidth={0.5} />
              <text x={COL.uid} y={RH / 2 + 3.3} fontSize={9.5} fill={INK} fontFamily={MONO}>
                {`u${r.user_id}`}
              </text>
              {dupFold && (
                <line x1={COL.uid - 2} y1={RH / 2} x2={COL.uid + 22} y2={RH / 2} stroke={INK} strokeWidth={1} />
              )}
              <text
                x={COL.country}
                y={RH / 2 + 3.3}
                fontSize={9.5}
                fill={groupCol === 'country' ? L.color : INK}
                fontFamily={MONO}
                fontWeight={groupCol === 'country' ? 700 : 400}
              >
                {r.country}
              </text>
              <text
                x={COL.plan}
                y={RH / 2 + 3.3}
                fontSize={9.5}
                fill={groupCol === 'plan' ? L.color : INK}
                fontFamily={MONO}
                fontWeight={groupCol === 'plan' ? 700 : 400}
              >
                {r.plan}
              </text>
              <text x={COL.events} y={RH / 2 + 3.3} fontSize={9.5} fill={FADE} fontFamily={MONO}>
                {`${r.events} ev`}
              </text>
            </g>
          )
        })}

        {/* right summary cards: one per visible group */}
        {visible.map((g) => {
          const top = g.centerY - CARD_H / 2
          const val = aggValue(g, agg)
          const barW = (val / maxVal) * BAR_MAX
          return (
            <g key={`card-${groupCol}-${g.key}`} className={styles.summaryCard}>
              <rect x={X_R} y={top} width={W_R} height={CARD_H} rx={5} fill="#ffffff" stroke={g.color} strokeWidth={1.5} />
              <rect x={X_R} y={top} width={5} height={CARD_H} rx={1} fill={g.color} />
              <text x={X_R + 14} y={top + 15} fontSize={12} fill={g.color} fontFamily={MONO} fontWeight="bold">
                {g.key}
              </text>
              <text x={X_R + 14} y={top + 29} fontSize={9.5} fill={FADE} fontFamily={MONO}>
                {`${AGG_LABEL[agg]} =`}
              </text>
              <text x={X_R + BAR_X - 6} y={top + 22} fontSize={13} fill={INK} fontFamily={MONO} fontWeight="bold" textAnchor="end">
                {val}
              </text>
              <rect
                x={X_R + BAR_X}
                y={top + CARD_H / 2 - 4}
                width={Math.max(barW, 1)}
                height={8}
                rx={1.5}
                fill={g.color}
                opacity={0.5}
                style={{ transition: 'width 360ms ease' }}
              />
            </g>
          )
        })}
      </svg>

      {/* GROUP BY column toggle */}
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>group by</span>
        {GROUP_COLUMNS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setGroupCol(c)}
            aria-pressed={groupCol === c}
            className={`${styles.toggle} ${groupCol === c ? styles.toggleOn : ''}`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* HAVING threshold */}
      <div className={styles.controlRow}>
        <span className={styles.havingValue}>{havingN > 0 ? `HAVING COUNT(*) > ${havingN}` : 'HAVING: off'}</span>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={MAX_COUNT}
          step={1}
          value={havingN}
          onChange={(e) => setHavingN(Number(e.target.value))}
          aria-label="HAVING threshold: keep groups with COUNT(*) greater than this value"
        />
      </div>

      {/* SQL for the current grouping, aggregate, and HAVING */}
      <pre
        style={{
          marginTop: 14,
          padding: '12px 14px',
          background: '#f0ede6',
          border: '1px solid #e2e0d8',
          borderRadius: 6,
          fontFamily: MONO,
          fontSize: 12.5,
          lineHeight: 1.5,
          color: INK,
          overflowX: 'auto',
        }}
      >
        {buildSql(groupCol, agg, havingN)}
      </pre>

      <p className={styles.note}>
        GROUP BY collapses each group&apos;s rows into a single summary row. A window function, by contrast, keeps
        every row and adds the calculated value alongside it.
      </p>
    </Figure>
  )
}
