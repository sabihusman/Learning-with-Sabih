'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Figure from './Figure'
import { WORDS, SENTENCE, DIMS, attentionRow } from './attentionData'
import { FADE, MONO } from './vizPalette'
import AttentionHeatmap from './AttentionHeatmap'
import shared from './vizShared.module.css'
import styles from './AttentionViz.module.css'

// three.js / R3F load ONLY here, client-side, on this route. ssr:false keeps the
// 3D scene out of the static export and out of every other page's bundle. The
// loading placeholder reserves the same height so the layout does not jump.
const AttentionScene = dynamic(() => import('./AttentionScene'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 440,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: MONO,
        fontSize: 12,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: FADE,
      }}
    >
      Loading 3D scene…
    </div>
  ),
})

const DEFAULT_QUERY = 7 // "it", the coreference case
// Wide enough that "street" can overtake "animal" in the "it" row (needs about
// +4.7), which the Try this asks the reader to do.
const NUDGE_MIN = -5
const NUDGE_MAX = 5

const labelOf = (id) => WORDS.find((w) => w.id === id)?.label ?? id
const fmt = (x) => (Math.abs(x) < 0.005 ? '0.00' : x.toFixed(2))

export default function AttentionViz() {
  const [selected, setSelected] = useState(DEFAULT_QUERY)
  const [scaled, setScaled] = useState(true)
  const [nudgeKey, setNudgeKey] = useState(5) // "street", the word "it" should NOT pick
  const [nudge, setNudge] = useState(0)

  // A nudge belongs to the selected query's row only; picking another query
  // starts it fresh.
  const selectQuery = (id) => {
    setSelected(id)
    setNudge(0)
  }
  const adjustFor = (queryId) => (queryId === selected && nudge !== 0 ? { [nudgeKey]: nudge } : {})

  const matrix = WORDS.map((w) => attentionRow(w.id, { scaled, adjust: adjustFor(w.id) }).weights)
  const row = selected == null ? null : attentionRow(selected, { scaled, adjust: adjustFor(selected) })
  const rowSum = row ? row.weights.reduce((a, b) => a + b, 0) : null
  const top = row
    ? row.weights
        .map((weight, id) => ({ id, weight }))
        .filter((l) => l.id !== selected)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
    : []
  const maxWeight = row ? Math.max(...row.weights) : 1

  const controls = [
    { label: scaled ? 'Divide by √d: on' : 'Divide by √d: off', onClick: () => setScaled((s) => !s), active: scaled },
    { label: 'Reset nudge', onClick: () => setNudge(0), disabled: nudge === 0 },
  ]

  const readouts = [
    { label: 'selected', value: selected != null ? labelOf(selected) : '—' },
    { label: 'top links', value: top.length ? top.map((l) => `${labelOf(l.id)} ${l.weight.toFixed(2)}`).join(', ') : '—' },
    { label: 'row sum', value: rowSum != null ? rowSum.toFixed(2) : '—' },
  ]

  const status =
    selected == null
      ? 'Pick a word to see its row of attention'
      : `Softmax over "${labelOf(selected)}"'s ${WORDS.length} scores: the weights always add up to 1.00`

  return (
    <Figure
      eyebrow="Transformers"
      title={`Attention in "${SENTENCE.join(' ')}"`}
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis={
        'In the Softmax Lab, pick "it", then drag the "street" score up until its weight passes "animal", and watch every other weight in the row fall to keep the total at 1.00. Then switch scaling off and compare how much sharper the row becomes. Finally, find the word whose row is the flattest, the one spreading its attention most evenly, and say why that makes sense for that word\'s job in the sentence.'
      }
    >
      <div className={styles.lab} data-testid="softmax-lab">
        <fieldset className={`${shared.group} ${styles.fieldset}`}>
          <legend className={shared.groupLabel}>query word</legend>
          {WORDS.map((w) => (
            <button
              key={w.id}
              type="button"
              className={shared.btn}
              aria-pressed={selected === w.id}
              data-testid={`query-${w.id}`}
              onClick={() => selectQuery(w.id)}
            >
              {w.label}
            </button>
          ))}
        </fieldset>

        {row && (
          <>
            <div className={styles.headRow} aria-hidden="true">
              <span>key word</span>
              <span>Q·K</span>
              <span>{scaled ? `÷√${DIMS}` : 'unscaled'}</span>
              <span>softmax weight</span>
            </div>
            <ol className={styles.rows} aria-label={`Attention from "${labelOf(selected)}" to each word`}>
              {WORDS.map((w, j) => (
                <li key={w.id} className={styles.row} data-testid="lab-row" data-weight={row.weights[j]}>
                  <span className={styles.word}>{w.label}</span>
                  <span className={styles.num}>{fmt(row.raw[j])}</span>
                  <span className={styles.num}>{fmt(row.scores[j])}</span>
                  <span className={styles.barCell}>
                    <span className={styles.bar} style={{ width: `${(row.weights[j] / maxWeight) * 100}%` }} />
                    <span className={styles.weight}>{row.weights[j].toFixed(2)}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className={styles.sumRow}>
              <span>sum of weights</span>
              <span data-testid="lab-sum">{rowSum.toFixed(2)}</span>
            </div>

            <div className={styles.nudge}>
              <label className={shared.groupLabel} htmlFor="attn-nudge-key">
                nudge the raw score of
              </label>
              <select
                id="attn-nudge-key"
                className={shared.select}
                value={nudgeKey}
                onChange={(e) => {
                  setNudgeKey(Number(e.target.value))
                  setNudge(0)
                }}
              >
                {WORDS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                    {w.label === 'the' ? ` (${w.id + 1})` : ''}
                  </option>
                ))}
              </select>
              <input
                type="range"
                className={shared.slider}
                min={NUDGE_MIN}
                max={NUDGE_MAX}
                step={0.1}
                value={nudge}
                onChange={(e) => setNudge(Number(e.target.value))}
                aria-label={`Add to the raw score of "${labelOf(nudgeKey)}"`}
                data-testid="nudge"
              />
              <span className={styles.nudgeValue}>
                {nudge > 0 ? '+' : ''}
                {nudge.toFixed(1)}
              </span>
            </div>
          </>
        )}
      </div>

      <AttentionHeatmap matrix={matrix} selected={selected} onSelect={selectQuery} />
      <AttentionScene selected={selected} row={row ? row.weights : null} onSelect={(id) => (id == null ? setSelected(null) : selectQuery(id))} />

      <p className={shared.caption}>
        Attention for the example sentence, computed live: dot products of hand-written query and key vectors,
        scaled, then softmax. Every row sums to 1.00. In a trained model the vectors are learned, not written.
      </p>
    </Figure>
  )
}
