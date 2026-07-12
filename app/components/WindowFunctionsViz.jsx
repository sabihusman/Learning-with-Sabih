'use client'

import { useState } from 'react'
import Figure from './Figure'
import { computeView, buildSql, maxRunning } from './windowFnData'
import styles from './WindowFunctionsViz.module.css'

const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

const FUNCTIONS = ['ROW_NUMBER', 'RANK', 'DENSE_RANK', 'SUM']

// Which displayed column each function annotates.
const FN_COLUMN = {
  ROW_NUMBER: 'row_number',
  RANK: 'rank',
  DENSE_RANK: 'dense_rank',
  SUM: 'running',
}

// ── SVG geometry ──────────────────────────────────────────────────────────────
const X0 = 10
const HEAD_H = 24
const ROW_H = 26
const TABLE_TOP = 28
const PARTITION_GAP = 16

const COLS = [
  { key: 'session_id', label: 'session', w: 58 },
  { key: 'time', label: 'time', w: 70 },
  { key: 'event', label: 'event', w: 116 },
  { key: 'value', label: 'val', w: 40 },
  { key: 'row_number', label: 'row_number', w: 78 },
  { key: 'rank', label: 'rank', w: 52 },
  { key: 'dense_rank', label: 'dense_rank', w: 76 },
  { key: 'running', label: 'running', w: 106, bar: true },
]
const TOTAL_W = COLS.reduce((s, c) => s + c.w, 0)
const VB_W = X0 + TOTAL_W + 8
const COL_X = COLS.map((_, ci) => X0 + COLS.slice(0, ci).reduce((s, c) => s + c.w, 0))

// running-sum bar metrics inside the last column
const BAR_NUM_W = 28
const BAR_PAD = 8

