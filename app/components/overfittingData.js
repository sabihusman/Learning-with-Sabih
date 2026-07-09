// Polynomial-regression demo for the overfitting topic. Everything is deterministic:
// a fixed PRNG seed generates the training points (a gentle curve + noise) and a
// separate seed generates the held-out test points. The fit is a real polynomial
// least-squares solve via the normal equations, with a tiny ridge for numerical
// stability at high degree. No ML library; this is plain JS.

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Box-Muller, paired with a PRNG so noise is reproducible.
function gauss(rng) {
  const u1 = Math.max(rng(), 1e-9)
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

// The underlying trend the data is generated from: a gentle sine wave plus a slope.
export const truth = (x) => Math.sin(2 * Math.PI * x * 0.8) + 0.4 * x

const NOISE = 0.18

// Training set: 16 points spread across x in [0, 1] with noise.
const trainRng = mulberry32(7)
export const TRAIN = Array.from({ length: 16 }, (_, i) => {
  const x = i / 15
  return { x, y: truth(x) + NOISE * gauss(trainRng) }
})

// Held-out test set: 6 points at different x positions, with separate noise.
const testRng = mulberry32(101)
export const TEST = Array.from({ length: 6 }, (_, i) => {
  const x = (i + 0.5) / 6
  return { x, y: truth(x) + NOISE * gauss(testRng) }
})

export const MIN_DEG = 1
export const MAX_DEG = 14

// Fit a polynomial of the given degree to points by solving (X^T X + λI) β = X^T y
// via Gaussian elimination. Returns the coefficient array [β0, β1, ..., β_deg].
export function fitPolynomial(points, degree) {
  const d = degree + 1
  const xtx = Array.from({ length: d }, () => new Array(d).fill(0))
  const xty = new Array(d).fill(0)
  for (const p of points) {
    const xs = [1]
    for (let k = 1; k < d; k += 1) xs.push(xs[k - 1] * p.x)
    for (let i = 0; i < d; i += 1) {
      xty[i] += xs[i] * p.y
      for (let j = 0; j < d; j += 1) xtx[i][j] += xs[i] * xs[j]
    }
  }
  // tiny ridge to keep the matrix invertible at high degree
  for (let i = 0; i < d; i += 1) xtx[i][i] += 1e-8

  // augmented system [A | b]
  const M = xtx.map((row, i) => [...row, xty[i]])
  for (let c = 0; c < d; c += 1) {
    let piv = c
    for (let r = c + 1; r < d; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    if (piv !== c) {
      const tmp = M[c]
      M[c] = M[piv]
      M[piv] = tmp
    }
    const pv = M[c][c] || 1e-12
    for (let j = c; j <= d; j += 1) M[c][j] /= pv
    for (let r = 0; r < d; r += 1) {
      if (r === c) continue
      const f = M[r][c]
      for (let j = c; j <= d; j += 1) M[r][j] -= f * M[c][j]
    }
  }
  return M.map((row) => row[d])
}

export function predict(coef, x) {
  let term = 1
  let s = 0
  for (let k = 0; k < coef.length; k += 1) {
    s += coef[k] * term
    term *= x
  }
  return s
}

export function mse(coef, points) {
  return points.reduce((s, p) => s + (p.y - predict(coef, p.x)) ** 2, 0) / points.length
}

// A label for the three regimes given the chosen degree.
export function regime(degree) {
  if (degree <= 2) return 'underfitting'
  if (degree <= 6) return 'good fit'
  return 'overfitting'
}

// Train and test error at every degree from MIN_DEG to MAX_DEG, for the U-curve panel.
export function errorCurve() {
  const points = []
  for (let d = MIN_DEG; d <= MAX_DEG; d += 1) {
    const coef = fitPolynomial(TRAIN, d)
    points.push({ degree: d, train: mse(coef, TRAIN), test: mse(coef, TEST) })
  }
  return points
}

// The degree at which test error is smallest, i.e. the best-generalizing model.
export function bestDegree(curve) {
  return curve.reduce((best, p) => (p.test < best.test ? p : best), curve[0]).degree
}
