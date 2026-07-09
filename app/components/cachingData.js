// Deterministic data for the Caching topic (Systems and Networking).
//
// The request stream is hand-authored to be instructive: one hot key, two warm
// keys, two one-offs, tuned so the final hit rate lands at exactly 50 percent and
// so the arrival of E evicts a key that is needed again a moment later. Real
// traffic is messier than this, and least-recently-used is only one eviction
// policy among several. Everything the figure draws and every readout is computed
// by the real LRU cache below over this fixed stream, never hand-typed, so the
// picture and the numbers can never drift apart.

export const CAPACITY = 3

// A is hot, B and C are warm, D and E are one-offs. 12 requests.
export const STREAM = ['A', 'B', 'C', 'A', 'B', 'A', 'C', 'D', 'A', 'E', 'A', 'C']

// An honest LRU cache. A Map keeps insertion order, so the first key it yields is
// the oldest (least recently used); get() and put() reinsert a key to make it the
// most recent. This is real computation, not choreography.
export class LRUCache {
  constructor(capacity) {
    this.capacity = capacity
    this.map = new Map()
  }

  has(key) {
    return this.map.has(key)
  }

  get(key) {
    if (!this.map.has(key)) return undefined
    const value = this.map.get(key)
    this.map.delete(key)
    this.map.set(key, value) // move to the most-recent end
    return value
  }

  put(key, value) {
    let evicted = null
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.capacity) {
      evicted = this.map.keys().next().value // oldest entry = least recently used
      this.map.delete(evicted)
    }
    this.map.set(key, value)
    return evicted
  }

  // Most-recent-first, which is how the figure lays out its slots (newest on the
  // left). Reverse of the Map's own oldest-first iteration order.
  order() {
    return [...this.map.keys()].reverse()
  }
}

// Run the real cache over the stream once and snapshot a frame after each request.
// STATES[0] is the initial empty state; STATES[k] is the state after request k-1.
function buildStates() {
  const cache = new LRUCache(CAPACITY)
  let hits = 0
  let misses = 0

  const states = [
    {
      step: 0,
      index: -1,
      key: null,
      event: 'start',
      evicted: null,
      order: [],
      originFetch: false,
      hits: 0,
      misses: 0,
    },
  ]

  STREAM.forEach((key, index) => {
    const hit = cache.has(key)
    let event
    let evicted = null
    if (hit) {
      hits += 1
      cache.get(key)
      event = 'hit'
    } else {
      misses += 1
      const wasFull = cache.map.size >= cache.capacity
      evicted = cache.put(key, 1)
      event = wasFull ? 'miss-evict' : 'miss-fill'
    }
    states.push({
      step: index + 1,
      index,
      key,
      event,
      evicted,
      order: cache.order(),
      originFetch: !hit, // every miss, and only a miss, is a trip to the origin
      hits,
      misses,
    })
  })

  return states
}

export const STATES = buildStates()
export const LAST_STEP = STREAM.length // 12

// Live hit rate as a whole-number percentage, derived from the frame's counts.
export function hitRate(state) {
  const total = state.hits + state.misses
  if (total === 0) return 0
  return Math.round((state.hits / total) * 100)
}

export function statusFor(state) {
  switch (state.event) {
    case 'start':
      return 'Press Step to send the first request. The cache holds 3 keys; watch which requests reach the slow origin.'
    case 'hit':
      return `${state.key} is already here, no origin trip.`
    case 'miss-fill':
      return `${state.key} is not in the cache, fetched from origin.`
    case 'miss-evict':
      return `Cache full: least recently used key ${state.evicted} leaves, ${state.key} fetched from origin.`
    default:
      return ''
  }
}
