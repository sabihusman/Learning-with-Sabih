'use client'

import { useState } from 'react'
import Figure from './Figure'
import { ACCENT, AMBER, OK, LINE, CONTROL_BG, FADE, CARD } from './vizPalette'
import shared from './vizShared.module.css'
import styles from './HashTableViz.module.css'
import {
  BAND,
  MAX_KEYS,
  MAX_LOAD,
  PRESETS,
  allKeys,
  anagramGroups,
  canInsert,
  charCodes,
  finishRehash,
  initialState,
  insert,
  layout,
  rehashStep,
  stats,
} from './hashTableData'

// ── geometry: buckets drawn in bands of 7, so bucket b + 7 sits under bucket b ──
const VB_W = 560
const MARGIN = 12
const COL_PITCH = (VB_W - 2 * MARGIN) / BAND
const COL_W = 62
const HEADER_H = 24
const CHIP_GAP = 8 // header to first chip
const CHIP_H = 24
const CHIP_PITCH = 29
const BAND_GAP = 14
const centerX = (col) => MARGIN + col * COL_PITCH + COL_PITCH / 2
const colX = (col) => centerX(col) - COL_W / 2

const fmt2 = (x) => x.toFixed(2)
const quoted = (k) => `"${k}"`
const listOf = (ks) => ks.map(quoted).join(', ')

function bandGeometry(cells) {
  const bands = []
  let top = 4
  for (let start = 0; start < cells.length; start += BAND) {
    const band = cells.slice(start, start + BAND)
    const minRows = cells.length === BAND ? 3 : 1
    const rows = Math.max(minRows, ...band.map((c) => c.length))
    bands.push({ start, top, rows })
    top += HEADER_H + CHIP_GAP + rows * CHIP_PITCH + BAND_GAP
  }
  return { bands, height: top - BAND_GAP + 4 }
}

function chipStroke(anagram, waiting) {
  if (anagram) return AMBER
  return waiting ? FADE : CARD
}

function sumLine(key) {
  return charCodes(key).map((c, i) => (
    <span key={i}>
      {i > 0 ? ' + ' : ''}
      {c.ch}
      <span className={styles.code}>({c.code})</span>
    </span>
  ))
}

function anagramNote(anagrams, sum) {
  if (!anagrams.length) return ''
  return ` Same letters as ${listOf(anagrams)}, so the same sum (${sum}): under this hash, anagrams share a bucket at every table size.`
}

function statusFor(state, st) {
  const e = state.event
  if (!e) return `Empty table, ${st.buckets} buckets. Add a key to hash it into a bucket.`
  if (e.kind === 'insert' && e.resized) {
    const r = e.resized
    return `Added ${quoted(e.key)} to bucket ${e.bucket}. ${r.count} keys / ${r.from} buckets = ${fmt2(r.load)}, over ${MAX_LOAD}: the table doubles to ${r.to} buckets and all ${r.count} keys must be rehashed. Step through the rehash.`
  }
  if (e.kind === 'insert') {
    const collision = e.chain > 1 ? ` (collision, chain length ${e.chain})` : ''
    const full = st.count >= MAX_KEYS ? ` The figure stops at ${MAX_KEYS} keys: one more would double the table to ${st.buckets * 2} buckets.` : ''
    return `Added ${quoted(e.key)} to bucket ${e.bucket}${collision}.${anagramNote(e.anagrams, e.sum)}${full}`
  }
  if (e.done) {
    const moved = e.movedAll.length
    const which = moved ? ` (${listOf(e.movedAll)})` : ''
    return `Rehash finished: ${e.count} keys / ${e.to} buckets = ${fmt2(e.count / e.to)}. ${moved} of ${e.count} keys moved to a new bucket number${which}; the rest kept theirs.`
  }
  const where = e.moved ? `moves from bucket ${e.oldBucket} to bucket ${e.bucket}` : `stays in bucket ${e.bucket}`
  return `Rehashed ${quoted(e.key)}: it ${where}.${anagramNote(e.anagrams, e.sum)} ${e.remaining} ${e.remaining === 1 ? 'key' : 'keys'} still waiting in the old table.`
}

