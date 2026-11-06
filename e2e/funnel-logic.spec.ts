import { test, expect } from '@playwright/test'
import { COHORTS, WINDOWS, STEP_EVENTS, stepSessions, computeFunnel, buildSql, eventsFor } from '../app/components/funnelData'
import { users } from '../app/components/sqlData'

// Invariants for the Funnel figure: an ordered, windowed funnel (step n holds
// only sessions that did steps 1..n-1 first, in order, within the window), one
// unit (sessions) and one denominator (sessions that reached step 1).

const ALL = COHORTS.flatMap((c) => WINDOWS.flatMap((w) => [false, true].map((messy) => ({ cohortId: c.id, windowMinutes: w.minutes, messy }))))

// An independent re-implementation: walk each session's events in time order
// and advance through the steps. Shares nothing with funnelData's own code.
function resimulate({ cohortId, windowMinutes, messy }: { cohortId: string; windowMinutes: number | null; messy: boolean }) {
  const month: Record<string, string> = { jan: '2025-01', feb: '2025-02', mar: '2025-03' }
  const keep = new Set(
    users
      .filter((u) => cohortId === 'all' || u.plan === cohortId || u.signup_date.slice(0, 7) === month[cohortId])
      .map((u) => u.user_id),
  )
  const counts = [0, 0, 0]
  const sessions = new Map<number, { event: string; at: number }[]>()
  for (const e of eventsFor(messy)) {
    if (!keep.has(e.user_id)) continue
    const at = new Date(e.occurred_at.replace(' ', 'T') + 'Z').getTime()
    sessions.set(e.session_id, [...(sessions.get(e.session_id) ?? []), { event: e.event, at }])
  }
  for (const list of sessions.values()) {
    const sorted = [...list].sort((a, b) => a.at - b.at || STEP_EVENTS.indexOf(a.event) - STEP_EVENTS.indexOf(b.event))
    let stage = 0
    let start = 0
    for (const ev of sorted) {
      if (stage > 0 && windowMinutes != null && ev.at > start + windowMinutes * 60000) break
      if (ev.event === STEP_EVENTS[stage]) {
        if (stage === 0) start = ev.at
        counts[stage] += 1
        stage += 1
        if (stage === 3) break
      }
    }
  }
  return counts
}

test.describe('funnel logic', () => {
  test('every step is a subset of the step before it, in every configuration', () => {
    for (const o of ALL) {
      const [opened, used, completed] = stepSessions(o)
      for (const id of used) expect(opened.has(id), JSON.stringify(o)).toBe(true)
      for (const id of completed) expect(used.has(id), JSON.stringify(o)).toBe(true)
    }
  })

  test('one denominator: every percentage is a share of the sessions that reached step 1', () => {
    for (const o of ALL) {
      const f = computeFunnel(o)
      expect(f.base).toBe(f.steps[0].count)
      for (const s of f.steps) expect(s.shareOfBase).toBeCloseTo(f.base === 0 ? 0 : (s.count / f.base) * 100, 10)
      expect(f.completion).toBeCloseTo(f.steps[2].shareOfBase, 10)
      expect(f.outsideBase).toBe(0)
    }
  })

  test('counts match an independent re-simulation in every configuration', () => {
    for (const o of ALL) {
      expect(computeFunnel(o).steps.map((s) => s.count), JSON.stringify(o)).toEqual(resimulate(o))
    }
  })

  test('a wider window never lowers a count', () => {
    for (const c of COHORTS) {
      for (const messy of [false, true]) {
        const series = WINDOWS.map((w) => computeFunnel({ cohortId: c.id, windowMinutes: w.minutes, messy }).steps.map((s) => s.count))
        for (let i = 1; i < series.length; i += 1) series[i].forEach((n, k) => expect(n).toBeGreaterThanOrEqual(series[i - 1][k]))
      }
    }
  })

  test('the headline numbers', () => {
    expect(computeFunnel({ windowMinutes: 30 }).steps.map((s) => s.count)).toEqual([143, 77, 45])
    expect(computeFunnel({ windowMinutes: 30 }).completion.toFixed(1)).toBe('31.5')
    expect(computeFunnel({ windowMinutes: 1 }).steps.map((s) => s.count)).toEqual([143, 59, 5])
    expect(computeFunnel({ windowMinutes: 2 }).steps.map((s) => s.count)).toEqual([143, 77, 30])
  })

  test('counting each step on its own lets sessions that never opened into later steps', () => {
    const naive = computeFunnel({ mode: 'independent', messy: true })
    expect(naive.steps.map((s) => s.count)).toEqual([146, 81, 50])
    expect(naive.outsideBase).toBe(2)
    expect(computeFunnel({ mode: 'ordered', messy: true, windowMinutes: 30 }).steps.map((s) => s.count)).toEqual([146, 79, 45])
  })

  test('the SQL shown follows the controls', () => {
    const ordered = buildSql({ windowMinutes: 30 })
    expect(ordered).toContain("e.occurred_at >= o.t1")
    expect(ordered).toContain("e.occurred_at >= u.t2")
    expect(ordered.match(/INTERVAL '30 minutes'/g)).toHaveLength(2)
    expect(buildSql({ windowMinutes: null })).not.toContain('INTERVAL')
    expect(buildSql({ mode: 'independent' })).toContain('SELECT DISTINCT session_id FROM events WHERE event =')
    expect(buildSql({ cohortId: 'pro', windowMinutes: 2 })).toContain("u.plan = 'pro'")
  })
})

test.describe('funnel figure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/topics/funnel-analysis/')
    await expect(page.getByTestId('step-0')).toBeVisible()
  })

  test('opens on the ordered 30-minute funnel with one labelled denominator', async ({ page }) => {
    await expect(page.getByTestId('step-0')).toHaveText('143')
    await expect(page.getByTestId('step-2')).toHaveText('45')
    await expect(page.getByTestId('base')).toHaveText('denominator: 143 sessions that opened a topic')
    await expect(page.locator('figure').first()).toContainText('45 of the 143 sessions that opened a topic completed it (31.5%)')
  })

  test('shrinking the window drops completions and the SQL follows', async ({ page }) => {
    await page.getByTestId('window-1').click()
    await expect(page.getByTestId('step-1')).toHaveText('59')
    await expect(page.getByTestId('step-2')).toHaveText('5')
    await expect(page.getByTestId('sql')).toContainText("INTERVAL '1 minutes'")
  })

  test('the old counting is always labelled incorrect and always carries its warning', async ({ page }) => {
    await expect(page.getByTestId('old-way-warning')).toHaveCount(0)
    await page.getByRole('button', { name: 'Old way (incorrect): each step alone', exact: true }).click()
    // clean data: totals match the ordered funnel, but the warning still shows
    await expect(page.getByTestId('old-way-warning')).toContainText('Old way, incorrect')
    await expect(page.locator('figure').first()).toContainText('they are not a funnel')
    await page.getByTestId('messy').click()
    await expect(page.getByTestId('old-way-warning')).toContainText('2 sessions counted at a later step never opened a topic')
  })

  test('the common mistake counts sessions that never opened a topic', async ({ page }) => {
    await page.getByTestId('messy').click()
    await page.getByRole('button', { name: 'Old way (incorrect): each step alone', exact: true }).click()
    await expect(page.getByTestId('step-2')).toHaveText('50')
    await expect(page.locator('figure').first()).toContainText('2 sessions counted at a later step never opened a topic')
    await page.getByRole('button', { name: 'Ordered funnel', exact: true }).click()
    await expect(page.getByTestId('step-2')).toHaveText('45')
  })
})
