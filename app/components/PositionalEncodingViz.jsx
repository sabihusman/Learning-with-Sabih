'use client'

import { useState } from 'react'
import Figure from './Figure'
import { D_MODEL, NUM_PAIRS, POSITIONS, peVector, waveAt, periodOf, similarity } from './positionalEncodingData'
import styles from './PositionalEncodingViz.module.css'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const INK = '#1a1a1a'
const FADE = '#9b9892'
const SIM_COLOR = '#2f6f7e' // teal, matches the Query color used on the attention topic
const SIN_COLOR = '#2f6f7e' // teal
const COS_COLOR = '#9a6b1f' // amber, matches the Key color used on the attention topic

// ── View 1 geometry: encoding strip + similarity strip ────────────────────────
const VB_W = 500
const CELL = 16
const CELL_GAP = 3
const STRIP_X = 8
const ENC_LABEL_Y = 14
const ENC_ROW_Y = ENC_LABEL_Y + 10
const SIM_LABEL_Y = ENC_ROW_Y + CELL + 30
const SIM_ROW_Y = SIM_LABEL_Y + 10
const POS_LABEL_Y = SIM_ROW_Y + CELL + 14
const VB_H = POS_LABEL_Y + 8

// A value in [-1, 1] mapped to fill opacity, so the cell reads darkest at +1 and
// faintest at -1, the same convention as the attention topic's Q/K/V cells.
function cellOpacity(v) {
  return 0.12 + ((v + 1) / 2) * 0.85
}

function EncodingStrip({ selected }) {
  const vec = peVector(selected, D_MODEL)
  return (
    <g>
      <text x={STRIP_X} y={ENC_LABEL_Y} fontSize={10} fill={FADE} fontFamily={MONO} letterSpacing="0.04em">
        {`encoding for position ${selected} (d_model = ${D_MODEL})`}
      </text>
      {vec.map((val, dim) => (
        <g key={dim}>
          <rect
            x={STRIP_X + dim * (CELL + CELL_GAP)}
            y={ENC_ROW_Y}
            width={CELL}
            height={CELL}
            rx={3}
            fill={dim % 2 === 0 ? SIN_COLOR : COS_COLOR}
            fillOpacity={cellOpacity(val)}
            stroke="#e2e0d8"
            strokeWidth={0.5}
          />
          <text
            x={STRIP_X + dim * (CELL + CELL_GAP) + CELL / 2}
            y={ENC_ROW_Y + CELL + 11}
            fontSize={7.5}
            fill={FADE}
            fontFamily={MONO}
            textAnchor="middle"
          >
            {dim % 2 === 0 ? 'sin' : 'cos'}
          </text>
        </g>
      ))}
    </g>
  )
}

function SimilarityStrip({ selected, positions, onSelect }) {
  const sims = positions.map((p) => similarity(selected, p))
  const minSim = Math.min(...sims)
  const maxSim = Math.max(...sims)
  const span = maxSim - minSim || 1
  return (
    <g>
      <text x={STRIP_X} y={SIM_LABEL_Y} fontSize={10} fill={FADE} fontFamily={MONO} letterSpacing="0.04em">
        {`similarity of every position's encoding to position ${selected}`}
      </text>
      {positions.map((p, i) => {
        const norm = (sims[i] - minSim) / span
        const isSelected = p === selected
        return (
          <g key={p} style={{ cursor: 'pointer' }} onClick={() => onSelect(p)}>
            <rect
              x={STRIP_X + i * (CELL + CELL_GAP)}
              y={SIM_ROW_Y}
              width={CELL}
              height={CELL}
              rx={3}
              fill={SIM_COLOR}
              fillOpacity={0.1 + norm * 0.85}
              stroke={isSelected ? INK : '#e2e0d8'}
              strokeWidth={isSelected ? 1.4 : 0.5}
            />
            <text
              x={STRIP_X + i * (CELL + CELL_GAP) + CELL / 2}
              y={POS_LABEL_Y}
              fontSize={9.5}
              fill={isSelected ? INK : FADE}
              fontFamily={MONO}
              fontWeight={isSelected ? 700 : 400}
              textAnchor="middle"
            >
              {p}
            </text>
          </g>
        )
      })}
    </g>
  )
}

// ── View 2 geometry: one wave row per dimension pair ───────────────────────────
const WAVE_VB_W = 500
const WAVE_PAD_X = 34
const WAVE_ROW_H = 74
const WAVE_ROW_GAP = 10
const WAVE_PLOT_W = WAVE_VB_W - WAVE_PAD_X * 2
const WAVE_VB_H = NUM_PAIRS * (WAVE_ROW_H + WAVE_ROW_GAP)
const SAMPLES = 80
const MAX_POS = POSITIONS.length - 1

function xOf(pos) {
  return WAVE_PAD_X + (pos / MAX_POS) * WAVE_PLOT_W
}
function yOf(rowTop, v) {
  // v in [-1, 1] maps to the row's inner band, +1 at the top, -1 at the bottom
  const inner = WAVE_ROW_H - 16
  return rowTop + 8 + ((1 - v) / 2) * inner
}

function pathFor(pairIndex, kind, rowTop) {
  let d = ''
  for (let s = 0; s <= SAMPLES; s += 1) {
    const pos = (s / SAMPLES) * MAX_POS
    const v = waveAt(pairIndex, pos, kind, D_MODEL)
    const x = xOf(pos)
    const y = yOf(rowTop, v)
    d += `${s === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)} `
  }
  return d.trim()
}

