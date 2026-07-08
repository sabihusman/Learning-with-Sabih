// Logistic regression on a hand-authored 2D dataset, fit for real by batch
// gradient descent, on a timer, in the browser. The learned object is three
// numbers: w1, w2, b, defining the line w1*x + w2*y + b = 0. Everything here
// is a pure function of (weights, points) so it is Node-testable with no DOM.
//
// Loss: binary cross-entropy. Optimizer: full-batch gradient descent, fixed
// learning rate, fixed step count. Deterministic: w = 0, b = 0 at the start of
// every run, same learning rate and step count every time.

export const CLASS0 = '#c98a3b' // amber, label 0 (matches the activations figure's outside class)
export const CLASS1 = '#2f6f8f' // blue, label 1 (matches the activations figure's inside class)
export const PAPER = '#f7f6f2'
export const INK = '#1a1a1a'
export const FADE = '#9b9892'

// ── hyperparameters (fixed, deterministic; verified by a Node harness before
// this module was wired into the UI) ─────────────────────────────────────────
export const LR = 3 // learning rate
export const STEPS_PER_TICK = 10 // gradient steps taken on each timer tick
export const TOTAL_ITERS = 200 // a run always takes exactly this many steps, then stops
export const TICK_MS = 100 // timer cadence
export const NUDGE_STEP = 0.05 // per-arrow-key-press point movement, in data units

// ── dataset: 14 hand-authored points in [-1, 1]^2, two roughly-separable
// clusters (label 0 lower-left, label 1 upper-right), each with one point
// planted close to the eventual boundary so the fit has real work to do ────
export const INITIAL_POINTS = [
  { id: 0, x: -0.8, y: -0.6, label: 0 },
  { id: 1, x: -0.6, y: -0.8, label: 0 },
  { id: 2, x: -0.7, y: -0.2, label: 0 },
  { id: 3, x: -0.3, y: -0.7, label: 0 },
  { id: 4, x: -0.9, y: 0.1, label: 0 },
  { id: 5, x: -0.4, y: -0.4, label: 0 },
  { id: 6, x: -0.05, y: -0.15, label: 0 }, // near the eventual boundary
  { id: 7, x: 0.8, y: 0.6, label: 1 },
  { id: 8, x: 0.6, y: 0.8, label: 1 },
  { id: 9, x: 0.7, y: 0.2, label: 1 },
  { id: 10, x: 0.3, y: 0.7, label: 1 },
  { id: 11, x: 0.9, y: -0.1, label: 1 },
  { id: 12, x: 0.4, y: 0.4, label: 1 },
  { id: 13, x: 0.15, y: 0.1, label: 1 }, // near the eventual boundary
]

export const ZERO_WEIGHTS = { w1: 0, w2: 0, b: 0 }

// numerically stable sigmoid
export const sigmoid = (z) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)))

// one full-batch gradient descent step (binary cross-entropy loss)
export function gradStep(weights, points, lr) {
  const { w1, w2, b } = weights
  let g1 = 0
  let g2 = 0
  let gb = 0
  for (const p of points) {
    const yhat = sigmoid(w1 * p.x + w2 * p.y + b)
    const dz = yhat - p.label // sigmoid + binary cross-entropy gives this clean gradient
    g1 += dz * p.x
    g2 += dz * p.y
    gb += dz
  }
  const n = points.length
  return { w1: w1 - (lr * g1) / n, w2: w2 - (lr * g2) / n, b: b - (lr * gb) / n }
}

// run n gradient steps from the given weights
export function trainSteps(weights, points, lr, n) {
  let w = weights
  for (let i = 0; i < n; i += 1) w = gradStep(w, points, lr)
  return w
}

// mean binary cross-entropy loss at the given weights
export function lossOf(weights, points) {
  const { w1, w2, b } = weights
  const eps = 1e-7
  let loss = 0
  for (const p of points) {
    const yhat = sigmoid(w1 * p.x + w2 * p.y + b)
    loss += -(p.label * Math.log(yhat + eps) + (1 - p.label) * Math.log(1 - yhat + eps))
  }
  return loss / points.length
}

// count of points on the wrong side of the current boundary
export function misclassifiedCount(weights, points) {
  const { w1, w2, b } = weights
  let c = 0
  for (const p of points) {
    const predicted = w1 * p.x + w2 * p.y + b >= 0 ? 1 : 0
    if (predicted !== p.label) c += 1
  }
  return c
}

// ── boundary geometry, for drawing the line and shading the two half-planes ──

export const SQUARE = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
]

function segIntersect(p1, p2, w1, w2, b) {
  const f1 = w1 * p1[0] + w2 * p1[1] + b
  const f2 = w1 * p2[0] + w2 * p2[1] + b
  const t = f1 / (f1 - f2)
  return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])]
}

// Sutherland-Hodgman clip of a convex polygon against one half-plane of the
// line w1*x + w2*y + b = 0. sign = +1 keeps w1*x+w2*y+b >= 0, sign = -1 keeps
// the other side. Used to shade each predicted-class region.
export function clipHalfPlane(poly, w1, w2, b, sign) {
  if (w1 === 0 && w2 === 0) return []
  const f = (p) => sign * (w1 * p[0] + w2 * p[1] + b)
  const out = []
  for (let i = 0; i < poly.length; i += 1) {
    const curr = poly[i]
    const prev = poly[(i - 1 + poly.length) % poly.length]
    const fCurr = f(curr)
    const fPrev = f(prev)
    if (fCurr >= 0) {
      if (fPrev < 0) out.push(segIntersect(prev, curr, w1, w2, b))
      out.push(curr)
    } else if (fPrev >= 0) {
      out.push(segIntersect(prev, curr, w1, w2, b))
    }
  }
  return out
}

// The boundary line's two endpoints where it crosses the [-1,1]^2 square, or
// null if the weights are degenerate (w1 = w2 = 0, no line yet).
export function boundarySegment(w1, w2, b) {
  if (w1 === 0 && w2 === 0) return null
  const pts = []
  const within = (v) => v >= -1 - 1e-9 && v <= 1 + 1e-9
  if (w2 !== 0) {
    const yLeft = -(w1 * -1 + b) / w2
    if (within(yLeft)) pts.push([-1, yLeft])
    const yRight = -(w1 * 1 + b) / w2
    if (within(yRight)) pts.push([1, yRight])
  }
  if (w1 !== 0) {
    const xBottom = -(w2 * -1 + b) / w1
    if (within(xBottom)) pts.push([xBottom, -1])
    const xTop = -(w2 * 1 + b) / w1
    if (within(xTop)) pts.push([xTop, 1])
  }
  if (pts.length < 2) return null
  return [pts[0], pts[pts.length - 1]]
}
