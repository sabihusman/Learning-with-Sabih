// Deterministic data and simulation for the CAP Theorem topic (Systems and
// Networking).
//
// A small model: one key x, replicated on every node of a cluster of two or three
// nodes, and a fixed sequence of reads and writes. Each client talks to the node
// with its own letter. While the network is healthy, every write reaches every
// node, so all copies agree. When the network partitions, the nodes split into
// sides that cannot reach each other, and the system must choose:
//
// - Prefer consistency (majority quorum): an operation succeeds only if the
//   client's side holds a MAJORITY of the cluster's nodes (more than half). A
//   side without a majority refuses. With two nodes a majority is 2 of 2, so a
//   partition leaves NO side a majority and everything is refused. With three
//   nodes and node C cut off, A and B are 2 of 3 and keep serving; C refuses.
//   Only one side can ever hold a majority, so the copies never split into two
//   competing truths: a refusing node is merely behind.
// - Prefer availability: every side serves on its own, so if two sides both
//   take writes, the copies become two different truths.
//
// Healing the network: if at most one side accepted writes during the
// partition, every node simply catches up to that side's value. If two sides
// accepted writes, they hold a conflict, which this model leaves unresolved
// (resolving it is its own topic).
//
// step(), setLink(), setChoice(), setCluster() and reset() are pure: each takes
// a state and returns a new one. Every readout the figure shows is derived here.

export const START_VALUE = 1

export const CLUSTERS = [
  {
    id: 2,
    label: '2 nodes',
    nodes: ['A', 'B'],
    // which nodes can still reach each other during a partition
    sides: [['A'], ['B']],
    ops: [
      { client: 'A', op: 'write', value: 2 },
      { client: 'A', op: 'read' },
      { client: 'B', op: 'read' },
      { client: 'B', op: 'write', value: 3 },
      { client: 'A', op: 'read' },
      { client: 'B', op: 'read' },
    ],
  },
  {
    id: 3,
    label: '3 nodes',
    nodes: ['A', 'B', 'C'],
    sides: [['A', 'B'], ['C']],
    ops: [
      { client: 'A', op: 'write', value: 2 },
      { client: 'C', op: 'read' },
      { client: 'B', op: 'read' },
      { client: 'C', op: 'write', value: 3 },
      { client: 'B', op: 'write', value: 4 },
      { client: 'C', op: 'read' },
    ],
  },
]
export const clusterOf = (id) => CLUSTERS.find((c) => c.id === id)
export const majorityOf = (cluster) => Math.floor(cluster.nodes.length / 2) + 1

// Kept for callers that only know the original two-node sequence.
export const OPS = clusterOf(2).ops

export const CHOICES = [
  { id: 'C', label: 'Prefer consistency' },
  { id: 'A', label: 'Prefer availability' },
]

const freshValues = (cluster) => Object.fromEntries(cluster.nodes.map((n) => [n, START_VALUE]))

export function initialState(clusterId = 2) {
  const cluster = clusterOf(clusterId)
  return {
    clusterId,
    opIndex: 0,
    values: freshValues(cluster),
    linkHealthy: true,
    choice: 'C', // only meaningful while partitioned
    refused: 0,
    diverged: 0,
    wroteDuringPartition: [], // indexes of sides that accepted a write during the partition
    lastOp: null, // { client, op, value, returned, outcome, diverged, wroteTo } for display
    lastHeal: null, // { outcome: 'caught-up' | 'conflict' | 'in-sync', value } after the link heals
  }
}

const clone = (s) => ({
  ...s,
  values: { ...s.values },
  wroteDuringPartition: [...s.wroteDuringPartition],
  lastOp: s.lastOp ? { ...s.lastOp } : null,
  lastHeal: s.lastHeal ? { ...s.lastHeal } : null,
})

export const opsOf = (state) => clusterOf(state.clusterId).ops

// The side (index into cluster.sides) a node is on during a partition.
const sideIndexOf = (cluster, node) => cluster.sides.findIndex((side) => side.includes(node))

// Can this side serve under the current choice while partitioned?
export function sideServes(state, sideIndex) {
  const cluster = clusterOf(state.clusterId)
  if (state.linkHealthy || state.choice === 'A') return true
  return cluster.sides[sideIndex].length >= majorityOf(cluster)
}

