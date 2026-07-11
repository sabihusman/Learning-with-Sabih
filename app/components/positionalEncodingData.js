// Real sin/cos positional encoding from "Attention Is All You Need" (Vaswani et al.),
// computed live at a small scale for display. Nothing here is hand-typed: every value
// is peValue's output for that (pos, dim) pair.
//
//   PE(pos, 2i)   = sin(pos / 10000^(2i / d_model))
//   PE(pos, 2i+1) = cos(pos / 10000^(2i / d_model))
//
// Even dimensions use sine, odd dimensions use cosine; i is the dimension-PAIR index
// (floor(dim / 2)), so dims 0 and 1 share pair 0, dims 2 and 3 share pair 1, and so on.
// The wavelength grows with i, so low pairs cycle fast across positions and high pairs
// cycle slow.

export const D_MODEL = 12
export const SEQ_LEN = 10
export const NUM_PAIRS = D_MODEL / 2
export const POSITIONS = Array.from({ length: SEQ_LEN }, (_, i) => i)

// The angle shared by one dimension pair (i) at one position, before sin/cos is taken.
function angle(pos, pairIndex, dModel) {
  return pos / 10000 ** ((2 * pairIndex) / dModel)
}

// The single value for one position and one dimension: even dims use sine, odd dims
// use cosine, both driven by the same pair angle.
export function peValue(pos, dim, dModel = D_MODEL) {
  const pairIndex = Math.floor(dim / 2)
  const a = angle(pos, pairIndex, dModel)
  return dim % 2 === 0 ? Math.sin(a) : Math.cos(a)
}

// The full length-dModel encoding vector for a position, derived from peValue.
export function peVector(pos, dModel = D_MODEL) {
  return Array.from({ length: dModel }, (_, dim) => peValue(pos, dim, dModel))
}

// The continuous wave a dimension pair follows across position, for drawing: sample at
// any real-valued position, not just the integers in POSITIONS, so the figure can plot
// a smooth curve.
export function waveAt(pairIndex, pos, kind, dModel = D_MODEL) {
  const a = angle(pos, pairIndex, dModel)
  return kind === 'cos' ? Math.cos(a) : Math.sin(a)
}

// The period, in positions, of a dimension pair's wave (2*pi divided by the angular
// frequency), so the figure can report how many positions one cycle spans.
export function periodOf(pairIndex, dModel = D_MODEL) {
  return 2 * Math.PI * 10000 ** ((2 * pairIndex) / dModel)
}

// How similar two positions' encodings are, derived from peVector. Every peVector has
// the same squared norm (each sin/cos pair contributes exactly 1, so the squared norm
// is always dModel / 2, independent of position), so a plain dot product already orders
// positions the same way cosine similarity would; no separate normalization is needed.
export function similarity(posA, posB, dModel = D_MODEL) {
  const a = peVector(posA, dModel)
  const b = peVector(posB, dModel)
  return a.reduce((sum, val, dim) => sum + val * b[dim], 0)
}
