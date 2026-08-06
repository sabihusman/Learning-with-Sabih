'use client'

import { useState } from 'react'
import Figure from './Figure'
import {
  BIT_WIDTHS,
  GROUP_COUNT,
  OUTLIER,
  activeWeights,
  groupRanges,
  quantize,
  bytesPerWeight,
  sevenBGb,
} from './quantizationData'
import styles from './QuantizationViz.module.css'

// Static-on-change figure: every change of a control recomputes and redraws
// synchronously from the data module. No timers, no animation, deliberately no
// animation-speed control.

const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b' // connectors (the visible error) and the outlier mark
const OK = '#1f6f5c' // the snapped position on the grid
const LINE = '#e2e0d8'
const PANEL_BG = '#faf9f6'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 460
const VB_H = 330
const PLOT_X = 52
const PLOT_W = 396
const CX = PLOT_X + PLOT_W / 2
const BAND_TOP = 16
const BAND_H = 66
const BAND_GAP = 6
const bandY = (g) => BAND_TOP + g * (BAND_H + BAND_GAP)
const AXIS_Y = bandY(GROUP_COUNT - 1) + BAND_H + 14

export default function QuantizationViz() {
  const [bits, setBits] = useState(8)
  const [outlier, setOutlier] = useState(false)
  const [grouped, setGrouped] = useState(false)

  const weights = activeWeights(outlier)
  const result = quantize(weights, bits, grouped)
  const ranges = groupRanges(weights.length, GROUP_COUNT)
  const bpw = bytesPerWeight(bits, grouped, weights.length)
  const gb = sevenBGb(bits, grouped, weights.length)

  // The axis stretches to fit the outlier when it is on: squashing every
  // ordinary weight into the middle is exactly the point.
  const dmax = Math.max(...weights.map(Math.abs)) * 1.06
  const xOf = (v) => CX + (v / dmax) * (PLOT_W / 2 - 6)

  // Deterministic vertical jitter: each weight keeps its row within its band
  // across every state, so toggling controls moves only grids and connectors.
  const dotY = (indexInGroup, g) => bandY(g) + 9 + (indexInGroup % 7) * 8

  const scaleValue = grouped
    ? `${GROUP_COUNT} scales`
    : result.scales[0].toFixed(5)

  const readouts = [
    { label: 'levels', value: result.levels },
    { label: 'scale', value: scaleValue },
    { label: 'mean |error|', value: result.meanErr.toFixed(4) },
    { label: 'max |error|', value: result.maxErr.toFixed(4) },
    // Per-group charges the FP16 scale each group stores; per-tensor is the
    // plain b/8 figure (its single scale is not charged). See quantizationData.
    { label: 'bytes per weight', value: grouped ? `${bpw.toFixed(4)} incl. FP16 scales` : bpw.toFixed(4) },
    { label: '7B model, weights only', value: `${gb.toFixed(2)} GB` },
  ]

  const status = `INT${bits}, ${grouped ? 'per-group' : 'per-tensor'}${outlier ? ', outlier in' : ''}: ${result.levels} levels, mean error ${result.meanErr.toFixed(4)}`

  return (
    <Figure
      eyebrow="Model compression"
      title="Weights snapping to a quantization grid"
      status={status}
      readouts={readouts}
      tryThis="Start at INT8 and walk the bit width down: the grid thins from 255 levels to 3, and the red connectors, each weight's rounding error, grow from invisible to enormous. At INT4 switch the outlier on: one extreme weight stretches the shared scale and every ordinary weight's error jumps. Now switch to per-group: only the outlier's own group pays for it, and the other three groups get their tight grids back. Check the bytes-per-weight readout while you are there: the per-group rescue is not free, because every group's scale has to be stored."
    >
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>bit width</span>
        {BIT_WIDTHS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBits(b)}
            aria-pressed={bits === b}
            className={`${styles.toggle} ${bits === b ? styles.toggleOn : ''}`}
          >
            {`INT${b}`}
          </button>
        ))}
      </div>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>outlier</span>
        <button
          type="button"
          onClick={() => setOutlier((o) => !o)}
          aria-pressed={outlier}
          className={`${styles.toggle} ${outlier ? styles.toggleOn : ''}`}
        >
          {outlier ? 'one extreme weight in' : 'off'}
        </button>
        <span className={styles.controlLabel}>grouping</span>
        <button
          type="button"
          onClick={() => setGrouped(false)}
          aria-pressed={!grouped}
          className={`${styles.toggle} ${!grouped ? styles.toggleOn : ''}`}
        >
          per-tensor
        </button>
        <button
          type="button"
          onClick={() => setGrouped(true)}
          aria-pressed={grouped}
          className={`${styles.toggle} ${grouped ? styles.toggleOn : ''}`}
        >
          per-group
        </button>
      </div>

      <div className={styles.scroll}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={styles.svg}
          role="img"
          aria-label={`${weights.length} weights on a value axis snapping to a symmetric INT${bits} grid, ${result.levels} levels, ${grouped ? 'one scale per group of about 30 weights' : 'one shared scale'}. Mean absolute error ${result.meanErr.toFixed(4)}, max ${result.maxErr.toFixed(4)}.`}
        >
          {ranges.map(([a, b], g) => {
            const top = bandY(g)
            const gridScale = grouped ? result.scales[g] : result.scales[0]
            const gridQ = []
            for (let q = -result.qmax; q <= result.qmax; q += 1) gridQ.push(q)
            return (
              <g key={`band-${g}`}>
                <rect x={PLOT_X} y={top} width={PLOT_W} height={BAND_H} rx={6} fill={PANEL_BG} stroke={LINE} strokeWidth={1} />
                {grouped && (
                  <>
                    <text x={PLOT_X - 6} y={top + BAND_H / 2 - 4} fontSize={8.5} fill={INK} fontFamily={MONO} fontWeight={700} textAnchor="end">
                      {`g${g + 1}`}
                    </text>
                    <text x={PLOT_X - 6} y={top + BAND_H / 2 + 7} fontSize={7} fill={FADE} fontFamily={MONO} textAnchor="end">
                      {`s ${result.scales[g].toFixed(3)}`}
                    </text>
                  </>
                )}

                {/* the quantization grid this band snaps to */}
                {gridQ.map((q) => {
                  const x = xOf(q * gridScale)
                  if (x < PLOT_X || x > PLOT_X + PLOT_W) return null
                  return (
                    <line
                      key={`grid-${g}-${q}`}
                      x1={x}
                      y1={top + 2}
                      x2={x}
                      y2={top + BAND_H - 2}
                      stroke={q === 0 ? FADE : LINE}
                      strokeWidth={q === 0 ? 1 : 0.6}
                    />
                  )
                })}

                {/* weights, their snap targets, and the error connectors */}
                {result.perWeight.slice(a, b).map((p, i) => {
                  const y = dotY(i, g)
                  const isOutlier = outlier && a + i === weights.length - 1
                  return (
                    <g key={`w-${a + i}`}>
                      <line x1={xOf(p.w)} y1={y} x2={xOf(p.wHat)} y2={y} stroke={ACCENT} strokeWidth={1.1} strokeOpacity={0.75} />
                      <circle cx={xOf(p.wHat)} cy={y} r={1.6} fill={OK} />
                      <circle
                        cx={xOf(p.w)}
                        cy={y}
                        r={isOutlier ? 3.4 : 2.4}
                        fill={isOutlier ? '#ffffff' : INK}
                        stroke={isOutlier ? ACCENT : 'none'}
                        strokeWidth={isOutlier ? 1.6 : 0}
                      />
                      {isOutlier && (
                        <text x={xOf(p.w)} y={y - 7} fontSize={7.5} fill={ACCENT} fontFamily={MONO} textAnchor="middle">
                          outlier
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}

          {/* value axis */}
          <text x={PLOT_X} y={AXIS_Y} fontSize={8} fill={FADE} fontFamily={MONO}>
            {(-dmax).toFixed(2)}
          </text>
          <text x={CX} y={AXIS_Y} fontSize={8} fill={FADE} fontFamily={MONO} textAnchor="middle">
            0
          </text>
          <text x={PLOT_X + PLOT_W} y={AXIS_Y} fontSize={8} fill={FADE} fontFamily={MONO} textAnchor="end">
            {dmax.toFixed(2)}
          </text>
          <text x={CX} y={AXIS_Y + 11} fontSize={7.5} fill={FADE} fontFamily={MONO} textAnchor="middle">
            weight value, black dot = original, green dot = snapped, red length = error
          </text>
        </svg>
      </div>

      <p className={styles.caption}>
        The 120 weights are authored once (a fixed normal-shaped draw, frozen as
        literals) so the figure is identical on every load; the optional 121st is a
        single authored outlier at {OUTLIER}. Everything else is computed by a real
        symmetric integer quantizer: scales, snapped values, every error, and both
        size readouts. Symmetric quantization keeps zero exact, which costs one
        level: 2 to the b minus 1 values, so INT2 means three levels. The 7B figure
        assumes the same format for every weight and FP16 group scales, and reports
        storage only. Nothing here measures model quality; that would require a real
        model, and this figure does not run one.
      </p>
    </Figure>
  )
}
