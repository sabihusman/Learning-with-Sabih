import { test, expect } from '@playwright/test'
import {
  LAYERS,
  DB_ID,
  STREAM,
  LAST_STEP,
  STATES,
  hitRate,
} from '../app/components/cachingLayersData'

// Pure-logic correctness for the Caching Layers figure. No page, no browser:
// asserts on the same STATES the component renders. To avoid simply re-running
// the module's own code, the expected outcome of every read is recomputed here
// with an independent array-based LRU simulation (most recent first) and
// compared frame by frame: which layer served, all four counts, and every
// layer's exact contents after copy-back.

type Sim = { id: string; capacity: number; keys: string[] }

function touch(sim: Sim, key: string) {
  const at = sim.keys.indexOf(key)
  let evicted: string | null = null
  if (at !== -1) sim.keys.splice(at, 1)
  else if (sim.keys.length >= sim.capacity) evicted = sim.keys.pop() as string
  sim.keys.unshift(key)
  return evicted
}

test('step 0 is the all-empty cold start', () => {
  const s0 = STATES[0]
  expect(s0.step).toBe(0)
  expect(s0.servedBy).toBeNull()
  expect(s0.counts).toEqual({ browser: 0, cdn: 0, redis: 0, database: 0 })
  expect(s0.cacheServed).toBe(0)
  expect(hitRate(s0)).toBe(0)
  for (const layer of LAYERS) expect(s0.orders[layer.id]).toEqual([])
})

test('every frame: serving layer, counts, and contents match an independent LRU simulation', () => {
  const sims: Sim[] = LAYERS.map((l) => ({ id: l.id, capacity: l.capacity, keys: [] }))
  const counts: Record<string, number> = { browser: 0, cdn: 0, redis: 0, database: 0 }

  expect(STATES).toHaveLength(LAST_STEP + 1)

  STREAM.forEach((key, index) => {
    // Which layer serves: the closest sim already holding the key, else the DB.
    const holder = sims.find((sim) => sim.keys.includes(key))
    const expectServedBy = holder ? holder.id : DB_ID
    counts[expectServedBy] += 1

    // The serving cache refreshes recency; every closer layer receives a copy.
    const expectEvicted: Record<string, string> = {}
    const expectCopied: string[] = []
    for (const sim of sims) {
      if (sim.id === expectServedBy) {
        touch(sim, key) // refresh recency, never evicts (key already present)
        break
      }
      const out = touch(sim, key)
      expectCopied.push(sim.id)
      if (out !== null) expectEvicted[sim.id] = out
    }

    const frame = STATES[index + 1]
    expect(frame.step, `step at read ${index + 1}`).toBe(index + 1)
    expect(frame.key, `key at read ${index + 1}`).toBe(key)
    expect(frame.servedBy, `servedBy at read ${index + 1} (${key})`).toBe(expectServedBy)
    expect(frame.copiedInto, `copiedInto at read ${index + 1} (${key})`).toEqual(expectCopied)
    expect(frame.evicted, `evicted at read ${index + 1} (${key})`).toEqual(expectEvicted)
    expect(frame.counts, `counts at read ${index + 1}`).toEqual(counts)
    for (const sim of sims) {
      expect(frame.orders[sim.id], `${sim.id} contents after read ${index + 1}`).toEqual(sim.keys)
    }
    expect(frame.cacheServed, `cacheServed at read ${index + 1}`).toBe(
      counts.browser + counts.cdn + counts.redis,
    )
  })
})

test('final totals: all reads accounted for, hit rate consistent, caches warmed', () => {
  const final = STATES[LAST_STEP]
  const { browser, cdn, redis, database } = final.counts
  expect(browser + cdn + redis + database).toBe(LAST_STEP)
  expect(final.cacheServed).toBe(browser + cdn + redis)
  expect(hitRate(final)).toBe(Math.round((final.cacheServed / LAST_STEP) * 100))

  // The stream is authored so warming is emergent: every layer serves at least
  // one read, and the second half of the stream leans on the database less than
  // the first half.
  expect(browser).toBeGreaterThan(0)
  expect(cdn).toBeGreaterThan(0)
  expect(redis).toBeGreaterThan(0)
  expect(database).toBeGreaterThan(0)
  const dbServes = (frames: typeof STATES) =>
    frames.filter((f) => f.servedBy === DB_ID).length
  const half = LAST_STEP / 2
  expect(dbServes(STATES.slice(1, half + 1))).toBeGreaterThan(dbServes(STATES.slice(half + 1)))
})
