import { test, expect } from '@playwright/test'
import { ROWS, GROUP_KEYS, fnv1a, shardOf, shardCounts } from '../app/components/shardingData'

// Pure-function correctness for the sharding figure. No page, no browser: these
// assert directly on the same functions the component renders, so a change that
// breaks the figure's central claim (a low-cardinality key produces a hot shard)
// fails here.

test('shardOf is deterministic', () => {
  for (const row of ROWS) {
    for (const n of [3, 4]) {
      expect(shardOf(row.id, n)).toBe(shardOf(row.id, n))
      expect(fnv1a(String(row.id))).toBe(fnv1a(String(row.id)))
    }
  }
})

test('shardCounts sums to the row count for every key at n=3 and n=4', () => {
  for (const key of GROUP_KEYS) {
    for (const n of [3, 4]) {
      const counts = shardCounts(key, n)
      expect(counts).toHaveLength(n)
      expect(counts.reduce((a, b) => a + b, 0)).toBe(ROWS.length)
    }
  }
})

test('measured per-shard distributions match the real hash', () => {
  expect(shardCounts('id', 3)).toEqual([7, 4, 3])
  expect(shardCounts('id', 4)).toEqual([3, 4, 3, 4])
  expect(shardCounts('country', 3)).toEqual([4, 5, 5])
  expect(shardCounts('country', 4)).toEqual([3, 3, 5, 3])
  expect(shardCounts('plan', 3)).toEqual([14, 0, 0])
  expect(shardCounts('plan', 4)).toEqual([3, 0, 0, 11])
})

test('plan produces a hot shard at n=3 and n=4', () => {
  for (const n of [3, 4]) {
    const counts = shardCounts('plan', n)
    const max = Math.max(...counts)
    // a hot shard: one shard clearly exceeds an even split of the rows
    expect(max).toBeGreaterThan(ROWS.length / n)
    expect(max).toBeGreaterThan(ROWS.length / 2)
  }
})

test('country stays mild, not hot, at n=3 and n=4', () => {
  for (const n of [3, 4]) {
    const counts = shardCounts('country', n)
    const max = Math.max(...counts)
    // mild: no single shard holds more than half the rows, and every shard
    // gets at least one row (the skew never collapses country onto one or
    // two shards the way plan's low cardinality does)
    expect(max).toBeLessThanOrEqual(ROWS.length / 2)
    expect(counts.every((c) => c > 0)).toBe(true)
  }
})
