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

// The prose claims a two-value key lands on at most two shards, one per value,
// however many shards there are, and that every other shard stays empty. Checked
// at the figure's own shard counts (3 and 4) and beyond them.
test('plan rows land on at most two shards, one per plan value, at any shard count', () => {
  const values = [...new Set(ROWS.map((r) => r.plan))]
  expect(values.sort()).toEqual(['free', 'pro'])
  for (const n of [3, 4, 5, 6, 8, 16]) {
    const target = new Set(values.map((v) => shardOf(v, n)))
    for (const row of ROWS) expect(target.has(shardOf(row.plan, n))).toBe(true)
    const counts = shardCounts('plan', n)
    const used = counts.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0)
    expect(used.length).toBeLessThanOrEqual(2)
    expect(new Set(used)).toEqual(target)
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
