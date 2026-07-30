// Deterministic data for the Caching Layers topic (Systems and Networking).
//
// A read falls through four layers, closest first: BROWSER, CDN, REDIS, then the
// DATABASE, which always has the answer. The read is served at the first layer
// that holds the key. Whichever layer serves, every layer closer to the reader
// receives a copy on the way back up (cache-aside with copy-back), so the next
// read for the same key can stop sooner. All three cache layers start empty:
// there is no warm-up switch, the caches warm up on their own as the stream
// plays.
//
// The read stream is hand-authored to be instructive (one hot key, a few medium
// keys, some one-offs), but every outcome below (which layer serves each read,
// every count, every cache's contents) is computed by running real LRU caches
// over the stream in buildStates(), never typed in per read.

// Explicit .js extension so a plain Node harness can resolve this import too.
import { LRUCache } from './cachingData.js'

// Capacities are deliberately small and staggered so eviction happens at every
// layer: the browser forgets fastest, Redis remembers longest.
export const LAYERS = [
  { id: 'browser', label: 'BROWSER', capacity: 2 },
  { id: 'cdn', label: 'CDN', capacity: 3 },
  { id: 'redis', label: 'REDIS', capacity: 4 },
]

export const DB_ID = 'database'

// Latency figures are authored illustration for the labels only (typical orders
// of magnitude); nothing in the figure computes timing from them.
export const LATENCY_LABEL = {
  browser: '~0 ms',
  cdn: '~20 ms',
  redis: '~50 ms',
  database: '~200 ms',
}

// A is hot, B and C are medium, D, X, Y, Z are one-offs. 24 reads, arranged so
// the early reads mostly fall through to the database and the later reads are
// mostly absorbed by the warmed caches.
export const STREAM = [
  'A', 'B', 'A', 'C', 'A', 'B', 'D', 'A', 'A', 'C', 'B', 'X',
  'A', 'B', 'A', 'C', 'A', 'Y', 'A', 'B', 'C', 'Z', 'A', 'A',
]

export const LAST_STEP = STREAM.length

// Run real LRU caches (one per layer) over the stream once, snapshotting a frame
// after each read. STATES[0] is the initial all-empty state; STATES[k] is the
// state after read k-1.
function buildStates() {
  const caches = new Map(LAYERS.map((l) => [l.id, new LRUCache(l.capacity)]))
  const counts = { browser: 0, cdn: 0, redis: 0, database: 0 }

  const snapshotOrders = () => {
    const orders = {}
    LAYERS.forEach((l) => {
      orders[l.id] = caches.get(l.id).order()
    })
    return orders
  }

  const states = [
    {
      step: 0,
      index: -1,
      key: null,
      servedBy: null,
      copiedInto: [],
      evicted: {},
      counts: { ...counts },
      cacheServed: 0,
      orders: snapshotOrders(),
    },
  ]

  STREAM.forEach((key, index) => {
    // Check each cache layer closest-first; the first layer holding the key
    // serves the read (get() refreshes its recency there). The database is the
    // fallback that always serves.
    let servedBy = DB_ID
    for (const layer of LAYERS) {
      if (caches.get(layer.id).has(key)) {
        servedBy = layer.id
        caches.get(layer.id).get(key)
        break
      }
    }
    counts[servedBy] += 1

    // Copy-back: every layer closer than the serving layer receives a copy on
    // the way up. If the database served, that is all three cache layers.
    const copiedInto = []
    const evicted = {}
    for (const layer of LAYERS) {
      if (layer.id === servedBy) break
      const out = caches.get(layer.id).put(key, 1)
      copiedInto.push(layer.id)
      if (out !== null) evicted[layer.id] = out
    }

    states.push({
      step: index + 1,
      index,
      key,
      servedBy,
      copiedInto,
      evicted,
      counts: { ...counts },
      cacheServed: counts.browser + counts.cdn + counts.redis,
      orders: snapshotOrders(),
    })
  })

  return states
}

export const STATES = buildStates()

// Cache hit rate as a whole-number percentage: reads served by any cache layer
// out of all reads so far.
export function hitRate(state) {
  if (state.step === 0) return 0
  return Math.round((state.cacheServed / state.step) * 100)
}

const LAYER_NAME = { browser: 'the browser cache', cdn: 'the CDN', redis: 'Redis', database: 'the database' }

export function statusFor(state) {
  if (state.step === 0) {
    return 'Press Step to send the first read. All three caches start empty, so it must fall through to the database.'
  }
  if (state.servedBy === DB_ID) {
    return `${state.key} missed every cache: the database serves it, and a copy is written into Redis, the CDN, and the browser on the way up.`
  }
  const copies = state.copiedInto.length
  if (copies === 0) {
    return `${state.key} is served by ${LAYER_NAME[state.servedBy]} instantly.`
  }
  const into = state.copiedInto.map((id) => LAYER_NAME[id]).join(' and ')
  return `${state.key} is served by ${LAYER_NAME[state.servedBy]}, and a copy moves up into ${into}.`
}