export default function HashTableViz() {
  const [state, setState] = useState(initialState)
  const [input, setInput] = useState('')

  const st = stats(state)
  const cells = layout(state)
  const keys = allKeys(state)
  const anagramKeys = new Set(anagramGroups(keys).flat())
  const e = state.event
  const resizing = Boolean(state.resize)
  const { bands, height } = bandGeometry(cells)

  const add = (raw) => setState((s) => insert(s, raw))
  const onSubmit = (ev) => {
    ev.preventDefault()
    add(input)
    setInput('')
  }

  const controls = [
    ...(resizing
      ? [
          {
            label: 'Rehash next key',
            onClick: () => setState(rehashStep),
            variant: 'primary',
          },
          { label: 'Finish rehash', onClick: () => setState(finishRehash) },
        ]
      : []),
    { label: 'Reset', onClick: () => setState(initialState()), disabled: !e },
  ]

  const loadValue = resizing
    ? `${st.count} / ${state.resize.from} = ${fmt2(st.count / state.resize.from)} → ${st.count} / ${st.buckets} = ${fmt2(st.load)}`
    : `${st.count} / ${st.buckets} = ${fmt2(st.load)}`
  const perKey = st.count ? ` (${fmt2(st.placements / st.count)} per key)` : ''
  const readouts = [
    { label: 'load factor (keys / buckets)', value: loadValue },
    { label: 'collisions', value: st.collisions },
    { label: 'longest chain', value: st.longest },
    { label: 'resizes', value: st.resizes },
    {
      label: 'key placements (inserts + rehashes)',
      value: `${st.inserts} + ${st.rehashed} = ${st.placements}${perKey}`,
    },
  ]

  const inputCheck = canInsert(state, input)
  // after Finish, the status line sums up the whole rehash; no single key is highlighted
  const showKey = e && e.kind !== 'finish'
  const lastKey = showKey ? e.key : null

  return (
    <Figure
      eyebrow="Data structures"
      title="Hash tables"
      controls={controls}
      status={statusFor(state, st)}
      readouts={readouts}
      tryThis="Add owl, then cod, then jay: all three sum to a bucket of 2 and form a chain, a collision handled by chaining. Keep adding keys. The sixth takes the load factor to 6 / 7 = 0.86, over 0.75, and the table doubles to 14 buckets. Step the rehash: each key either keeps its bucket number or drops to the band below, because bucket b can only become b or b + 7. Then add dog and god. Same letters, same sum, so they share a bucket, and no resize ever separates them."
    >
      <div className={shared.group} role="group" aria-label="Add a preset key">
        {PRESETS.map((k) => (
          <button key={k} type="button" className={shared.btn} disabled={!canInsert(state, k).ok} onClick={() => add(k)} data-testid={`hash-add-${k}`}>
            {k}
          </button>
        ))}
      </div>

      <form className={styles.inputRow} onSubmit={onSubmit}>
        <input
          className={`${shared.input} ${styles.keyInput}`}
          type="text"
          value={input}
          maxLength={12}
          placeholder="type a key"
          aria-label="Custom key"
          disabled={resizing}
          onChange={(ev) => setInput(ev.target.value)}
        />
        <button type="submit" className={shared.btn} data-variant="primary" disabled={!inputCheck.ok}>
          Add
        </button>
      </form>

      {showKey && (
        <p className={styles.compute} data-testid="hash-compute">
          <span className={styles.computeKey}>&quot;{e.key}&quot;</span> {sumLine(e.key)} = {e.sum}
          {e.kind === 'insert' && (
            <>
              {' '}
              &rarr; {e.sum} mod {e.buckets} = {e.bucket} &rarr; bucket {e.bucket}
            </>
          )}
          {e.kind === 'rehash' && (
            <>
              {' '}
              &rarr; {e.sum} mod {e.to} = {e.bucket} (was {e.sum} mod {e.from} = {e.oldBucket}) &rarr;{' '}
              {e.moved ? `moves to bucket ${e.bucket}` : `stays in bucket ${e.bucket}`}
            </>
          )}
        </p>
      )}

      <svg
        viewBox={`0 0 ${VB_W} ${height}`}
        className={styles.svg}
        role="img"
        aria-label={`Hash table with ${st.buckets} buckets and ${st.count} keys`}
        data-testid="hash-svg"
        data-buckets={st.buckets}
      >
        {bands.map(({ start, top }) =>
          cells.slice(start, start + BAND).map((cell, col) => {
            const b = start + col
            const chipTop = top + HEADER_H + CHIP_GAP
            return (
              <g key={b} data-testid={`hash-bucket-${b}`} data-keys={cell.map((c) => c.key).join(' ')}>
                {cell.length > 0 && (
                  <line
                    x1={centerX(col)}
                    y1={top + HEADER_H}
                    x2={centerX(col)}
                    y2={chipTop + (cell.length - 1) * CHIP_PITCH + CHIP_H / 2}
                    stroke={LINE}
                    strokeWidth={2}
                  />
                )}
                <rect x={colX(col)} y={top} width={COL_W} height={HEADER_H} rx={3} fill={CONTROL_BG} stroke={LINE} strokeWidth={1} />
                <text x={centerX(col)} y={top + HEADER_H / 2 + 4} className={styles.idx} textAnchor="middle">
                  {b}
                </text>
              </g>
            )
          }),
        )}

        {/* chips are keyed by key, so a rehashed key slides from its old cell to its new one */}
        <g>
          {bands.flatMap(({ start, top }) =>
            cells.slice(start, start + BAND).flatMap((cell, col) =>
              cell.map(({ key, waiting }, i) => {
                const x = colX(col)
                const y = top + HEADER_H + CHIP_GAP + i * CHIP_PITCH
                const isLast = key === lastKey
                let fill = OK
                if (waiting) fill = CARD
                else if (isLast) fill = ACCENT
                const anagram = anagramKeys.has(key)
                return (
                  <g
                    key={key}
                    className={styles.chipPos}
                    style={{ transform: `translate(${x}px, ${y}px)` }}
                    data-testid={`hash-key-${key}`}
                    data-waiting={waiting}
                  >
                    <g className={styles.chip}>
                      <rect
                        width={COL_W}
                        height={CHIP_H}
                        rx={4}
                        fill={fill}
                        stroke={chipStroke(anagram, waiting)}
                        strokeWidth={anagram ? 3 : 1}
                        strokeDasharray={waiting ? '4 3' : undefined}
                      />
                      <text x={COL_W / 2} y={CHIP_H / 2 + 4} className={styles.chipText} fill={waiting ? FADE : CARD} textAnchor="middle">
                        {key}
                      </text>
                    </g>
                  </g>
                )
              }),
            ),
          )}
        </g>
      </svg>

      <div className={shared.legend}>
        <span className={shared.legendItem}>
          <span className={shared.swatch} style={{ background: OK }} /> key in the table
        </span>
        <span className={shared.legendItem}>
          <span className={shared.swatch} style={{ background: ACCENT }} /> last key added or rehashed
        </span>
        <span className={shared.legendItem}>
          <span className={shared.swatch} style={{ background: CARD, border: `1px dashed ${FADE}` }} /> waiting in the old table
        </span>
        <span className={shared.legendItem}>
          <span className={shared.swatch} style={{ background: CARD, border: `3px solid ${AMBER}` }} /> anagram of another key
        </span>
      </div>

      <p className={shared.caption}>
        The placement, the resize and every readout are computed live from the table. The hash is a simple teaching function (sum of character codes, mod the
        number of buckets), which is why anagrams always collide; real hash functions are far more complex and scatter keys much more evenly. The table starts
        at 7 buckets and doubles to 14, then 28, when the load factor goes over 0.75, the rule Java&apos;s HashMap uses. Real tables rehash every key inside the
        insert that triggers the resize; the figure lets you step through it, and a key waiting in the old table is drawn in the cell of its old bucket number.
        The figure stops at {MAX_KEYS} keys.
      </p>
    </Figure>
  )
}
