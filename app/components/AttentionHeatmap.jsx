'use client'

// Plain SVG/DOM only: no three.js, no dynamic() wrapper needed. Draws the
// matrix it is given (softmax rows from attentionData), so it always shows the
// same numbers as the rest of the figure, including any score the reader has
// adjusted. Every row sums to 1, and the sum column says so.

import { WORDS } from './attentionData'
import { ACCENT, INK, FADE, PAPER, RULE, MONO } from './vizPalette'
import styles from './AttentionHeatmap.module.css'
import shared from './vizShared.module.css'

// interpolate between two hex colors by t in [0,1] (same approach as
// AttentionScene's lerpColor, kept local so attentionData.js stays data-only)
const hexToRgb = (h) => [Number.parseInt(h.slice(1, 3), 16), Number.parseInt(h.slice(3, 5), 16), Number.parseInt(h.slice(5, 7), 16)]
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
const SUM_W = 40
const VB_W = GRID_X + GRID_SIZE + SUM_W + PAD
const VB_H = GRID_Y + GRID_SIZE + PAD

const cellX = (col) => GRID_X + col * PITCH
const cellY = (row) => GRID_Y + row * PITCH

const rowSum = (row) => row.reduce((a, b) => a + b, 0)

export default function AttentionHeatmap({ matrix, selected, onSelect }) {
  const rows = matrix
  const max = Math.max(...rows.flat()) || 1

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
      <div className={styles.scroll}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        role="img"
        aria-label={`Attention weight heatmap: ${N} rows and ${N} columns, one per word in the sentence, in reading order. Each cell is the softmax weight from the row word to the column word, shaded relative to the strongest weight in the grid; every row sums to 1. ${selected != null ? `Row "${WORDS.find((w) => w.id === selected)?.label}" is selected.` : 'No row is selected.'}`}
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

        <text x={GRID_X + GRID_SIZE + SUM_W / 2} y={GRID_Y - 8} fontSize={10.5} fill={FADE} fontFamily={MONO} textAnchor="middle">
          sum
        </text>

        {/* rows: label + cells + row sum + one invisible full-row hit target */}
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

              {rows[row].map((w, col) => (
                <rect
                  key={col}
                  x={cellX(col)}
                  y={cellY(row)}
                  width={CELL}
                  height={CELL}
                  rx={3}
                  fill={lerpColor(w / max)}
                  stroke={RULE}
                  strokeWidth={0.75}
                  data-testid="cell"
                  data-weight={w}
                >
                  <title>{`${rowWord.label} to ${WORDS[col].label}: ${w.toFixed(2)}`}</title>
                </rect>
              ))}

              <text
                x={GRID_X + GRID_SIZE + SUM_W / 2}
                y={cellY(row) + CELL / 2 + 4}
                fontSize={10.5}
                fill={INK}
                fontFamily={MONO}
                textAnchor="middle"
                data-testid="row-sum"
              >
                {rowSum(rows[row]).toFixed(2)}
              </text>

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

      {/* shade scale: weak to strong, the same ramp the cells use */}
      <div className={shared.legend}>
        <span className={shared.legendItem}>
          <span className={shared.swatch} style={{ background: lerpColor(0) }} />
          weak
        </span>
        <span className={shared.legendItem}>
          <span className={shared.swatch} style={{ background: lerpColor(0.5) }} />
          medium
        </span>
        <span className={shared.legendItem}>
          <span className={shared.swatch} style={{ background: lerpColor(1) }} />
          strong
        </span>
      </div>
    </div>
  )
}
