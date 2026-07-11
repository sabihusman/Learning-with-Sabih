// Hand-authored query / key / value vectors for a short slice of the attention
// sentence. NOTHING here is learned or a real vector. Each dimension stands for a real
// feature so the intended relationships fall out of the dot product honestly, not from
// inflated magnitudes: [creature, place, state, antecedent-strength, local-subject].
// "animal" and "street" are self-referential anchors (their Query mirrors their own
// Key -- nothing else in this slice is a closer match). "it" is a pronoun: its Query
// seeks a strong creature-antecedent, which "animal" offers and "it" itself lacks, so
// "it" attends most to "animal" (the coreference case from the first figure). "tired"
// is a predicate: its Query seeks whichever word is the local grammatical subject its
// state applies to, which is "it" ("it was tired"), not the distant "animal". Values
// stay in 0..1 so the figure's opacity encoding (VecCells) stays legible.
// A real model learns Q, K, V from data; this is the idea, not the math.

// Colours for the three vector kinds (also defined in attentionData, kept local so
// this 2D figure is self-contained).
export const Q_COLOR = '#2f6f7e' // query  (teal)
export const K_COLOR = '#9a6b1f' // key    (amber)
export const V_COLOR = '#c0392b' // value  (accent)
export const INK = '#1a1a1a'
export const FADE = '#9b9892'

// A readable 4-word slice. Each word has a 5-dim Query, Key, and Value (values 0..1).
export const WORDS = [
  { id: 0, label: 'animal', q: [0.9, 0, 0, 1.0, 0], k: [0.9, 0, 0, 1.0, 0], v: [0.9, 0.2, 0.1, 0.6, 0] },
  { id: 1, label: 'street', q: [0, 1.0, 0, 0.1, 0], k: [0, 1.0, 0, 0.1, 0], v: [0.1, 0.9, 0.2, 0.1, 0] },
  { id: 2, label: 'it', q: [0.9, 0, 0, 1.0, 0], k: [0.5, 0, 0, 0.1, 1.0], v: [0.4, 0.3, 0.5, 0.1, 0.6] },
  { id: 3, label: 'tired', q: [0, 0, 0, 0, 1.0], k: [0, 0, 0.9, 0, 0], v: [0.2, 0.2, 0.9, 0, 0.1] },
]

export const DIMS = 5

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)

// Match of the picked word's Query against every word's Key (raw dot product), plus
// the attention weight from scaled dot-product softmax: score = match / sqrt(DIMS),
// weight = exp(score - max) / sum(exp(score - max)) (max-subtraction for numerical
// stability, same shape as the softmax in temperatureData.js).
export function matches(pickedId) {
  const picked = WORDS.find((w) => w.id === pickedId)
  const raw = WORDS.map((w) => ({ id: w.id, label: w.label, match: dot(picked.q, w.k) }))
  const scores = raw.map((r) => r.match / Math.sqrt(DIMS))
  const mx = Math.max(...scores)
  const exps = scores.map((s) => Math.exp(s - mx))
  const sum = exps.reduce((a, b) => a + b, 0)
  return raw.map((r, i) => ({ ...r, weight: exps[i] / sum }))
}

// The picked word's output: each Value blended by that word's weight.
export function output(pickedId) {
  const ms = matches(pickedId)
  const out = new Array(DIMS).fill(0)
  ms.forEach((m) => {
    const w = WORDS.find((x) => x.id === m.id)
    for (let d = 0; d < DIMS; d += 1) out[d] += m.weight * w.v[d]
  })
  return out
}

// Top matches (excluding the word itself) for the readout, strongest first.
export function topMatches(pickedId, k = 2) {
  return matches(pickedId)
    .filter((m) => m.id !== pickedId)
    .sort((a, b) => b.match - a.match)
    .slice(0, k)
}
