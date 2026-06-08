// Hand-authored query / key / value vectors for a short slice of the attention
// sentence. NOTHING here is learned or a real vector. The numbers are set by hand so
// the mechanism is legible: picking "it" makes its Query match "animal"'s Key most
// strongly (the coreference case from the first figure), so "it" pulls in mostly
// "animal"'s Value. A real model learns Q, K, V from data; this is the idea, not the
// math.

// Colours for the three vector kinds (also defined in attentionData, kept local so
// this 2D figure is self-contained).
export const Q_COLOR = '#2f6f7e' // query  (teal)
export const K_COLOR = '#9a6b1f' // key    (amber)
export const V_COLOR = '#c0392b' // value  (accent)
export const INK = '#1a1a1a'
export const FADE = '#9b9892'

// A readable 4-word slice. Each word has a 3-dim Query, Key, and Value (values 0..1).
export const WORDS = [
  { id: 0, label: 'animal', q: [0.2, 0.2, 0.3], k: [0.9, 0.1, 0.2], v: [0.9, 0.2, 0.1] },
  { id: 1, label: 'street', q: [0.1, 0.8, 0.2], k: [0.1, 0.9, 0.1], v: [0.1, 0.9, 0.2] },
  { id: 2, label: 'it', q: [0.9, 0.1, 0.3], k: [0.3, 0.2, 0.3], v: [0.4, 0.3, 0.5] },
  { id: 3, label: 'tired', q: [0.3, 0.2, 0.8], k: [0.3, 0.1, 0.8], v: [0.2, 0.2, 0.9] },
]

export const DIMS = 3

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)

// Match of the picked word's Query against every word's Key, plus the normalized
// attention weight (match over the sum of matches) for each word.
export function matches(pickedId) {
  const picked = WORDS.find((w) => w.id === pickedId)
  const raw = WORDS.map((w) => ({ id: w.id, label: w.label, match: dot(picked.q, w.k) }))
  const total = raw.reduce((s, r) => s + r.match, 0)
  return raw.map((r) => ({ ...r, weight: total > 0 ? r.match / total : 0 }))
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
