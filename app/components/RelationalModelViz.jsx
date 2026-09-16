'use client'

import { useState } from 'react'
import Figure from './Figure'
import { USERS, SESSIONS, USER_COLS, SESSION_COLS } from './relationalData'
import { INK, FADE, ACCENT, OK, ERR_BG, LINE, MUTED_BG, PANEL, MONO } from './vizPalette'
import styles from './RelationalModelViz.module.css'
import shared from './vizShared.module.css'

// ── SVG geometry ──────────────────────────────────────────────────────────────
const VB_W = 600
const SRC_TOP = 50
const HEAD_H = 32
const ROW_H = 28

const X_U = 14
const USER_W = USER_COLS.reduce((s, c) => s + c.w, 0)
const X_S = 336

const VB_H = SRC_TOP + HEAD_H + Math.max(USERS.length, SESSIONS.length) * ROW_H + 16

// left edge of column `ci`: start at x and accumulate the widths before it
const colX = (x, cols, ci) => cols.slice(0, ci).reduce((sum, c) => sum + c.w, x)
const rowTop = (i) => SRC_TOP + HEAD_H + i * ROW_H
const rowCenter = (i) => rowTop(i) + ROW_H / 2

// viewBox for the figure svg (kept as a value so the markup stays terse)
const SVG_VIEWBOX = `0 0 ${VB_W} ${VB_H}`

function keyColor(role) {
  if (role === 'PK') return OK
  if (role === 'FK') return ACCENT
  return FADE
}

function rowFill(activeRow, ri) {
  if (activeRow) return ERR_BG
  return ri % 2 ? PANEL : '#ffffff'
}

// Interactive table: highlights any row whose user_id equals `active`, and reports
// hover/click of a row back through onHover/onPin.
// A header cell: the column label, plus a PK/FK badge when the column has a role.
function HeaderCell({ col, left }) {
  const color = keyColor(col.role)
  return (
    <g>
      <text x={left} y={SRC_TOP + 12} fontSize={13} fill={col.role ? color : FADE} fontFamily={MONO} fontWeight={col.role ? 700 : 400} letterSpacing="0.03em">{col.label}</text>
      {col.role ? <rect x={left} y={SRC_TOP + 17} width={17} height={11} rx={2} fill={color} /> : null}
      {col.role ? <text x={left + 8.5} y={SRC_TOP + 25.5} fontSize={11} fill="#ffffff" fontFamily={MONO} fontWeight={700} textAnchor="middle">{col.role}</text> : null}
    </g>
  )
}

function Table({ x, cols, rows, title, active, onHover, onPin }) {
  const totalW = cols.reduce((s, c) => s + c.w, 0)
  const left = (ci) => colX(x, cols, ci) + 8
  return (
    <g>
      <text x={x} y={SRC_TOP - 18} fontSize={16} fill={INK} fontFamily={MONO} fontWeight={700}>{title}</text>
      {cols.map((c, ci) => (
        <HeaderCell key={`h-${c.key}`} col={c} left={left(ci)} />
      ))}
      <line x1={x} y1={SRC_TOP + HEAD_H} x2={x + totalW} y2={SRC_TOP + HEAD_H} stroke={LINE} strokeWidth={1} />
      {rows.map((row, ri) => {
        const on = row.user_id === active
        const pin = () => onPin(row.user_id)
        // hover previews, click (or Enter/Space from the keyboard) pins; focus
        // mirrors hover so keyboard users get the same preview
        const handlers = {
          onMouseEnter: () => onHover(row.user_id),
          onMouseLeave: () => onHover(null),
          onFocus: () => onHover(row.user_id),
          onBlur: () => onHover(null),
          onClick: pin,
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              pin()
            }
          },
        }
        const cells = cols.map((c) => `${c.label} ${row[c.key]}`).join(', ')
        return (
          <g
            key={row[cols[0].key]}
            className={styles.row}
            tabIndex={0}
            role="button"
            aria-pressed={on}
            aria-label={`${title} row: ${cells}. Select to highlight the rows linked by user_id ${row.user_id}.`}
            {...handlers}
          >
            <rect x={x} y={rowTop(ri)} width={totalW} height={ROW_H} fill={rowFill(on, ri)} stroke={on ? ACCENT : MUTED_BG} strokeWidth={on ? 1.2 : 0.5} />
            {cols.map((c, ci) => (
              <text key={c.key} x={left(ci)} y={rowTop(ri) + ROW_H / 2 + 3.5} fontSize={14} fill={c.role ? keyColor(c.role) : INK} fontFamily={MONO} fontWeight={c.role ? 700 : 400}>{row[c.key]}</text>
            ))}
          </g>
        )
      })}
    </g>
  )
}

export default function RelationalModelViz() {
  // active = the user_id whose relationship is shown. Hover previews; click pins.
  const [pinned, setPinned] = useState(31)
  const [hover, setHover] = useState(null)
  const active = hover ?? pinned

  const activeUserIndex = USERS.findIndex((u) => u.user_id === active)
  const matchingSessionIdx = SESSIONS.map((s, i) => (s.user_id === active ? i : -1)).filter((i) => i >= 0)

  const readouts = [
    { label: 'selected', value: `users.user_id = ${active}` },
    { label: 'linked sessions', value: matchingSessionIdx.length },
    { label: 'foreign key', value: 'sessions.user_id' },
  ]

  return (
    <Figure
      eyebrow="Data model"
      title="Two tables linked by a key"
      readouts={readouts}
      tryThis="A relational database splits data into focused tables. The users table has one row per user, and the sessions table has one row per session. Each table has a primary key (PK) that uniquely identifies its rows: user_id for users, session_id for sessions. The sessions table also has a foreign key (FK), user_id, that points back to users.user_id, recording who the session belongs to. Hover or click a row to light up its related rows: a session links to its one user, and a user links to all of its sessions (user 31 has two). Because the data lives in separate tables, putting it back together needs a join."
    >
      <div className={shared.scroll}>
      <svg
        role="group"
        viewBox={SVG_VIEWBOX}
        className={styles.svg}
        aria-label="A users table and a sessions table side by side. Each session's user_id foreign key links to a user's user_id primary key; hovering or clicking a row highlights the related rows and draws connecting lines."
      >
        {/* connector lines from the active user to each of its sessions */}
        {activeUserIndex >= 0 &&
          matchingSessionIdx.map((si) => (
            <line
              key={`link-${active}-${si}`}
              x1={X_U + USER_W}
              y1={rowCenter(activeUserIndex)}
              x2={X_S}
              y2={rowCenter(si)}
              stroke={ACCENT}
              strokeWidth={1.6}
              strokeOpacity={0.75}
            />
          ))}

        <Table x={X_U} cols={USER_COLS} rows={USERS} title="users" active={active} onHover={setHover} onPin={setPinned} />
        <Table x={X_S} cols={SESSION_COLS} rows={SESSIONS} title="sessions" active={active} onHover={setHover} onPin={setPinned} />
      </svg>
      </div>

      <div className={styles.legend}>
        <span>
          <span className={`${styles.badge} ${styles.pk}`}>PK</span>primary key: uniquely identifies a row
        </span>
        <span>
          <span className={`${styles.badge} ${styles.fk}`}>FK</span>foreign key: points to a primary key in another table
        </span>
      </div>

      <p className={shared.caption}>
        The data is not one giant table. It is split into focused tables connected by keys, which is what
        &quot;relational&quot; means, and why combining them needs a join.
      </p>
    </Figure>
  )
}
