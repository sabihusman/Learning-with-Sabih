// Deterministic simulation for the Where Caches Live topic (Systems).
//
// Two kinds of cache sit between a reader and the database, and they fill in
// different ways:
// - HTTP caches (each reader's browser, and the CDN shared by every reader)
//   store a RESPONSE, and only when the response's Cache-Control header allows
//   it: `public` may be stored by both, `private` only by that reader's
//   browser, `no-store` by neither. Where the origin got the data from (Redis or
//   the database) makes no difference to them.
// - Redis is the application's cache. The app checks it before the database and
//   writes into it after a database read (cache-aside), with a TTL the app
//   chooses. HTTP headers have nothing to do with it.
// Every entry expires: a stored copy is served only while it is fresh.
//
// The read stream and the resources are hand-authored; every outcome (who
// serves each read, what each layer stores, every count) is computed by
// simulate(), never typed in per read.

export const DB_ID = 'database'
export const READERS = ['ana', 'ben']
export const READER_NAME = { ana: 'Ana', ben: 'Ben' }

// Per-layer lookup cost, as labels (typical orders of magnitude, not measured).
// Redis in the same region is always faster than a CDN round trip.
export const LATENCY_LABEL = {
  browser: '~0 ms',
  cdn: '~5-30 ms',
  redis: '~0.2-2 ms',
  database: '~5-50 ms',
}
export const LATENCY_RANGE_MS = { browser: [0, 0], cdn: [5, 30], redis: [0.2, 2], database: [5, 50] }

export const HTTP_MAX_AGE_S = 60 // max-age on cacheable responses
export const REDIS_TTL_S = 30 // TTL the app sets on Redis entries
export const READ_GAP_S = 5 // seconds between reads in the stream

export const POLICIES = [
  { id: 'public', label: 'public', header: `public, max-age=${HTTP_MAX_AGE_S}` },
  { id: 'private', label: 'private', header: `private, max-age=${HTTP_MAX_AGE_S}` },
  { id: 'no-store', label: 'no-store', header: 'no-store' },
]
export const headerFor = (policy) => POLICIES.find((p) => p.id === policy).header

// Three resources, each with a sensible default header. `perReader` marks data
// that differs per reader (the app keys it in Redis by reader too).
export const RESOURCES = [
  { id: 'logo', path: '/logo.png', perReader: false, defaultPolicy: 'public' },
  { id: 'profile', path: '/api/me', perReader: true, defaultPolicy: 'private' },
  { id: 'prices', path: '/api/prices', perReader: false, defaultPolicy: 'no-store' },
]
export const DEFAULT_POLICIES = Object.fromEntries(RESOURCES.map((r) => [r.id, r.defaultPolicy]))
const resource = (id) => RESOURCES.find((r) => r.id === id)

// 24 reads, READ_GAP_S apart, alternating readers so the shared CDN and the
// per-reader browsers both get exercised.
export const STREAM = [
  ['ana', 'logo'], ['ana', 'profile'], ['ana', 'prices'], ['ben', 'logo'],
  ['ben', 'prices'], ['ana', 'logo'], ['ben', 'profile'], ['ana', 'prices'],
  ['ben', 'logo'], ['ana', 'profile'], ['ben', 'prices'], ['ana', 'logo'],
  ['ben', 'profile'], ['ana', 'prices'], ['ben', 'logo'], ['ana', 'profile'],
  ['ben', 'prices'], ['ana', 'logo'], ['ben', 'profile'], ['ana', 'prices'],
  ['ben', 'logo'], ['ana', 'profile'], ['ben', 'prices'], ['ana', 'logo'],
].map(([reader, res], i) => ({ reader, res, t: i * READ_GAP_S }))
export const LAST_STEP = STREAM.length

// The HTTP cache key is the URL (plus the reader, for a browser, since each
// reader has their own). Redis keys add the reader for per-reader data.
const redisKey = (reader, res) => (resource(res).perReader ? `${res}:${reader}` : res)

const fresh = (entry, t) => entry != null && t < entry.expires

// Which HTTP caches may store a response with this policy, for this reader.
export function httpStorers(policy, reader) {
  if (policy === 'public') return [`browser:${reader}`, 'cdn']
  if (policy === 'private') return [`browser:${reader}`]
  return []
}

