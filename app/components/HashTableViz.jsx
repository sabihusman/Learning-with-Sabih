'use client'

import { useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './HashTableViz.module.css'

const SIZE = 7 // a small prime, so the teaching hash spreads a little better
const PRESETS = ['cat', 'dog', 'owl', 'ant', 'hen', 'ram', 'fox', 'cod', 'jay']

// The deliberately simple TEACHING hash: sum of character codes, mod the table size.
// Real and deterministic so placement is reproducible, but not a production hash.
function charCodes(key) {
  return [...key].map((ch) => ({ ch, code: ch.charCodeAt(0) }))
}
function hashOf(key) {
  const codes = charCodes(key)
  const sum = codes.reduce((a, c) => a + c.code, 0)
  return { codes, sum, bucket: sum % SIZE }
}

// ── geometry ───────────────────────────────────────────────────────────────────────
const VB_W = 560
const MARGIN = 12
const COL_PITCH = (VB_W - 2 * MARGIN) / SIZE
const COL_W = 62
const HEADER_Y = 10
const HEADER_H = 26
const CHIP_TOP = 50
const CHIP_H = 26
const CHIP_PITCH = 32
const centerX = (b) => MARGIN + b * COL_PITCH + COL_PITCH / 2
const colX = (b) => centerX(b) - COL_W / 2

export default function HashTableViz() {
  const [entries, setEntries] = useState([]) // { key, sum, bucket } in add order
  const [input, setInput] = useState('')

  const has = (key) => entries.some((e) => e.key === key)

  const addKey = (raw) => {
    const key = raw.trim().toLowerCase()
    if (!key || has(key)) return
    const { sum, bucket } = hashOf(key)
    setEntries((es) => [...es, { key, sum, bucket }])
  }
  const reset = () => setEntries([])

  const onSubmit = (e) => {
    e.preventDefault()
    addKey(input)
    setInput('')
  }

  // everything below is derived from the real table state
  const buckets = useMemo(() => {
    const b = Array.from({ length: SIZE }, () => [])
    entries.forEach((e) => b[e.bucket].push(e))
    return b
  }, [entries])

  const count = entries.length
  const collisions = buckets.reduce((a, ch) => a + Math.max(0, ch.length - 1), 0)
  const longest = buckets.reduce((a, ch) => Math.max(a, ch.length), 0)
  const last = entries[entries.length - 1] || null
  const lastComp = last ? hashOf(last.key) : null

  const rows = Math.max(3, longest)
  const VB_H = CHIP_TOP + rows * CHIP_PITCH + 8

  const controls = [{ label: 'Reset', onClick: reset, disabled: count === 0 }]

  const status = last
    ? `Added "${last.key}" to bucket ${last.bucket}${buckets[last.bucket].length > 1 ? ` (collision, chain length ${buckets[last.bucket].length})` : ''}`
    : 'Empty table. Add a key to hash it into a bucket.'

  const readouts = [
    { label: 'load factor', value: `${count} / ${SIZE} (${(count / SIZE).toFixed(2)})` },
    { label: 'collisions', value: collisions },
    { label: 'longest chain', value: longest },
  ]

  return (
    <Figure
      eyebrow="Data structures"
      title="Hash tables"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Add keys and watch each one hash into a bucket by the character-code-sum-mod-7 rule shown below. Add owl, then cod, then jay: all three sum to a bucket of 2 and form a chain. That is a collision, handled here by chaining. Watch the load factor, collision count, and longest chain climb from the real table contents."
    >
      <div className={styles.presets} role="group" aria-label="Add a preset key">
        {PRESETS.map((k) => (
          <button key={k} type="button" className={styles.presetBtn} disabled={has(k)} onClick={() => addKey(k)}>
            {k}
          </button>
        ))}
      </div>

      <form className={styles.inputRow} onSubmit={onSubmit}>
        <input
          className={styles.input}
          type="text"
          value={input}
          maxLength={12}
          placeholder="type a key"
          aria-label="Custom key"
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className={styles.addBtn} disabled={!input.trim() || has(input.trim().toLowerCase())}>
          Add
        </button>
      </form>

      {lastComp && (
        <p className={styles.compute}>
          <span className={styles.computeKey}>&quot;{last.key}&quot;</span>{' '}
          {lastComp.codes.map((c, i) => (
            <span key={i}>
              {i > 0 ? ' + ' : ''}
              {c.ch}
              <span className={styles.code}>({c.code})</span>
            </span>
          ))}{' '}
          = {lastComp.sum} &nbsp;&rarr;&nbsp; {lastComp.sum} mod {SIZE} = {lastComp.bucket} &nbsp;&rarr;&nbsp; bucket {lastComp.bucket}
        </p>
      )}

      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={styles.svg} role="img" aria-label={`Hash table with ${SIZE} buckets and ${count} keys`}>
        {buckets.map((chain, b) => (
          <g key={b}>
            {/* chain spine behind the chips */}
            {chain.length > 0 && (
              <line x1={centerX(b)} y1={HEADER_Y + HEADER_H} x2={centerX(b)} y2={CHIP_TOP + (chain.length - 1) * CHIP_PITCH + CHIP_H / 2} stroke="#cfcbc2" strokeWidth={2} />
            )}
            {/* bucket header with its index */}
            <rect x={colX(b)} y={HEADER_Y} width={COL_W} height={HEADER_H} rx={3} fill="#efece4" stroke="#d8d4cc" strokeWidth={1} />
            <text x={centerX(b)} y={HEADER_Y + HEADER_H / 2 + 4} className={styles.idx} textAnchor="middle">{b}</text>
            {/* chained chips */}
            {chain.map((e, i) => {
              const isNewest = last && e.key === last.key
              return (
                <g key={e.key} className={styles.chip}>
                  <rect x={colX(b)} y={CHIP_TOP + i * CHIP_PITCH} width={COL_W} height={CHIP_H} rx={4} fill={isNewest ? '#c0392b' : '#3f7d68'} stroke="#ffffff" strokeWidth={1} />
                  <text x={centerX(b)} y={CHIP_TOP + i * CHIP_PITCH + CHIP_H / 2 + 4} className={styles.chipText} fill="#ffffff" textAnchor="middle">{e.key}</text>
                </g>
              )
            })}
          </g>
        ))}
      </svg>

      <p className={styles.caption}>
        The placement and all three readouts are computed live from the table. The hash here is a simple teaching
        function (sum of character codes, mod the table size); real hash functions are far more complex and designed to
        scatter keys much more evenly. The table is kept small so collisions are easy to see.
      </p>
    </Figure>
  )
}
