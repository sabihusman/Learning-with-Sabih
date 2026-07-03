import { test, expect } from '@playwright/test'

// The contents drawer is layout chrome mounted on every topic page: a slim left-edge
// "Contents" tab that reveals a jump-between-topics panel. Playwright runs Desktop
// Chrome (viewport wider than the 768px breakpoint), so these exercise the desktop
// behavior: reveal on focus, click-to-pin, Escape to close, active-topic highlight,
// and in-drawer navigation. The panel reads its sections from topicList.js.

const tabOf = (page) => page.locator('[aria-controls="contents-drawer-panel"]')
const panelOf = (page) => page.locator('#contents-drawer-panel')

test('the drawer tab is present on a topic page and starts collapsed', async ({ page }) => {
  await page.goto('/topics/embeddings/')
  const tab = tabOf(page)
  await expect(tab).toBeVisible()
  await expect(tab).toHaveText('Contents')
  await expect(tab).toHaveAttribute('aria-expanded', 'false')
})

test('moving keyboard focus into the tab reveals the contents', async ({ page }) => {
  await page.goto('/topics/embeddings/')
  const tab = tabOf(page)
  await tab.focus()
  // the panel opens on focus (not only hover), so its expanded state flips to true
  await expect(tab).toHaveAttribute('aria-expanded', 'true')
})

test('the drawer highlights the current topic', async ({ page }) => {
  await page.goto('/topics/embeddings/')
  await tabOf(page).click() // pin open so the panel is stably visible
  const current = panelOf(page).locator('[aria-current="page"]')
  await expect(current).toHaveAttribute('href', '/topics/embeddings/')
  await expect(current).toContainText('Embeddings')
})

test('a topic link inside the drawer navigates to that topic', async ({ page }) => {
  await page.goto('/topics/embeddings/')
  await tabOf(page).click() // pin open
  const panel = panelOf(page)
  // expand the AI and ML section, then follow a sibling topic link
  await panel.getByRole('button', { name: /AI and ML/ }).click()
  await panel.locator('a[href="/topics/attention/"]').click()
  await expect(page).toHaveURL(/\/topics\/attention\/?$/)
  await expect(page.locator('figure').first()).toBeVisible()
})

test('the drawer is keyboard operable: Enter pins, Escape closes', async ({ page }) => {
  await page.goto('/topics/embeddings/')
  const tab = tabOf(page)
  await tab.focus()
  await page.keyboard.press('Enter') // activates the tab -> pins the panel open
  await expect(panelOf(page).getByRole('button', { name: 'Unpin' })).toBeVisible()
  await page.keyboard.press('Escape') // releases the pin and collapses the panel
  await expect(tab).toHaveAttribute('aria-expanded', 'false')
})

test('the header and the Contents tab stay visible at a narrow (zoomed) width', async ({ page }) => {
  // Browser page-zoom shrinks the effective CSS width, so a zoomed-in laptop can cross
  // below the 768px breakpoint into mobile mode. Guard that neither the sticky header nor
  // the Contents opener is dropped in that mode. (This covers the breakpoint dimension;
  // the compositing-under-real-page-zoom dimension cannot be exercised in a headless run.)
  await page.setViewportSize({ width: 640, height: 800 })
  await page.goto('/topics/embeddings/')
  // the sticky header (its "Contents" back link) stays visible
  await expect(page.locator('a[href="/"]')).toBeVisible()
  // the left Contents opener tab stays visible
  await expect(page.locator('[aria-controls="contents-drawer-panel"]')).toBeVisible()
})

test('expanding a section in the drawer stays in sync with the contents page', async ({ page }) => {
  // The drawer and the contents accordion share one localStorage store, so a section
  // opened in the drawer is open on the contents page too (they never drift).
  await page.goto('/topics/embeddings/')
  await tabOf(page).click()
  await panelOf(page).getByRole('button', { name: /Databases and SQL/ }).click()
  await page.goto('/')
  const contentsHeader = page.getByRole('button', { name: /Databases and SQL/ })
  await expect(contentsHeader).toHaveAttribute('aria-expanded', 'true')
})
