'use client'

import { useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './BeamSearchViz.module.css'
import {
  TREE,
  ALL_NODES,
  LAYOUT,
  PROMPT,
  MAX_BEAM_WIDTH,
  greedyDecode,
  beamSearch,
  pathNodeIdSet,
  pathEdgeKeySet,
} from './beamSearchData'

const ACCENT = '#c0392b' // greedy
const BEAM = '#2f8f63' // beam search
const FADE = '#c8c4bc' // untraveled tree
const INK = '#1a1a1a'

// Computed once: greedy never changes, the tree is fixed.
const GREEDY = greedyDecode(TREE)
const GREEDY_NODE_IDS = pathNodeIdSet(GREEDY.ids)
const GREEDY_EDGE_KEYS = pathEdgeKeySet(GREEDY.ids)

const fmtLogProb = (v) => v.toFixed(3)

export default function BeamSearchViz() {
  const [k, setK] = useState(2)
  const [selected, setSelected] = useState(0)

  const beams = useMemo(() => beamSearch(TREE, k), [k])
  const selectedBeam = beams[Math.min(selected, beams.length - 1)]

  const changeK = (nextK) => {
    setK(nextK)
    setSelected(0) // the winner is always index 0; re-selecting it keeps the emphasis meaningful after k changes
  }

  const winner = beams[0]
  const winnerMatchesGreedy = winner.ids.join('|') === GREEDY.ids.join('|')
  const advantage = winner.logProb - GREEDY.logProb

  const selectedNodeIds = pathNodeIdSet(selectedBeam.ids)
  const selectedEdgeKeys = pathEdgeKeySet(selectedBeam.ids)
  // Only the part of the selected beam that diverges from greedy gets its own green
  // draw pass; the shared prefix (at minimum the root) is already covered by the red
  // greedy layer. At k=1 the selected beam IS the greedy path, so this is empty and
  // the figure shows a single red walk, not two overlapping paths.
  const beamOnlyNodeIds = new Set([...selectedNodeIds].filter((id) => !GREEDY_NODE_IDS.has(id)))
  const beamOnlyEdgeKeys = new Set([...selectedEdgeKeys].filter((key) => !GREEDY_EDGE_KEYS.has(key)))

  // Other surviving beams (not selected, not identical to greedy — greedy's own path
  // is already drawn by the red layer) get a faint dashed trace so their existence is
  // visible without competing with the selected walk.
  const otherBeams = beams.filter((b, i) => i !== selected && b.ids.join('|') !== GREEDY.ids.join('|'))
  const otherEdgeKeys = new Set(otherBeams.flatMap((b) => [...pathEdgeKeySet(b.ids)]))
  const otherNodeIds = new Set(otherBeams.flatMap((b) => [...pathNodeIdSet(b.ids)]))

  const pos = (id) => LAYOUT.positions.get(id)

  const status = winnerMatchesGreedy
    ? `Beam width ${k} collapses to the greedy walk: "${GREEDY.tokens.join(' ')}" (log-probability ${fmtLogProb(GREEDY.logProb)}).`
    : `Beam search (width ${k}) finds "${winner.tokens.join(' ')}" (${fmtLogProb(winner.logProb)}), beating greedy's "${GREEDY.tokens.join(' ')}" (${fmtLogProb(GREEDY.logProb)}) by ${fmtLogProb(advantage)}.`

  const readouts = [
    { label: 'beam width k', value: k },
    { label: 'greedy log-prob', value: fmtLogProb(GREEDY.logProb) },
    { label: 'best beam log-prob', value: fmtLogProb(winner.logProb) },
    { label: 'beam advantage', value: winnerMatchesGreedy ? '0.000' : `+${fmtLogProb(advantage)}` },
  ]

  return (
    <Figure
      eyebrow="Decoding"
      title="Beam search vs greedy decoding over a token-probability tree"
      status={status}
      readouts={readouts}
      tryThis="Start at k=1: the highlighted walk is exactly greedy, one path, no alternatives kept. Raise k to 2: a second, cheaper-looking first token opens onto a near-certain follow-up, and its total log-probability overtakes greedy's. Greedy could never find that path, because it never looks past the single best next token. Click a beam chip below the tree to trace a different surviving sequence."
    >
      <div className={styles.prompt}>
        <span className={styles.promptLabel}>prompt</span>
        <span className={styles.promptText}>{PROMPT}</span>
        <span className={styles.promptBlank}>___</span>
      </div>

      <div className={styles.sliderRow}>
        <label htmlFor="beam-k" className={styles.sliderLabel}>
          <span>beam width k</span>
          <span className={styles.sliderValue}>{k}</span>
        </label>
        <input
          id="beam-k"
          type="range"
          min={1}
          max={MAX_BEAM_WIDTH}
          step={1}
          value={k}
          onChange={(e) => changeK(Number(e.target.value))}
          className={styles.slider}
          aria-label="Beam width k"
        />
      </div>

      <svg
        viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
        className={styles.svg}
        role="img"
        aria-label={`Token probability tree; greedy walk in red, beam search walk in green at width ${k}`}
      >
        {LAYOUT.edges.map(({ from, to }) => {
          const key = `${from}>${to}`
          const a = pos(from)
          const b = pos(to)
          let stroke = FADE
          let width = 1
          let dash = undefined
          if (otherEdgeKeys.has(key)) {
            stroke = BEAM
            width = 1.4
            dash = '3 2'
          }
          if (GREEDY_EDGE_KEYS.has(key)) {
            stroke = ACCENT
            width = 2.4
            dash = undefined
          }
          if (beamOnlyEdgeKeys.has(key)) {
            stroke = BEAM
            width = 2.4
            dash = undefined
          }
          return <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={width} strokeDasharray={dash} opacity={stroke === FADE ? 0.5 : 1} />
        })}

        {ALL_NODES.map((n) => {
          const p = pos(n.id)
          const onGreedy = GREEDY_NODE_IDS.has(n.id)
          const onBeamOnly = beamOnlyNodeIds.has(n.id)
          const onOther = otherNodeIds.has(n.id)
          const emphasized = onGreedy || onBeamOnly || onOther
          const fill = onGreedy ? ACCENT : onBeamOnly ? BEAM : onOther ? '#eaf4ef' : '#ffffff'
          const stroke = onGreedy ? ACCENT : onBeamOnly ? BEAM : onOther ? BEAM : '#b8b4aa'
          const textColor = onGreedy || onBeamOnly ? '#ffffff' : INK
          const r = emphasized ? (onGreedy || onBeamOnly ? 12 : 9) : 3
          return (
            <g key={n.id}>
              <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={stroke} strokeWidth={emphasized ? 1.6 : 1} />
              {emphasized && n.token !== 'START' && (
                <text x={p.x} y={p.y + 3.5} className={styles.nodeText} fill={textColor} textAnchor="middle">
                  {n.token}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.swatch} style={{ background: ACCENT }} /> greedy walk
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatch} style={{ background: BEAM }} /> selected beam walk
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchDashed}`} /> other surviving beams
        </span>
      </div>

      <div className={styles.chips} role="group" aria-label="Surviving beam sequences, ranked by log-probability">
        {beams.map((b, i) => (
          <button
            key={b.ids.join(',')}
            type="button"
            className={`${styles.chip} ${i === selected ? styles.chipActive : ''}`}
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
          >
            <span className={styles.chipRank}>#{i + 1}</span>
            <span className={styles.chipTokens}>{b.tokens.join(' ')}</span>
            <span className={styles.chipLogProb}>{fmtLogProb(b.logProb)}</span>
          </button>
        ))}
      </div>

      <p className={styles.caption}>
        The tree, both walks, and every log-probability shown are computed live by real greedy and beam-search
        functions over the tree data. The tree itself and its edge probabilities are hand-authored, not a real
        model&apos;s output; a real decoder searches over its full vocabulary at every step, not three or four
        fixed candidates.
      </p>
    </Figure>
  )
}
