import { test, expect } from '@playwright/test'
import { LAYERS, STATES, LAST_STEP } from '../app/components/cachingLayersData'

// Structural assertions for the wire-and-beads presentation of the Caching
// Layers figure: everything checked here is state-derived rendering (bead count
// and labels per layer, torn vs held wire, database tint) read from the DOM
// after real Step clicks, compared against the precomputed STATES frames. No
// animation timing is asserted anywhere; the figure must satisfy all of this
// with animation disabled.

test('wires, beads, and database tint derive from STATES at every step', async ({ page }) => {
  await page.goto('/topics/caching-layers/')
  const stepButton = page.getByRole('button', { name: 'Step', exact: true })

  for (let step = 0; step <= LAST_STEP; step += 1) {
    if (step > 0) await stepButton.click()
    const frame = STATES[step]

    for (const layer of LAYERS) {
      const expected = frame.orders[layer.id]
      const beads = page.locator(`[data-bead-layer="${layer.id}"]`)
      await expect(beads, `bead count for ${layer.id} at step ${step}`).toHaveCount(expected.length)
      if (expected.length > 0) {
        const labels = await beads.locator('text').allTextContents()
        expect(labels, `bead labels for ${layer.id} at step ${step}`).toEqual(expected)
      }
      await expect(
        page.locator(`[data-wire="${layer.id}"]`),
        `wire integrity for ${layer.id} at step ${step}`,
      ).toHaveAttribute('data-integrity', expected.length === 0 ? 'empty' : 'held')
    }

    await expect(page.locator('[data-db]'), `database tint at step ${step}`).toHaveAttribute(
      'data-serving',
      frame.servedBy === 'database' ? 'true' : 'false',
    )
  }
})

test('speed chips: stepping stays one state per press at 0.5x, Reset keeps the selection', async ({ page }) => {
  await page.goto('/topics/caching-layers/')
  const aria = () => page.locator('svg[aria-label^="Caching layers"]').getAttribute('aria-label')

  // The shared animation-speed chips render in the Figure bar; 1x (Normal) is
  // the default.
  const half = page.getByRole('button', { name: 'Half speed', exact: true })
  await expect(page.getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await half.click()
  await expect(half).toHaveAttribute('aria-pressed', 'true')

  // Speed is animation pacing only: manual Step still advances exactly one
  // precomputed state per press.
  const stepButton = page.getByRole('button', { name: 'Step', exact: true })
  await stepButton.click()
  expect(await aria()).toContain('read 1 of')
  await stepButton.click()
  expect(await aria()).toContain('read 2 of')

  // Reset returns to step 0 but does not change the chosen speed.
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  expect(await aria()).toContain('read 0 of')
  await expect(half).toHaveAttribute('aria-pressed', 'true')
})
