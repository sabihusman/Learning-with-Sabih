// Pure data + compression logic for the Entropy and Compression figure. No React, no
// DOM: a 4-symbol probability table plus real, testable functions over it (Shannon
// entropy, a Huffman tree builder that records each merge, encoding a message and
// decoding it bit by bit), so every readout the figure shows is computed live rather
// than typed in.
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

// Build the Huffman tree over the symbols with nonzero probability by repeatedly
// merging the two lowest-weight nodes, and record every merge so the figure can draw
// the tree one merge at a time. Each round re-sorts the small working array (stable,
// so on a tie the node that was in the array first goes first: a leaf before a merged
// node built later), takes the two smallest, and appends their merge at the end. The
// smaller of the two becomes the left child, read as bit 0; the other is the right
// child, bit 1.
//
// Node ids: leaves are 0..n-1 in symbol order (zero-probability symbols skipped);
// merge k creates node n + k.
export function buildHuffmanTree(labels, probs) {
  const leaves = []
  labels.forEach((label, i) => {
    if (probs[i] > 0) leaves.push({ id: leaves.length, label, prob: probs[i], left: null, right: null })
  })
  const nodes = [...leaves]
  const merges = []
  let work = [...leaves]
  while (work.length > 1) {
    work.sort((a, b) => a.prob - b.prob)
    const a = work.shift()
    const b = work.shift()
    const node = { id: nodes.length, label: undefined, prob: a.prob + b.prob, left: a.id, right: b.id }
    nodes.push(node)
    merges.push(node)
    work.push(node)
  }
  return { leaves, nodes, merges, root: nodes.length ? nodes.length - 1 : null }
}

// Codes read off the finished tree: left edge 0, right edge 1. A single active symbol
// is a degenerate case (nothing to distinguish it from), and is still given a 1-bit
// code "0" rather than a 0-length code, matching common convention.
export function codesFromTree(tree) {
  if (tree.root === null) return {}
  if (tree.leaves.length === 1) return { [tree.leaves[0].label]: '0' }
  const codes = {}
  const walk = (id, prefix) => {
    const node = tree.nodes[id]
    if (node.label !== undefined) {
      codes[node.label] = prefix
      return
    }
    walk(node.left, `${prefix}0`)
    walk(node.right, `${prefix}1`)
  }
  walk(tree.root, '')
  return codes
}

export function buildHuffmanCodes(labels, probs) {
  return codesFromTree(buildHuffmanTree(labels, probs))
}

// The forest after the first `k` merges: ids of the trees still standing, i.e. every
// node not yet used as a child by one of those merges.
export function forestAfter(tree, k) {
  const used = new Set()
  const standing = tree.nodes.filter((n) => n.label !== undefined || n.id < tree.leaves.length + k)
  tree.merges.slice(0, k).forEach((m) => {
    used.add(m.left)
    used.add(m.right)
  })
  return standing.filter((n) => !used.has(n.id)).map((n) => n.id)
}

// A message of `length` symbols whose counts follow the current probabilities:
// each symbol gets floor(p * length) copies, and the leftover places go to the
// largest remainders (ties to the earlier symbol). Copies are spread out rather
// than bunched: copy j of a symbol with c copies sits at (j + 0.5) / c along the
// message, and the message is those positions in order (ties to the earlier symbol).
export const MESSAGE_LENGTH = 20

export function messageCounts(labels, probs, length = MESSAGE_LENGTH) {
  const raw = probs.map((p) => p * length)
  const counts = raw.map((r) => Math.floor(r + 1e-9))
  let left = length - counts.reduce((a, c) => a + c, 0)
  const order = raw
    .map((r, i) => ({ i, rem: r - counts[i] }))
    .filter((x) => probs[x.i] > 0)
    .sort((a, b) => b.rem - a.rem || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    counts[i]++
    left--
  }
  return Object.fromEntries(labels.map((l, i) => [l, counts[i]]))
}

export function buildMessage(labels, probs, length = MESSAGE_LENGTH) {
  const counts = messageCounts(labels, probs, length)
  const slots = []
  labels.forEach((label, i) => {
    const c = counts[label]
    for (let j = 0; j < c; j++) slots.push({ label, i, pos: (j + 0.5) / c })
  })
  slots.sort((a, b) => a.pos - b.pos || a.i - b.i)
  return slots.map((s) => s.label)
}

// Encode a message with a code table: the bit string, and where each symbol's code
// sits in it.
export function encodeMessage(message, codes) {
  let bits = ''
  const segments = message.map((label) => {
    const start = bits.length
    bits += codes[label]
    return { label, start, code: codes[label] }
  })
  return { bits, segments }
}

// Decode a bit string by walking the tree: start at the root, go left on 0 and right
// on 1, and on reaching a leaf emit its symbol and go back to the root. Returns one
// step per bit: the node reached and the symbol emitted (if any). A one-leaf tree
// emits its only symbol on every bit.
export function decodeTrace(bits, tree) {
  const steps = []
  if (tree.root === null) return steps
  let at = tree.root
  for (const bit of bits) {
    const node = tree.nodes[at]
    const next = node.label === undefined ? tree.nodes[bit === '0' ? node.left : node.right] : node
    if (next.label === undefined) {
      steps.push({ bit, node: next.id, emitted: null })
      at = next.id
    } else {
      steps.push({ bit, node: next.id, emitted: next.label })
      at = tree.root
    }
  }
  return steps
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
