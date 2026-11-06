import { test, expect } from '@playwright/test'
import {
  DB_ID,
  DEFAULT_POLICIES,
  HTTP_MAX_AGE_S,
  LATENCY_LABEL,
  LATENCY_RANGE_MS,
  POLICIES,
  REDIS_TTL_S,
  RESOURCES,
  STREAM,
  httpStorers,
  simulate,
} from '../app/components/cachingLayersData'

// Invariants for the Where Caches Live figure. The headline one: browsers and
// the CDN store a response only when its Cache-Control header allows it, and a
// Redis hit never fills them by itself.

type Policies = Record<string, string>
const ALL_POLICIES: Policies[] = []
for (const a of POLICIES) for (const b of POLICIES) for (const c of POLICIES) ALL_POLICIES.push({ logo: a.id, profile: b.id, prices: c.id })
const perReader = Object.fromEntries(RESOURCES.map((r) => [r.id, r.perReader]))

// An independent re-simulation: plain objects with absolute expiry times,
// written without reference to simulate()'s code.
function resimulate(policies: Policies) {
  const http: Record<string, number> = {} // `${cache}|${res}` -> expires
  const redis: Record<string, number> = {}
  return STREAM.map(({ reader, res, t }) => {
    const live = (exp: number | undefined) => exp !== undefined && t < exp
    const p = policies[res]
    const browserKey = `b-${reader}|${res}`
    const cdnKey = `cdn|${res}`
    if (live(http[browserKey])) return 'browser'
    if (live(http[cdnKey])) {
      if (p === 'public' || p === 'private') http[browserKey] = http[cdnKey]
      return 'cdn'
    }
    const rk = perReader[res] ? `${res}/${reader}` : res
    let source = 'redis'
    if (!live(redis[rk])) {
      source = 'database'
      redis[rk] = t + REDIS_TTL_S
    }
    if (p === 'public' || p === 'private') http[browserKey] = t + HTTP_MAX_AGE_S
    if (p === 'public') http[cdnKey] = t + HTTP_MAX_AGE_S
    return source
  })
}

test.describe('caching layers logic', () => {
  test('every read matches an independent re-simulation, for all 27 header combinations', () => {
    for (const policies of ALL_POLICIES) {
      expect(simulate(policies).slice(1).map((s) => s.servedBy), JSON.stringify(policies)).toEqual(resimulate(policies))
    }
  })

  test('HTTP caches store a response only as its header allows, whether Redis or the database answered', () => {
    for (const policies of ALL_POLICIES) {
      for (const s of simulate(policies).slice(1)) {
        if (s.servedBy !== 'redis' && s.servedBy !== DB_ID) continue
        const storedHttp = s.stored.filter((l) => l !== 'redis').sort()
        expect(storedHttp, JSON.stringify({ policies, step: s.step })).toEqual([...httpStorers(s.policy, s.read.reader)].sort())
      }
    }
  })

  test('a Redis hit puts nothing in a browser or the CDN by itself', () => {
    for (const s of simulate(DEFAULT_POLICIES).slice(1)) {
      if (s.servedBy === 'redis' && s.policy === 'no-store') expect(s.stored).toEqual([])
    }
    const redisHits = simulate(DEFAULT_POLICIES).filter((s) => s.servedBy === 'redis')
    expect(redisHits.length).toBeGreaterThan(0)
  })

  test('the CDN never holds a private or no-store response', () => {
    for (const policies of ALL_POLICIES) {
      for (const s of simulate(policies)) {
        for (const e of s.contents.cdn) expect(policies[e.key], JSON.stringify(policies)).toBe('public')
      }
    }
  })

  test('Redis is written only when the database answered', () => {
    for (const policies of ALL_POLICIES) {
      for (const s of simulate(policies).slice(1)) expect(s.stored.includes('redis')).toBe(s.servedBy === DB_ID)
    }
  })

  test('cached copies expire: a 60-second response cached at t=0 is gone by t=60', () => {
    const states = simulate(DEFAULT_POLICIES)
    const logoReadAt = (t: number) => states.find((s) => s.read?.res === 'logo' && s.t === t)!
    expect(logoReadAt(15).servedBy).toBe('cdn')
    expect(logoReadAt(70).servedBy).toBe(DB_ID)
  })

  test('per-reader data leaks only when marked public', () => {
    for (const policies of ALL_POLICIES) {
      const leaks = simulate(policies).at(-1)!.leaks
      if (policies.profile === 'public') expect(leaks).toBeGreaterThan(0)
      else expect(leaks).toBe(0)
    }
  })

  test('latency labels: Redis is never slower than the CDN', () => {
    expect(LATENCY_RANGE_MS.redis[1]).toBeLessThan(LATENCY_RANGE_MS.cdn[0])
    for (const [layer, [lo, hi]] of Object.entries(LATENCY_RANGE_MS)) {
      const label = LATENCY_LABEL[layer as keyof typeof LATENCY_LABEL]
      expect(label).toBe(lo === hi ? `~${lo} ms` : `~${lo}-${hi} ms`)
    }
  })
})

test.describe('caching layers figure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/topics/caching-layers/')
    await expect(page.getByTestId('box-cdn')).toBeVisible()
  })

  const stepTo = async (page, n: number) => {
    for (let i = 0; i < n; i += 1) await page.getByRole('button', { name: 'Step', exact: true }).click()
  }

  test('read 5: Redis serves a no-store response and neither the CDN nor the browser stores it', async ({ page }) => {
    await stepTo(page, 5)
    await expect(page.getByTestId('box-redis')).toHaveAttribute('data-mark', 'served')
    await expect(page.getByTestId('box-cdn')).toHaveAttribute('data-mark', 'refused')
    await expect(page.getByTestId('box-browser:ben')).toHaveAttribute('data-mark', 'refused')
    await expect(page.getByTestId('entries-cdn')).not.toContainText('/api/prices')
  })

  test('setting /api/prices to public lets the CDN serve it instead of Redis', async ({ page }) => {
    await page.getByTestId('policy-prices-public').click()
    await stepTo(page, 5)
    await expect(page.getByTestId('box-cdn')).toHaveAttribute('data-mark', 'served')
  })

  test('marking per-reader data public leaks it through the shared CDN', async ({ page }) => {
    await page.getByTestId('policy-profile-public').click()
    await stepTo(page, 7)
    await expect(page.getByTestId('box-cdn')).toContainText("served Ana's private data to Ben")
    await expect(page.locator('figure').first()).toContainText("That copy is Ana's data")
  })
})
