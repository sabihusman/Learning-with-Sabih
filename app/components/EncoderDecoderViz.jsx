'use client'

import { useState } from 'react'
import Figure from './Figure'
import { SENTENCE, INK, FADE, canAttend, visibleWords } from './encoderDecoderData'
import styles from './EncoderDecoderViz.module.css'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const ENCODER_COLOR = '#2f6f7e' // teal, matches the site's "open/full" convention
const DECODER_COLOR = '#c0392b' // accent red, matches the site's "restricted" convention

const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

// ── SVG geometry ──────────────────────────────────────────────────────────────
const N = SENTENCE.length
const CELL = 26
const GAP = 2
const ROW_LABEL_W = 58
const COL_LABEL_H = 66
const PAD = 10

const GRID_SIDE = N * (CELL + GAP) - GAP
const VB_W = ROW_LABEL_W + GRID_SIDE + PAD
const VB_H = COL_LABEL_H + GRID_SIDE + PAD

const colX = (col) => ROW_LABEL_W + col * (CELL + GAP)
const rowY = (row) => COL_LABEL_H + row * (CELL + GAP)

export default function EncoderDecoderViz() {
  const [mode, setMode] = useState('encoder')
  const [selectedRow, setSelectedRow] = useState(null)
  const color = mode === 'encoder' ? ENCODER_COLOR : DECODER_COLOR
  const colorRgb = hexToRgb(color)

  const controls = [
    { label: 'Encoder', onClick: () => setMode('encoder'), active: mode === 'encoder' },
    { label: 'Decoder', onClick: () => setMode('decoder'), active: mode === 'decoder' },
    { label: 'Clear selection', onClick: () => setSelectedRow(null), disabled: selectedRow == null },
  ]

  const rule =
    mode === 'encoder'
      ? 'Encoder: every word sees the whole sentence'
      : 'Decoder: each word sees itself and the words before it'

  const readouts = [
    { label: 'mode', value: rule },
    {
      label: 'selected word can see',
      value: selectedRow != null ? visibleWords(mode, selectedRow).join(', ') : '—',
    },
  ]

  const status = selectedRow != null ? `"${SENTENCE[selectedRow]}" attends to the highlighted cells` : 'Click a word to see what it can attend to'

  return (
    <Figure
      eyebrow="Transformers"
      title={`Attention mask: ${mode === 'encoder' ? 'encoder (full)' : 'decoder (causal)'}`}
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis={
        'Toggle between encoder and decoder. In encoder mode every word sees the whole sentence. Switch to decoder and the upper half goes dark: each word can only look back at itself and earlier words. Click a word to see exactly which words it is allowed to reach.'
      }
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', maxWidth: 420, height: 'auto', display: 'block', margin: '0 auto' }}
        aria-label={`A ${N} by ${N} grid where rows and columns are the words of the sentence. A filled cell means the row word can attend to the column word. ${rule}.`}
      >
        {/* column labels, rotated so ten words fit above narrow columns */}
        {SENTENCE.map((word, col) => (
          <text
            key={col}
            x={colX(col) + CELL / 2}
            y={COL_LABEL_H - 6}
            fontSize={10.5}
            fill={INK}
            fontFamily={MONO}
            textAnchor="start"
            transform={`rotate(-45, ${colX(col) + CELL / 2}, ${COL_LABEL_H - 6})`}
          >
            {word}
          </text>
        ))}

        {/* row labels */}
        {SENTENCE.map((word, row) => (
          <text
            key={row}
            x={ROW_LABEL_W - 8}
            y={rowY(row) + CELL / 2 + 4}
            fontSize={10.5}
            fill={selectedRow === row ? color : INK}
            fontWeight={selectedRow === row ? 700 : 400}
            fontFamily={MONO}
            textAnchor="end"
          >
            {word}
          </text>
        ))}

        {/* grid rows: each row is one clickable hit target covering its label + cells */}
        {SENTENCE.map((_, row) => (
          <g
            key={row}
            className={styles.row}
            style={{ cursor: 'pointer' }}
            onClick={() => setSelectedRow(row)}
          >
            <rect
              x={0}
              y={rowY(row) - 1}
              width={VB_W}
              height={CELL + 2}
              fill={selectedRow === row ? `rgba(${colorRgb.join(', ')}, 0.1)` : 'transparent'}
            />
            {SENTENCE.map((__, col) => {
              const on = canAttend(mode, row, col)
              return (
                <rect
                  key={col}
                  x={colX(col)}
                  y={rowY(row)}
                  width={CELL}
                  height={CELL}
                  rx={3}
                  fill={on ? color : 'none'}
                  fillOpacity={on ? (selectedRow === null || selectedRow === row ? 1 : 0.25) : 1}
                  stroke={on ? 'none' : FADE}
                  strokeWidth={1}
                  strokeOpacity={0.6}
                />
              )
            })}
          </g>
        ))}
      </svg>
    </Figure>
  )
}
