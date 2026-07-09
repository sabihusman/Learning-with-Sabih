// A tiny neural network trained from scratch in plain JS: forward pass, backprop,
// and full-batch gradient descent. No ML library. Everything is seeded so the run
// is deterministic. The task is a classic non-linear one: classify 2D points as
// inside vs outside a circle, which a single linear boundary cannot do but a small
// hidden layer can.

export const PAPER = '#f7f6f2'
export const INK = '#1a1a1a'
export const FADE = '#9b9892'
export const CLASS1 = '#2f6f8f' // inside the circle (blue)
export const CLASS0 = '#c98a3b' // outside the circle (amber)
export const POS_EDGE = '#1a1a1a' // positive weight
export const NEG_EDGE = '#c0392b' // negative weight

// ── hyperparameters (tuned so it converges smoothly in a few seconds) ──────────
export const H = 6 // hidden neurons
export const LR = 2.0 // learning rate (full-batch)
export const EPOCHS_PER_FRAME = 3 // training steps per animation frame
export const STEP_EPOCHS = 25 // epochs advanced by one click of "Step"
export const MAX_EPOCH = 4000 // safety cap
export const CONVERGE_LOSS = 0.012 // auto-pause once the loss is this low
export const GRID_N = 24 // decision-field resolution
const SEED_DATA = 1
const SEED_NET = 7

// ── seeded PRNG ────────────────────────────────────────────────────────────────
function mulberry32(a) {
  return function () {
    a = Math.trunc(a)
    a = Math.trunc(a + 0x6d2b79f5)
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// numerically stable sigmoid
const sigmoid = (z) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)))

// ── dataset: inside vs outside a circle, with a small margin gap ────────────────
const R = 0.8
const MARGIN = 0.1
export const DATA = (() => {
  const rng = mulberry32(SEED_DATA)
  const pts = []
  let guard = 0
  while (pts.length < 160 && guard < 6000) {
    guard++
    const x = rng() * 2 - 1
    const y = rng() * 2 - 1
    const r = Math.hypot(x, y)
    if (Math.abs(r - R) < MARGIN) continue // clear gap so the classes are separable
    pts.push({ x, y, label: r < R ? 1 : 0 })
  }
  return pts
})()

// ── network ─────────────────────────────────────────────────────────────────────
export function makeNet() {
  const rng = mulberry32(SEED_NET)
  const r = () => (rng() * 2 - 1) * 0.9
  const W1 = []
  const b1 = []
  for (let j = 0; j < H; j++) {
    W1.push([r(), r()])
    b1.push(0)
  }
  const W2 = []
  for (let j = 0; j < H; j++) W2.push(r())
  return { W1, b1, W2, b2: 0 }
}

export function forward(net, x, y) {
  const h = new Array(H)
  for (let j = 0; j < H; j++) {
    h[j] = Math.tanh(net.W1[j][0] * x + net.W1[j][1] * y + net.b1[j])
  }
  let zo = net.b2
  for (let j = 0; j < H; j++) zo += net.W2[j] * h[j]
  return { h, yhat: sigmoid(zo) }
}

// one full-batch epoch; mutates net in place and returns the mean BCE loss
export function trainEpoch(net, data, lr) {
  const gW1 = net.W1.map(() => [0, 0])
  const gb1 = new Array(H).fill(0)
  const gW2 = new Array(H).fill(0)
  let gb2 = 0
  let loss = 0
  const eps = 1e-7
  for (const p of data) {
    const { h, yhat } = forward(net, p.x, p.y)
    loss += -(p.label * Math.log(yhat + eps) + (1 - p.label) * Math.log(1 - yhat + eps))
    const dzo = yhat - p.label // sigmoid + BCE gives this clean gradient
    for (let j = 0; j < H; j++) {
      gW2[j] += dzo * h[j]
      const dz = dzo * net.W2[j] * (1 - h[j] * h[j]) // through tanh
      gW1[j][0] += dz * p.x
      gW1[j][1] += dz * p.y
      gb1[j] += dz
    }
    gb2 += dzo
  }
  const n = data.length
  for (let j = 0; j < H; j++) {
    net.W2[j] -= (lr * gW2[j]) / n
    net.W1[j][0] -= (lr * gW1[j][0]) / n
    net.W1[j][1] -= (lr * gW1[j][1]) / n
    net.b1[j] -= (lr * gb1[j]) / n
  }
  net.b2 -= (lr * gb2) / n
  return loss / n
}

export function meanLoss(net, data) {
  let loss = 0
  const eps = 1e-7
  for (const p of data) {
    const { yhat } = forward(net, p.x, p.y)
    loss += -(p.label * Math.log(yhat + eps) + (1 - p.label) * Math.log(1 - yhat + eps))
  }
  return loss / data.length
}

// predicted probability on an n x n grid over [-1, 1]^2 (row-major), for the field
export function predictGrid(net, n) {
  const out = new Float32Array(n * n)
  for (let iy = 0; iy < n; iy++) {
    const y = 1 - ((iy + 0.5) / n) * 2 // top row = +1
    for (let ix = 0; ix < n; ix++) {
      const x = ((ix + 0.5) / n) * 2 - 1
      out[iy * n + ix] = forward(net, x, y).yhat
    }
  }
  return out
}

// snapshot of just the weights, for the live diagram (cheap shallow copy)
export function snapshotWeights(net) {
  return {
    W1: net.W1.map((row) => row.slice()),
    W2: net.W2.slice(),
  }
}