export default function WindowFunctionsViz() {
  const [activeFn, setActiveFn] = useState('ROW_NUMBER')
  const [partition, setPartition] = useState(false)

  const rows = computeView(partition)
  const maxRun = maxRunning(rows)
  const activeCol = FN_COLUMN[activeFn]
  const activeColIndex = COLS.findIndex((c) => c.key === activeCol)

  // Lay rows out top to bottom, inserting a gap and a divider between partitions.
  const layout = []
  const dividers = []
  let y = TABLE_TOP + HEAD_H
  let prevSid = null
  rows.forEach((r) => {
    if (partition && prevSid !== null && r.session_id !== prevSid) {
      dividers.push(y + PARTITION_GAP / 2)
      y += PARTITION_GAP
    }
    layout.push({ ...r, y })
    y += ROW_H
    prevSid = r.session_id
  })
  const tableBottom = y
  const vbH = tableBottom + 8

  const runCol = COLS[COLS.length - 1]
  const barX = COL_X[COLS.length - 1] + BAR_NUM_W
  const barMaxW = runCol.w - BAR_NUM_W - BAR_PAD

  const controls = FUNCTIONS.map((f) => ({
    label: f,
    onClick: () => setActiveFn(f),
    active: activeFn === f,
  }))
  const readouts = [
    { label: 'view', value: activeFn },
    { label: 'partition', value: partition ? 'session_id' : 'off' },
    { label: 'rows', value: `${rows.length}` },
  ]
  const status = partition
    ? `${activeFn} restarts within each session_id`
    : `${activeFn} over all rows, ordered by occurred_at`

  return (
    <Figure
      eyebrow="Ranking"
      title="Window functions over a stream of events"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="A window function adds a column without collapsing rows, so every event stays visible. Compare row_number, rank, and dense_rank on the tied pair (the two events at the same time): row_number gives 2 and 3, rank gives 2 and 2 then jumps to 4, dense_rank gives 2 and 2 then 3. The running column is SUM(value) accumulating down the rows, where value is an illustrative weight per event type (opened 1, used 2, completed 3). Turn on PARTITION BY session_id and watch the numbering and the running total restart for each session."
    >
      <svg
        viewBox={`0 0 ${VB_W} ${vbH}`}
        style={{ width: '100%', maxWidth: 620, height: 'auto', display: 'block', margin: '0 auto' }}
        aria-label="An events table with row_number, rank, dense_rank, and a running total computed across the rows. A tied pair shows how the ranking functions differ, and a PARTITION BY toggle restarts the calculation per session."
      >
        {/* highlight band behind the active function's column */}
        <rect
          x={COL_X[activeColIndex]}
          y={TABLE_TOP}
          width={COLS[activeColIndex].w}
          height={vbH - TABLE_TOP - 4}
          fill={ACCENT}
          opacity={0.07}
        />

        {/* column headers */}
        {COLS.map((c, ci) => (
          <text
            key={`h-${c.key}`}
            x={COL_X[ci] + 8}
            y={TABLE_TOP + 15}
            fontSize={11}
            fill={c.key === activeCol ? ACCENT : FADE}
            fontFamily={MONO}
            letterSpacing="0.03em"
            fontWeight={c.key === activeCol ? 700 : 400}
          >
            {c.label}
          </text>
        ))}
        <line
          x1={X0}
          y1={TABLE_TOP + HEAD_H}
          x2={X0 + TOTAL_W}
          y2={TABLE_TOP + HEAD_H}
          stroke="#d4d0c8"
          strokeWidth={1}
        />

        {/* partition dividers */}
        {dividers.map((dy, i) => (
          <line
            key={`div-${i}`}
            x1={X0}
            y1={dy}
            x2={X0 + TOTAL_W}
            y2={dy}
            stroke={INK}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.45}
          />
        ))}

        {/* rows */}
        {layout.map((r, ri) => (
          <g key={`${r.session_id}-${r.event_id}`}>
            <rect
              x={X0}
              y={r.y}
              width={TOTAL_W}
              height={ROW_H}
              fill={r.tied ? '#fbeeec' : ri % 2 ? '#faf9f6' : '#ffffff'}
              stroke="#eceae3"
              strokeWidth={0.5}
            />
            {COLS.map((c, ci) => {
              if (c.bar) {
                const w = maxRun > 0 ? (r.running / maxRun) * barMaxW : 0
                return (
                  <g key={c.key}>
                    <text
                      x={COL_X[ci] + 8}
                      y={r.y + ROW_H / 2 + 3.5}
                      fontSize={13}
                      fill={INK}
                      fontFamily={MONO}
                      fontWeight={700}
                    >
                      {r.running}
                    </text>
                    <rect
                      key={`bar-${partition}-${ri}`}
                      className={styles.bar}
                      style={{ animationDelay: `${ri * 45}ms` }}
                      x={barX}
                      y={r.y + ROW_H / 2 - 4}
                      width={Math.max(w, 1)}
                      height={8}
                      rx={1.5}
                      fill={ACCENT}
                      opacity={0.55}
                    />
                  </g>
                )
              }
              const isActive = c.key === activeCol
              return (
                <text
                  key={c.key}
                  x={COL_X[ci] + 8}
                  y={r.y + ROW_H / 2 + 3.5}
                  fontSize={13}
                  fill={isActive ? ACCENT : INK}
                  fontFamily={MONO}
                  fontWeight={isActive ? 700 : 400}
                >
                  {r[c.key]}
                </text>
              )
            })}
          </g>
        ))}
      </svg>

      {/* PARTITION BY toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setPartition((p) => !p)}
          aria-pressed={partition}
          className={`${styles.partitionToggle} ${partition ? styles.partitionToggleOn : ''}`}
        >
          {partition ? 'PARTITION BY session_id: on' : 'PARTITION BY session_id: off'}
        </button>
        <span style={{ fontFamily: MONO, fontSize: 11, color: FADE }}>
          {partition ? 'numbering and running total restart per session' : 'one calculation across all rows'}
        </span>
      </div>

      {/* SQL for the active function */}
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
        {buildSql(activeFn, partition)}
      </pre>

      <p className={styles.note}>
        GROUP BY would collapse these rows into one summary per group. A window function keeps every row and
        adds the calculated column alongside it.
      </p>
    </Figure>
  )
}
