'use client'

import { useState } from 'react'
import Figure from './Figure'
import {
  COLUMNS,
  MODEL_COLUMNS,
  ROWS,
  binBoundaries,
  tokenFor,
  buildModel,
} from './similarRowsData'
import styles from './SimilarRowsViz.module.css'

// Static-on-change figure: every control change recomputes the whole pipeline
// synchronously from the data module. No timers, no animation.

const STAGES = [
  { title: 'Raw table', blurb: 'Sixteen customers, five columns, exactly as stored.' },
  { title: 'Columns classified', blurb: 'Categorical, numeric, or identifier. The id names a row; it says nothing about the customer, so the model excludes it.' },
  { title: 'Tokenized', blurb: 'Categorical values become tokens as-is. Each numeric column is cut into four quantile bins over its sixteen values, and the bin is the token.' },
  { title: 'Rows as bags of tokens', blurb: 'Each row is now just an unordered set of tokens. The table structure is gone; only co-occurrence remains.' },
  { title: 'Ranked neighbours', blurb: 'Tokens that share rows get PPMI-weighted vectors; a row is the mean of its token vectors; neighbours rank by cosine.' },
]

const COL_LABELS = {
  contract: 'contract type',
  payment: 'payment method',
  charge: 'monthly charge',
  tenure: 'tenure months',
}

