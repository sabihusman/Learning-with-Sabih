'use client'

import { useState } from 'react'
import Figure from './Figure'
import { users, sessions } from './sqlData'
import styles from './JoinsViz.module.css'

const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

// A small, readable slice of the shared dataset. Left = a few users (one with no
// session), right = a few sessions (one whose user is not in the left slice), so
// every join type shows something distinct.
const LEFT = [5, 9, 14, 47].map((id) => {
  const u = users.find((x) => x.user_id === id)
  return { user_id: u.user_id, country: u.country }
})
const RIGHT = [1, 35, 3, 2].map((id) => {
  const s = sessions.find((x) => x.session_id === id)
  return { session_id: s.session_id, user_id: s.user_id, started_at: s.started_at.split(' ')[0] }
})

const JOIN_TYPES = ['INNER', 'LEFT', 'RIGHT', 'FULL']

// Compute the join. Each result row is { l, r } where either side may be null
// (an unmatched row), which is how NULLs appear in the output.
function computeJoin(type) {
  const rows = []
  for (const l of LEFT) {
    const matches = RIGHT.filter((r) => r.user_id === l.user_id)
    if (matches.length) for (const r of matches) rows.push({ l, r })
    else if (type === 'LEFT' || type === 'FULL') rows.push({ l, r: null })
  }
  if (type === 'RIGHT' || type === 'FULL') {
    for (const r of RIGHT) {
      if (!LEFT.some((l) => l.user_id === r.user_id)) rows.push({ l: null, r })
    }
  }
  return rows
}

const COUNTS = Object.fromEntries(JOIN_TYPES.map((t) => [t, computeJoin(t).length]))

const SQL = {
  INNER: 'SELECT *\nFROM users u\nINNER JOIN sessions s ON s.user_id = u.user_id;',
  LEFT: 'SELECT *\nFROM users u\nLEFT JOIN sessions s ON s.user_id = u.user_id;',
  RIGHT: 'SELECT *\nFROM users u\nRIGHT JOIN sessions s ON s.user_id = u.user_id;',
  FULL: 'SELECT *\nFROM users u\nFULL JOIN sessions s ON s.user_id = u.user_id;',
}

// ── SVG geometry ──────────────────────────────────────────────────────────────
const VB_W = 680
const ROW_H = 24
const HEAD_H = 22
const SRC_TOP = 40
const L_X = 18
const L_COLS = [
  { key: 'user_id', label: 'user_id', w: 70 },
  { key: 'country', label: 'country', w: 80 },
]
const L_W = L_COLS.reduce((s, c) => s + c.w, 0)
const R_X = 430
const R_COLS = [
  { key: 'session_id', label: 'session_id', w: 78 },
  { key: 'user_id', label: 'user_id', w: 60 },
  { key: 'started_at', label: 'started_at', w: 94 },
]
const R_W = R_COLS.reduce((s, c) => s + c.w, 0)
const SRC_BOTTOM = SRC_TOP + HEAD_H + Math.max(LEFT.length, RIGHT.length) * ROW_H

const RES_TOP = SRC_BOTTOM + 46
const RES_X = 18
const RES_COLS = [
  { key: 'uid', label: 'u.user_id', w: 78 },
  { key: 'country', label: 'u.country', w: 78 },
  { key: 'sid', label: 's.session_id', w: 92 },
  { key: 'suid', label: 's.user_id', w: 78 },
  { key: 'started', label: 's.started_at', w: 100 },
]
const RES_W = RES_COLS.reduce((s, c) => s + c.w, 0)
const VB_H = RES_TOP + 14 + HEAD_H + 5 * ROW_H + 16

const rowCY = (top, i) => top + HEAD_H + i * ROW_H + ROW_H / 2

