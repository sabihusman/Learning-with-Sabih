// Deterministic data and simulation for the Load Balancing topic (Systems and
// Networking).
//
// A fixed stream of 16 requests, each with a hand-authored duration in ticks, is
// dispatched one per tick across three servers. Each server processes one request
// at a time (the rest queue behind it), so a long request blocks the ones behind
// it and the queue grows. The stream is tuned so the two policies visibly diverge:
// round robin keeps feeding the same server on its turn even while it is buried,
// so its queue climbs to 4, while least connections routes around the busy server
// and never queues more than 2.
//
// The tick logic is a pure function of (state, action): tick(), killServer(), and
// reviveServer() each take a state and return a new one without mutating the input,
// so the whole trajectory is reproducible and testable. Every readout the figure
// shows is derived from this state at runtime, never hand-typed.

export const SERVER_COUNT = 3

// duration (ticks) per request. Indices 0..15. Under round robin, indices
// 0,3,6,9,12,15 land on server 1; the three 6-tick jobs at 3,6,9 pile up there.
// The opening trio of 4-tick jobs (0,1,2) briefly pushes least connections to 2.
const DURATIONS = [4, 4, 4, 6, 1, 1, 6, 1, 1, 6, 1, 1, 1, 1, 1, 1]

export const STREAM = DURATIONS.map((dur, i) => ({ id: i + 1, dur }))

export const POLICIES = [
  { id: 'rr', label: 'Round robin' },
  { id: 'lc', label: 'Least connections' },
]

export function initialState(policy = 'rr') {
  return {
    tick: 0,
    nextIndex: 0, // index into STREAM of the next request to dispatch
    policy,
    rrCursor: 0, // round-robin pointer (server position 0..SERVER_COUNT-1)
    completed: 0,
    dropped: 0,
    peakLoad: 0, // running maximum of the active server load, for the summary
    lastAssign: null, // { reqId, serverId } dispatched on the last tick, for highlight
    lastDrops: [], // reqIds lost on the last action, shown as error ghosts
    servers: Array.from({ length: SERVER_COUNT }, (_, i) => ({
      id: i + 1,
      up: true,
      queue: [], // [{ reqId, rem }] front is the one being processed
    })),
  }
}

const cloneState = (s) => ({
  ...s,
  lastAssign: s.lastAssign ? { ...s.lastAssign } : null,
  lastDrops: [...s.lastDrops],
  servers: s.servers.map((sv) => ({ ...sv, queue: sv.queue.map((j) => ({ ...j })) })),
})

// Round robin: the next up server at or after the cursor, wrapping around.
function chooseRoundRobin(s) {
  for (let k = 0; k < SERVER_COUNT; k += 1) {
    const idx = (s.rrCursor + k) % SERVER_COUNT
    if (s.servers[idx].up) return idx
  }
  return -1
}

// Least connections: the up server with the shortest queue; ties go to the lowest
// server number (the scan keeps the first minimum it finds).
function chooseLeastConnections(s) {
  let best = -1
  let bestLen = Infinity
  for (let i = 0; i < SERVER_COUNT; i += 1) {
    const sv = s.servers[i]
    if (!sv.up) continue
    if (sv.queue.length < bestLen) {
      bestLen = sv.queue.length
      best = i
    }
  }
  return best
}

// One tick: first advance the in-flight work (the front job on each up server loses
// one tick and leaves if finished), then dispatch the next request to a server
// chosen by the current policy. Pure: returns a new state.
export function tick(state) {
  const s = cloneState(state)
  s.lastAssign = null
  s.lastDrops = []
  s.tick += 1

  // 1. progress the front job on each running server
  for (const sv of s.servers) {
    if (!sv.up || sv.queue.length === 0) continue
    sv.queue[0].rem -= 1
    if (sv.queue[0].rem <= 0) {
      sv.queue.shift()
      s.completed += 1
    }
  }

  // 2. dispatch the next request, if any and if a server is available
  if (s.nextIndex < STREAM.length) {
    const idx = s.policy === 'rr' ? chooseRoundRobin(s) : chooseLeastConnections(s)
    if (idx >= 0) {
      const req = STREAM[s.nextIndex]
      s.servers[idx].queue.push({ reqId: req.id, rem: req.dur })
      s.lastAssign = { reqId: req.id, serverId: s.servers[idx].id }
      if (s.policy === 'rr') s.rrCursor = (idx + 1) % SERVER_COUNT
      s.nextIndex += 1
    }
    // if idx === -1 (every server down) the request waits; nextIndex is unchanged
  }

  s.peakLoad = Math.max(s.peakLoad, Math.max(...s.servers.map((sv) => sv.queue.length)))
  return s
}

// Mark a server down: it stops receiving requests, and everything currently queued
// on it is lost (a simplification, see the topic's honesty note). Pure.
export function killServer(state, id) {
  const s = cloneState(state)
  const sv = s.servers.find((x) => x.id === id)
  if (sv && sv.up) {
    s.dropped += sv.queue.length
    s.lastDrops = sv.queue.map((j) => j.reqId)
    sv.queue = []
    sv.up = false
    s.lastAssign = null
  }
  return s
}

// Bring a server back up so it rejoins the rotation with an empty queue. Pure.
export function reviveServer(state, id) {
  const s = cloneState(state)
  const sv = s.servers.find((x) => x.id === id)
  if (sv && !sv.up) {
    sv.up = true
    s.lastDrops = []
  }
  return s
}

// All requests dispatched and nothing left in flight.
export function isDone(state) {
  return state.nextIndex >= STREAM.length && state.servers.every((sv) => sv.queue.length === 0)
}

// The highest active queue length right now: the imbalance signal.
export function maxLoad(state) {
  return Math.max(...state.servers.map((sv) => sv.queue.length))
}
