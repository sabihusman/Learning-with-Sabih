// Pure data + search logic for the Beam Search vs Greedy Decoding figure. No React,
// no DOM: this module is a token-probability tree plus two decoding strategies over
// it, both real, testable functions of the tree.
//
// The tree is hand-authored to contain a deliberate trap: greedy decoding always takes
// the single highest-probability next token, but the token it picks first (highest
// local probability) leads only to mediocre continuations, while a slightly
// lower-probability first token opens onto a near-certain continuation whose combined
// probability is much higher. Verified in a throwaway Node harness before this module
// was written (see the PR description for the exact numbers): greedy reaches "cloudy
// and windy" (logP ~ -3.074), beam search with width >= 2 finds "clear and warm"
// (logP ~ -1.261), a margin of about 1.81 nats (~6.1x more probable).

const RAW_TREE = {
  token: 'START',
  prob: null,
  children: [
    {
      token: 'cloudy', prob: 0.40,
      children: [
        { token: 'and', prob: 0.34, children: [
          { token: 'windy', prob: 0.34, children: [] },
          { token: 'humid', prob: 0.33, children: [] },
          { token: 'mild', prob: 0.33, children: [] },
        ] },
        { token: 'with', prob: 0.33, children: [
          { token: 'gusts', prob: 0.40, children: [] },
          { token: 'drizzle', prob: 0.35, children: [] },
          { token: 'haze', prob: 0.25, children: [] },
        ] },
        { token: 'then', prob: 0.33, children: [
          { token: 'clearing', prob: 0.40, children: [] },
          { token: 'thunder', prob: 0.35, children: [] },
          { token: 'fog', prob: 0.25, children: [] },
        ] },
      ],
    },
    {
      token: 'clear', prob: 0.35,
      children: [
        { token: 'and', prob: 0.90, children: [
          { token: 'warm', prob: 0.90, children: [] },
          { token: 'cool', prob: 0.06, children: [] },
          { token: 'breezy', prob: 0.04, children: [] },
        ] },
        { token: 'but', prob: 0.07, children: [
          { token: 'windy', prob: 0.40, children: [] },
          { token: 'chilly', prob: 0.35, children: [] },
          { token: 'humid', prob: 0.25, children: [] },
        ] },
        { token: 'or', prob: 0.03, children: [
          { token: 'partly', prob: 0.40, children: [] },
          { token: 'mostly', prob: 0.35, children: [] },
          { token: 'fully', prob: 0.25, children: [] },
        ] },
      ],
    },
    {
      token: 'stormy', prob: 0.25,
      children: [
        { token: 'with', prob: 0.40, children: [
          { token: 'hail', prob: 0.40, children: [] },
          { token: 'thunder', prob: 0.35, children: [] },
          { token: 'flooding', prob: 0.25, children: [] },
        ] },
        { token: 'and', prob: 0.35, children: [
          { token: 'windy', prob: 0.40, children: [] },
          { token: 'cold', prob: 0.35, children: [] },
          { token: 'humid', prob: 0.25, children: [] },
        ] },
        { token: 'then', prob: 0.25, children: [
          { token: 'clearing', prob: 0.40, children: [] },
          { token: 'calm', prob: 0.35, children: [] },
          { token: 'fog', prob: 0.25, children: [] },
        ] },
      ],
    },
  ],
}

export const PROMPT = 'The forecast for tomorrow is'
export const MAX_BEAM_WIDTH = 3

// Assign every node a stable id ("root", "root.0", "root.0.1", ...) and a depth, once,
// at module load. Downstream code (search functions, layout, the component) refers to
// nodes by id rather than walking the raw tree structure repeatedly.
function withIds(node, id, depth) {
  const withId = { ...node, id, depth }
  withId.children = node.children.map((c, i) => withIds(c, `${id}.${i}`, depth + 1))
  return withId
}
export const TREE = withIds(RAW_TREE, 'root', 0)

// Flat list of every node, root first, in the same order children were authored.
export function flattenTree(tree) {
  const out = [tree]
  for (const child of tree.children) out.push(...flattenTree(child))
  return out
}
export const ALL_NODES = flattenTree(TREE)