// header + body cells for a table, given column defs and rows of plain values
function Table({ x, top, cols, rows, getCell, rowClass, rowKey }) {
  const totalW = cols.reduce((s, c) => s + c.w, 0)
  // left edge of each column = x plus the widths of all columns before it
  const colX = cols.map((_, ci) => x + cols.slice(0, ci).reduce((s, c) => s + c.w, 0))
  return (
    <g>
      {/* header */}
      {cols.map((c, ci) => (
        <text
          key={`h${c.key}`}
          x={colX[ci] + 8}
          y={top + 14}
          fontSize={9.5}
          fill={FADE}
          fontFamily={MONO}
          letterSpacing="0.04em"
        >
          {c.label}
        </text>
      ))}
      <line x1={x} y1={top + HEAD_H} x2={x + totalW} y2={top + HEAD_H} stroke="#d4d0c8" strokeWidth={1} />
      {/* rows */}
      {rows.map((row, ri) => (
        <g key={rowKey ? rowKey(row, ri) : ri} className={rowClass} style={rowClass ? { animationDelay: `${ri * 55}ms` } : undefined}>
          <rect
            x={x}
            y={top + HEAD_H + ri * ROW_H}
            width={totalW}
            height={ROW_H}
            fill={ri % 2 ? '#faf9f6' : '#ffffff'}
            stroke="#eceae3"
            strokeWidth={0.5}
          />
          {cols.map((c, ci) => {
            const cell = getCell(row, c.key)
            const isNull = cell === null
            return (
              <text
                key={c.key}
                x={colX[ci] + 8}
                y={top + HEAD_H + ri * ROW_H + ROW_H / 2 + 3.5}
                fontSize={10.5}
                fill={isNull ? ACCENT : INK}
                fontFamily={MONO}
                fontStyle={isNull ? 'italic' : 'normal'}
              >
                {isNull ? 'NULL' : cell}
              </text>
            )
          })}
        </g>
      ))}
    </g>
  )
}

export default function JoinsViz() {
  const [joinType, setJoinType] = useState('INNER')
  const result = computeJoin(joinType)

  // connector lines for matched key pairs (same for every join type)
  const connectors = []
  LEFT.forEach((l, li) => {
    RIGHT.forEach((r, ri) => {
      if (l.user_id === r.user_id) connectors.push({ li, ri })
    })
  })

  const controls = JOIN_TYPES.map((t) => ({ label: t, onClick: () => setJoinType(t), active: joinType === t }))
  const readouts = JOIN_TYPES.map((t) => ({ label: t.toLowerCase(), value: `${COUNTS[t]} rows` }))
  const status = `${joinType} JOIN returns ${COUNTS[joinType]} rows`

  return (
    <Figure
      eyebrow="Joining"
      title="Joining users and their sessions"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Switch the join type. INNER keeps only rows that match on user_id, so the user with no session and the session with no matching user both vanish. LEFT keeps every user (the session columns go NULL when there is none), RIGHT keeps every session, and FULL keeps both sides. Watch the row count: INNER is the smallest, FULL the largest, because the outer joins add back the unmatched rows as NULLs."
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="A users table and a sessions table joined on user_id, with the result table below changing as the join type toggles."
      >
        {/* table titles */}
        <text x={L_X} y={SRC_TOP - 14} fontSize={11} fill={INK} fontFamily={MONO} fontWeight="bold">
          users (u)
        </text>
        <text x={R_X} y={SRC_TOP - 14} fontSize={11} fill={INK} fontFamily={MONO} fontWeight="bold">
          sessions (s)
        </text>

        {/* connector lines for matched user_id pairs */}
        {connectors.map(({ li, ri }) => (
          <line
            key={`c${li}-${ri}`}
            x1={L_X + L_W}
            y1={rowCY(SRC_TOP, li)}
            x2={R_X}
            y2={rowCY(SRC_TOP, ri)}
            stroke={ACCENT}
            strokeWidth={1.4}
            strokeOpacity={0.7}
          />
        ))}

        <Table x={L_X} top={SRC_TOP} cols={L_COLS} rows={LEFT} getCell={(row, k) => row[k]} />
        <Table x={R_X} top={SRC_TOP} cols={R_COLS} rows={RIGHT} getCell={(row, k) => row[k]} />

        {/* result label */}
        <text x={RES_X} y={RES_TOP} fontSize={10} fill={FADE} fontFamily={MONO} letterSpacing="0.12em">
          {`RESULT  (${joinType} JOIN, ${result.length} rows)`}
        </text>

        <Table
          x={RES_X}
          top={RES_TOP + 8}
          cols={RES_COLS}
          rows={result}
          rowClass={styles.resultRow}
          rowKey={(_, i) => `${joinType}-${i}`}
          getCell={({ l, r }, k) => {
            if (k === 'uid') return l ? l.user_id : null
            if (k === 'country') return l ? l.country : null
            if (k === 'sid') return r ? r.session_id : null
            if (k === 'suid') return r ? r.user_id : null
            if (k === 'started') return r ? r.started_at : null
            return null
          }}
        />
      </svg>

      {/* the SQL for the selected join */}
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
        {SQL[joinType]}
      </pre>
    </Figure>
  )
}
