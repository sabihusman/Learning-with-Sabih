// Hand-authored candidate next-words for one context, plus the real softmax-with-
// temperature math. The base scores (logits) are hand-set so the lesson is legible:
// "mat" is the obvious top choice, "floor" and "chair" are plausible alternatives,
// "roof" is unusual, and "moon" is nonsense. This is NOT a real model predicting;
// the prose says so. The temperature math, however, is exactly what models use.

export const CONTEXT = 'The cat sat on the ___'

// Candidates with hand-authored base logits (higher = more plausible).
export const CANDIDATES = [
  { word: 'mat', logit: 5.2 },
  { word: 'floor', logit: 3.6 },
  { word: 'chair', logit: 2.6 },
  { word: 'roof', logit: 0.8 },
  { word: 'moon', logit: -1.5 },
]

export const T_MIN = 0.1
export const T_MAX = 2.0

// Softmax(logits / T). Subtract the max for numerical stability before exp.
export function probsAt(temperature) {
  const T = Math.max(temperature, 1e-6)
  const scaled = CANDIDATES.map((c) => c.logit / T)
  const mx = Math.max(...scaled)
  const exps = scaled.map((s) => Math.exp(s - mx))
  const sum = exps.reduce((a, b) => a + b, 0)
  return CANDIDATES.map((c, i) => ({ word: c.word, p: exps[i] / sum }))
}

export function entropy(probs) {
  // bits; useful as a one-number readout of how "flat" the distribution is.
  return -probs.reduce((s, x) => s + (x.p > 0 ? x.p * Math.log2(x.p) : 0), 0)
}

// Pick a word according to the given probabilities. Caller passes a random number in
// [0, 1) so determinism stays at the call site (only sampling is random; base scores
// and the math are pure).
export function sampleWith(probs, r) {
  let acc = 0
  for (const x of probs) {
    acc += x.p
    if (r < acc) return x.word
  }
  return probs[probs.length - 1].word
}
