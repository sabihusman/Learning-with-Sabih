// Attention for one example sentence, computed the way a transformer computes
// it: each word's Query is compared with every word's Key by a dot product,
// the scores are divided by the square root of the vector size, and softmax
// turns each row of scores into weights that are positive and sum to exactly 1.
//
// What is hand-authored is the Query and Key vectors: six readable features
// [creature, place, state, antecedent, local-subject, action] chosen so the
// sentence's relationships fall out of the dot products. A real model learns
// these vectors from data. Everything downstream of them is the real formula.

// Colour tokens re-exported for the sibling figures (transformerData,
// encoderDecoderData) that read them from here; the values live in vizPalette.
export { ACCENT, INK, FADE, PAPER } from './vizPalette'

export const SENTENCE = ['the', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'tired']

// Words laid along x in reading order, with a gentle 3D wobble (deterministic,
// from sin/cos) so attention links arc through space instead of lying flat.
export const WORDS = SENTENCE.map((label, i) => ({
  id: i,
  label,
  pos: [(i - 4.5) * 1.3, 0.45 * Math.sin(i * 1.3), 0.7 * Math.cos(i * 0.9)],
}))

export const FEATURES = ['creature', 'place', 'state', 'antecedent', 'local-subject', 'action']
export const DIMS = FEATURES.length

const VECTORS = {
  the: { q: [0.4, 0.4, 0, 0, 0, 0], k: [0.2, 0.2, 0, 0, 0, 0] },
  animal: { q: [1.5, 0, 0, 1.0, 0, 1.0], k: [1.5, 0, 0, 1.6, 0, 0] },
  "didn't": { q: [0, 0, 0, 0, 0, 1.6], k: [0, 0, 0.3, 0, 0, 0.4] },
  cross: { q: [1.2, 1.6, 0, 0, 0, 0], k: [0, 0, 0, 0, 0, 1.6] },
  street: { q: [0, 0, 0, 0, 0, 1.4], k: [0, 1.8, 0, 0, 0, 0] },
  because: { q: [0, 0, 1.8, 0, 0.6, 0], k: [0, 0, 0.2, 0, 0, 0] },
  it: { q: [1.2, 0, 0, 1.8, 0, 0], k: [0.6, 0, 0, 0, 1.6, 0] },
  was: { q: [0, 0, 0.8, 0, 1.4, 0], k: [0, 0, 0.4, 0, 0, 0.3] },
  tired: { q: [0, 0, 0, 0, 1.8, 0], k: [0, 0, 1.8, 0, 0, 0] },
}

export const queryOf = (id) => VECTORS[SENTENCE[id]].q
export const keyOf = (id) => VECTORS[SENTENCE[id]].k

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)

// Raw Query-Key match for one query word against every key, with optional
// per-key adjustments (the figure lets a reader nudge a score by hand).
export function rawScores(queryId, adjust = {}) {
  const q = queryOf(queryId)
  return WORDS.map((w) => dot(q, keyOf(w.id)) + (adjust[w.id] ?? 0))
}

// Softmax with max-subtraction for numerical stability. The output is
// positive and sums to 1 for any input, which is the point of the figure.
export function softmax(scores) {
  const mx = Math.max(...scores)
  const exps = scores.map((s) => Math.exp(s - mx))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

// One row of attention: raw scores, scaled scores, weights.
export function attentionRow(queryId, { scaled = true, adjust = {} } = {}) {
  const raw = rawScores(queryId, adjust)
  const divisor = scaled ? Math.sqrt(DIMS) : 1
  const scores = raw.map((r) => r / divisor)
  return { raw, scores, weights: softmax(scores) }
}

// The full matrix, one softmax row per query word.
export function attentionMatrix(options = {}) {
  return WORDS.map((w) => attentionRow(w.id, options).weights)
}

// Outgoing weight from a word to every word (itself included), keyed by id.
export function weightsFrom(id, options) {
  return Object.fromEntries(attentionRow(id, options).weights.map((w, j) => [j, w]))
}

// Top-k attended words other than the word itself, strongest first.
export function topLinks(id, k = 3, options) {
  return attentionRow(id, options)
    .weights.map((weight, j) => ({ id: j, weight }))
    .filter((l) => l.id !== id)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, k)
}
