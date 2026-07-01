'use client'

import { useEffect, useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './IndexViz.module.css'
import { ROWS, INDEX, N, QUERIES, buildFrames, queryLabel, querySql } from './indexData'

const PLAY_MS = 700

// ── SVG geometry ────────────────────────────────────────────────────────────────
const PADX = 8
const PADT = 12
const HEAD_H = 22
const ROW_H = 24
const BAR = 3
const ID_W = 34
const SCORE_W = 58
const TABLE_W = ID_W + SCORE_W
const GAP = 30
const IX_SCORE_W = 50
const IX_ARROW_W = 48
const INDEX_W = IX_SCORE_W + IX_ARROW_W
const TABLE_X = PADX + BAR
const INDEX_X = TABLE_X + TABLE_W + GAP
const VB_H = PADT + HEAD_H + N * ROW_H + PADT
const rowY = (i) => PADT + HEAD_H + i * ROW_H

// palette (shared project tokens / the searching-topic colours)
const GREEN = '#1f6f5c'
const AMBER_FILL = '#fdf3ee'
const AMBER_STROKE = '#c0392b'
const DIM_FILL = '#efece4'
const DIM_TEXT = '#b9b6ae'
const IDLE_FILL = '#fffefb'
const IDLE_STROKE = '#e2e0d8'
const INK = '#1a1a1a'
const FADE = '#9b9892'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

// classify a physical-table row for the current frame
function tableKind(rowIndex, rowId, f) {
  if (!f) return 'idle'
  const matched = f.matched.includes(rowId)
  if (f.mode === 'scan') {
    if (rowIndex === f.cursor) return 'cursor'
    if (matched) return 'match'
    if (rowIndex < f.cursor) return 'seen'
    return 'idle'
  }
  // index mode: the table just lights up the matched rows, dim otherwise
  return matched ? 'match' : 'dim'
}

// classify a sorted index entry for the current frame
function indexKind(pos, f) {
  if (!f) return 'active'
  if (f.phase === 'search') {
    if (pos === f.bsMid) return 'mid'
    if (pos < f.bsLo || pos > f.bsHi) return 'elim'
    return 'active'
  }
  if (f.phase === 'found') return pos === f.located ? 'match' : 'dim'
  if (f.phase === 'notfound') return 'dim'
  // walk
  if (pos === f.walk) return 'cursor'
  if (f.matched.includes(INDEX[pos].id)) return 'match'
  return 'dim'
}

const fillFor = (k) => (k === 'match' ? GREEN : k === 'cursor' || k === 'mid' ? AMBER_FILL : k === 'elim' || k === 'seen' || k === 'dim' ? DIM_FILL : IDLE_FILL)
const strokeFor = (k) => (k === 'match' ? GREEN : k === 'cursor' || k === 'mid' ? AMBER_STROKE : IDLE_STROKE)
const textFor = (k) => (k === 'match' ? '#ffffff' : k === 'elim' || k === 'seen' || k === 'dim' ? DIM_TEXT : INK)

export default function IndexViz() {
  const [query, setQuery] = useState(QUERIES[0])
  const [indexed, setIndexed] = useState(false)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const frames = useMemo(() => buildFrames(query, indexed), [query, indexed])
  const total = frames.length
  const done = step >= total
  const f = step > 0 ? frames[step - 1] : null
  const isPlaying = playing && !done

  // Auto-advance with setInterval (never requestAnimationFrame) so stepping keeps
  // progressing in a backgrounded tab. Keyed on `done` so it tears down at the end and
  // on the frame identity so it rebinds when the query or index toggle changes; no
  // setState in the effect body.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(total, s + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done, total])

  const onStep = () => setStep((s) => Math.min(total, s + 1))
  const reset = () => {
    setPlaying(false)
    setStep(0)
  }
  const setIndex = (v) => {
    setPlaying(false)
    setStep(0)
    setIndexed(v)
  }
  const chooseQuery = (q) => {
    setPlaying(false)
    setStep(0)
    setQuery(q)
  }
  const clickRow = (row) => chooseQuery({ id: `row-${row.id}`, type: 'eq', value: row.score, label: `score = ${row.score}` })

  const examined = f ? f.examined : 0
  const matchCount = f ? f.matched.length : 0

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]

  const readouts = [
    { label: 'rows examined', value: examined },
    { label: 'total rows', value: N },
    { label: 'matches', value: matchCount },
  ]

  const status = f
    ? f.status
    : indexed
      ? `Index on: binary-search the sorted index for "${queryLabel(query)}". Step or play.`
      : `No index: full scan for "${queryLabel(query)}". Step or play to check every row.`

  const VB_W = indexed ? INDEX_X + INDEX_W + PADX : TABLE_X + TABLE_W + PADX

  return (
    <Figure
      eyebrow="Indexing"
      title="How an index turns a full scan into a jump"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Run a query with the index off: the engine does a full scan, checking every row top to bottom, and rows examined climbs to the whole table. Turn the index on and run the same query: it binary-searches the sorted index, jumps almost straight to the match, and rows examined stays tiny. Pick a between query to watch the B-tree find the range start and then walk the sorted order, something an exact-match structure could not do. Click any row to search its value."
    >
      <div className={styles.controls}>
        <div className={styles.line}>
          <span className={styles.label}>index</span>
          <button
            type="button"
            className={`${styles.toggle} ${indexed ? styles.toggleOn : ''}`}
            aria-pressed={indexed}
            onClick={() => setIndex(!indexed)}
          >
            {indexed ? 'on (B-tree)' : 'off'}
          </button>
        </div>
        <div className={styles.line}>
          <span className={styles.label}>query</span>
          <select className={styles.select} value={QUERIES.some((q) => q.id === query.id) ? query.id : 'custom'} onChange={(e) => chooseQuery(QUERIES.find((q) => q.id === e.target.value) || query)} aria-label="Query">
            {QUERIES.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
            {!QUERIES.some((q) => q.id === query.id) && <option value="custom">{query.label}</option>}
          </select>
        </div>
      </div>

      <div className={styles.plotWrap}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={styles.svg}
          style={{ maxWidth: indexed ? 520 : 240 }}
          role="img"
          aria-label={`A ${N}-row users table in physical order on the left${indexed ? ', and a sorted B-tree index on the score column on the right' : ''}. The current strategy highlights the rows or index entries it examines.`}
        >
          {/* table panel */}
          <text x={TABLE_X} y={PADT + 8} fontSize={9} fill={FADE} fontFamily={MONO} letterSpacing="0.04em">
            table (physical)
          </text>
          <text x={TABLE_X + 4} y={PADT + HEAD_H - 3} fontSize={8.5} fill={FADE} fontFamily={MONO}>
            id
          </text>
          <text x={TABLE_X + ID_W + 4} y={PADT + HEAD_H - 3} fontSize={8.5} fill={FADE} fontFamily={MONO}>
            score
          </text>
          {ROWS.map((row, i) => {
            const kind = tableKind(i, row.id, f)
            const y = rowY(i)
            return (
              <g key={row.id} onClick={() => clickRow(row)} style={{ cursor: 'pointer' }} className={styles.row}>
                {kind === 'cursor' && <rect x={PADX} y={y} width={BAR} height={ROW_H - 2} fill={AMBER_STROKE} />}
                {kind === 'match' && <rect x={PADX} y={y} width={BAR} height={ROW_H - 2} fill={GREEN} />}
                <rect x={TABLE_X} y={y} width={TABLE_W} height={ROW_H - 2} rx={2} fill={fillFor(kind)} stroke={strokeFor(kind)} strokeWidth={kind === 'cursor' ? 1.6 : 1} />
                <text x={TABLE_X + 6} y={y + ROW_H / 2 + 2} fontSize={10.5} fill={textFor(kind)} fontFamily={MONO}>
                  {row.id}
                </text>
                <text x={TABLE_X + ID_W + 6} y={y + ROW_H / 2 + 2} fontSize={10.5} fill={textFor(kind)} fontFamily={MONO} fontWeight={700}>
                  {row.score}
                </text>
              </g>
            )
          })}

          {/* index panel */}
          {indexed && (
            <>
              <text x={INDEX_X} y={PADT + 8} fontSize={9} fill={FADE} fontFamily={MONO} letterSpacing="0.04em">
                index on score (sorted)
              </text>
              <text x={INDEX_X + 4} y={PADT + HEAD_H - 3} fontSize={8.5} fill={FADE} fontFamily={MONO}>
                score
              </text>
              <text x={INDEX_X + IX_SCORE_W + 4} y={PADT + HEAD_H - 3} fontSize={8.5} fill={FADE} fontFamily={MONO}>
                {'→ row'}
              </text>
              {INDEX.map((e, p) => {
                const kind = indexKind(p, f)
                const y = rowY(p)
                return (
                  <g key={p}>
                    <rect x={INDEX_X} y={y} width={INDEX_W} height={ROW_H - 2} rx={2} fill={fillFor(kind)} stroke={strokeFor(kind)} strokeWidth={kind === 'mid' || kind === 'cursor' ? 1.6 : 1} />
                    <text x={INDEX_X + 6} y={y + ROW_H / 2 + 2} fontSize={10.5} fill={textFor(kind)} fontFamily={MONO} fontWeight={700}>
                      {e.score}
                    </text>
                    <text x={INDEX_X + IX_SCORE_W + 6} y={y + ROW_H / 2 + 2} fontSize={9.5} fill={kind === 'match' ? '#ffffff' : FADE} fontFamily={MONO}>
                      {`→ ${e.id}`}
                    </text>
                  </g>
                )
              })}
            </>
          )}
        </svg>
      </div>

      <pre className={styles.sql}>{querySql(query)}</pre>

      <p className={styles.note}>
        The scan and the index lookup are real: rows examined is the actual number of rows or index entries the chosen
        strategy touches on this fixed {N}-row table. The index shown is a simplified B-tree, a sorted copy of the score
        column; the table is kept tiny for clarity, where real tables have millions of rows and the gap is enormous.
      </p>
    </Figure>
  )
}
