'use client'

import { useState } from 'react'
import Figure from './Figure'
import { WORDS, SENTENCE, HEADS, weightsFor, topLinks, INK } from './transformerData'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

// ── SVG geometry ──────────────────────────────────────────────────────────────
// Three panels side by side, one per head, each showing the same word column at
// the same y-positions so a reader can compare across panels at a glance.
const PANEL_W = 172
const PANEL_GAP = 22
const HEADER_H = 20
const TOP = HEADER_H + 16
const ROW_H = 26
const LABEL_X = 4
const NODE_X = 64
const N = WORDS.length

const VB_W = HEADS.length * PANEL_W + (HEADS.length - 1) * PANEL_GAP
const VB_H = TOP + N * ROW_H + 12

const rowY = (id) => TOP + id * ROW_H + ROW_H / 2
const panelX = (panelIndex) => panelIndex * (PANEL_W + PANEL_GAP)

const labelOf = (id) => WORDS.find((w) => w.id === id)?.label ?? id

const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

// Arc between two rows in the same panel, bulging right of the node column; a
// deeper bulge for rows further apart (same convention as the DNS figure's
// non-adjacent-message arcs) so overlapping links stay readable.
function arcPath(x, yA, yB, distance) {
  const bulge = 16 + distance * 7
  return `M ${x} ${yA} C ${x + bulge} ${yA} ${x + bulge} ${yB} ${x} ${yB}`
}

function HeadPanel({ head, panelIndex, selected, onSelect }) {
  const x0 = panelX(panelIndex)
  const headRgb = hexToRgb(head.color)
  const weights = selected != null ? weightsFor(head, selected) : {}

  return (
    <g transform={`translate(${x0}, 0)`}>
      <text x={LABEL_X} y={HEADER_H} fontSize={11} fontWeight={700} fill={head.color} fontFamily={MONO} letterSpacing="0.03em">
        {head.name}
      </text>

      {selected != null &&
        WORDS.filter((w) => w.id !== selected).map((w) => {
          const wt = weights[w.id] ?? 0
          if (wt < 0.05) return null
          return (
            <path
              key={w.id}
              d={arcPath(NODE_X, rowY(selected), rowY(w.id), Math.abs(w.id - selected))}
              fill="none"
              stroke={head.color}
              strokeWidth={1 + wt * 4}
              opacity={0.25 + wt * 0.65}
            />
          )
        })}

      {WORDS.map((w) => {
        const isPicked = selected === w.id
        const wt = selected != null ? (weights[w.id] ?? 0) : 0
        const dotOpacity = isPicked ? 1 : selected != null ? 0.3 + wt * 0.65 : 0.55
        return (
          <g key={w.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(w.id)}>
            <rect
              x={0}
              y={rowY(w.id) - ROW_H / 2 + 2}
              width={PANEL_W - 6}
              height={ROW_H - 4}
              rx={4}
              fill={isPicked ? `rgba(${headRgb[0]}, ${headRgb[1]}, ${headRgb[2]}, 0.12)` : 'transparent'}
            />
            <circle cx={NODE_X} cy={rowY(w.id)} r={isPicked ? 4 : 2.5} fill={head.color} opacity={dotOpacity} />
            <text
              x={LABEL_X}
              y={rowY(w.id) + 4}
              fontSize={11}
              fill={isPicked ? head.color : INK}
              fontWeight={isPicked ? 700 : 400}
              fontFamily={MONO}
            >
              {w.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export default function TransformersViz() {
  const [selected, setSelected] = useState(null)

  const controls = [{ label: 'Clear selection', onClick: () => setSelected(null), disabled: selected == null }]

  const readouts = [
    { label: 'selected', value: selected != null ? labelOf(selected) : '—' },
    ...HEADS.map((head) => {
      const top = selected != null ? topLinks(head, selected, 1)[0] : null
      return {
        label: head.name,
        value: top ? `${labelOf(selected)} to ${labelOf(top.id)} (${top.weight.toFixed(2)})` : '—',
      }
    }),
  ]

  const status =
    selected != null
      ? `Attention from "${labelOf(selected)}" across all three heads`
      : 'Click a word to see its links in every head'

  return (
    <Figure
      eyebrow="Transformers"
      title={`Multi-head attention over "${SENTENCE.join(' ')}"`}
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis={
        'This is the same sentence as the attention topic, but now there are three heads shown at once, one panel each. Click a word to draw its links in every panel at the same time: Coreference links "it" back to "animal", Previous word links each token to the one before it, and Verb to arguments links a verb like "cross" to its subject and object. A transformer runs many heads like these in parallel and stacks them in layers; these weights are hand-set to show the idea, not computed.'
      }
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', maxWidth: 580, height: 'auto', display: 'block', margin: '0 auto' }}
        aria-label="Three panels, one per attention head, each showing the same sentence. Clicking a word draws its attention links in all three panels at once, colored by head."
      >
        {HEADS.map((head, i) => (
          <HeadPanel key={head.id} head={head} panelIndex={i} selected={selected} onSelect={setSelected} />
        ))}
      </svg>
    </Figure>
  )
}
