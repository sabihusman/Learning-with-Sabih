import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  OPS,
  REPLICAS,
  MODES,
  MAX_LAG,
  START_BALANCE,
  scheduleFor,
  totalStepsFor,
  writeCostFor,
  stateAt,
  killAt,
} from '../app/components/replicationData'

// Pure-logic correctness for the Replication figure. No page, no browser.
//
// Everything below is an INDEPENDENT resimulation from the raw OPS / REPLICAS /
// START_BALANCE literals. The data module answers "what is the newest write whose
// arrival step is at or before this step" by scanning the write list; this file
// instead walks the timeline forward one step at a time, pushing each issued write
// onto a per-replica queue and draining it as arrivals come due. Two different
// constructions of the same quantity, compared at every step of both modes.

type Write = { seq: number; value: number; issue: number; ack: number; arr: Record<string, number> }
type Ev = { kind: 'write' | 'wait' | 'read'; w?: Write; replica?: string }

function resimulate(mode: string) {
  const timeline: Ev[] = []
  const writes: Write[] = []
  let t = 0

  for (const op of OPS) {
    if (op.op === 'write') {
      t += 1
      const arr: Record<string, number> = {}
      for (const r of REPLICAS) arr[r.id] = t + r.lag
      const w: Write = { seq: writes.length + 1, value: op.value as number, issue: t, ack: mode === 'sync' ? t + MAX_LAG : t, arr }
      writes.push(w)
      timeline[t] = { kind: 'write', w }
      if (mode === 'sync') {
        for (let k = 0; k < MAX_LAG; k += 1) {
          t += 1
          timeline[t] = { kind: 'wait', w }
        }
      }
    } else {
      t += 1
      timeline[t] = { kind: 'read', replica: op.replica as string }
    }
  }

  const total = t
  let primary = START_BALANCE
  let stale = 0
  const value: Record<string, number> = {}
  const frontier: Record<string, number> = {}
  const queue: Record<string, Write[]> = {}
  for (const r of REPLICAS) {
    value[r.id] = START_BALANCE
    frontier[r.id] = 0
    queue[r.id] = []
  }

  const perStep: Array<{
    primary: number
    value: Record<string, number>
    frontier: Record<string, number>
    pending: Record<string, Write[]>
    stale: number
    read: { returned: number; stale: boolean } | null
  }> = []

  perStep[0] = {
    primary,
    value: { ...value },
    frontier: { ...frontier },
    pending: Object.fromEntries(REPLICAS.map((r) => [r.id, []])),
    stale: 0,
    read: null,
  }

  for (let s = 1; s <= total; s += 1) {
    const ev = timeline[s]
    if (ev.kind === 'write') {
      primary = ev.w!.value
      for (const r of REPLICAS) queue[r.id].push(ev.w!)
    }
    // drain everything that has come due by this step
    for (const r of REPLICAS) {
      const due = queue[r.id].filter((w) => w.arr[r.id] <= s)
      for (const w of due) {
        value[r.id] = w.value
        frontier[r.id] = w.seq
      }
      queue[r.id] = queue[r.id].filter((w) => w.arr[r.id] > s)
    }
    let read: { returned: number; stale: boolean } | null = null
    if (ev.kind === 'read') {
      const returned = value[ev.replica!]
      const isStale = returned !== primary
      if (isStale) stale += 1
      read = { returned, stale: isStale }
    }
    perStep[s] = {
      primary,
      value: { ...value },
      frontier: { ...frontier },
      pending: Object.fromEntries(REPLICAS.map((r) => [r.id, [...queue[r.id]]])),
      stale,
      read,
    }
  }

  return { total, writes, timeline, perStep }
}

const SIMS = Object.fromEntries(MODES.map((m) => [m.id, resimulate(m.id)]))

test('schedule length and per-write cost match an independent expansion', () => {
  const writeCount = OPS.filter((o) => o.op === 'write').length
  const readCount = OPS.length - writeCount
  expect(writeCount + readCount).toBe(OPS.length)

  for (const m of MODES) {
    const sim = SIMS[m.id]
    expect(totalStepsFor(m.id), `${m.id} totalSteps`).toBe(sim.total)
    expect(writeCostFor(m.id), `${m.id} writeCost`).toBe(m.id === 'sync' ? 1 + MAX_LAG : 1)
    expect(sim.total, `${m.id} steps = reads + writes * cost`).toBe(readCount + writeCount * writeCostFor(m.id))
  }

  // Synchronous must visibly cost more steps for the same stream, or the toggle is dead.
  expect(totalStepsFor('sync')).toBeGreaterThan(totalStepsFor('async'))
  expect(totalStepsFor('sync') - totalStepsFor('async')).toBe(writeCount * MAX_LAG)
})

test('replica lags are distinct, so one replica is always at least as fresh', () => {
  const lags = REPLICAS.map((r) => r.lag)
  expect(new Set(lags).size, 'lags must differ per replica').toBe(lags.length)
  const freshest = REPLICAS.reduce((a, b) => (a.lag <= b.lag ? a : b))
  for (const m of MODES) {
    const sim = SIMS[m.id]
    for (let s = 0; s <= sim.total; s += 1) {
      for (const r of REPLICAS) {
        expect(sim.perStep[s].frontier[freshest.id], `${m.id} s${s} ${r.id}`).toBeGreaterThanOrEqual(
          sim.perStep[s].frontier[r.id],
        )
      }
    }
  }
})

