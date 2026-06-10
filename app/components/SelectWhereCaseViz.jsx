'use client'

import { useState } from 'react'
import Figure from './Figure'
import { INK, FADE, MONO } from './vizPalette'
import {
  ROWS,
  ID_COL,
  TOGGLE_COLS,
  TIER_COL,
  WHERE_OPTS,
  whereById,
  tierOf,
  buildSql,
} from './selectWhereData'
import styles from './SelectWhereCaseViz.module.css'

const PAID = '#1f6f5c'
const FREE = '#9b9892'
const tierColor = (tier) => (tier === 'paid' ? PAID : FREE)

// ── SVG geometry ──────────────────────────────────────────────────────────────
const X0 = 10
const TOP = 16
const HEAD_H = 26
const ROW_H = 26

export default function SelectWhereCaseViz() {
  const [shown, setShown] = useState({ country: true, plan: true, signup_date: true })
  const [whereId, setWhereId] = useState('none')
  const [caseOn, setCaseOn] = useState(false)

  const where = whereById(whereId)
  const selectedKeys = [ID_COL.key, ...TOGGLE_COLS.filter((c) => shown[c.key]).map((c) => c.key)]
  const visibleCols = [
    ID_COL,
    ...TOGGLE_COLS.filter((c) => shown[c.key]),
    ...(caseOn ? [TIER_COL] : []),
  ]

  const totalW = visibleCols.reduce((s, c) => s + c.w, 0)
  const VB_W = X0 + totalW + 10
  const VB_H = TOP + HEAD_H + ROWS.length * ROW_H + 10
  const colLeft = (ci) => visibleCols.slice(0, ci).reduce((s, c) => s + c.w, X0)

  const keptCount = ROWS.filter((r) => where.test(r)).length

  const readouts = [
    { label: 'columns', value: visibleCols.length },
    { label: 'rows kept', value: `${keptCount} of ${ROWS.length}` },
    { label: 'case', value: caseOn ? 'on' : 'off' },
  ]
  const status = where.sql ? `WHERE keeps ${keptCount} of ${ROWS.length} rows` : `all ${ROWS.length} rows shown`

  const toggleCol = (key) => setShown((s) => ({ ...s, [key]: !s[key] }))

  return (
    <Figure
      eyebrow="Filtering"
      title="Selecting columns, filtering rows, bucketing with CASE"
      status={status}
      readouts={readouts}
      tryThis="SELECT chooses columns: tick or untick country, plan, and signup_date to change what the query returns (user_id always stays as the row's identity). WHERE chooses rows: pick a condition and the rows that fail it fade out, leaving only the matches. CASE adds a derived column without changing the source data: turn it on to bucket each row into a paid or free tier from its plan, colouring the rows by bucket. The SQL below updates to match every choice."
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', maxWidth: 560, height: 'auto', display: 'block', margin: '0 auto' }}
        aria-label="A users table whose visible columns, filtered rows, and an optional CASE tier column change as the controls below are adjusted."
      >
        {/* header */}
        {visibleCols.map((c, ci) => (
          <text
            key={`h-${c.key}`}
            x={colLeft(ci) + 8}
            y={TOP + 15}
            fontSize={9.5}
            fill={c.key === TIER_COL.key ? PAID : FADE}
            fontFamily={MONO}
            fontWeight={c.key === TIER_COL.key ? 700 : 400}
            letterSpacing="0.03em"
          >
            {c.label}
          </text>
        ))}
        <line x1={X0} y1={TOP + HEAD_H} x2={X0 + totalW} y2={TOP + HEAD_H} stroke="#d4d0c8" strokeWidth={1} />

        {/* rows */}
        {ROWS.map((row, ri) => {
          const kept = where.test(row)
          const top = TOP + HEAD_H + ri * ROW_H
          const tier = tierOf(row)
          return (
            <g key={row.user_id} className={styles.row} style={{ opacity: kept ? 1 : 0.22 }}>
              <rect
                x={X0}
                y={top}
                width={totalW}
                height={ROW_H}
                fill={ri % 2 ? '#faf9f6' : '#ffffff'}
                stroke="#eceae3"
                strokeWidth={0.5}
              />
              {caseOn && <rect x={X0} y={top} width={4} height={ROW_H} fill={tierColor(tier)} />}
              {visibleCols.map((c, ci) => {
                const isTier = c.key === TIER_COL.key
                return (
                  <text
                    key={c.key}
                    x={colLeft(ci) + 8}
                    y={top + ROW_H / 2 + 3.5}
                    fontSize={10.5}
                    fill={isTier ? tierColor(tier) : INK}
                    fontFamily={MONO}
                    fontWeight={isTier ? 700 : 400}
                  >
                    {isTier ? tier : row[c.key]}
                  </text>
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* SELECT: column checkboxes */}
      <div className={styles.controlRow}>
        <span className={styles.label}>select</span>
        <label className={styles.check}>
          <input type="checkbox" checked readOnly disabled />
          user_id
        </label>
        {TOGGLE_COLS.map((c) => (
          <label key={c.key} className={styles.check}>
            <input type="checkbox" checked={!!shown[c.key]} onChange={() => toggleCol(c.key)} />
            {c.label}
          </label>
        ))}
      </div>

      {/* WHERE: condition dropdown */}
      <div className={styles.controlRow}>
        <span className={styles.label}>where</span>
        <select className={styles.select} value={whereId} onChange={(e) => setWhereId(e.target.value)} aria-label="WHERE condition">
          {WHERE_OPTS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
      </div>

      {/* CASE: tier bucket toggle */}
      <div className={styles.controlRow}>
        <span className={styles.label}>case</span>
        <button
          type="button"
          onClick={() => setCaseOn((v) => !v)}
          aria-pressed={caseOn}
          className={`${styles.toggle} ${caseOn ? styles.toggleOn : ''}`}
        >
          {caseOn ? 'tier column: on' : 'tier column: off'}
        </button>
        <span style={{ fontFamily: MONO, fontSize: 11, color: FADE }}>
          CASE WHEN plan = &apos;pro&apos; THEN &apos;paid&apos; ELSE &apos;free&apos; END
        </span>
      </div>

      {/* live SQL */}
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
        {buildSql(selectedKeys, caseOn, where.sql)}
      </pre>

      <p className={styles.note}>
        SELECT picks columns, WHERE picks rows, and CASE derives a new column per row. None of them change the
        stored table; they shape what the query returns.
      </p>
    </Figure>
  )
}
