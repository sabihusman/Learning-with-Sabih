// Pure data + compression logic for the Entropy and Compression figure. No React, no
// DOM: a 4-symbol probability table plus two real, testable functions over it, Shannon
// entropy and a Huffman code builder, so every readout the figure shows is computed
// live rather than typed in.
//
// Default probabilities are deliberately not a power-of-two set, so the gap between
// entropy and the Huffman average is visible the moment the figure loads (verified in
// a throwaway Node harness before this module was written): entropy ~= 1.846 bits,
// Huffman average ~= 1.900 bits, gap ~= 0.054 bits.

export const SYMBOLS = ['A', 'B', 'C', 'D']
export const DEFAULT_PROBS = [0.4, 0.3, 0.2, 0.1]

// Move symbol `index` to `rawValue` (clamped to [0, 1]) and rescale every other
// probability proportionally so the table still sums to 1. If every other symbol is
// currently at 0 (nothing to scale proportionally), the freed-up mass is split evenly
// among them instead.
export function adjustProbability(probs, index, rawValue) {
  const clamped = Math.min(Math.max(rawValue, 0), 1)
  const othersSum = probs.reduce((sum, p, i) => (i === index ? sum : sum + p), 0)
  const remaining = 1 - clamped
  const n = probs.length - 1
  return probs.map((p, i) => {
    if (i === index) return clamped
    if (othersSum <= 1e-9) return n > 0 ? remaining / n : 0
    return (p / othersSum) * remaining
  })
}

// Shannon entropy in bits/symbol: H = -sum(p_i * log2(p_i)), skipping p_i = 0 (0*log2(0)
// is taken as its limit, 0).
export function shannonEntropy(probs) {
  return probs.reduce((sum, p) => (p > 0 ? sum - p * Math.log2(p) : sum), 0)
}

// Build a Huffman code over the symbols with nonzero probability by repeatedly merging
// the two lowest-weight nodes. Standard binary-heap-free version: with only 4 symbols,
// re-sorting the small working array each merge is simplest and plenty fast.
// A single active symbol is a degenerate case (nothing to distinguish it from), and is
// still given a 1-bit code "0" rather than a 0-length code, matching common convention.
export function buildHuffmanCodes(labels, probs) {
  const active = labels
    .map((label, i) => ({ label, prob: probs[i] }))
    .filter((s) => s.prob > 0)

  if (active.length === 0) return {}
  if (active.length === 1) return { [active[0].label]: '0' }

  let nodes = active.map((s) => ({ prob: s.prob, label: s.label, left: null, right: null }))
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.prob - b.prob)
    const a = nodes.shift()
    const b = nodes.shift()
    nodes.push({ prob: a.prob + b.prob, left: a, right: b })
  }

  const codes = {}
  ;(function walk(node, prefix) {
    if (node.label !== undefined) {
      codes[node.label] = prefix
      return
    }
    walk(node.left, `${prefix}0`)
    walk(node.right, `${prefix}1`)
  })(nodes[0], '')
  return codes
}

// Average Huffman code length in bits/symbol: sum(p_i * length_i). Zero-probability
// symbols (no code, since they were excluded from the tree) contribute 0 regardless.
export function averageCodeLength(labels, probs, codes) {
  return labels.reduce((sum, label, i) => sum + probs[i] * (codes[label]?.length ?? 0), 0)
}

// True if no code in the set is a strict prefix of another (the defining property of a
// decodable, uniquely-parseable code).
export function isPrefixFree(codeList) {
  for (const a of codeList) {
    for (const b of codeList) {
      if (a !== b && b.startsWith(a) && b !== a) return false
    }
  }
  return true
}
