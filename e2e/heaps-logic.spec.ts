import { test, expect } from '@playwright/test'
import { PRESETS, HEAP_SIZE, buildFrames, shuffledValues, isMaxHeap, leftOf, rightOf, parentOf } from '../app/components/heapsData'

// Pure-logic correctness for the Heaps and Priority Queues figure. No page, no
// browser.
//
// Everything below is an INDEPENDENT resimulation of both phases. The data module
// snapshots the array while it mutates it, inside an iterative sift-down loop.
// This file does the opposite: a RECURSIVE sift-down first emits an event log
// (compare / swap / settle / focus / extract), and only then replays that log from
// the untouched input to derive what each frame's array, heap size, and counters
// must be. Two different constructions of the same run, compared frame for frame.

type Ev =
  | { kind: 'focus'; i: number }
  | { kind: 'compare'; a: number; b: number }
  | { kind: 'swap'; a: number; b: number }
  | { kind: 'settle'; i: number }
  | { kind: 'buildDone' }
  | { kind: 'extract'; end: number }
  | { kind: 'done' }

// Emit the event log by running the algorithm recursively on a scratch copy.
function eventsFor(values: number[]): Ev[] {
  const a = [...values]
  const n = a.length
  const evs: Ev[] = []

  function siftDown(i: number, size: number): void {
    const l = leftOf(i)
    const r = rightOf(i)
    if (l >= size) return
    let largest = i
    evs.push({ kind: 'compare', a: l, b: largest })
    if (a[l] > a[largest]) largest = l
    if (r < size) {
      evs.push({ kind: 'compare', a: r, b: largest })
      if (a[r] > a[largest]) largest = r
    }
    if (largest === i) {
      evs.push({ kind: 'settle', i })
      return
    }
    evs.push({ kind: 'swap', a: i, b: largest })
    ;[a[i], a[largest]] = [a[largest], a[i]]
    siftDown(largest, size)
  }

  for (let i = Math.floor(n / 2) - 1; i >= 0; i -= 1) {
    evs.push({ kind: 'focus', i })
    siftDown(i, n)
  }
  evs.push({ kind: 'buildDone' })

  for (let end = n - 1; end > 0; end -= 1) {
    evs.push({ kind: 'extract', end })
    ;[a[0], a[end]] = [a[end], a[0]]
    siftDown(0, end)
  }
  evs.push({ kind: 'done' })
  return evs
}

type Expected = {
  arr: number[]
  heapSize: number
  compare: [number, number] | null
  swap: [number, number] | null
  comparisons: number
  swaps: number
  phase: string
}

// Replay the log from the untouched input to derive every frame.
function replay(values: number[]): Expected[] {
  const a = [...values]
  const n = a.length
  let heapSize = n
  let comparisons = 0
  let swaps = 0
  let phase = 'build'
  const out: Expected[] = []
  const snap = (compare: [number, number] | null, swap: [number, number] | null): void => {
    out.push({ arr: [...a], heapSize, compare, swap, comparisons, swaps, phase })
  }

  snap(null, null) // frame 0, the untouched input

  for (const ev of eventsFor(values)) {
    if (ev.kind === 'focus' || ev.kind === 'settle') {
      snap(null, null)
    } else if (ev.kind === 'compare') {
      comparisons += 1
      snap([ev.a, ev.b], null)
    } else if (ev.kind === 'swap') {
      ;[a[ev.a], a[ev.b]] = [a[ev.b], a[ev.a]]
      swaps += 1
      snap(null, [ev.a, ev.b])
    } else if (ev.kind === 'buildDone') {
      snap(null, null)
    } else if (ev.kind === 'extract') {
      ;[a[0], a[ev.end]] = [a[ev.end], a[0]]
      swaps += 1
      heapSize = ev.end
      phase = 'sort'
      snap(null, [0, ev.end])
    } else {
      heapSize = 0
      phase = 'done'
      snap(null, null)
    }
  }
  return out
}

const CASES: Array<{ name: string; values: number[] }> = [
  ...PRESETS.map((p) => ({ name: p.key, values: [...p.values] })),
  ...Array.from({ length: 6 }, (_, i) => ({ name: `shuffle${i + 1}`, values: shuffledValues(i + 1) })),
]

test('index math is the 0-indexed heap rule', () => {
  for (let i = 0; i < 40; i += 1) {
    expect(leftOf(i), `left of ${i}`).toBe(2 * i + 1)
    expect(rightOf(i), `right of ${i}`).toBe(2 * i + 2)
    if (i > 0) {
      expect(parentOf(leftOf(i)), `parent of left child of ${i}`).toBe(i)
      expect(parentOf(rightOf(i)), `parent of right child of ${i}`).toBe(i)
    }
  }
  expect(parentOf(0), 'the root has no parent above index 0').toBe(-1)
})

