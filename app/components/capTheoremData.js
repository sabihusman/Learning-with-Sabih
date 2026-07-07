// Deterministic data and simulation for the CAP Theorem topic (Systems and
// Networking).
//
// A deliberately tiny model: one key x, two replicas (Node A and Node B), and a
// fixed sequence of reads and writes issued by two clients (client A talks to Node
// A, client B to Node B). When the link is healthy, every write replicates
// synchronously, so the nodes always agree. When the link is partitioned, the
// system must choose: prefer consistency (refuse what it cannot confirm, so the
// data never diverges) or prefer availability (serve locally, so the two replicas
// drift apart). That forced choice, only when the network is broken, is the whole
// theorem.
//
// The outcome under each (link, choice) combination is a pure function of state and
// action: step(), setLink(), setChoice(), and reset() each take a state and return a
// new one without mutating the input, so the three scenarios are reproducible and
// testable. Every readout the figure shows is derived from this state.

// Fixed operation sequence. Client A is wired to Node A, client B to Node B.
export const OPS = [
  { client: 'A', op: 'write', value: 2 },
  { client: 'A', op: 'read' },
  { client: 'B', op: 'read' },
  { client: 'B', op: 'write', value: 3 },
  { client: 'A', op: 'read' },
  { client: 'B', op: 'read' },
]

export const START_VALUE = 1

export const CHOICES = [
  { id: 'C', label: 'Prefer consistency' },
  { id: 'A', label: 'Prefer availability' },
]

export function initialState() {
  return {
    opIndex: 0,
    a: START_VALUE, // Node A's value of x
    b: START_VALUE, // Node B's value of x
    linkHealthy: true,
    choice: 'C', // only meaningful while partitioned
    refused: 0,
    diverged: 0,
    lastOp: null, // { client, op, value, returned, outcome, diverged } for display
    lastReplicated: false, // did the last step send a replication message across the link
  }
}

const clone = (s) => ({ ...s, lastOp: s.lastOp ? { ...s.lastOp } : null })

// Execute the next operation under the current (link, choice) mode. Pure.
export function step(state) {
  if (state.opIndex >= OPS.length) return state
  const s = clone(state)
  const op = OPS[s.opIndex]
  const onA = op.client === 'A'
  s.lastReplicated = false

  if (s.linkHealthy) {
    // Synchronous replication: a write lands on both nodes, reads always agree.
    if (op.op === 'write') {
      s.a = op.value
      s.b = op.value
      s.lastReplicated = true
      s.lastOp = { client: op.client, op: 'write', value: op.value, returned: null, outcome: 'replicated', diverged: false }
    } else {
      const returned = onA ? s.a : s.b
      s.lastOp = { client: op.client, op: 'read', value: null, returned, outcome: 'agree', diverged: false }
    }
  } else if (s.choice === 'C') {
    // Consistency: with only two nodes there is no quorum during a partition, so the
    // system refuses rather than risk diverging. Values never change.
    s.refused += 1
    s.lastOp = { client: op.client, op: op.op, value: op.op === 'write' ? op.value : null, returned: null, outcome: 'refused', diverged: false }
  } else {
    // Availability: serve locally with no replication, so the replicas drift apart.
    if (op.op === 'write') {
      if (onA) s.a = op.value
      else s.b = op.value
      const diverged = s.a !== s.b
      if (diverged) s.diverged += 1
      s.lastOp = { client: op.client, op: 'write', value: op.value, returned: null, outcome: 'local-write', diverged }
    } else {
      const returned = onA ? s.a : s.b
      const diverged = s.a !== s.b
      if (diverged) s.diverged += 1
      s.lastOp = { client: op.client, op: 'read', value: null, returned, outcome: 'stale-read', diverged }
    }
  }

  s.opIndex += 1
  return s
}

// Break or heal the network link. Healing does NOT reconcile diverged values (that
// is out of scope); if the replicas disagree, the conflict simply becomes visible.
export function setLink(state, healthy) {
  const s = clone(state)
  s.linkHealthy = healthy
  s.lastReplicated = false
  s.lastOp = null
  return s
}

// Choose the partition behaviour. Only affects steps taken while partitioned.
export function setChoice(state, choice) {
  const s = clone(state)
  s.choice = choice
  s.lastOp = null
  return s
}

// Rewind the operation sequence and clear the counters, keeping the current link and
// choice configuration so the same scenario can be replayed.
export function reset(state) {
  const s = clone(state)
  s.opIndex = 0
  s.a = START_VALUE
  s.b = START_VALUE
  s.refused = 0
  s.diverged = 0
  s.lastOp = null
  s.lastReplicated = false
  return s
}

export function isDone(state) {
  return state.opIndex >= OPS.length
}

// The replicas hold different values while the link is healthy: an unresolved
// conflict left behind by an availability-mode partition.
export function hasConflict(state) {
  return state.linkHealthy && state.a !== state.b
}
