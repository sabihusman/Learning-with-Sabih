'use client'

import { useState } from 'react'
import Figure from './Figure'
import ChoiceGroup from './ChoiceGroup'
import {
  FN_COLUMN,
  FRAMES,
  FUNCTIONS,
  ORDERS,
  ambiguousCells,
  cellText,
  compute,
  isAmbiguous,
  maxRunning,
  sqlLines,
  statusFor,
} from './windowFnData'
import { INK, FADE, ACCENT, RULE, MUTED_BG, AMBER, AMBER_BG, PANEL, CARD, MONO } from './vizPalette'
import shared from './vizShared.module.css'
import styles from './WindowFunctionsViz.module.css'

// ── SVG geometry ──────────────────────────────────────────────────────────────
const X0 = 10
const HEAD_H = 24
const ROW_H = 26
const TABLE_TOP = 6
const PARTITION_GAP = 16

const COLS = [
  { key: 'session_id', label: 'session', w: 58 },
  { key: 'event_id', label: 'id', w: 34 },
  { key: 'time', label: 'time', w: 70 },
  // wide enough for the longest event name ("interactive_used") plus padding
  { key: 'event', label: 'event', w: 148 },
  { key: 'value', label: 'val', w: 36 },
  { key: 'row_number', label: 'row_number', w: 82, window: true },
  { key: 'rank', label: 'rank', w: 52, window: true },
  { key: 'dense_rank', label: 'dense_rank', w: 80, window: true },
  { key: 'running', label: 'running', w: 132, window: true, bar: true },
]
const TOTAL_W = COLS.reduce((s, c) => s + c.w, 0)
const VB_W = X0 + TOTAL_W + 8
const COL_X = COLS.map((_, ci) => X0 + COLS.slice(0, ci).reduce((s, c) => s + c.w, 0))
// smallest raw font (the column headers) sets the phone scroll floor
const MIN_FONT = 11
const SVG_MIN_WIDTH = Math.min(640, Math.ceil((7 * VB_W) / MIN_FONT))

// running-total bar inside the last column: room for "2 or 4" before it
const BAR_NUM_W = 56
const BAR_PAD = 8