for (const m of MODES) {
  test(`every step matches the independent resimulation: ${m.id}`, () => {
    const sim = SIMS[m.id]
    const sched = scheduleFor(m.id)

    for (const w of sched.writes) {
      const exp = sim.writes.find((x) => x.seq === w.seq)!
      expect(w.value, `write ${w.seq} value`).toBe(exp.value)
      expect(w.issueStep, `write ${w.seq} issueStep`).toBe(exp.issue)
      expect(w.ackStep, `write ${w.seq} ackStep`).toBe(exp.ack)
      for (const r of REPLICAS) expect(w.arrival[r.id], `write ${w.seq} arrival ${r.id}`).toBe(exp.arr[r.id])
    }

    for (let s = 0; s <= sim.total; s += 1) {
      const actual = stateAt(m.id, s)
      const expected = sim.perStep[s]
      expect(actual.primary, `${m.id} s${s} primary`).toBe(expected.primary)
      expect(actual.staleReads, `${m.id} s${s} stale count`).toBe(expected.stale)
      for (const r of REPLICAS) {
        const got = actual.replicas.find((x) => x.id === r.id)!
        expect(got.value, `${m.id} s${s} ${r.id} value`).toBe(expected.value[r.id])
        expect(got.frontier, `${m.id} s${s} ${r.id} frontier`).toBe(expected.frontier[r.id])
        expect(
          got.pending.map((w) => `${w.value}@${w.arrival[r.id]}`),
          `${m.id} s${s} ${r.id} pending`,
        ).toEqual(expected.pending[r.id].map((w) => `${w.value}@${w.arr[r.id]}`))
      }
      if (expected.read) {
        expect(actual.lastRead, `${m.id} s${s} lastRead present`).not.toBeNull()
        expect(actual.lastRead!.returned, `${m.id} s${s} returned`).toBe(expected.read.returned)
        expect(actual.lastRead!.stale, `${m.id} s${s} stale flag`).toBe(expected.read.stale)
      } else {
        expect(actual.lastRead, `${m.id} s${s} no read`).toBeNull()
      }
    }
  })

  test(`killing the primary at every step matches the independent resimulation: ${m.id}`, () => {
    const sim = SIMS[m.id]
    const sched = scheduleFor(m.id)

    for (let s = 0; s <= sim.total; s += 1) {
      const k = killAt(sched, s)
      const st = sim.perStep[s]

      // furthest ahead, ties to the smaller lag
      const ranked = [...REPLICAS].sort((a, b) => st.frontier[b.id] - st.frontier[a.id] || a.lag - b.lag)
      expect(k.promoted.id, `${m.id} s${s} promoted`).toBe(ranked[0].id)
      expect(k.promotedValue, `${m.id} s${s} promoted value`).toBe(st.value[ranked[0].id])
      expect(k.primaryValue, `${m.id} s${s} primary value`).toBe(st.primary)
      expect(k.staleReads, `${m.id} s${s} stale reads`).toBe(st.stale)

      const expLost = st.pending[ranked[0].id]
      expect(
        k.lost.map((w) => `${w.value}@${w.issueStep}`),
        `${m.id} s${s} lost set`,
      ).toEqual(expLost.map((w) => `${w.value}@${w.issue}`))
      expect(
        k.acknowledgedLost.map((w) => w.value),
        `${m.id} s${s} acknowledged loss`,
      ).toEqual(expLost.filter((w) => w.ack <= s).map((w) => w.value))
      expect(
        k.inFlightLost.map((w) => w.value),
        `${m.id} s${s} in-flight loss`,
      ).toEqual(expLost.filter((w) => w.ack > s).map((w) => w.value))
      expect(k.acknowledgedLost.length + k.inFlightLost.length, `${m.id} s${s} loss partition`).toBe(k.lost.length)
    }
  })
}

test('asynchronous mode: reads go stale and acknowledged writes can be lost', () => {
  const sched = scheduleFor('async')
  const end = stateAt('async', totalStepsFor('async'))
  expect(end.staleReads, 'async must actually produce stale reads').toBeGreaterThan(0)

  const worstAckLoss = Array.from({ length: totalStepsFor('async') + 1 }, (_, s) => killAt(sched, s).acknowledgedLost.length)
  expect(Math.max(...worstAckLoss), 'async must be able to lose more than one acknowledged write').toBeGreaterThan(1)
})

test('synchronous mode: no stale read anywhere, and no acknowledged write is ever lost', () => {
  const sched = scheduleFor('sync')
  const total = totalStepsFor('sync')

  for (let s = 0; s <= total; s += 1) {
    expect(stateAt('sync', s).staleReads, `sync s${s} stale reads`).toBe(0)
    const k = killAt(sched, s)
    expect(k.acknowledgedLost, `sync s${s} acknowledged loss`).toEqual([])
    for (const w of k.lost) expect(w.acknowledged, `sync s${s} lost write ${w.value} unacknowledged`).toBe(false)
  }

  // and the guarantee is not vacuous: there are steps where a write is in flight.
  const inFlightSteps = Array.from({ length: total + 1 }, (_, s) => killAt(sched, s).inFlightLost.length).filter((n) => n > 0)
  expect(inFlightSteps.length, 'sync must have steps with a write in flight').toBeGreaterThan(0)
})

test('the figure carries no timing constructs', () => {
  const banned = /setInterval|setTimeout|requestAnimationFrame|usePacedInterval|useAnimationSpeedRef|animejs|speedControl/
  for (const file of ['app/components/ReplicationViz.jsx', 'app/components/replicationData.js']) {
    const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
    expect(banned.test(src), `${file} must stay out of the animation-speed system`).toBe(false)
  }
})
