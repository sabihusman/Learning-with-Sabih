'use client'

import { useState, useMemo } from 'react'
import Figure from './Figure'

// ─── data ──────────────────────────────────────────────────────────────────
// A fixed, deterministic dataset. We seed a tiny PRNG (mulberry32) so the
// numbers are identical on every build and every machine — no Math.random,
// no Date. Two overlapping Gaussian classes make the threshold tradeoff real:
// some negatives score high (future false positives) and some positives score
// low (future false negatives), so no single threshold is perfect.

function mulberry32(a) {
  return function () {
    a = Math.trunc(a)
    a = Math.trunc(a + 0x6d2b79f5)
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

function makeDataset(seed, nPos, nNeg) {
  const rng = mulberry32(seed)
  // Box-Muller transform for a normal sample from two uniforms.
  const gauss = (mean, sd) => {
    let u = 0
    let v = 0
    while (u === 0) u = rng()
    while (v === 0) v = rng()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  const items = []
  let id = 0
  for (let i = 0; i < nPos; i++) {
    items.push({ id: id++, label: 'pos', score: clamp(gauss(0.62, 0.16), 0.02, 0.98) })
  }
  for (let i = 0; i < nNeg; i++) {
    items.push({ id: id++, label: 'neg', score: clamp(gauss(0.38, 0.16), 0.02, 0.98) })
  }
  // sort by score so the score-axis layout is stable left-to-right
  items.sort((a, b) => a.score - b.score)
  return items
}

// 50 items: 24 actual positives, 26 actual negatives. Seed is fixed at 42.
const DATA = makeDataset(42, 24, 26)
const TOTAL_POS = DATA.filter((d) => d.label === 'pos').length
const TOTAL_NEG = DATA.length - TOTAL_POS

function confusion(items, threshold) {
  let TP = 0
  let FP = 0
  let FN = 0
  let TN = 0
  for (const it of items) {
    const predictedPositive = it.score >= threshold
    if (it.label === 'pos') {
      if (predictedPositive) TP++
      else FN++
    } else if (predictedPositive) FP++
    else TN++
  }
  return { TP, FP, FN, TN }
}

// ─── plot geometry ───────────────────────────────────────────────────────────
const VB_W = 600
const VB_H = 230
const PAD = { left: 64, right: 22, top: 34, bottom: 34 }
const PLOT_L = PAD.left
const PLOT_R = VB_W - PAD.right
const AXIS_Y = VB_H - PAD.bottom
const ROW_POS_Y = 78 // actual-positive band centre
const ROW_NEG_Y = 134 // actual-negative band centre
const JITTER = 13 // vertical spread within a band, to reduce dot overlap

const px = (score) => PLOT_L + score * (PLOT_R - PLOT_L)

// deterministic vertical jitter from the item id (stable across renders)
const jitterFor = (id) => {
  const h = (Math.imul(id + 1, 2654435761) >>> 0) / 4294967296 // 0..1
  return (h - 0.5) * 2 * JITTER
}

const INK = '#1a1a1a'
const ACCENT = '#c0392b'
const FADE = '#9b9892'

// ─── component ───────────────────────────────────────────────────────────────
export default function ConfusionMatrixViz() {
  const [threshold, setThreshold] = useState(0.5)

  const { TP, FP, FN, TN } = useMemo(() => confusion(DATA, threshold), [threshold])

  // precision = TP / (TP + FP); recall = TP / (TP + FN)
  // guard the divide-by-zero cases and surface them as "n/a"
  const predictedPositives = TP + FP
  const precision = predictedPositives === 0 ? null : TP / predictedPositives
  const recall = TOTAL_POS === 0 ? null : TP / TOTAL_POS
  const fmt = (v) => (v === null ? 'n/a' : v.toFixed(3))

  const readouts = [
    { label: 'threshold', value: threshold.toFixed(2) },
    { label: 'precision', value: fmt(precision) },
    { label: 'recall', value: fmt(recall) },
    { label: 'predicted +', value: predictedPositives },
  ]

  const thrX = px(threshold)

  // 2x2 matrix cell descriptor: [count, isCorrect]
  const cell = (count, correct) => ({ count, correct })
  const grid = {
    tp: cell(TP, true),
    fn: cell(FN, false),
    fp: cell(FP, false),
    tn: cell(TN, true),
  }

  return (
    <Figure
      eyebrow="Classification"
      title="Precision and recall at a decision threshold"
      readouts={readouts}
      tryThis="Drag the threshold. Slide it left and recall climbs while precision drops (you catch more real positives but also wave through more false ones). Slide it right and the trade reverses. Push it past the highest score and precision reads n/a, because the model predicts no positives at all."
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', maxWidth: 600, height: 'auto', display: 'block', margin: '0 auto' }}
        aria-label="Example items plotted along a model-score axis from 0 to 1, split by a movable decision threshold into predicted-positive and predicted-negative regions"
      >
        {/* predicted-positive region (right of the threshold) */}
        <rect
          x={thrX}
          y={PAD.top - 6}
          width={PLOT_R - thrX}
          height={AXIS_Y - (PAD.top - 6)}
          fill={ACCENT}
          opacity={0.06}
        />

        {/* region labels */}
        <text x={(PLOT_L + thrX) / 2} y={PAD.top - 14} fontSize={11} fill={FADE} textAnchor="middle" fontFamily="ui-monospace,monospace">
          predicted −
        </text>
        <text x={(thrX + PLOT_R) / 2} y={PAD.top - 14} fontSize={11} fill={ACCENT} textAnchor="middle" fontFamily="ui-monospace,monospace">
          predicted +
        </text>

        {/* row labels */}
        <text x={PLOT_L - 12} y={ROW_POS_Y + 3} fontSize={11} fill={FADE} textAnchor="end" fontFamily="ui-monospace,monospace">
          actual +
        </text>
        <text x={PLOT_L - 12} y={ROW_NEG_Y + 3} fontSize={11} fill={FADE} textAnchor="end" fontFamily="ui-monospace,monospace">
          actual −
        </text>

        {/* score axis */}
        <line x1={PLOT_L} y1={AXIS_Y} x2={PLOT_R} y2={AXIS_Y} stroke="#c8c4bc" strokeWidth={1} />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={px(t)} y1={AXIS_Y} x2={px(t)} y2={AXIS_Y + 4} stroke="#c8c4bc" strokeWidth={0.8} />
            <text x={px(t)} y={AXIS_Y + 15} fontSize={11} fill={FADE} textAnchor="middle" fontFamily="ui-monospace,monospace">
              {t}
            </text>
          </g>
        ))}
        <text x={(PLOT_L + PLOT_R) / 2} y={VB_H - 2} fontSize={11} fill={FADE} textAnchor="middle" fontFamily="ui-monospace,monospace">
          model score
        </text>

        {/* item dots: top row = actual positives, bottom row = actual negatives.
            colour encodes correct (ink) vs incorrect (accent) given the threshold. */}
        {DATA.map((it) => {
          const predictedPositive = it.score >= threshold
          const correct = it.label === 'pos' ? predictedPositive : !predictedPositive
          const baseY = it.label === 'pos' ? ROW_POS_Y : ROW_NEG_Y
          return (
            <circle
              key={it.id}
              cx={px(it.score).toFixed(1)}
              cy={(baseY + jitterFor(it.id)).toFixed(1)}
              r={4.2}
              fill={correct ? INK : ACCENT}
              fillOpacity={correct ? 0.82 : 1}
              stroke="#ffffff"
              strokeWidth={1}
            />
          )
        })}

        {/* threshold line */}
        <line x1={thrX} y1={PAD.top - 6} x2={thrX} y2={AXIS_Y} stroke={ACCENT} strokeWidth={1.6} />
        <circle cx={thrX} cy={PAD.top - 6} r={3} fill={ACCENT} />
      </svg>

      {/* threshold slider — instant, no animation needed */}
      <div style={{ maxWidth: 600, margin: '14px auto 4px', padding: '0 4px' }}>
        <label
          htmlFor="cm-threshold"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: FADE,
            marginBottom: 6,
          }}
        >
          <span>Decision threshold</span>
          <span style={{ color: INK }}>{threshold.toFixed(2)}</span>
        </label>
        <input
          id="cm-threshold"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          style={{ width: '100%', accentColor: ACCENT, cursor: 'pointer' }}
          aria-label="Decision threshold"
        />
      </div>

      {/* 2x2 confusion matrix */}
      <div style={{ maxWidth: 420, margin: '18px auto 2px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr 1fr',
            gridTemplateRows: 'auto auto auto',
            gap: 1,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {/* header row */}
          <div />
          <MatrixHeader>predicted +</MatrixHeader>
          <MatrixHeader>predicted −</MatrixHeader>

          {/* actual + row */}
          <MatrixRowLabel>actual +</MatrixRowLabel>
          <MatrixCell {...grid.tp} name="TP" />
          <MatrixCell {...grid.fn} name="FN" />

          {/* actual − row */}
          <MatrixRowLabel>actual −</MatrixRowLabel>
          <MatrixCell {...grid.fp} name="FP" />
          <MatrixCell {...grid.tn} name="TN" />
        </div>
      </div>
    </Figure>
  )
}

// ─── matrix sub-parts (presentational) ───────────────────────────────────────
function MatrixHeader({ children }) {
  return (
    <div
      style={{
        fontSize: 9,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: FADE,
        textAlign: 'center',
        padding: '4px 0',
      }}
    >
      {children}
    </div>
  )
}

function MatrixRowLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 9,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: FADE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 8,
      }}
    >
      {children}
    </div>
  )
}

function MatrixCell({ count, correct, name }) {
  return (
    <div
      style={{
        background: correct ? 'rgba(26,26,26,0.05)' : 'rgba(192,57,43,0.08)',
        border: `1px solid ${correct ? 'rgba(26,26,26,0.18)' : 'rgba(192,57,43,0.28)'}`,
        padding: '12px 10px',
        textAlign: 'center',
        minHeight: 58,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <div style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums', color: correct ? INK : ACCENT }}>
        {count}
      </div>
      <div style={{ fontSize: 9, letterSpacing: '0.12em', color: FADE }}>{name}</div>
    </div>
  )
}