export default function SimilarRowsViz() {
  const [stage, setStage] = useState(0)
  const [selected, setSelected] = useState(0)
  const [included, setIncluded] = useState([...MODEL_COLUMNS])

  const model = buildModel(included)
  const selRanking = model.rankings[selected]
  const pairTotal = model.total / 2

  const toggleColumn = (key) => {
    setIncluded((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...MODEL_COLUMNS.filter((k) => k === key || cur.includes(k))],
    )
  }

  const controls = [
    { label: 'Back', onClick: () => setStage((s) => Math.max(0, s - 1)), disabled: stage === 0 },
    { label: 'Next', onClick: () => setStage((s) => Math.min(STAGES.length - 1, s + 1)), variant: 'primary', disabled: stage === STAGES.length - 1 },
  ]

  const readouts = [
    { label: 'stage', value: `${stage + 1} of ${STAGES.length}` },
    { label: 'columns in', value: included.length },
    { label: 'vocabulary', value: `${model.vocab.length} tokens` },
    { label: 'token pairs', value: pairTotal },
    { label: 'selected row', value: ROWS[selected].id },
    { label: 'nearest', value: stage === 4 ? `${selRanking[0].id} at ${selRanking[0].cos.toFixed(3)}` : '—' },
  ]

  const status = `Stage ${stage + 1}, ${STAGES[stage].title.toLowerCase()}: ${STAGES[stage].blurb}`

  const chargeCuts = binBoundaries('charge')
  const tenureCuts = binBoundaries('tenure')

  const rowButton = (i, children, extraClass = '') => (
    <button
      type="button"
      onClick={() => setSelected(i)}
      aria-pressed={selected === i}
      className={`${styles.rowBtn} ${selected === i ? styles.rowSelected : ''} ${extraClass}`}
    >
      {children}
    </button>
  )

  return (
    <Figure
      eyebrow="Vectors over tables"
      title="From a churn table to ranked similar rows"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Step through the five stages once with the default row, then jump to the last stage and click other rows: the five short-tenure month-to-month customers find each other, the five two-year customers find each other, and the in-between rows split the difference. Then start removing columns. Select C04 and turn tenure off: its similarity to the top rows snaps to a perfect score, because tenure was the only thing separating them. Select C16 and turn contract type off: with its two-year token gone, it defects to the electronic-check side of the table."
    >
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>columns</span>
        {MODEL_COLUMNS.map((key) => {
          const on = included.includes(key)
          const lastOn = on && included.length === 1
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleColumn(key)}
              aria-pressed={on}
              disabled={lastOn}
              title={lastOn ? 'at least one column must stay in' : undefined}
              className={`${styles.toggle} ${on ? styles.toggleOn : ''}`}
            >
              {COL_LABELS[key]}
            </button>
          )
        })}
      </div>

      {/* ── STAGES 1-3: the table, progressively transformed ─────────────── */}
      {stage <= 2 && (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                {COLUMNS.map((c) => {
                  const excludedId = stage >= 1 && c.kind === 'identifier'
                  const excludedCol = stage >= 1 && c.kind !== 'identifier' && !included.includes(c.key)
                  return (
                    <th key={c.key} className={excludedId || excludedCol ? styles.colExcluded : ''}>
                      {c.label}
                      {stage >= 1 && (
                        <span className={`${styles.kind} ${excludedId ? styles.kindExcluded : ''}`}>
                          {c.kind === 'identifier' ? 'identifier, excluded' : excludedCol ? `${c.kind}, toggled off` : c.kind}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={r.id} className={selected === i ? styles.trSelected : ''}>
                  <td className={stage >= 1 ? styles.colExcluded : ''}>{rowButton(i, r.id)}</td>
                  {MODEL_COLUMNS.map((key) => {
                    const off = stage >= 1 && !included.includes(key)
                    const col = COLUMNS.find((c) => c.key === key)
                    let cell
                    if (stage <= 1 || col.kind === 'categorical') cell = String(r[key])
                    else cell = null
                    return (
                      <td key={key} className={off ? styles.colExcluded : ''}>
                        {stage === 2 && !off ? (
                          <span className={styles.token}>
                            {tokenFor(key, r)}
                            {col.kind === 'numeric' && <span className={styles.rawValue}>{r[key]}</span>}
                          </span>
                        ) : (
                          cell ?? String(r[key])
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stage === 2 && (
        <p className={styles.binLegend}>
          Bin boundaries, computed from the sixteen values of each column. monthly
          charge: Q1 up to {chargeCuts[0]}, Q2 up to {chargeCuts[1]}, Q3 up to {chargeCuts[2]},
          Q4 above. tenure months: Q1 up to {tenureCuts[0]}, Q2 up to {tenureCuts[1]},
          Q3 up to {tenureCuts[2]}, Q4 above.
        </p>
      )}

      {/* ── STAGE 4: unordered bags ──────────────────────────────────────── */}
      {stage === 3 && (
        <ul className={styles.bags}>
          {ROWS.map((r, i) => (
            <li key={r.id} className={styles.bagRow}>
              {rowButton(i, r.id)}
              <span className={styles.bagTokens}>
                {[...model.bags[i]].sort().map((t) => (
                  <span key={t} className={styles.token}>
                    {t}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* ── STAGE 5: ranked neighbours for the selected row ──────────────── */}
      {stage === 4 && (
        <div className={styles.ranking}>
          <div className={styles.anchorRow}>
            <span className={styles.anchorLabel}>neighbours of</span>
            {rowButton(selected, ROWS[selected].id)}
            <span className={styles.bagTokens}>
              {[...model.bags[selected]].sort().map((t) => (
                <span key={t} className={styles.token}>
                  {t}
                </span>
              ))}
            </span>
          </div>
          <ol className={styles.neighbours}>
            {selRanking.map((e, rank) => (
              <li key={e.id} className={`${styles.neighbourRow} ${rank < 3 ? styles.topThree : ''}`}>
                <span className={styles.rank}>{rank + 1}</span>
                {rowButton(e.j, e.id)}
                <span className={styles.cosBarWrap}>
                  <span className={styles.cosBar} style={{ width: `${Math.max(0, e.cos) * 100}%` }} />
                </span>
                <span className={styles.cosNum}>{e.cos.toFixed(3)}</span>
                <span className={styles.bagTokens}>
                  {[...model.bags[e.j]].sort().map((t) => (
                    <span key={t} className={`${styles.token} ${model.bags[selected].includes(t) ? styles.tokenShared : ''}`}>
                      {t}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
          <p className={styles.legendNote}>shared tokens with the selected row are filled in</p>
        </div>
      )}

      <p className={styles.caption}>
        The sixteen-row table is authored once and frozen; everything downstream is
        computed live: the quantile bins, the token vocabulary, the co-occurrence
        counts, the PPMI weights (log base 2), every row vector, and every cosine in
        the ranking. Real systems train a neural network to learn vectors like these;
        counting co-occurrence and weighting it with PPMI is a simplified stand-in
        that reaches a similar shape of result by a cruder route. The clusters you
        can see in the rankings are not labelled anywhere in the data: they emerge
        from which tokens share rows, or they do not.
      </p>
    </Figure>
  )
}