test('every preset holds fifteen distinct values, and all presets share one multiset', () => {
  const reference = [...PRESETS[0].values].sort((x, y) => x - y)
  expect(reference.length).toBe(HEAP_SIZE)
  expect(new Set(reference).size, 'values must be distinct so a highlight is unambiguous').toBe(HEAP_SIZE)
  for (const p of PRESETS) {
    expect([...p.values].sort((x, y) => x - y), `${p.key} multiset`).toEqual(reference)
  }
  for (let seed = 1; seed <= 6; seed += 1) {
    expect([...shuffledValues(seed)].sort((x, y) => x - y), `shuffle ${seed} multiset`).toEqual(reference)
  }
})

test('the seeded shuffle is deterministic and does not repeat quickly', () => {
  expect(shuffledValues(3), 'same seed, same arrangement').toEqual(shuffledValues(3))
  const seen = new Set(Array.from({ length: 25 }, (_, i) => shuffledValues(i + 1).join(',')))
  expect(seen.size, '25 seeds should give 25 distinct arrangements').toBe(25)
})

for (const { name, values } of CASES) {
  test(`both phases match the independent resimulation frame for frame: ${name}`, () => {
    const actual = buildFrames(values).frames
    const expected = replay(values)

    expect(actual.length, `${name} frame count`).toBe(expected.length)

    actual.forEach((f, k) => {
      const e = expected[k]
      expect(f.arr, `${name} frame ${k} array`).toEqual(e.arr)
      expect(f.heapSize, `${name} frame ${k} heapSize`).toBe(e.heapSize)
      expect(f.comparisons, `${name} frame ${k} comparisons`).toBe(e.comparisons)
      expect(f.swaps, `${name} frame ${k} swaps`).toBe(e.swaps)
      expect(f.compare ?? null, `${name} frame ${k} compare pair`).toEqual(e.compare)
      expect(f.swap ?? null, `${name} frame ${k} swap pair`).toEqual(e.swap)
      expect(f.phase, `${name} frame ${k} phase`).toBe(e.phase)
    })
  })

  test(`phase 1 leaves a valid max-heap and phase 2 leaves a sorted array: ${name}`, () => {
    const r = buildFrames(values)
    const ascending = [...values].sort((x, y) => x - y)

    // Phase 1: the frame the module reports as the end of build must satisfy the
    // heap property, checked here by an independent parent-vs-children sweep.
    expect(r.heapArray, 'heapArray matches the frame at buildEndStep').toEqual(r.frames[r.buildEndStep].arr)
    expect(isMaxHeap(r.heapArray), `${name} is a max-heap after phase 1`).toBe(true)
    for (let i = 1; i < HEAP_SIZE; i += 1) {
      expect(r.heapArray[parentOf(i)], `${name} parent of index ${i} outranks it`).toBeGreaterThan(r.heapArray[i])
    }
    expect([...r.heapArray].sort((x, y) => x - y), `${name} phase 1 moves values, never invents them`).toEqual(ascending)

    // Phase 2: the tail locked so far is always the largest values, in order.
    expect(r.sortedArray, `${name} sorted after phase 2`).toEqual(ascending)
    expect(r.frames[r.frames.length - 1].arr, 'last frame holds the sorted array').toEqual(ascending)
  })

  test(`counters only ever climb, and the totals match the last frame: ${name}`, () => {
    const r = buildFrames(values)
    r.frames.forEach((f, k) => {
      if (k === 0) return
      expect(f.comparisons, `${name} comparisons at ${k}`).toBeGreaterThanOrEqual(r.frames[k - 1].comparisons)
      expect(f.swaps, `${name} swaps at ${k}`).toBeGreaterThanOrEqual(r.frames[k - 1].swaps)
      expect(f.heapSize, `${name} heapSize at ${k}`).toBeLessThanOrEqual(r.frames[k - 1].heapSize)
    })
    const lastFrame = r.frames[r.frames.length - 1]
    expect(lastFrame.comparisons, `${name} total comparisons`).toBe(r.stats.total.comparisons)
    expect(lastFrame.swaps, `${name} total swaps`).toBe(r.stats.total.swaps)
    expect(r.stats.build.comparisons + r.stats.sort.comparisons, `${name} phase split adds up`).toBe(r.stats.total.comparisons)
    expect(r.stats.build.swaps + r.stats.sort.swaps, `${name} phase swap split adds up`).toBe(r.stats.total.swaps)
    expect(r.stats.frameCount, `${name} frameCount`).toBe(r.frames.length)
  })
}

test('the already-a-heap preset does no swapping in phase 1', () => {
  const preset = PRESETS.find((p) => p.key === 'heapAlready')
  expect(preset, 'heapAlready preset exists').toBeTruthy()
  expect(isMaxHeap(preset!.values), 'the preset is already a valid max-heap before any work').toBe(true)
  expect(buildFrames(preset!.values).stats.build.swaps, 'phase 1 has nothing to move').toBe(0)
})
