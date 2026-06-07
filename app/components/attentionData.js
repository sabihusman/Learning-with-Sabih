// Hand-authored attention weights for one example sentence. NOTHING here is a
// real attention computation. The weights are set by hand so the teaching point
// is legible: clicking "it" shows a strong link to "animal" (what "it" refers
// to) and weak links elsewhere. Real attention is computed from learned query,
// key, and value vectors across many heads; this is the idea, not the math.

export const ACCENT = '#c0392b'
export const INK = '#1a1a1a'
export const FADE = '#9b9892'
export const PAPER = '#f7f6f2'

export const SENTENCE = ['the', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'tired']

// Words laid along x in reading order, with a gentle 3D wobble (deterministic,
// from sin/cos) so attention links arc through space instead of lying flat.
export const WORDS = SENTENCE.map((label, i) => ({
  id: i,
  label,
  pos: [(i - 4.5) * 1.3, 0.45 * Math.sin(i * 1.3), 0.7 * Math.cos(i * 0.9)],
}))

// Outgoing attention: from a clicked word, how strongly it attends to each
// other word (0..1). Keyed by word index. The famous coreference case is "it".
const WEIGHTS = {
  7: { 1: 1.0, 9: 0.5, 8: 0.35, 5: 0.2, 3: 0.15, 6: 0.15, 0: 0.08, 2: 0.08, 4: 0.08 }, // it  -> animal (strong)
  1: { 0: 0.6, 7: 0.45, 3: 0.5, 2: 0.4, 5: 0.3, 9: 0.3 }, // animal
  9: { 7: 0.7, 1: 0.55, 8: 0.5, 6: 0.35 }, // tired -> it, animal
  3: { 5: 0.8, 1: 0.7, 2: 0.5, 4: 0.4 }, // cross -> street, animal
  5: { 3: 0.7, 4: 0.6, 1: 0.35, 7: 0.25 }, // street -> cross
  6: { 9: 0.7, 7: 0.5, 3: 0.4, 1: 0.3 }, // because -> tired
}

// Function words ("the", "didn't", "was") have no authored row; they fall back
// to attending mostly to their immediate neighbors, which is a sensible default.
function fallbackWeights(id) {
  const w = {}
  if (id - 1 >= 0) w[id - 1] = 0.45
  if (id + 1 < WORDS.length) w[id + 1] = 0.45
  return w
}

// weight from source word to a target word (0 if none)
export function weightsFrom(id) {
  return WEIGHTS[id] ?? fallbackWeights(id)
}

// top-k attended words for the readout, strongest first
export function topLinks(id, k = 3) {
  const w = weightsFrom(id)
  return Object.entries(w)
    .map(([target, weight]) => ({ id: Number(target), weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, k)
}
