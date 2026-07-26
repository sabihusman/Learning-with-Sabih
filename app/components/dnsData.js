// Deterministic data and simulation for the DNS topic (Systems and
// Networking).
//
// A hand-authored, fixed lookup sequence for a reserved example domain
// (app.example.com, under example.com per RFC 2606) resolving to a
// documentation-range IP (192.0.2.42 per RFC 5737, the TEST-NET-1 block).
//
// Per RFC 1034: a stub resolver sends ONE recursive query and waits, while
// the recursive resolver performs the iteration on its behalf. A server that
// lacks authoritative data returns a REFERRAL (NS records for the next zone
// down, not an answer); only the authoritative server returns the final
// answer, with the authoritative bit set. The recursive resolver caches that
// answer for its TTL.
//
// Whether a lookup is a cache MISS (the full 8-step chain) or a cache HIT
// (2 steps: ask the resolver, get the cached answer back) depends only on
// whether state.cache is populated when the lookup starts, so the whole run
// is a pure function of (state, action): step(), lookup(), tickTtl(),
// reset(). Every readout is derived from that state, never hand-tracked.

export const DOMAIN = 'app.example.com'
export const ANSWER_IP = '192.0.2.42'

// TTL is a control the learner sets (R3): how long, in seconds, a fresh
// answer stays cached before the entry ages out on its own.
export const TTL_MIN = 5
export const TTL_MAX = 600
export const TTL_DEFAULT = 10
export const TTL_STEP = 5

// TTL countdown cadence (setInterval period, ms). Each tick integrates over
// measured wall-clock elapsed time (capped at 1s), not this nominal period,
// so the countdown stays correct in a backgrounded tab.
export const TTL_TICK_MS = 1000

// The five service boxes, left to right in the figure.
export const BOXES = ['device', 'resolver', 'root', 'tld', 'auth']

function missQueue() {
  return [
    { tick: 1, kind: 'query', from: 'device', to: 'resolver', label: `${DOMAIN}?`, ask: true },
    { tick: 2, kind: 'query', from: 'resolver', to: 'root', label: `${DOMAIN}?`, ask: true },
    { tick: 3, kind: 'referral', from: 'root', to: 'resolver', label: 'referral: ask .com TLD', ask: false },
    { tick: 4, kind: 'query', from: 'resolver', to: 'tld', label: `${DOMAIN}?`, ask: true },
    { tick: 5, kind: 'referral', from: 'tld', to: 'resolver', label: "referral: ask example.com's authoritative servers", ask: false },
    { tick: 6, kind: 'query', from: 'resolver', to: 'auth', label: `${DOMAIN}?`, ask: true },
    // Label has no ttl baked in: step() fills the live slider value in when
    // this event actually fires, since that is when a real authoritative
    // server would stamp the TTL onto the answer.
    { tick: 7, kind: 'answer', from: 'auth', to: 'resolver', label: `answer: ${ANSWER_IP}`, ask: false, caches: true },
    { tick: 8, kind: 'answer', from: 'resolver', to: 'device', label: `answer: ${ANSWER_IP}`, ask: false },
  ]
}

function hitQueue() {
  return [
    { tick: 1, kind: 'query', from: 'device', to: 'resolver', label: `${DOMAIN}?`, ask: true },
    { tick: 2, kind: 'cached-answer', from: 'resolver', to: 'device', label: `cached answer: ${ANSWER_IP}`, ask: false },
  ]
}

function buildState(cache) {
  const miss = !cache
  return {
    cache, // null (empty) or { ip, ttl }
    runKind: miss ? 'miss' : 'hit',
    queue: miss ? missQueue() : hitQueue(),
    cursor: 0,
    lastEvent: null,
  }
}

export function initialState() {
  return buildState(null)
}

export function isDone(state) {
  return state.cursor >= state.queue.length
}

// Advance one tick: process the next event in the fixed queue. Pure.
// ttlSeconds is the learner's current TTL-slider value; it is only used if
// this tick is the one that caches an answer.
export function step(state, ttlSeconds) {
  if (isDone(state)) return state
  const s = { ...state, lastEvent: null }
  const e = s.queue[s.cursor]
  s.cursor = s.cursor + 1
  s.lastEvent = { ...e }
  if (e.caches) {
    s.cache = { ip: ANSWER_IP, ttl: ttlSeconds, remaining: ttlSeconds }
    s.lastEvent = { ...e, label: `answer: ${ANSWER_IP} (ttl ${ttlSeconds}s)` }
  }
  return s
}

// Start a new lookup of the same name. Whether it is a cache hit or miss
// depends only on whether state.cache is currently populated.
export function lookup(state) {
  return buildState(state.cache)
}

// Age the cached entry by dtSec of real elapsed time. Once remaining hits
// zero the entry is gone, the same as a real resolver dropping an expired
// record; the next lookup() call then walks the full chain again. Pure, so
// the component supplies dtSec already capped at 1s per tick.
export function tickTtl(state, dtSec) {
  if (!state.cache) return state
  const remaining = Math.max(0, state.cache.remaining - dtSec)
  if (remaining <= 0) return { ...state, cache: null }
  return { ...state, cache: { ...state.cache, remaining } }
}

// Full reset: clear the cache and start over from an empty resolver, as if
// the page just loaded.
export function reset() {
  return buildState(null)
}

// ── Derived readouts (all computed from state, never hand-tracked) ─────────

// Outbound queries only (device->resolver, resolver->root/tld/auth), which
// is what "servers asked" means: how many parties were actually consulted,
// not how many messages crossed the wire.
export function serversAsked(state) {
  let n = 0
  for (let i = 0; i < state.cursor; i += 1) {
    if (state.queue[i].ask) n += 1
  }
  return n
}

export function stepsTaken(state) {
  return state.cursor
}

export function totalSteps(state) {
  return state.queue.length
}

// Every box id that has appeared as either side of an event so far this run
// (root/TLD/auth never appear at all during a cache hit, so they simply
// never light up).
export function askedBoxes(state) {
  const set = new Set()
  for (let i = 0; i < state.cursor; i += 1) {
    set.add(state.queue[i].from)
    set.add(state.queue[i].to)
  }
  return set
}
