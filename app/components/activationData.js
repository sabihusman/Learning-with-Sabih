// A tiny 2->H->1 network trained from scratch in plain JS, used to show WHY a
// non-linear activation matters. With a LINEAR hidden layer the whole network
// collapses to a single linear map, so its decision boundary is always a straight
// line and it cannot separate a non-linearly-separable dataset, no matter how many
// units it has. With ReLU units the boundary becomes piecewise-linear and bends;
// more units add more hinges and wrap the ring more tightly. Everything is seeded,
// so each (activation, unit-count) result is deterministic and reproducible.
//
// This trains for real (full-batch gradient descent, a few seeded restarts kept by
// lowest loss). It is not a hand-drawn boundary: the straight-vs-bent contrast and
// the more-units-more-bends behaviour fall straight out of the maths.

export const PAPER = '#f7f6f2'
export const INK = '#1a1a1a'
export const FADE = '#9b9892'
export const ACCENT = '#c0392b'
export const CLASS1 = '#2f6f8f' // inside the ring (blue)
export const CLASS0 = '#c98a3b' // outside the ring (amber)

// ── controls range ──────────────────────────────────────────────────────────────
export const MIN_UNITS = 1
export const MAX_UNITS = 8
export const DEFAULT_UNITS = 6
export const GRID_N = 44 // decision-field resolution

// ── training hyperparameters (tuned so every setting converges deterministically
// while a single fit stays well under ~70ms, so it recomputes on a control change
// with no perceptible jank) ──────────────────────────────────────────────────────
const EPOCHS = 1500
const RESTARTS = 2
const LR = 0.6
const R = 0.72 // ring radius separating the two classes
const MARGIN = 0.13 // clear gap so the classes are cleanly separable
const N_POINTS = 140

// ── seeded PRNG (mulberry32) + gaussian via Box-Muller ──────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function gaussian(rng) {
  const u = Math.max(rng(), 1e-9)
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// numerically stable sigmoid
const sigmoid = (z) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)))
const relu = (z) => (z > 0 ? z : 0)

// ── dataset: inside vs outside a ring, with a clear margin gap ───────────────────
export const DATA = (() => {
  const rng = mulberry32(1)
  const pts = []
  let guard = 0
  while (pts.length < N_POINTS && guard < 8000) {
    guard += 1
    const x = rng() * 2 - 1
    const y = rng() * 2 - 1
    const r = Math.hypot(x, y)
    if (Math.abs(r - R) < MARGIN) continue
    pts.push({ x, y, label: r < R ? 1 : 0 })
  }
  return pts
})()

// ── network ──────────────────────────────────────────────────────────────────────
function makeNet(H, seed) {
  const rng = mulberry32(seed)
  // He-style init for the input->hidden weights; small init for hidden->output.
  const scaleIn = Math.sqrt(2 / 2)
  const W1 = []
  const b1 = []
  for (let j = 0; j < H; j += 1) {
    W1.push([gaussian(rng) * scaleIn, gaussian(rng) * scaleIn])
    b1.push(0.1) // small positive bias keeps ReLU units alive early
  }
  const W2 = []
  for (let j = 0; j < H; j += 1) W2.push(gaussian(rng) * Math.sqrt(2 / H))
  return { W1, b1, W2, b2: 0 }
}

function forward(net, x, y, useRelu) {
  const H = net.W1.length
  const z1 = new Array(H)
  const a1 = new Array(H)
  for (let j = 0; j < H; j += 1) {
    z1[j] = net.W1[j][0] * x + net.W1[j][1] * y + net.b1[j]
    a1[j] = useRelu ? relu(z1[j]) : z1[j]
  }
  let zo = net.b2
  for (let j = 0; j < H; j += 1) zo += net.W2[j] * a1[j]
  return { z1, a1, yhat: sigmoid(zo) }
}

// one full-batch epoch; mutates net in place and returns the mean BCE loss
function trainEpoch(net, data, lr, useRelu) {
  const H = net.W1.length
  const gW1 = net.W1.map(() => [0, 0])
  const gb1 = new Array(H).fill(0)
  const gW2 = new Array(H).fill(0)
  let gb2 = 0
  let loss = 0
  const eps = 1e-7
  for (const p of data) {
    const { z1, a1, yhat } = forward(net, p.x, p.y, useRelu)
    loss += -(p.label * Math.log(yhat + eps) + (1 - p.label) * Math.log(1 - yhat + eps))
    const dzo = yhat - p.label // sigmoid + BCE gives this clean gradient
    for (let j = 0; j < H; j += 1) {
      gW2[j] += dzo * a1[j]
      const grad = useRelu ? (z1[j] > 0 ? 1 : 0) : 1 // through the activation
      const dz = dzo * net.W2[j] * grad
      gW1[j][0] += dz * p.x
      gW1[j][1] += dz * p.y
      gb1[j] += dz
    }
    gb2 += dzo
  }
  const n = data.length
  for (let j = 0; j < H; j += 1) {
    net.W2[j] -= (lr * gW2[j]) / n
    net.W1[j][0] -= (lr * gW1[j][0]) / n
    net.W1[j][1] -= (lr * gW1[j][1]) / n
    net.b1[j] -= (lr * gb1[j]) / n
  }
  net.b2 -= (lr * gb2) / n
  return loss / n
}

function meanLoss(net, data, useRelu) {
  let loss = 0
  const eps = 1e-7
  for (const p of data) {
    const { yhat } = forward(net, p.x, p.y, useRelu)
    loss += -(p.label * Math.log(yhat + eps) + (1 - p.label) * Math.log(1 - yhat + eps))
  }
  return loss / data.length
}

// Fit a network for the given hidden-unit count and activation. Runs a few seeded
// restarts and keeps the one with the lowest final loss, so the result is both
// deterministic and robust to a single unlucky initialization.
export function fit(H, useRelu) {
  let best = null
  let bestLoss = Infinity
  for (let s = 0; s < RESTARTS; s += 1) {
    const net = makeNet(H, 7 + s * 101 + (useRelu ? 1000 : 0) + H * 13)
    let l = 0
    for (let e = 0; e < EPOCHS; e += 1) l = trainEpoch(net, DATA, LR, useRelu)
    if (l < bestLoss) {
      bestLoss = l
      best = net
    }
  }
  return { net: best, loss: bestLoss, useRelu }
}

// Session cache so each (units, activation) pair is fitted at most once. There are
// only MAX_UNITS x 2 possible keys, so this stays tiny and the UI never re-trains a
// setting the reader has already visited.
const FIT_CACHE = new Map()
export function fitCached(H, useRelu) {
  const key = `${useRelu ? 'relu' : 'linear'}-${H}`
  let hit = FIT_CACHE.get(key)
  if (!hit) {
    hit = fit(H, useRelu)
    FIT_CACHE.set(key, hit)
  }
  return hit
}

// predicted probability on an n x n grid over [-1, 1]^2 (row-major, top row = +1)
export function predictGrid(net, n, useRelu) {
  const out = new Float32Array(n * n)
  for (let iy = 0; iy < n; iy += 1) {
    const y = 1 - ((iy + 0.5) / n) * 2
    for (let ix = 0; ix < n; ix += 1) {
      const x = ((ix + 0.5) / n) * 2 - 1
      out[iy * n + ix] = forward(net, x, y, useRelu).yhat
    }
  }
  return out
}

export function accuracy(net, useRelu) {
  let c = 0
  for (const p of DATA) if ((forward(net, p.x, p.y, useRelu).yhat >= 0.5 ? 1 : 0) === p.label) c += 1
  return c / DATA.length
}
