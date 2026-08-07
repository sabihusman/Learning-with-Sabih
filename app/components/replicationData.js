// Deterministic data and simulation for the Replication topic (Systems and
// Networking).
//
// One key: an account balance holding a single integer. Three nodes: a primary
// that every write lands on immediately, and two replicas that receive each write
// after a fixed, authored lag measured in steps. Replica 1 lags 2 steps, replica 2
// lags 4, so replica 1 is always at least as fresh as replica 2.
//
// There is no clock anywhere in this file and none in the component. Every value
// the figure shows is a pure function of (mode, step index): integer bookkeeping
// over a frozen operation stream. Nothing is sampled, nothing is random, and no
// timer, interval, or animation frame is involved.
//
// Two replication modes share the same stream and the same lags:
//
//   asynchronous - a write is acknowledged the instant it lands on the primary, so
//     it occupies exactly one step. The replicas catch up later, which is why reads
//     routed to them can be stale, and why a primary failure can lose writes the
//     client was already told had succeeded.
//
//   synchronous - a write is not acknowledged until BOTH replicas hold it, so it
//     occupies 1 + MAX_LAG steps: the step it is issued on plus one step per lag
//     unit of waiting. Every read that follows a completed write sees the newest
//     value on either replica, so no read is ever stale. The cost is paid in steps,
//     and the step total is the readout that shows it.

export const START_BALANCE = 100

// Fixed operation stream: 20 operations, writes and reads interleaved. Reads name
// the replica they are routed to; the primary is never read in this figure, which
// is the whole reason staleness is visible at all.
export const OPS = [
  { op: 'write', value: 120 },
  { op: 'read', replica: 'r1' },
  { op: 'read', replica: 'r2' },
  { op: 'write', value: 145 },
  { op: 'read', replica: 'r1' },
  { op: 'read', replica: 'r2' },
  { op: 'read', replica: 'r1' },
  { op: 'write', value: 130 },
  { op: 'write', value: 118 },
  { op: 'write', value: 160 },
  { op: 'read', replica: 'r1' },
  { op: 'read', replica: 'r2' },
  { op: 'read', replica: 'r1' },
  { op: 'read', replica: 'r2' },
  { op: 'write', value: 205 },
  { op: 'read', replica: 'r1' },
  { op: 'read', replica: 'r2' },
  { op: 'read', replica: 'r1' },
  { op: 'read', replica: 'r2' },
  { op: 'read', replica: 'r1' },
]

// Authored lag, in steps, per replica. Different per replica on purpose.
export const REPLICAS = [
  { id: 'r1', name: 'Replica 1', lag: 2 },
  { id: 'r2', name: 'Replica 2', lag: 4 },
]

export const MAX_LAG = REPLICAS.reduce((m, r) => Math.max(m, r.lag), 0)

export const MODES = [
  { id: 'async', label: 'Asynchronous' },
  { id: 'sync', label: 'Synchronous' },
]

// ── schedule ────────────────────────────────────────────────────────────────────
//
// Lay the operation stream onto a step timeline for one mode. A read always takes
// one step. A write takes one step in async mode; in sync mode it takes one step to
// issue plus MAX_LAG steps of waiting, and is acknowledged on the last of those.
//
// Returns { mode, totalSteps, writes, events } where events is indexed by step
// (1-based; events[0] is undefined) and every write carries the step it was issued
// on, the step the client was told it succeeded, and its arrival step per replica.
export function buildSchedule(mode) {
  const writes = []
  const events = []
  let t = 0

  OPS.forEach((op, opIndex) => {
    if (op.op === 'write') {
      t += 1
      const issueStep = t
      const arrival = {}
      REPLICAS.forEach((r) => {
        arrival[r.id] = issueStep + r.lag
      })
      const ackStep = mode === 'sync' ? issueStep + MAX_LAG : issueStep
      const write = { seq: writes.length + 1, opIndex, value: op.value, issueStep, ackStep, arrival }
      writes.push(write)
      events[issueStep] = { step: issueStep, kind: 'write', opIndex, writeSeq: write.seq }
      if (mode === 'sync') {
        for (let k = 0; k < MAX_LAG; k += 1) {
          t += 1
          events[t] = { step: t, kind: 'wait', opIndex, writeSeq: write.seq, acks: t === ackStep }
        }
      }
    } else {
      t += 1
      events[t] = { step: t, kind: 'read', opIndex, replica: op.replica }
    }
  })

  return { mode, totalSteps: t, writes, events }
}

