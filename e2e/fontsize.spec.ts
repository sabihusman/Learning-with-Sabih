import { test, expect } from '@playwright/test'

// The reading-size control scales prose text via a single CSS variable, persists
// the choice in localStorage, and must leave figure text untouched.
const proseFontSize = (page) =>
  page.locator('article p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))

const figureTitleFontSize = (page) =>
  page.locator('figure h3').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))

test('font-size control scales prose, persists across reload, leaves figures fixed', async ({ page }) => {
  await page.goto('/topics/gradient-descent/')

  const proseMedium = await proseFontSize(page)
  const figureMedium = await figureTitleFontSize(page)

  // Large makes prose bigger, but not the figure title.
  await page.getByRole('button', { name: 'Large' }).click()
  const proseLarge = await proseFontSize(page)
  const figureLarge = await figureTitleFontSize(page)
  expect(proseLarge).toBeGreaterThan(proseMedium)
  expect(figureLarge).toBeCloseTo(figureMedium, 1)

  // The choice survives a reload (localStorage + pre-paint script).
  await page.reload()
  expect(await proseFontSize(page)).toBeCloseTo(proseLarge, 1)

  // Small is smaller than the medium default.
  await page.getByRole('button', { name: 'Small' }).click()
  expect(await proseFontSize(page)).toBeLessThan(proseMedium)
})