// Every sibling group's probabilities sum to 1 (within floating-point tolerance).
// Not invoked at module load; this function is only exercised by the committed
// e2e logic spec, which calls it directly to assert the invariant holds.
export function siblingSumsValid(tree, tolerance = 1e-9) {
  if (tree.children.length === 0) return true
  const sum = tree.children.reduce((s, c) => s + c.prob, 0)
  if (Math.abs(sum - 1) > tolerance) return false
  return tree.children.every((c) => siblingSumsValid(c, tolerance))
}

// Greedy decoding: at every step, take the single highest-probability child. One walk,
// no backtracking. Ties broken by author order (never occurs in this tree; every
// sibling group has a unique maximum).
export function greedyDecode(tree = TREE) {
  const path = [tree]
  let logProb = 0
  let node = tree
  while (node.children.length > 0) {
    const best = node.children.reduce((a, b) => (b.prob > a.prob ? b : a))
    logProb += Math.log(best.prob)
    path.push(best)
    node = best
  }
  return { path, ids: path.map((n) => n.id), tokens: path.slice(1).map((n) => n.token), logProb }
}

// Beam search: keep the top-k running partial sequences by cumulative log-probability
// at every step. A sequence that reaches a leaf before the others is carried forward
// unchanged (it has no more children to expand) so shorter and longer completions can
// still be compared on the same cumulative log-probability.
export function beamSearch(tree = TREE, k) {
  let beams = [{ path: [tree], logProb: 0 }]
  const maxDepth = Math.max(...ALL_NODES.map((n) => n.depth))
  for (let step = 0; step < maxDepth; step++) {
    const candidates = []
    for (const beam of beams) {
      const last = beam.path[beam.path.length - 1]
      if (last.children.length === 0) {
        candidates.push(beam)
        continue
      }
      for (const child of last.children) {
        candidates.push({ path: [...beam.path, child], logProb: beam.logProb + Math.log(child.prob) })
      }
    }
    candidates.sort((a, b) => b.logProb - a.logProb)
    beams = candidates.slice(0, k)
  }
  beams.sort((a, b) => b.logProb - a.logProb)
  return beams.map((b) => ({
    path: b.path,
    ids: b.path.map((n) => n.id),
    tokens: b.path.slice(1).map((n) => n.token),
    logProb: b.logProb,
  }))
}

// ── layout: x,y for every node, for SVG rendering ──────────────────────────────────
// Leaves get sequential x slots left to right; an internal node's x is the average of
// its children's x (so a parent sits centered above its subtree). Depth maps to y.
export const COL_W = 34
export const ROW_H = 78
export const PAD_X = 24
export const PAD_TOP = 30

export function layoutTree(tree = TREE) {
  const xById = new Map()
  let nextLeafX = 0
  ;(function assignX(node) {
    if (node.children.length === 0) {
      xById.set(node.id, nextLeafX++)
      return
    }
    node.children.forEach(assignX)
    const xs = node.children.map((c) => xById.get(c.id))
    xById.set(node.id, xs.reduce((a, b) => a + b, 0) / xs.length)
  })(tree)

  const positions = new Map()
  for (const node of flattenTree(tree)) {
    positions.set(node.id, { x: PAD_X + xById.get(node.id) * COL_W, y: PAD_TOP + node.depth * ROW_H })
  }
  const edges = []
  for (const node of flattenTree(tree)) {
    for (const child of node.children) edges.push({ from: node.id, to: child.id })
  }
  const leafCount = nextLeafX
  const width = PAD_X * 2 + Math.max(0, leafCount - 1) * COL_W
  const maxDepth = Math.max(...ALL_NODES.map((n) => n.depth))
  const height = PAD_TOP * 2 + maxDepth * ROW_H
  return { positions, edges, width, height }
}

export const LAYOUT = layoutTree(TREE)

// Small rendering helpers: turn a node-id sequence (as returned by greedyDecode /
// beamSearch) into a Set of node ids and a Set of "from>to" edge keys, so the SVG can
// test membership per node/edge without re-walking the tree.
export function pathNodeIdSet(ids) {
  return new Set(ids)
}
export function pathEdgeKeySet(ids) {
  const s = new Set()
  for (let i = 0; i < ids.length - 1; i++) s.add(`${ids[i]}>${ids[i + 1]}`)
  return s
}