export default function WindowFunctionsViz() {
  const [activeFn, setActiveFn] = useState('ROW_NUMBER')
  const [order, setOrder] = useState('time')
  const [frame, setFrame] = useState('RANGE')
  const [partition, setPartition] = useState(false)

  const opts = { order, frame, partition }
  const rows = compute(opts)
  const maxRun = maxRunning(rows)
  const activeCol = FN_COLUMN[activeFn]
  const activeColIndex = COLS.findIndex((c) => c.key === activeCol)
  const unfixed = ambiguousCells(rows)

  // Lay rows out top to bottom, with a gap and a divider between partitions.
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
  const vbH = y + 8

  const runCol = COLS[COLS.length - 1]
  const barX = COL_X[COLS.length - 1] + BAR_NUM_W
  const barMaxW = runCol.w - BAR_NUM_W - BAR_PAD
  const barW = (v) => (maxRun > 0 ? Math.max((v / maxRun) * barMaxW, 1) : 0)

  const controls = FUNCTIONS.map((f) => ({ label: f, onClick: () => setActiveFn(f), active: activeFn === f }))
  const readouts = [
    { label: 'view', value: activeFn },
    { label: 'order by', value: ORDERS.find((o) => o.id === order).label },
    { label: 'SUM frame', value: frame },
    { label: 'partition', value: partition ? 'session_id' : 'off' },
    { label: 'values not fixed by the SQL', value: unfixed },
  ]

  return (
    <Figure
      eyebrow="Window functions"
      title="The query, and exactly what it returns"
      controls={controls}
      status={statusFor(rows, opts, activeFn)}
      readouts={readouts}
      tryThis="Find the tied pair, events 2 and 3. Under RANGE their running totals are equal. Under ROWS they split, and which one is smaller is an order the SQL does not fix. Add the tie-break and watch the split disappear. Finally, turn on PARTITION BY and see every calculation restart for session 2."
    >
      <div className={styles.choices}>
        <ChoiceGroup label="ORDER BY" options={ORDERS} value={order} onChange={setOrder} testPrefix="wf-order" />
        <ChoiceGroup label="SUM frame" options={FRAMES} value={frame} onChange={setFrame} testPrefix="wf-frame" />
        <ChoiceGroup
          label="PARTITION BY"
          options={[
            { id: 'off', label: 'none' },
            { id: 'on', label: 'session_id' },
          ]}
          value={partition ? 'on' : 'off'}
          onChange={(v) => setPartition(v === 'on')}
          testPrefix="wf-partition"
        />
      </div>

      <div className={shared.scroll}>
        <svg
          role="img"
          viewBox={`0 0 ${VB_W} ${vbH}`}
          className={styles.svg}
          style={{ minWidth: SVG_MIN_WIDTH }}
          data-testid="wf-table"
          aria-label={`The result of the query below: ${rows.length} events with row_number, rank, dense_rank and a running total. ${unfixed} values are not fixed by the SQL.`}
        >
          {/* highlight band behind the active function's column */}
          <rect x={COL_X[activeColIndex]} y={TABLE_TOP} width={COLS[activeColIndex].w} height={vbH - TABLE_TOP - 4} fill={ACCENT} opacity={0.07} />

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
          <line x1={X0} y1={TABLE_TOP + HEAD_H} x2={X0 + TOTAL_W} y2={TABLE_TOP + HEAD_H} stroke={RULE} strokeWidth={1} />

          {dividers.map((dy, i) => (
            <line key={`div-${i}`} x1={X0} y1={dy} x2={X0 + TOTAL_W} y2={dy} stroke={INK} strokeWidth={1} strokeDasharray="3 3" opacity={0.45} />
          ))}

          {layout.map((r, ri) => (
            <g key={`${r.session_id}-${r.event_id}`} data-testid={`wf-row-${r.event_id}`} data-tied={r.tied ? 'true' : 'false'}>
              <rect x={X0} y={r.y} width={TOTAL_W} height={ROW_H} fill={r.tied ? AMBER_BG : ri % 2 ? PANEL : CARD} stroke={MUTED_BG} strokeWidth={0.5} />
              {COLS.map((c, ci) => {
                const cx = COL_X[ci] + 8
                const ty = r.y + ROW_H / 2 + 4
                if (!c.window) {
                  return (
                    <text key={c.key} x={cx} y={ty} fontSize={13} fill={INK} fontFamily={MONO}>
                      {r[c.key]}
                    </text>
                  )
                }
                const open = isAmbiguous(r, c.key)
                const isActive = c.key === activeCol
                const values = r.cells[c.key]
                return (
                  <g key={c.key} data-testid={`wf-cell-${r.event_id}-${c.key}`} data-values={values.join(',')}>
                    {open && (
                      <rect
                        x={COL_X[ci] + 3}
                        y={r.y + 3}
                        width={(c.bar ? BAR_NUM_W : c.w) - 6}
                        height={ROW_H - 6}
                        fill="none"
                        stroke={AMBER}
                        strokeWidth={1}
                        strokeDasharray="3 2"
                        rx={3}
                      />
                    )}
                    <text x={cx} y={ty} fontSize={open ? 12 : 13} fill={open ? AMBER : isActive ? ACCENT : INK} fontFamily={MONO} fontWeight={isActive || c.bar ? 700 : 400}>
                      {cellText(r, c.key)}
                    </text>
                    {c.bar && (
                      <>
                        <rect
                          key={`bar-${order}-${frame}-${partition}-${ri}`}
                          className={styles.bar}
                          style={{ animationDelay: `${ri * 45}ms` }}
                          x={barX}
                          y={r.y + ROW_H / 2 - 4}
                          width={barW(values[0])}
                          height={8}
                          rx={1.5}
                          fill={ACCENT}
                          opacity={0.55}
                        />
                        {open && (
                          <rect
                            x={barX}
                            y={r.y + ROW_H / 2 - 4}
                            width={barW(values[values.length - 1])}
                            height={8}
                            rx={1.5}
                            fill="none"
                            stroke={AMBER}
                            strokeWidth={1}
                            strokeDasharray="2 2"
                          />
                        )}
                      </>
                    )}
                  </g>
                )
              })}
            </g>
          ))}
        </svg>
      </div>

      <div className={shared.legend}>
        <span className={shared.legendItem}>
          <span className={shared.swatch} style={{ background: AMBER_BG }} />
          peers: equal on the ORDER BY key
        </span>
        <span className={shared.legendItem}>
          <span className={shared.swatch} style={{ background: 'transparent', border: `1px dashed ${AMBER}` }} />
          not fixed by the SQL: the database may return any value shown
        </span>
      </div>

      <pre className={styles.sql} data-testid="wf-sql">
        {sqlLines(opts).map((l, i) => (
          <span key={i} className={l.fn === activeFn ? styles.sqlActive : undefined}data-active={l.fn === activeFn ? 'true' : undefined}>
            {`${l.text}\n`}
          </span>
        ))}
      </pre>

      <p className={shared.caption}>
        The printed SQL is the literal query behind the table, verified against a real SQL engine. A cell shown as &apos;a or
        b&apos; is a value the SQL genuinely leaves open. It is not a rounding.
      </p>
    </Figure>
  )
}
