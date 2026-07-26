'use client'

// Plain SVG/DOM only: no three.js, no dynamic() wrapper needed. Reuses the
// exact weight source AttentionScene.jsx already uses (weightsFrom), so the
// two views are always showing the same numbers, just two different ways.

import { WORDS, weightsFrom, ACCENT, INK, FADE, PAPER } from './attentionData'
import styles from './AttentionHeatmap.module.css'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

// interpolate between two hex colors by t in [0,1] (same approach as
// AttentionScene's lerpColor, kept local so attentionData.js stays data-only)
const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const PAPER_RGB = hexToRgb(PAPER)
const ACCENT_RGB = hexToRgb(ACCENT)
const lerpColor = (t) => {
  const c = PAPER_RGB.map((a, i) => Math.round(a + (ACCENT_RGB[i] - a) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

// ── SVG geometry ──────────────────────────────────────────────────────────────
const N = WORDS.length
const CELL = 26
const GAP = 2
const PITCH = CELL + GAP
const ROW_LABEL_W = 76
const COL_LABEL_H = 76
const PAD = 8
const GRID_SIZE = N * PITCH - GAP
const GRID_X = ROW_LABEL_W + PAD
const GRID_Y = COL_LABEL_H + PAD
const VB_W = GRID_X + GRID_SIZE + PAD
const VB_H = GRID_Y + GRID_SIZE + PAD

const cellX = (col) => GRID_X + col * PITCH
const cellY = (row) => GRID_Y + row * PITCH

// The full N x N matrix, source word (row) -> target word (column). The
// diagonal is never in weightsFrom's output (a word has no outgoing weight
// to itself), so it is kept as a distinct "not applicable" cell rather than
// treated as a measured zero.
function buildMatrix() {
  let max = 0
  const rows = WORDS.map((rowWord) => {
    const weights = weightsFrom(rowWord.id)
    return WORDS.map((colWord) => {
      if (colWord.id === rowWord.id) return null
      const w = weights[colWord.id] ?? 0
      if (w > max) max = w
      return w
    })
  })
  return { rows, max: max || 1 }
}

export default function AttentionHeatmap({ selected, onSelect }) {
  const { rows, max } = buildMatrix()

  const toggleRow = (id) => {
    onSelect(id)
  }
  const onRowKeyDown = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleRow(id)
    }
  }

  return (
    <div className={styles.wrap}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        role="img"
        aria-label={`Attention weight heatmap: ${N} rows and ${N} columns, one per word in the sentence, in reading order. Each cell shows how strongly the row word attends to the column word, shaded relative to the strongest weight in the grid; these are hand-set relative strengths, not probabilities, and diagonal cells are not applicable. ${selected != null ? `Row "${WORDS.find((w) => w.id === selected)?.label}" is selected.` : 'No row is selected.'}`}
      >
        {/* column labels, rotated so 10 words fit in narrow columns */}
        {WORDS.map((colWord, col) => (
          <text
            key={colWord.id}
            x={cellX(col) + CELL / 2}
            y={GRID_Y - 8}
            fontSize={10.5}
            fill={FADE}
            fontFamily={MONO}
            textAnchor="end"
            transform={`rotate(-45 ${cellX(col) + CELL / 2} ${GRID_Y - 8})`}
          >
            {colWord.label}
          </text>
        ))}

        {/* rows: label + cells + one invisible full-row hit target */}
        {WORDS.map((rowWord, row) => {
          const isSelected = selected === rowWord.id
          return (
            <g key={rowWord.id}>
              <text
                x={ROW_LABEL_W - 8}
                y={cellY(row) + CELL / 2 + 4}
                fontSize={11}
                fill={isSelected ? ACCENT : INK}
                fontFamily={MONO}
                fontWeight={isSelected ? 700 : 400}
                textAnchor="end"
              >
                {rowWord.label}
              </text>

              {rows[row].map((w, col) => {
                if (w == null) {
                  // diagonal: not applicable, not a measured zero
                  return (
                    <rect
                      key={col}
                      x={cellX(col)}
                      y={cellY(row)}
                      width={CELL}
                      height={CELL}
                      rx={3}
                      fill={PAPER}
                      stroke="#e2e0d8"
                      strokeWidth={0.75}
                    />
                  )
                }
                return (
                  <rect
                    key={col}
                    x={cellX(col)}
                    y={cellY(row)}
                    width={CELL}
                    height={CELL}
                    rx={3}
                    fill={lerpColor(w / max)}
                    stroke="#e2e0d8"
                    strokeWidth={0.75}
                  >
                    <title>{`${rowWord.label} to ${WORDS[col].label}: ${w.toFixed(2)}`}</title>
                  </rect>
                )
              })}

              {/* full-row hit target: clicking the label OR any cell in the row selects it */}
              <rect
                className={styles.rowHit}
                x={0}
                y={cellY(row) - GAP / 2}
                width={VB_W}
                height={PITCH}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Show outgoing attention from "${rowWord.label}"`}
                onClick={() => toggleRow(rowWord.id)}
                onKeyDown={(e) => onRowKeyDown(e, rowWord.id)}
              />

              {isSelected && (
                <rect
                  x={PAD / 2}
                  y={cellY(row) - 1}
                  width={VB_W - PAD}
                  height={CELL + 2}
                  rx={4}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={2}
                  pointerEvents="none"
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
