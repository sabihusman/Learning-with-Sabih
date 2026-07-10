// Deterministic data for the Sharding topic (Systems and Networking).
//
// 14 hand-authored rows. id is unique per row (high cardinality). country has 7
// distinct values with an uneven distribution (DE and CA are the most common),
// chosen so the real hash below spreads country mildly across shards rather
// than piling it onto one. plan has only 2 values, deliberately skewed so most
// rows are "free" (this is the hot-shard demonstrator: a key with only 2
// possible values can never spread across more than 2 shards, no matter how
// many shards exist).
//
// The hash is a real FNV-1a (32-bit), not a toy sum: offset basis 2166136261,
// prime 16777619, XOR each byte then multiply. Every placement and every count
// the figure shows is computed live from ROWS through this hash, never typed in.

export const ROWS = [
  { id: 'u-1001', country: 'DE', plan: 'free' },
  { id: 'u-1002', country: 'DE', plan: 'free' },
  { id: 'u-1003', country: 'DE', plan: 'free' },
  { id: 'u-1004', country: 'CA', plan: 'pro' },
  { id: 'u-1005', country: 'CA', plan: 'free' },
  { id: 'u-1006', country: 'CA', plan: 'free' },
  { id: 'u-1007', country: 'FI', plan: 'free' },
  { id: 'u-1008', country: 'FI', plan: 'pro' },
  { id: 'u-1009', country: 'JP', plan: 'free' },
  { id: 'u-1010', country: 'JP', plan: 'free' },
  { id: 'u-1011', country: 'AR', plan: 'free' },
  { id: 'u-1012', country: 'AR', plan: 'pro' },
  { id: 'u-1013', country: 'MX', plan: 'free' },
  { id: 'u-1014', country: 'IE', plan: 'free' },
]

export const GROUP_KEYS = ['id', 'country', 'plan']

// FNV-1a, 32-bit.
export function fnv1a(str) {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function shardOf(value, n) {
  return (fnv1a(String(value)) >>> 0) % n
}

// Per-shard row counts for a key column at a given shard count, derived purely
// from ROWS and shardOf.
export function shardCounts(keyColumn, n) {
  const counts = Array.from({ length: n }, () => 0)
  ROWS.forEach((row) => {
    counts[shardOf(row[keyColumn], n)] += 1
  })
  return counts
}

// The most- and least-loaded shard counts, and whether one shard holds a
// disproportionate share (more than half the rows, with more than one shard
// in play): the "hot shard" signal.
export function balanceOf(keyColumn, n) {
  const counts = shardCounts(keyColumn, n)
  const max = Math.max(...counts)
  const min = Math.min(...counts)
  const hot = max > ROWS.length / 2
  return { counts, max, min, hot }
}
