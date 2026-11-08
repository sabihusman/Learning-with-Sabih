// Deterministic engine for the Hash Tables topic: a chained hash table that
// doubles and rehashes when its load factor goes over 0.75.
//
// The hash is the deliberately simple TEACHING hash the topic has always used:
// the sum of the key's character codes, mod the number of buckets. It is real
// and reproducible, not a production hash. Two consequences the figure shows:
//   - anagrams (dog / god) have the same sum, so they share a bucket at every
//     table size, and no resize ever separates them;
//   - doubling from c to 2c buckets sends a key in bucket b to b or b + c and
//     nowhere else, because (sum mod 2c) mod c = sum mod c.
//
// The resize follows the common rule (Java's HashMap uses it): insert the key,
// then if keys / buckets > 0.75, allocate a table twice the size and rehash
// every key into it. Real tables do the whole rehash inside that one insert;
// the figure lets the learner step through it one key at a time.

export const START_BUCKETS = 7 // a small prime, so the teaching hash spreads a little
export const MAX_LOAD = 0.75
export const MAX_BUCKETS = 28 // the figure stops doubling here
export const MAX_KEYS = Math.floor(MAX_BUCKETS * MAX_LOAD) // 21: the 22nd would need 56 buckets
export const BAND = 7 // buckets drawn per band, so bucket b + 7 sits under bucket b

// Presets in a fixed order. Added in this order they cross 0.75 twice: the
// 6th key (6 / 7 = 0.86) doubles 7 -> 14, the 11th (11 / 14 = 0.79) doubles 14 -> 28.
// dog / god and cat / act are anagram pairs.
export const PRESETS = ['cat', 'dog', 'owl', 'ant', 'hen', 'ram', 'fox', 'cod', 'jay', 'god', 'act']

export function charCodes(key) {
  return [...key].map((ch) => ({ ch, code: ch.codePointAt(0) }))
}

export function sumOf(key) {
  return charCodes(key).reduce((a, c) => a + c.code, 0)
}

export const bucketOf = (key, buckets) => sumOf(key) % buckets

// sorted by code point, so two keys with the same letters give the same string
const letters = (key) => [...key].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('')

// Other keys in the table made of exactly the same letters.
export function anagramsOf(key, keys) {
  return keys.filter((k) => k !== key && letters(k) === letters(key))
}

const emptyTable = (n) => Array.from({ length: n }, () => [])

export function initialState() {
  return {
    buckets: START_BUCKETS,
    table: emptyTable(START_BUCKETS), // chains of keys, in insertion order
    resize: null, // during a rehash: { from, to, waiting: [{ key, oldBucket }], moved: [keys] }
    inserts: 0,
    rehashed: 0, // keys placed by rehashing, over all resizes
    resizes: 0,
    event: null, // what the last action did, for the status and compute lines
  }
}

// Every key, in the order it is drawn: placed keys, then keys still waiting
// in the old table during a rehash.
export function allKeys(state) {
  const placed = state.table.flat()
  return state.resize ? [...placed, ...state.resize.waiting.map((w) => w.key)] : placed
}

export const keyCount = (state) => allKeys(state).length

export function canInsert(state, raw) {
  const key = raw.trim().toLowerCase()
  if (!key) return { ok: false, reason: 'empty' }
  if (state.resize) return { ok: false, reason: 'resizing' }
  if (allKeys(state).includes(key)) return { ok: false, reason: 'duplicate' }
  if (keyCount(state) >= MAX_KEYS) return { ok: false, reason: 'full' }
  return { ok: true, key }
}

export function insert(state, raw) {
  const check = canInsert(state, raw)
  if (!check.ok) return state
  const { key } = check
  const bucket = bucketOf(key, state.buckets)
  const table = state.table.map((chain, i) => (i === bucket ? [...chain, key] : chain))
  const count = table.flat().length
  const anagrams = anagramsOf(key, table.flat())
  const next = {
    ...state,
    table,
    inserts: state.inserts + 1,
    event: { kind: 'insert', key, sum: sumOf(key), buckets: state.buckets, bucket, chain: table[bucket].length, anagrams },
  }
  if (count / state.buckets <= MAX_LOAD) return next
  // Over 0.75: the table doubles. Every key waits in the old table, in
  // old-bucket order then chain order, to be rehashed into the new one.
  const from = state.buckets
  const to = from * 2
  const waiting = table.flatMap((chain, oldBucket) => chain.map((k) => ({ key: k, oldBucket })))
  return {
    ...next,
    buckets: to,
    table: emptyTable(to),
    resize: { from, to, waiting, moved: [] },
    resizes: state.resizes + 1,
    event: { ...next.event, resized: { from, to, count, load: count / from } },
  }
}

export function rehashStep(state) {
  if (!state.resize) return state
  const [first, ...rest] = state.resize.waiting
  const bucket = bucketOf(first.key, state.buckets)
  const table = state.table.map((chain, i) => (i === bucket ? [...chain, first.key] : chain))
  const placedKeys = table.flat()
  const moved = bucket === first.oldBucket ? state.resize.moved : [...state.resize.moved, first.key]
  const event = {
    kind: 'rehash',
    key: first.key,
    sum: sumOf(first.key),
    from: state.resize.from,
    to: state.resize.to,
    oldBucket: first.oldBucket,
    bucket,
    moved: bucket !== first.oldBucket,
    // anagrams have the same sum, so one is always already in this bucket
    anagrams: anagramsOf(first.key, placedKeys),
    done: rest.length === 0,
    remaining: rest.length,
    movedAll: moved, // every key this resize has moved so far
    count: placedKeys.length + rest.length,
  }
  return {
    ...state,
    table,
    rehashed: state.rehashed + 1,
    resize: rest.length ? { ...state.resize, waiting: rest, moved } : null,
    event,
  }
}

export function finishRehash(state) {
  if (!state.resize) return state
  let s = state
  while (s.resize) s = rehashStep(s)
  return { ...s, event: { ...s.event, kind: 'finish' } }
}

// Where each key is drawn: its bucket, its position in the chain, and whether
// it is still waiting in the old table. A waiting key is drawn in the cell of
// its old bucket index, below the keys already rehashed into that cell (a cell
// b only ever receives keys from old bucket b, so the two never mix).
export function layout(state) {
  const cells = state.table.map((chain) => chain.map((key) => ({ key, waiting: false })))
  if (state.resize) state.resize.waiting.forEach((w) => cells[w.oldBucket].push({ key: w.key, waiting: true }))
  return cells
}

export function stats(state) {
  const cells = layout(state)
  const count = keyCount(state)
  return {
    count,
    buckets: state.buckets,
    load: count / state.buckets,
    longest: cells.reduce((m, c) => Math.max(m, c.length), 0),
    collisions: cells.reduce((a, c) => a + Math.max(0, c.length - 1), 0),
    resizes: state.resizes,
    inserts: state.inserts,
    rehashed: state.rehashed,
    placements: state.inserts + state.rehashed,
  }
}

// Every anagram group of two or more keys currently in the table.
export function anagramGroups(keys) {
  const groups = {}
  for (const k of keys) {
    const id = letters(k)
    if (!groups[id]) groups[id] = []
    groups[id].push(k)
  }
  return Object.values(groups).filter((g) => g.length > 1)
}
