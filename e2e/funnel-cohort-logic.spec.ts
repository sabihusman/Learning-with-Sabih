import { test, expect } from '@playwright/test'
import { COHORTS, computeFunnel } from '../app/components/funnelData'

// Pure-function correctness for the funnel's cohort filter (R2). No page, no browser:
// asserts directly on the same computeFunnel() the component calls, so a change that
// breaks the per-cohort join or the step counts fails here.

test('the "all" cohort matches the unfiltered funnel (143 / 77 / 45 of 146)', () => {
  const f = computeFunnel('all')
  expect(f.totalSessions).toBe(146)
  expect(f.steps.map((s) => s.count)).toEqual([143, 77, 45])
})

test('pro and free cohorts partition all sessions and each other', () => {
  const pro = computeFunnel('pro')
  const free = computeFunnel('free')
  expect(pro.totalSessions + free.totalSessions).toBe(146)
  expect(pro.steps[0].count + free.steps[0].count).toBeLessThanOrEqual(146)
})

test('pro plan converts overall better than free plan on this seed data', () => {
  const pro = computeFunnel('pro')
  const free = computeFunnel('free')
  expect(pro.overallRate).toBeGreaterThan(free.overallRate)
})

test('every cohort in COHORTS produces a monotonically non-increasing funnel', () => {
  for (const cohort of COHORTS) {
    const f = computeFunnel(cohort)
    expect(f.steps[1].count).toBeLessThanOrEqual(f.steps[0].count)
    expect(f.steps[2].count).toBeLessThanOrEqual(f.steps[1].count)
  }
})
