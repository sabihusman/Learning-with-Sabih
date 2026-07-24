import { test, expect } from '@playwright/test'
import { readoutValue } from './util'

// The streaming topic's buffer cycle: drain to a stall when the network falls
// below the playback rate, then refill and resume when it is restored.
test.describe('streaming-and-buffering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/topics/streaming-and-buffering/')
    await expect(page.locator('figure').first()).toBeVisible()
  })

  test('figure renders with its buffer bar and slider', async ({ page }) => {
    await expect(page.getByTestId('buffer-fill')).toBeVisible()
    await expect(page.getByLabel('Network speed as a multiple of the playback rate')).toBeVisible()
    await expect(readoutValue(page, 'state')).toHaveText('paused')
  })

  test('a dead network drains the buffer to a stall; restoring it resumes playback', async ({ page }) => {
    test.setTimeout(60_000)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(readoutValue(page, 'state')).toHaveText('playing')

    // Kill the network: the 3s starting buffer drains at 1x and playback stalls.
    const slider = page.getByLabel('Network speed as a multiple of the playback rate')
    await slider.focus()
    await page.keyboard.press('Home')
    await expect(readoutValue(page, 'network')).toHaveText('0.0x')
    await expect(readoutValue(page, 'state')).toHaveText('buffering', { timeout: 15_000 })
    await expect(page.getByTestId('screen-state')).toHaveText('buffering...')

    // Restore a fast network: the buffer refills to the resume threshold and
    // playback comes back on its own.
    await page.keyboard.press('End')
    await expect(readoutValue(page, 'state')).toHaveText('playing', { timeout: 15_000 })
    await expect(page.getByTestId('screen-state')).toHaveText('playing 1.0x')
  })

  test('pausing freezes the simulation', async ({ page }) => {
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    const buffer = (await readoutValue(page, 'buffer').textContent())?.trim() ?? ''
    await page.waitForTimeout(700)
    await expect(readoutValue(page, 'buffer')).toHaveText(buffer)
  })
})