function WaveRow({ pairIndex, selected }) {
  const rowTop = pairIndex * (WAVE_ROW_H + WAVE_ROW_GAP)
  const midY = rowTop + 8 + (WAVE_ROW_H - 16) / 2
  const selX = xOf(selected)
  const selSin = waveAt(pairIndex, selected, 'sin', D_MODEL)
  const selCos = waveAt(pairIndex, selected, 'cos', D_MODEL)
  const period = periodOf(pairIndex, D_MODEL)
  const periodLabel = period >= 1000 ? `${Math.round(period)}` : period.toFixed(1)

  return (
    <g>
      <line x1={WAVE_PAD_X} y1={midY} x2={WAVE_VB_W - WAVE_PAD_X} y2={midY} stroke="#e2e0d8" strokeWidth={1} />
      <text x={0} y={rowTop + 10} fontSize={9.5} fill={FADE} fontFamily={MONO}>
        {`pair ${pairIndex}`}
      </text>
      <text x={0} y={rowTop + 21} fontSize={8} fill={FADE} fontFamily={MONO}>
        {`dims ${pairIndex * 2},${pairIndex * 2 + 1}`}
      </text>
      <path d={pathFor(pairIndex, 'sin', rowTop)} fill="none" stroke={SIN_COLOR} strokeWidth={1.6} />
      <path d={pathFor(pairIndex, 'cos', rowTop)} fill="none" stroke={COS_COLOR} strokeWidth={1.6} strokeDasharray="4,3" />
      <line x1={selX} y1={rowTop} x2={selX} y2={rowTop + WAVE_ROW_H - 8} stroke={INK} strokeWidth={1} strokeDasharray="2,2" opacity={0.55} />
      <circle cx={selX} cy={yOf(rowTop, selSin)} r={3.4} fill={SIN_COLOR} stroke="#fff" strokeWidth={1} />
      <circle cx={selX} cy={yOf(rowTop, selCos)} r={3.4} fill={COS_COLOR} stroke="#fff" strokeWidth={1} />
      <text x={WAVE_VB_W} y={rowTop + 10} fontSize={8} fill={FADE} fontFamily={MONO} textAnchor="end">
        {`period ≈ ${periodLabel} pos`}
      </text>
    </g>
  )
}

export default function PositionalEncodingViz() {
  const [selected, setSelected] = useState(0)

  const sims = POSITIONS.map((p) => ({ p, s: similarity(selected, p) }))
  const mostSimilarOther = sims
    .filter((x) => x.p !== selected)
    .sort((a, b) => b.s - a.s)[0]

  const controls = POSITIONS.map((p) => ({
    label: String(p),
    onClick: () => setSelected(p),
    active: selected === p,
  }))

  const readouts = [
    { label: 'selected position', value: selected },
    { label: 'encoding (rounded)', value: peVector(selected, D_MODEL).map((v) => v.toFixed(2)).join(', ') },
    { label: 'most similar other position', value: mostSimilarOther.p },
  ]

  const status = `Position ${selected}: encoding sampled from ${NUM_PAIRS} sin/cos pairs`

  return (
    <Figure
      eyebrow="Transformers"
      title="Positional encoding, position by position"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis={`Click through the positions and watch the encoding row change. Notice position 0 is all zeros and ones, the simplest pattern. Watch the similarity shading: positions near the one you picked stay close, distant ones drift apart. Then look at the waves below, and see that a position's encoding is just those waves read off at that one spot. The fast waves separate nearby positions; the slow waves separate far ones.`}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', maxWidth: 520, height: 'auto', display: 'block', margin: '0 auto' }}
        aria-label="A strip of cells showing the selected position's encoding vector, and a second strip showing how similar every position's encoding is to the selected one."
      >
        <EncodingStrip selected={selected} />
        <SimilarityStrip selected={selected} positions={POSITIONS} onSelect={setSelected} />
      </svg>

      <p className={styles.sectionLabel}>The waves underneath</p>

      <svg
        viewBox={`0 0 ${WAVE_VB_W} ${WAVE_VB_H}`}
        style={{ width: '100%', maxWidth: 520, height: 'auto', display: 'block', margin: '0 auto' }}
        aria-label="One row per dimension pair, each showing the sine and cosine wave that pair follows across positions, with a dot marking the selected position."
      >
        {Array.from({ length: NUM_PAIRS }, (_, i) => (
          <WaveRow key={i} pairIndex={i} selected={selected} />
        ))}
      </svg>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.swatchLine} style={{ background: SIN_COLOR }} /> sine (even dims)
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatchDashed} /> cosine (odd dims)
        </span>
      </div>

      <p className={styles.formula}>
        {'PE(pos, 2i) = sin(pos / 10000^(2i / d_model))    PE(pos, 2i+1) = cos(pos / 10000^(2i / d_model))'}
      </p>
      <p className={styles.note}>
        Every value above comes from that formula computed live, at d_model = {D_MODEL} and {POSITIONS.length} positions.
        A real model uses hundreds of dimensions and adds this encoding to the token embedding rather than showing it
        on its own, as this figure does.
      </p>
    </Figure>
  )
}
