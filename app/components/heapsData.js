// Deterministic data and simulation for the Heaps and Priority Queues topic
// (Algorithms and Data Structures).
//
// A max-heap over an array of 15 values, run in two phases by one stepper:
//
//   build - bottom-up heapify. Start at the last parent, Math.floor(n / 2) - 1,
//     sift it down, then walk backward to index 0. Every node below the start
//     index is already a trivially valid heap of one, which is why the walk can
//     begin halfway along.
//
//   sort - repeatedly swap the root with the last slot still inside the heap,
//     shrink the heap by one so that slot is locked, and sift the new root down.
//     The locked tail grows into a sorted array.
//
// There is no authored frame list anywhere in this file. Every frame, counter,
// and final array is produced by running the real algorithm and snapshotting it,
// so the readouts cannot drift from what the figure is actually doing.
//
// Index math is 0-indexed throughout: children of i are 2i+1 and 2i+2, parent of
// i is Math.floor((i - 1) / 2). Both views in the figure, the tree and the flat
// array, are drawn from the SAME snapshot, so a highlight lands on one value in
// two places at once.

export const HEAP_SIZE = 15

// One multiset of 15 distinct values, arranged three ways. Sharing the values
// across presets is deliberate: the swap counts differ only because the starting
// order differs, which is the whole comparison.
const SORTED_ASC = [12, 15, 18, 23, 27, 31, 38, 42, 47, 55, 60, 66, 71, 84, 91]

export const PRESETS = [
  { key: 'scrambled', label: 'Scrambled', values: [38, 91, 23, 60, 15, 71, 42, 12, 84, 27, 55, 18, 66, 31, 47] },
  { key: 'ascending', label: 'Ascending', values: [...SORTED_ASC] },
  { key: 'heapAlready', label: 'Already a heap', values: [...SORTED_ASC].reverse() },
]

// ── index math ──────────────────────────────────────────────────────────────────
export const leftOf = (i) => 2 * i + 1
export const rightOf = (i) => 2 * i + 2
export const parentOf = (i) => Math.floor((i - 1) / 2)

// Depth of index i in the tree, and its position within that depth.
export const depthOf = (i) => Math.floor(Math.log2(i + 1))
export const offsetInDepth = (i) => i + 1 - 2 ** depthOf(i)

// ── deterministic shuffle ───────────────────────────────────────────────────────
// The Shuffle button must not call Math.random: an unseeded shuffle would make
// the figure render differently on the server and the client, and would make the
// logic spec untestable. A counter drives a small LCG instead, so shuffle number
// N is always the same arrangement.
export function shuffledValues(seed) {
  const a = [...SORTED_ASC]
  let s = (seed * 2654435761 + 12345) >>> 0
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── the simulation ──────────────────────────────────────────────────────────────
//
// Returns { frames, stats }. Frame 0 is the untouched input. Every later frame is
// one comparison, one swap, one settle, or one phase marker, snapshotted as it
// happens. `heapSize` is how many slots are still inside the heap: indices at or
// above it are locked and sorted.
export function buildFrames(values) {
  const a = [...values]
  const n = a.length
  const frames = []
  const ctx = { comparisons: 0, swaps: 0, heapSize: n }

  const push = (partial) => {
    frames.push({
      arr: [...a],
      heapSize: ctx.heapSize,
      compare: null,
      swap: null,
      focus: null,
      comparisons: ctx.comparisons,
      swaps: ctx.swaps,
      ...partial,
    })
  }

  push({ phase: 'build', note: 'Press Step or Play to heapify from the bottom up' })

  function siftDown(start, size, phase) {
    let i = start
    for (;;) {
      const l = leftOf(i)
      const r = rightOf(i)
      if (l >= size) return // a leaf: no children to compare against
      let largest = i

      ctx.comparisons += 1
      push({ phase, compare: [l, largest], focus: i, note: `Compare ${a[l]} with parent ${a[largest]}` })
      if (a[l] > a[largest]) largest = l

      if (r < size) {
        ctx.comparisons += 1
        push({ phase, compare: [r, largest], focus: i, note: `Compare ${a[r]} with the larger so far, ${a[largest]}` })
        if (a[r] > a[largest]) largest = r
      }

      if (largest === i) {
        push({ phase, focus: i, note: `${a[i]} is already larger than both children, so it stays` })
        return
      }

      const parentValue = a[i]
      const childValue = a[largest]
      ;[a[i], a[largest]] = [a[largest], a[i]]
      ctx.swaps += 1
      push({ phase, swap: [i, largest], focus: largest, note: `Swap ${childValue} up and ${parentValue} down` })
      i = largest
    }
  }

  // Phase 1: bottom-up heapify.
  for (let i = Math.floor(n / 2) - 1; i >= 0; i -= 1) {
    push({ phase: 'build', focus: i, note: `Sift down from index ${i}, holding ${a[i]}` })
    siftDown(i, n, 'build')
  }
  const heapArray = [...a]
  const buildStats = { comparisons: ctx.comparisons, swaps: ctx.swaps }
  const buildEndStep = frames.length - 1
  push({ phase: 'build', note: `Heap built: every parent outranks its children, and ${a[0]} is on top` })

  // Phase 2: repeatedly extract the root into the locked tail.
  for (let end = n - 1; end > 0; end -= 1) {
    const rootValue = a[0]
    const tailValue = a[end]
    ;[a[0], a[end]] = [a[end], a[0]]
    ctx.swaps += 1
    ctx.heapSize = end
    push({ phase: 'sort', swap: [0, end], focus: 0, note: `${rootValue} is the largest left, so it is locked at index ${end}; ${tailValue} takes the root` })
    siftDown(0, end, 'sort')
  }

  ctx.heapSize = 0
  push({ phase: 'done', note: 'Heap empty, and what is left behind is sorted' })

  return {
    frames,
    buildEndStep,
    heapArray,
    sortedArray: [...a],
    stats: {
      build: buildStats,
      sort: { comparisons: ctx.comparisons - buildStats.comparisons, swaps: ctx.swaps - buildStats.swaps },
      total: { comparisons: ctx.comparisons, swaps: ctx.swaps },
      frameCount: frames.length,
    },
  }
}

// True when every parent in a[0..size) outranks both of its children.
export function isMaxHeap(a, size = a.length) {
  for (let i = 0; i < size; i += 1) {
    const l = leftOf(i)
    const r = rightOf(i)
    if (l < size && a[l] > a[i]) return false
    if (r < size && a[r] > a[i]) return false
  }
  return true
}
