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

// ── U-curve companion panel ───────────────────────────────────────────────────
// Train/test error for every degree, computed once with the same fit the main
// panel uses (14 tiny least-squares solves, well under a millisecond).
const ALL_ERRORS = Array.from({ length: MAX_DEG - MIN_DEG + 1 }, (_, i) => {
  const degree = MIN_DEG + i
  const coef = fitPolynomial(TRAIN, degree)
  return { degree, train: mse(coef, TRAIN), test: mse(coef, TEST) }
})
const BEST = ALL_ERRORS.reduce((a, b) => (b.test < a.test ? b : a), ALL_ERRORS[0])

const U_H = 210
const U_PAD_L = 46
const U_PAD_R = 20
const U_PAD_T = 16
const U_PAD_B = 34
const U_PLOT_W = VB_W - U_PAD_L - U_PAD_R
const U_PLOT_H = U_H - U_PAD_T - U_PAD_B

// Errors span ~0.007 to ~0.16 (a factor of ~23), so a log scale keeps both the
// training-error drop and the test-error U readable in one panel.
const ERR_LO = 0.005
const ERR_HI = 0.2
// Coords are rounded to 2dp so server-prerendered and client-hydrated values match
// exactly; the log10 of a computed error can differ in its last float digit between
// Node and the browser (same reason the main panel rounds its point coords).
const uxPx = (degree) => Number((U_PAD_L + ((degree - MIN_DEG) / (MAX_DEG - MIN_DEG)) * U_PLOT_W).toFixed(2))
const uyPx = (err) =>
  Number(
    (U_PAD_T + (1 - (Math.log10(err) - Math.log10(ERR_LO)) / (Math.log10(ERR_HI) - Math.log10(ERR_LO))) * U_PLOT_H).toFixed(2),
  )

function errPath(key) {
  const pts = ALL_ERRORS.map((e) => uxPx(e.degree).toFixed(2) + ',' + uyPx(e[key]).toFixed(2))
  return 'M' + pts.join(' L')
}
const TRAIN_PATH = errPath('train')
const TEST_PATH = errPath('test')
const ERR_TICKS = [0.01, 0.03, 0.1]

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
            <text x={PAD_L - 6} y={yPx(yv) + 3} fontSize={11} fill={FADE} fontFamily={MONO} textAnchor="end">{yv}</text>
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
          <circle cx={4} cy={6} r={3.5} fill={TEAL} /><text x={14} y={9} fontSize={11.5} fill={INK} fontFamily={MONO}>training</text>
          <circle cx={4} cy={20} r={4.5} fill="none" stroke={GREEN} strokeWidth={1.8} /><text x={14} y={23} fontSize={11.5} fill={INK} fontFamily={MONO}>test (held out)</text>
          <line x1={0} y1={34} x2={9} y2={34} stroke={ACCENT} strokeWidth={2} /><text x={14} y={37} fontSize={11.5} fill={INK} fontFamily={MONO}>fit</text>
          <line x1={0} y1={47} x2={9} y2={47} stroke={FADE} strokeWidth={1.3} strokeDasharray="3 3" /><text x={14} y={50} fontSize={11.5} fill={INK} fontFamily={MONO}>true trend</text>
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

      <svg
        viewBox={`0 0 ${VB_W} ${U_H}`}
        style={{ width: '100%', maxWidth: 600, height: 'auto', display: 'block', margin: '14px auto 0', background: PAPER, borderRadius: 6 }}
        aria-label="Training and test error plotted against polynomial degree. Training error falls as degree rises; test error falls then rises again in a U shape. Dots mark the current slider degree on both curves, and the test-error minimum is flagged as the best fit."
      >
        {/* log-scale error gridlines */}
        {ERR_TICKS.map((tv) => (
          <g key={`et-${tv}`}>
            <line x1={U_PAD_L} y1={uyPx(tv)} x2={U_PAD_L + U_PLOT_W} y2={uyPx(tv)} stroke="#d4d0c8" strokeWidth={1} strokeDasharray="2 3" />
            <text x={U_PAD_L - 6} y={uyPx(tv) + 3} fontSize={11} fill={FADE} fontFamily={MONO} textAnchor="end">{tv}</text>
          </g>
        ))}

        {/* degree axis */}
        {ALL_ERRORS.map((e) => (
          <text key={`dt-${e.degree}`} x={uxPx(e.degree)} y={U_H - U_PAD_B + 16} fontSize={10.5} fill={e.degree === deg ? INK : FADE} fontFamily={MONO} textAnchor="middle" fontWeight={e.degree === deg ? 700 : 400}>{e.degree}</text>
        ))}
        <text x={U_PAD_L + U_PLOT_W / 2} y={U_H - 4} fontSize={11} fill={FADE} fontFamily={MONO} textAnchor="middle">polynomial degree</text>
        <text x={12} y={U_PAD_T + U_PLOT_H / 2} fontSize={11} fill={FADE} fontFamily={MONO} textAnchor="middle" transform={`rotate(-90 12 ${U_PAD_T + U_PLOT_H / 2})`}>error (log)</text>

        {/* current-degree guide line */}
        <line x1={uxPx(deg)} y1={U_PAD_T} x2={uxPx(deg)} y2={U_PAD_T + U_PLOT_H} stroke={ACCENT} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />

        {/* error curves: same fit as the main panel, run over every degree */}
        <path d={TRAIN_PATH} fill="none" stroke={TEAL} strokeWidth={2} />
        <path d={TEST_PATH} fill="none" stroke={GREEN} strokeWidth={2} />

        {/* test-error minimum, flagged */}
        <circle cx={uxPx(BEST.degree)} cy={uyPx(BEST.test)} r={7} fill="none" stroke={GREEN} strokeWidth={1.4} strokeDasharray="2 2" />
        <text x={uxPx(BEST.degree)} y={uyPx(BEST.test) + 22} fontSize={11} fill={GREEN} fontFamily={MONO} textAnchor="middle" fontWeight={700}>best (degree {BEST.degree})</text>

        {/* dots marking the current slider degree on both curves */}
        <circle data-testid="ucurve-train-dot" cx={uxPx(deg).toFixed(2)} cy={uyPx(trainErr).toFixed(2)} r={4.5} fill={TEAL} stroke="#fff" strokeWidth={1.2} />
        <circle data-testid="ucurve-test-dot" cx={uxPx(deg).toFixed(2)} cy={uyPx(testErr).toFixed(2)} r={4.5} fill={GREEN} stroke="#fff" strokeWidth={1.2} />

        {/* legend */}
        <g transform={`translate(${U_PAD_L + 8}, ${U_PAD_T + 6})`}>
          <line x1={0} y1={4} x2={12} y2={4} stroke={TEAL} strokeWidth={2} /><text x={17} y={7} fontSize={11.5} fill={INK} fontFamily={MONO}>training error</text>
          <line x1={0} y1={18} x2={12} y2={18} stroke={GREEN} strokeWidth={2} /><text x={17} y={21} fontSize={11.5} fill={INK} fontFamily={MONO}>test error</text>
        </g>
      </svg>

      <p className={styles.note}>
        Real polynomial least-squares fit over a fixed, seeded dataset (16 training + 6 held-out test points around a
        gentle sine curve plus noise). No ML library; the curve and both errors are recomputed from scratch on each
        slider tick. The lower panel runs the same fit at every degree and plots both errors on a log scale; the
        flagged minimum is computed, not hand-picked.
      </p>
    </Figure>
  )
}
