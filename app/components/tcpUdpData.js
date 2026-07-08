// Deterministic data and simulation for the TCP and UDP topic (Systems and
// Networking).
//
// A fixed 8-packet run crosses one channel from SENDER to RECEIVER. Whether a
// packet is dropped is decided by a seeded PRNG (mulberry32, inline below, no
// dependency), so the SAME seed and loss setting produce the SAME drops every
// time: reproducible, and testable in isolation. Both protocols face those
// identical drops for a given loss setting, which is the whole comparison.
//
// UDP: every packet is sent once. A dropped packet simply never arrives; the
// receiver shows whatever arrived, with permanent gaps where a sequence number
// is missing.
//
// TCP: a dropped packet is detected and retransmitted later (modeled as a
// second, guaranteed-to-arrive send appended after the original 8 ticks, not a
// real ack/timeout), and the receiver only releases packets to the
// application in order: a packet that arrives before an earlier missing one
// waits ("holds") in a buffer until the gap behind it fills in, then releases
// as a cascade.
//
// The precomputed queue of (tick, seq, retransmit, lost) events is the entire
// run; step() just advances one event at a time, so the whole simulation is a
// pure function of (state, action): step(), setLoss(), setProtocol(), reset().

const PACKET_COUNT = 8
export const SEED = 555
export const DEFAULT_LOSS_PCT = 25
export const MAX_LOSS_PCT = 50

// mulberry32: a small, public-domain seeded PRNG. Same seed -> same sequence.
function mulberry32(seed) {
  let a = seed
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One PRNG draw per original packet (seq 1..8), in seq order, independent of
// protocol, so UDP and TCP face the identical set of drops at a given loss.
function computeLostFlags(lossPct, seed) {
  const rng = mulberry32(seed)
  const flags = []
  for (let i = 0; i < PACKET_COUNT; i += 1) {
    flags.push(rng() < lossPct / 100)
  }
  return flags
}

// The full run as a flat, ordered list of send events, one per tick.
// UDP: exactly PACKET_COUNT events (the originals; losses just vanish).
// TCP: the PACKET_COUNT originals, then one retransmit event per lost original,
// each of which always arrives (a simplification: no repeated loss on resend,
// so every run terminates in a bounded number of ticks).
function buildQueue(protocol, lossPct, seed) {
  const lostFlags = computeLostFlags(lossPct, seed)
  const events = []
  for (let i = 0; i < PACKET_COUNT; i += 1) {
    events.push({ tick: i + 1, seq: i + 1, retransmit: false, lost: lostFlags[i] })
  }
  if (protocol === 'TCP') {
    let tick = PACKET_COUNT + 1
    for (let i = 0; i < PACKET_COUNT; i += 1) {
      if (lostFlags[i]) {
        events.push({ tick, seq: i + 1, retransmit: true, lost: false })
        tick += 1
      }
    }
  }
  return events
}

function buildState(protocol, lossPct) {
  return {
    protocol, // 'TCP' | 'UDP'
    lossPct,
    queue: buildQueue(protocol, lossPct, SEED),
    cursor: 0, // events processed so far
    delivered: [], // UDP: seqs that arrived, in arrival order
    receiverBuffer: {}, // seq -> true once it has arrived (both protocols)
    released: [], // TCP: seqs released to the application, in order
    nextExpected: 1, // TCP: next seq the application is waiting for
    retransmits: 0,
    lastEvent: null, // the event just processed, for display
  }
}

const clone = (s) => ({
  ...s,
  delivered: [...s.delivered],
  receiverBuffer: { ...s.receiverBuffer },
  released: [...s.released],
  lastEvent: s.lastEvent ? { ...s.lastEvent } : null,
})

export function initialState(protocol = 'TCP', lossPct = DEFAULT_LOSS_PCT) {
  return buildState(protocol, lossPct)
}

export function isDone(state) {
  return state.cursor >= state.queue.length
}

// Advance one tick: process the next event in the precomputed queue. Pure.
export function step(state) {
  if (isDone(state)) return state
  const s = clone(state)
  const e = s.queue[s.cursor]
  s.cursor += 1
  s.lastEvent = { ...e }

  if (!e.lost) {
    s.receiverBuffer = { ...s.receiverBuffer, [e.seq]: true }
    if (s.protocol === 'UDP') {
      s.delivered = [...s.delivered, e.seq]
    } else {
      // TCP: release every seq the application is waiting for that has now
      // arrived, in order, which is why a run of held packets can release as
      // a cascade the instant the gap behind them fills in.
      let next = s.nextExpected
      const released = [...s.released]
      while (s.receiverBuffer[next]) {
        released.push(next)
        next += 1
      }
      s.released = released
      s.nextExpected = next
    }
  }
  if (e.retransmit) s.retransmits += 1
  return s
}

// Changing the loss slider or the protocol invalidates the current run, so
// both rebuild a fresh (still seeded, still reproducible) queue from tick 0.
export function setLoss(state, lossPct) {
  return buildState(state.protocol, lossPct)
}

export function setProtocol(state, protocol) {
  return buildState(protocol, state.lossPct)
}

export function reset(state) {
  return buildState(state.protocol, state.lossPct)
}

// ── Derived readouts (all computed from state, never hand-tracked) ─────────

export function sentCount(state) {
  return state.cursor
}

export function deliveredCount(state) {
  return state.protocol === 'UDP' ? state.delivered.length : state.released.length
}

export function lostCount(state) {
  let n = 0
  for (let i = 0; i < state.cursor; i += 1) {
    if (state.queue[i].lost) n += 1
  }
  return n
}

// UDP only: whether the arrived set, sorted, is a contiguous run starting at
// seq 1 (no gaps). A permanently dropped packet in the middle breaks this.
export function isInOrder(state) {
  const sorted = [...state.delivered].sort((a, b) => a - b)
  return sorted.every((seq, idx) => seq === idx + 1)
}

// TCP only: seqs that have arrived but are still waiting behind an earlier
// missing one, i.e. visibly "holding" in the receive buffer.
export function heldSeqs(state) {
  return Object.keys(state.receiverBuffer)
    .map(Number)
    .filter((seq) => !state.released.includes(seq))
    .sort((a, b) => a - b)
}

export function totalTicks(state) {
  return state.queue.length
}
