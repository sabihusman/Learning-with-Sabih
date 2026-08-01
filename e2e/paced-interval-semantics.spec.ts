import { test, expect, Page } from '@playwright/test'
import { STEPS_PER_TICK, TOTAL_ITERS } from '../app/components/decisionBoundaryData'

// Pins the usePacedInterval semantics that PR #154 introduced.
//
//   1. Changing the tick closure's data mid-run does NOT rebind or stop the
//      timer: the next tick fires on the existing cadence and acts on the NEW
//      data, with no tick skipped or doubled. The representative consumer is
//      DecisionBoundaryViz: nudging a point (MOVE_POINT) swaps the training
//      data and resets the iteration counter while `running` stays true, so
//      the interval instance itself survives the change. It is the ONLY
//      consumer with a mid-run data change: every stepper (Sorting,
//      BinarySearch, and the rest) deliberately pauses in the same event as
//      its data change, so the scenario cannot arise there at all, and a tick
//      acting on new data always sees a coherent frame (audited while writing
//      this spec).
//   2. A speed change DOES rebind: the cadence visibly changes (SortingViz,
//      PLAY_MS 120, the fastest stepper).
//   3. The running toggle DOES rebind: Pause freezes ticks, Play resumes
//      (SortingViz).
//
// The hook has no direct test because the repo's only runner is Playwright
// e2e and a React hook needs a renderer; the consumers above cover it.
//
// A MutationObserver on document.body records every distinct rendered value
// of the watched readout (re-locating it each mutation, since React replaces
// readout nodes when sibling labels change), so the no-skip/no-double
// assertions read actual rendered ticks rather than sampling on a timer.

const armTickObserver = (page: Page, label: string) =>
  page.evaluate((lbl) => {
    const read = () => {
      const dt = [...document.querySelectorAll('dl dt')].find((d) => d.textContent?.trim() === lbl)
      return dt?.nextElementSibling?.textContent?.trim() ?? ''
    }
    const first = read()
    if (!first) throw new Error(`${lbl} readout not found`)
    const w = window as unknown as { __ticks: string[] }
    w.__ticks = [first]
    new MutationObserver(() => {
      const v = read()
      if (v && v !== w.__ticks[w.__ticks.length - 1]) w.__ticks.push(v)
    }).observe(document.body, { childList: true, characterData: true, subtree: true })
  }, label)

const observedTicks = (page: Page) =>
  page.evaluate(() => (window as unknown as { __ticks: string[] }).__ticks.slice())

const leadingNumbers = (ticks: string[]) => ticks.map((t) => Number(t.split('/')[0].trim()))

test('data change mid-run does not rebind the timer: ticks continue on the new data', async ({ page }) => {
  await page.goto('/topics/decision-boundary/')
  await armTickObserver(page, 'iterations')

  // Training auto-runs on load; let it advance a few ticks first.
  await expect
    .poll(async () => leadingNumbers(await observedTicks(page)).at(-1), { timeout: 5000 })
    .toBeGreaterThanOrEqual(3 * STEPS_PER_TICK)

  // Nudge a point mid-run. MOVE_POINT swaps the training data and resets the
  // iteration counter, but `running` stays true: the timer is never touched.
  await page.getByRole('button', { name: /point 1\./ }).press('ArrowUp')

  // With no further input, ticks keep arriving and train on the moved point:
  // the counter restarts from 0 and climbs again.
  await expect
    .poll(
      async () => {
        const nums = leadingNumbers(await observedTicks(page))
        const resetAt = nums.lastIndexOf(0)
        return resetAt > 0 && (nums.at(-1) ?? 0) >= 2 * STEPS_PER_TICK
      },
      { timeout: 5000 },
    )
    .toBe(true)

  // No tick skipped or doubled, before or after the data change: every
  // transition advances by exactly STEPS_PER_TICK (clamped at TOTAL_ITERS),
  // except the single reset to 0 from the nudge.
  const nums = leadingNumbers(await observedTicks(page))
  let resets = 0
  for (let i = 1; i < nums.length; i += 1) {
    if (nums[i] === 0) {
      resets += 1
    } else {
      expect(nums[i], `tick sequence ${nums.join(',')}`).toBe(Math.min(nums[i - 1] + STEPS_PER_TICK, TOTAL_ITERS))
    }
  }
  expect(resets).toBe(1)
})

test('speed change rebinds the timer: cadence visibly changes', async ({ page }) => {
  await page.goto('/topics/sorting/')
  await armTickObserver(page, 'step')
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  // Count ticks over a fixed window at 1x, then the same window at 0.5x.
  // Nominal cadence is 120ms vs 240ms per tick; requiring a 3-tick gap keeps
  // this robust under CI load.
  await page.waitForTimeout(1500)
  const atFull = (await observedTicks(page)).length
  await page.getByRole('button', { name: 'Half speed', exact: true }).click()
  await page.waitForTimeout(1500)
  const atHalf = (await observedTicks(page)).length - atFull
  expect(atFull, `1x ticks ${atFull} vs 0.5x ticks ${atHalf}`).toBeGreaterThanOrEqual(atHalf + 3)

  const pause = page.getByRole('button', { name: 'Pause', exact: true })
  if (await pause.isVisible()) await pause.click()
})

test('running toggle rebinds the timer: Pause freezes ticks, Play resumes', async ({ page }) => {
  await page.goto('/topics/sorting/')
  await armTickObserver(page, 'step')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(async () => (await observedTicks(page)).length, { timeout: 5000 }).toBeGreaterThanOrEqual(3)

  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const atPause = (await observedTicks(page)).length
  await page.waitForTimeout(600)
  expect((await observedTicks(page)).length, 'no ticks while paused').toBe(atPause)

  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(async () => (await observedTicks(page)).length, { timeout: 5000 }).toBeGreaterThan(atPause)
})
