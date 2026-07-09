'use client'

import { useState } from 'react'
import Figure from './Figure'
import { TRAIN, TEST, MIN_DEG, MAX_DEG, fitPolynomial, predict, mse, regime, truth } from './overfittingData'
import styles from './OverfittingViz.module.css'

const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b'
const TEAL = '#2f6f7e'
const GREEN = '#1f6f5c'
const PAPER = '#f7f6f2'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

// ── SVG geometry ──────────────────────────────────────────────────────────────
const VB_W = 560
const VB_H = 280
const PAD_L = 30
const PAD_R = 20
const PAD_T = 18
const PAD_B = 28

// y range chosen to cover the trend + noise comfortably; clip the wild-overfit curve to it
const Y_MIN = -1.6
const Y_MAX = 1.7

const PLOT_W = VB_W - PAD_L - PAD_R
const PLOT_H = VB_H - PAD_T - PAD_B
const xPx = (x) => PAD_L + x * PLOT_W
const yPx = (y) => PAD_T + (1 - (y - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H

// Sample the fitted polynomial on a dense grid for the curve path
function fitPath(coef, samples = 240) {
  const pts = []
  for (let i = 0; i <= samples; i += 1) {
    const x = i / samples
    const yRaw = predict(coef, x)
    const y = Math.max(Y_MIN, Math.min(Y_MAX, yRaw))
    pts.push(`${xPx(x).toFixed(2)},${yPx(y).toFixed(2)}`)
  }
  return `M${pts.join(' L')}`
}

function truthPath(samples = 240) {
  const pts = []
  for (let i = 0; i <= samples; i += 1) {
    const x = i / samples
    pts.push(`${xPx(x).toFixed(2)},${yPx(truth(x)).toFixed(2)}`)
  }
  return `M${pts.join(' L')}`
}
const TRUTH_PATH = truthPath()

function regimeClass(name) {
  if (name === 'good fit') return styles.regimeGood
  if (name === 'overfitting') return styles.regimeOver
  return styles.regimeUnder
}

export default function OverfittingViz() {
  const [deg, setDeg] = useState(4)

  const coef = fitPolynomial(TRAIN, deg)
  const trainErr = mse(coef, TRAIN)
  const testErr = mse(coef, TEST)
  const reg = regime(deg)

  const readouts = [
    { label: 'complexity', value: `degree ${deg}` },
    { label: 'training error', value: trainErr.toFixed(3) },
    { label: 'test error', value: testErr.toFixed(3) },
  ]
  const status = `Training error keeps dropping; test error has a U-shape ('${reg}')`

  // x grid lines (just two: 0 and 1)
  const yTicks = [-1, 0, 1]

  return (
    <Figure
      eyebrow="Machine learning"
      title="Underfitting, a good fit, and overfitting"
      readouts={readouts}
      status={status}
      tryThis={`The blue dots are the training data: a true underlying curve (faint grey) plus random noise. The red curve is a polynomial fit; the slider sets its degree. At low complexity the fit is a straight line that misses the trend (underfitting). In the middle it follows the trend smoothly while ignoring the noise (a good fit). At high complexity it wiggles to chase the training points and fit the noise (overfitting). Watch the readouts: training error keeps dropping as complexity rises, but test error on the green held-out points drops then rises again. The minimum of test error is the best-generalizing model.`}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', maxWidth: 600, height: 'auto', display: 'block', margin: '0 auto', background: PAPER, borderRadius: 6 }}
        aria-label="A scatter of training points with a polynomial fit. As the complexity slider increases, the fit goes from a straight line to a smooth curve to a wiggly overfit. A few held-out test points show where the fit fails to generalize."
      >
        {/* axes */}
        <line x1={PAD_L} y1={yPx(0)} x2={PAD_L + PLOT_W} y2={yPx(0)} stroke="#d4d0c8" strokeWidth={1} strokeDasharray="2 3" />
        {yTicks.map((yv) => (
          <g key={`yt-${yv}`}>
            <text x={PAD_L - 6} y={yPx(yv) + 3} fontSize={9} fill={FADE} fontFamily={MONO} textAnchor="end">{yv}</text>
          </g>
        ))}

        {/* true underlying trend (faint grey) */}
        <path d={TRUTH_PATH} fill="none" stroke={FADE} strokeWidth={1.3} strokeDasharray="4 4" opacity={0.55} />

        {/* fitted polynomial */}
        <path d={fitPath(coef)} fill="none" stroke={ACCENT} strokeWidth={2.2} />

        {/* training points (blue). Coords are rounded so the server-prerendered and
            client-hydrated values match exactly: p.y comes from Math.sin/sqrt/log
            noise, whose last float digit can differ between Node and the browser. */}
        {TRAIN.map((p, i) => (
          <circle key={`tr-${i}`} cx={xPx(p.x).toFixed(2)} cy={yPx(p.y).toFixed(2)} r={4} fill={TEAL} stroke="#fff" strokeWidth={1} />
        ))}

        {/* test points (green, larger). Coords rounded for the same hydration reason. */}
        {TEST.map((p, i) => (
          <circle key={`te-${i}`} cx={xPx(p.x).toFixed(2)} cy={yPx(p.y).toFixed(2)} r={5.5} fill="none" stroke={GREEN} strokeWidth={2} />
        ))}

        {/* legend */}
        <g transform={`translate(${PAD_L + 6}, ${PAD_T + 4})`}>
          <circle cx={4} cy={6} r={3.5} fill={TEAL} /><text x={14} y={9} fontSize={9.5} fill={INK} fontFamily={MONO}>training</text>
          <circle cx={4} cy={20} r={4.5} fill="none" stroke={GREEN} strokeWidth={1.8} /><text x={14} y={23} fontSize={9.5} fill={INK} fontFamily={MONO}>test (held out)</text>
          <line x1={0} y1={34} x2={9} y2={34} stroke={ACCENT} strokeWidth={2} /><text x={14} y={37} fontSize={9.5} fill={INK} fontFamily={MONO}>fit</text>
          <line x1={0} y1={47} x2={9} y2={47} stroke={FADE} strokeWidth={1.3} strokeDasharray="3 3" /><text x={14} y={50} fontSize={9.5} fill={INK} fontFamily={MONO}>true trend</text>
        </g>
      </svg>

      <div className={styles.sliderRow}>
        <span className={styles.sliderLabel}>model complexity</span>
        <input
          className={styles.slider}
          type="range"
          min={MIN_DEG}
          max={MAX_DEG}
          step={1}
          value={deg}
          onChange={(e) => setDeg(Number(e.target.value))}
          aria-label="Model complexity: polynomial degree"
        />
        <span className={styles.degValue}>{deg}</span>
        <span className={`${styles.regime} ${regimeClass(reg)}`}>{reg}</span>
      </div>
      <div className={styles.endsRow}>
        <span>← simple (straight line)</span>
        <span>wiggly (chases the training points) →</span>
      </div>

      <p className={styles.note}>
        Real polynomial least-squares fit over a fixed, seeded dataset (16 training + 6 held-out test points around a
        gentle sine curve plus noise). No ML library; the curve and both errors are recomputed from scratch on each
        slider tick.
      </p>
    </Figure>
  )
}