// Do two nodes that are both currently able to serve hold different values?
function servingSidesDisagree(state) {
  const cluster = clusterOf(state.clusterId)
  const serving = cluster.nodes.filter((n) => sideServes(state, sideIndexOf(cluster, n)))
  return new Set(serving.map((n) => state.values[n])).size > 1
}

// Execute the next operation under the current (link, choice) mode. Pure.
export function step(state) {
  const cluster = clusterOf(state.clusterId)
  if (state.opIndex >= cluster.ops.length) return state
  const s = clone(state)
  const op = cluster.ops[s.opIndex]
  s.lastHeal = null

  // The nodes this operation can reach: everyone while healthy, its own side otherwise.
  const sideIndex = sideIndexOf(cluster, op.client)
  const reachable = s.linkHealthy ? cluster.nodes : cluster.sides[sideIndex]

  if (!sideServes(s, sideIndex)) {
    s.refused += 1
    s.lastOp = { client: op.client, op: op.op, value: op.op === 'write' ? op.value : null, returned: null, outcome: 'refused', diverged: false, wroteTo: [] }
  } else {
    let returned = null
    if (op.op === 'write') {
      for (const n of reachable) s.values[n] = op.value
      if (!s.linkHealthy && !s.wroteDuringPartition.includes(sideIndex)) s.wroteDuringPartition.push(sideIndex)
    } else {
      returned = s.values[op.client]
    }
    const diverged = !s.linkHealthy && servingSidesDisagree(s)
    if (diverged) s.diverged += 1
    let outcome = 'served'
    if (s.linkHealthy) outcome = op.op === 'write' ? 'replicated' : 'agree'
    s.lastOp = { client: op.client, op: op.op, value: op.op === 'write' ? op.value : null, returned, outcome, diverged, wroteTo: op.op === 'write' ? [...reachable] : [] }
  }

  s.opIndex += 1
  return s
}

// Break or heal the network. Healing lets every node catch up when at most one
// side took writes; two sides that both took writes are left in conflict.
export function setLink(state, healthy) {
  const cluster = clusterOf(state.clusterId)
  const s = clone(state)
  s.lastOp = null
  s.lastHeal = null
  if (!healthy) {
    s.linkHealthy = false
    s.wroteDuringPartition = []
    return s
  }
  if (!s.linkHealthy) {
    const writers = s.wroteDuringPartition
    if (writers.length === 1) {
      const value = s.values[cluster.sides[writers[0]][0]]
      const behind = cluster.nodes.some((n) => s.values[n] !== value)
      for (const n of cluster.nodes) s.values[n] = value
      s.lastHeal = { outcome: behind ? 'caught-up' : 'in-sync', value }
    } else if (writers.length > 1) {
      s.lastHeal = { outcome: 'conflict', value: null }
    } else {
      s.lastHeal = { outcome: 'in-sync', value: s.values[cluster.nodes[0]] }
    }
  }
  s.linkHealthy = true
  s.wroteDuringPartition = []
  return s
}

// Choose the partition behaviour. Only affects steps taken while partitioned.
export function setChoice(state, choice) {
  const s = clone(state)
  s.choice = choice
  s.lastOp = null
  return s
}

// Switch cluster size: a fresh run on the new cluster, keeping link and choice.
export function setCluster(state, clusterId) {
  return { ...initialState(clusterId), linkHealthy: state.linkHealthy, choice: state.choice }
}

// Rewind the operation sequence and clear the counters, keeping the current
// cluster, link and choice so the same scenario can be replayed.
export function reset(state) {
  return { ...initialState(state.clusterId), linkHealthy: state.linkHealthy, choice: state.choice }
}

export function isDone(state) {
  return state.opIndex >= opsOf(state).length
}

// The nodes hold different values while the link is healthy: an unresolved
// conflict left behind by two sides that both accepted writes.
export function hasConflict(state) {
  return state.linkHealthy && new Set(Object.values(state.values)).size > 1
}

// Run every operation of the sequence under one fixed scenario (for tests and
// for the figure's summary), returning the final state.
export function runAll({ clusterId, partitioned, choice }) {
  let s = initialState(clusterId)
  if (partitioned) s = setLink(s, false)
  s = setChoice(s, choice)
  while (!isDone(s)) s = step(s)
  return s
}
