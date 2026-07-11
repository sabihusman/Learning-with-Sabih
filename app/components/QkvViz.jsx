'use client'

import { useState } from 'react'
import Figure from './Figure'
import { WORDS, DIMS, matches, output, topMatches, Q_COLOR, K_COLOR, V_COLOR, INK, FADE } from './qkvData'
import styles from './QkvViz.module.css'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

// ── SVG geometry ──────────────────────────────────────────────────────────────
// VB_W widened from 500 to account for DIMS=5 (was 3): wider Q/K/V cell groups would
// otherwise squeeze the match-bar column down to ~87px from its original ~189px.
const VB_W = 600
const TOP = 56
const ROW_H = 34
const CELL = 14
const CELL_GAP = 3
const GROUP_W = DIMS * (CELL + CELL_GAP)

const LABEL_X = 8
const Q_X = 66
const K_X = Q_X + GROUP_W + 14
const V_X = K_X + GROUP_W + 14
const MATCH_X = V_X + GROUP_W + 20
const BAR_MAX = VB_W - MATCH_X - 44
const rowY = (i) => TOP + i * ROW_H

const OUT_LABEL_Y = rowY(WORDS.length) + 14
const OUT_ROW_Y = OUT_LABEL_Y + 12
const VB_H = OUT_ROW_Y + CELL + 14

// One vector drawn as DIMS small cells whose opacity tracks each value (0..1).
function VecCells({ x, y, vec, color, boxed }) {
  return (
    <g>
      {boxed && (
        <rect x={x - 3} y={y - 3} width={GROUP_W + 3} height={CELL + 6} rx={3} fill="none" stroke={color} strokeWidth={1.4} />
      )}
      {vec.map((val, i) => (
        <rect
          key={i}
          x={x + i * (CELL + CELL_GAP)}
          y={y}
          width={CELL}
          height={CELL}
          rx={2}
          fill={color}
          fillOpacity={0.15 + val * 0.85}
          stroke="#e2e0d8"
          strokeWidth={0.5}
        />
      ))}
    </g>
  )
}

const labelOf = (id) => WORDS.find((w) => w.id === id)?.label ?? id

export default function QkvViz() {
  const [picked, setPicked] = useState(null)

  const ms = picked != null ? matches(picked) : null
  const out = picked != null ? output(picked) : null
  const maxMatch = ms ? Math.max(...ms.map((m) => m.match)) : 1

  const controls = [
    ...WORDS.map((w) => ({ label: w.label, onClick: () => setPicked(w.id), active: picked === w.id })),
    { label: 'Clear', onClick: () => setPicked(null), disabled: picked == null },
  ]

  const readouts = [
    { label: 'picked query', value: picked != null ? labelOf(picked) : '—' },
    {
      label: 'top matches',
      value: picked != null ? topMatches(picked, 2).map((m) => `${m.label} ${m.match.toFixed(2)}`).join(', ') : '—',
    },
  ]
  const status =
    picked != null
      ? `Comparing "${labelOf(picked)}" Query against every Key`
      : 'Pick a word to use its Query'

  return (
    <Figure
      eyebrow="Transformers"
      title="Query, key, and value, step by step"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis={`Pick a word to use it as the Query. Its Query is compared against every word's Key, and the match bars show how strong each comparison is (a higher bar is a higher attention weight). The word then pulls in a blend of every word's Value, weighted by those matches, to form its output row at the bottom. Pick "it" and its Query matches "animal"'s Key most, so its output is mostly "animal"'s Value. The Q, K, and V vectors are hand-set so the example is small, but the match, scaling, and softmax that turn them into weights are the real computation.`}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', maxWidth: 520, height: 'auto', display: 'block', margin: '0 auto' }}
        aria-label="Each word shows a Query, Key, and Value vector as small cells. Picking a word compares its Query against every Key to produce match weights, then blends the Values into an output."
      >
        {/* column headers */}
        <text x={LABEL_X} y={TOP - 12} fontSize={9.5} fill={FADE} fontFamily={MONO} letterSpacing="0.04em">word</text>
        <text x={Q_X} y={TOP - 12} fontSize={9.5} fill={Q_COLOR} fontFamily={MONO} fontWeight={700}>Q query</text>
        <text x={K_X} y={TOP - 12} fontSize={9.5} fill={K_COLOR} fontFamily={MONO} fontWeight={700}>K key</text>
        <text x={V_X} y={TOP - 12} fontSize={9.5} fill={V_COLOR} fontFamily={MONO} fontWeight={700}>V value</text>
        {picked != null && (
          <text x={MATCH_X} y={TOP - 12} fontSize={9.5} fill={FADE} fontFamily={MONO} letterSpacing="0.04em">
            match (Q . K)
          </text>
        )}

        {/* word rows */}
        {WORDS.map((w, i) => {
          const y = rowY(i)
          const m = ms?.find((x) => x.id === w.id)
          const isPicked = picked === w.id
          return (
            <g key={w.id} style={{ cursor: 'pointer' }} onClick={() => setPicked(w.id)}>
              <rect
                x={2}
                y={y - 5}
                width={VB_W - 4}
                height={ROW_H - 4}
                rx={4}
                fill={isPicked ? '#fbeeec' : 'transparent'}
                stroke={isPicked ? V_COLOR : 'transparent'}
                strokeWidth={1}
              />
              <text x={LABEL_X} y={y + CELL - 2} fontSize={11} fill={INK} fontFamily={MONO} fontWeight={isPicked ? 700 : 400}>
                {w.label}
              </text>
              <VecCells x={Q_X} y={y} vec={w.q} color={Q_COLOR} boxed={isPicked} />
              <VecCells x={K_X} y={y} vec={w.k} color={K_COLOR} />
              <VecCells x={V_X} y={y} vec={w.v} color={V_COLOR} />

              {m && (
                <g key={`m-${picked}-${w.id}`}>
                  <rect
                    className={styles.matchBar}
                    style={{ animationDelay: `${i * 90}ms` }}
                    x={MATCH_X}
                    y={y + 1}
                    width={Math.max((m.match / maxMatch) * BAR_MAX, 1)}
                    height={CELL - 2}
                    rx={2}
                    fill={K_COLOR}
                    opacity={0.35 + m.weight * 0.65}
                  />
                  <text x={MATCH_X + BAR_MAX + 6} y={y + CELL - 2} fontSize={10} fill={INK} fontFamily={MONO} fontWeight={700}>
                    {`${Math.round(m.weight * 100)}%`}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* output: the picked word's Value blend */}
        {out && (
          <g>
            <text x={LABEL_X} y={OUT_LABEL_Y} fontSize={10} fill={FADE} fontFamily={MONO} letterSpacing="0.04em">
              {`output for "${labelOf(picked)}"  =  weighted blend of Values`}
            </text>
            <VecCells x={V_X} y={OUT_ROW_Y} vec={out} color={V_COLOR} boxed />
            <text x={V_X - 26} y={OUT_ROW_Y + CELL - 2} fontSize={11} fill={INK} fontFamily={MONO}>
              {'→'}
            </text>
          </g>
        )}
      </svg>

      <p className={styles.formula}>
        Compare my Query to your Key; the better the match, the more of your Value I take.
      </p>
      <p className={styles.note}>
        The Q, K, and V vectors are hand-authored to illustrate the mechanism. A real model learns them from each
        word and computes the matches on the fly.
      </p>
    </Figure>
  )
}