// Cache one schedule per mode: they are frozen, so rebuilding per render is waste.
const SCHEDULES = MODES.reduce((acc, m) => {
  acc[m.id] = buildSchedule(m.id)
  return acc
}, {})

export function scheduleFor(mode) {
  return SCHEDULES[mode]
}

export function totalStepsFor(mode) {
  return SCHEDULES[mode].totalSteps
}

// Steps one write costs in this mode: 1 to issue, plus the wait in sync mode.
export function writeCostFor(mode) {
  return mode === 'sync' ? 1 + MAX_LAG : 1
}

// ── point-in-time values ────────────────────────────────────────────────────────

// The primary applies a write the instant it is issued, in both modes.
export function primaryValueAt(sched, step) {
  let value = START_BALANCE
  for (const w of sched.writes) {
    if (w.issueStep <= step) value = w.value
  }
  return value
}

// A replica holds the newest write that has ARRIVED by this step.
export function replicaValueAt(sched, replicaId, step) {
  let value = START_BALANCE
  for (const w of sched.writes) {
    if (w.arrival[replicaId] <= step) value = w.value
  }
  return value
}

// The newest write sequence number a replica has actually received (0 if none), the
// measure of how far ahead it is.
export function replicaFrontierAt(sched, replicaId, step) {
  let seq = 0
  for (const w of sched.writes) {
    if (w.arrival[replicaId] <= step) seq = w.seq
  }
  return seq
}

// Writes that have been issued on the primary but have not yet reached this replica.
// Each is tagged with whether the client was already told it succeeded, which is the
// difference between an acknowledged write and one still in flight.
export function pendingAt(sched, replicaId, step) {
  return sched.writes
    .filter((w) => w.issueStep <= step && w.arrival[replicaId] > step)
    .map((w) => ({ ...w, acknowledged: w.ackStep <= step }))
}

// Every read executed up to and including this step, with what it returned and
// whether that differed from the primary's value at the moment it ran.
export function readsUpTo(sched, step) {
  const out = []
  for (let s = 1; s <= step; s += 1) {
    const e = sched.events[s]
    if (!e || e.kind !== 'read') continue
    const returned = replicaValueAt(sched, e.replica, s)
    const primary = primaryValueAt(sched, s)
    out.push({ step: s, replica: e.replica, returned, primary, stale: returned !== primary })
  }
  return out
}

export function staleCountAt(sched, step) {
  return readsUpTo(sched, step).filter((r) => r.stale).length
}

// ── failover ────────────────────────────────────────────────────────────────────
//
// Kill the primary at this step and promote the replica that is furthest ahead, ties
// broken by the smaller lag then by declaration order so the choice is deterministic.
// Every write the primary holds that has not reached the promoted replica is lost:
// the new primary simply never had it, and the old one is gone.
export function killAt(sched, step) {
  const ranked = REPLICAS.map((r) => ({ ...r, frontier: replicaFrontierAt(sched, r.id, step) })).sort(
    (a, b) => b.frontier - a.frontier || a.lag - b.lag || REPLICAS.indexOf(a) - REPLICAS.indexOf(b),
  )
  const promoted = ranked[0]
  const lost = pendingAt(sched, promoted.id, step)
  return {
    step,
    promoted,
    demoted: ranked.slice(1),
    primaryValue: primaryValueAt(sched, step),
    promotedValue: replicaValueAt(sched, promoted.id, step),
    lost,
    acknowledgedLost: lost.filter((w) => w.acknowledged),
    inFlightLost: lost.filter((w) => !w.acknowledged),
    staleReads: staleCountAt(sched, step),
  }
}

// ── the whole picture at one step ───────────────────────────────────────────────

export function stateAt(mode, step) {
  const sched = SCHEDULES[mode]
  const clamped = Math.max(0, Math.min(step, sched.totalSteps))
  const event = clamped === 0 ? null : sched.events[clamped]
  const reads = readsUpTo(sched, clamped)
  return {
    mode,
    step: clamped,
    totalSteps: sched.totalSteps,
    event,
    primary: primaryValueAt(sched, clamped),
    replicas: REPLICAS.map((r) => ({
      ...r,
      value: replicaValueAt(sched, r.id, clamped),
      frontier: replicaFrontierAt(sched, r.id, clamped),
      pending: pendingAt(sched, r.id, clamped),
    })),
    reads,
    staleReads: reads.filter((rd) => rd.stale).length,
    lastRead: reads.length > 0 && reads[reads.length - 1].step === clamped ? reads[reads.length - 1] : null,
  }
}