export function simulate(policies = DEFAULT_POLICIES) {
  const caches = { 'browser:ana': new Map(), 'browser:ben': new Map(), cdn: new Map(), redis: new Map() }
  const counts = { browser: 0, cdn: 0, redis: 0, database: 0 }
  const snapshot = (t) =>
    Object.fromEntries(
      Object.entries(caches).map(([layer, map]) => [
        layer,
        [...map.entries()]
          .filter(([, e]) => fresh(e, t))
          .map(([key, e]) => ({ key, secondsLeft: e.expires - t }))
          .sort((a, b) => a.key.localeCompare(b.key)),
      ]),
    )

  const states = [{ step: 0, read: null, servedBy: null, stored: [], refused: [], leakedFrom: null, leaks: 0, counts: { ...counts }, contents: snapshot(0), t: 0 }]
  let leaks = 0

  for (const read of STREAM) {
    const { reader, res, t } = read
    const policy = policies[res]
    const browser = `browser:${reader}`
    let servedBy
    let originSource = null
    let leakedFrom = null
    const stored = []
    // a cached response remembers whose data it is, for per-reader resources
    const owner = resource(res).perReader ? reader : null

    if (fresh(caches[browser].get(res), t)) {
      servedBy = 'browser'
    } else if (fresh(caches.cdn.get(res), t)) {
      servedBy = 'cdn'
      const copy = caches.cdn.get(res)
      // the CDN keys by URL, so a per-reader response marked public is handed
      // to whoever asks next: another reader's data
      if (copy.owner && copy.owner !== reader) {
        leakedFrom = copy.owner
        leaks += 1
      }
      // the CDN's copy travels down to the reader as an HTTP response
      if (httpStorers(policy, reader).includes(browser)) {
        caches[browser].set(res, { expires: copy.expires, owner: copy.owner })
        stored.push(browser)
      }
    } else {
      // the request reaches the origin; the app checks Redis, then the database
      const rk = redisKey(reader, res)
      if (fresh(caches.redis.get(rk), t)) {
        servedBy = 'redis'
        originSource = 'redis'
      } else {
        servedBy = DB_ID
        originSource = DB_ID
        caches.redis.set(rk, { expires: t + REDIS_TTL_S })
        stored.push('redis')
      }
      // the response goes back up through the CDN and into the browser; each
      // HTTP cache stores it only if the response's own header allows
      for (const layer of httpStorers(policy, reader)) {
        caches[layer].set(res, { expires: t + HTTP_MAX_AGE_S, owner })
        stored.push(layer)
      }
    }

    const passedThrough = servedBy === 'browser' ? [] : servedBy === 'cdn' ? [browser] : [browser, 'cdn']
    const refused = passedThrough.filter((layer) => !stored.includes(layer))
    counts[servedBy] += 1
    states.push({
      step: states.length,
      read,
      policy,
      servedBy,
      originSource,
      stored,
      refused,
      leakedFrom,
      leaks,
      counts: { ...counts },
      contents: snapshot(t),
      t,
    })
  }
  return states
}

export function hitRate(state) {
  if (state.step === 0) return 0
  return Math.round(((state.step - state.counts.database) / state.step) * 100)
}

const LAYER_NAME = { browser: "the reader's browser", cdn: 'the CDN', redis: 'Redis', database: 'the database' }
const layerName = (layer) => (layer.startsWith('browser:') ? `${READER_NAME[layer.split(':')[1]]}'s browser` : LAYER_NAME[layer])

export function statusFor(state) {
  if (state.step === 0) return 'Press Step to send the first read. Every cache starts empty.'
  const { reader, res } = state.read
  const who = READER_NAME[reader]
  const path = resource(res).path
  const served = state.servedBy === 'browser' ? `${who}'s browser` : LAYER_NAME[state.servedBy]
  const storedHttp = state.stored.filter((l) => l !== 'redis').map(layerName)
  const parts = [`${who} reads ${path}: served by ${served}.`]
  if (state.leakedFrom) parts.push(`That copy is ${READER_NAME[state.leakedFrom]}'s data: a per-reader response marked public was shared by the CDN.`)
  if (state.stored.includes('redis')) parts.push('The app writes the result into Redis.')
  if (state.servedBy === 'redis') parts.push('A Redis hit does not copy anything upward by itself.')
  if (storedHttp.length) parts.push(`${storedHttp.join(' and ')} stored the response (${headerFor(state.policy)}).`)
  else if (state.refused.length) parts.push(`No HTTP cache stored it (${headerFor(state.policy)}).`)
  return parts.join(' ')
}
