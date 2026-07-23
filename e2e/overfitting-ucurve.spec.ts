import { test, expect } from '@playwright/test'
import { readoutValue } from './util'

// The U-curve companion panel (AUDIT-REPORT R1): train/test error vs degree,
// driven by the same complexity slider as the main scatter panel.
test('overfitting: the U-curve panel renders and both marks follow the slider', async ({ page }) => {
  await page.goto('/topics/overfitting/')

  const trainDot = page.getByTestId('ucurve-train-dot')
  const testDot = page.getByTestId('ucurve-test-dot')
  await expect(trainDot).toBeVisible()
  await expect(testDot).toBeVisible()
  await expect(page.getByText(/best \(degree \d+\)/)).toBeVisible()

  const trainXBefore = await trainDot.getAttribute('cx')
  const testXBefore = await testDot.getAttribute('cx')
  const trainErrBefore = (await readoutValue(page, 'training error').textContent())?.trim() ?? ''

  // Range inputs cannot be filled; keyboard "End" jumps the slider to max degree.
  const slider = page.getByLabel('Model complexity: polynomial degree')
  await slider.focus()
  await page.keyboard.press('End')

  // Both panels respond to the one slider: the readout changes and both U-curve
  // dots move to the new degree's x position together.
  await expect(readoutValue(page, 'training error')).not.toHaveText(trainErrBefore)
  const trainXAfter = await trainDot.getAttribute('cx')
  const testXAfter = await testDot.getAttribute('cx')
  expect(trainXAfter).not.toBe(trainXBefore)
  expect(testXAfter).not.toBe(testXBefore)
  expect(trainXAfter).toBe(testXAfter)
})
