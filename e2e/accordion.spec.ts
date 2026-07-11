import { test, expect } from '@playwright/test'

// The contents page groups topics into six colored chapter cards, one per section; the
// card's header button IS the accordion toggle. Each Playwright test runs in a fresh
// browser context, so localStorage starts empty (all sections collapsed). Sections
// collapse via grid-template-rows 0fr -> 1fr, so a collapsed panel has offsetHeight 0
// (its links stay in the DOM, clipped, which is why we assert the panel height rather
// than per-link visibility for the collapsed state).
const aiHeader = (page) => page.getByRole('button', { name: /AI and ML/ })
const aiPanelHeight = (page) => page.locator('#card-p-ai-and-ml').evaluate((el) => el.offsetHeight)

// All six sections, and their real topic counts (from topicList.js), so this test fails
// if a topic is ever added/removed from a section without the card's count updating.
const SECTION_COUNTS = [
  ['AI and ML', 19],
  ['Algorithms and Data Structures', 10],
  ['Databases and SQL', 13],
  ['Systems and Networking', 10],
  ['Object-Oriented Programming', 7],
  ['Data and Compression', 1],
]

test('all six chapter cards render with a chevron and their real topic count, all collapsed', async ({ page }) => {
  await page.goto('/')
  const headers = page.locator('main button[aria-expanded]')
  expect(await headers.count()).toBe(6)
  for (let i = 0; i < 6; i += 1) {
    await expect(headers.nth(i)).toHaveAttribute('aria-expanded', 'false')
  }
  for (const [name, count] of SECTION_COUNTS) {
    const header = page.getByRole('button', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
    await expect(header).toContainText(`${count} ${count === 1 ? 'topic' : 'topics'}`)
  }
  // topic links are in the DOM even while collapsed, but the panel is collapsed to 0
  expect(await page.locator('main a[href^="/topics/"]').count()).toBeGreaterThan(0)
  expect(await aiPanelHeight(page)).toBe(0)
})

test('opening a second card closes the first: only one section is open at a time', async ({ page }) => {
  await page.goto('/')
  const ai = aiHeader(page)
  const oop = page.getByRole('button', { name: /Object-Oriented Programming/ })
  await ai.click()
  await expect(ai).toHaveAttribute('aria-expanded', 'true')
  await oop.click()
  await expect(oop).toHaveAttribute('aria-expanded', 'true')
  // AI closed the moment OOP opened - never two cards open together
  await expect(ai).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(() => aiPanelHeight(page)).toBe(0)
})

test('keyboard (Enter/Space) toggles a section and reveals its topics', async ({ page }) => {
  await page.goto('/')
  const ai = aiHeader(page)
  await ai.focus()
  await ai.press('Enter')
  await expect(ai).toHaveAttribute('aria-expanded', 'true')
  // the first AI topic link is now visible
  await expect(page.locator('main a[href="/topics/gradient-descent/"]').first()).toBeVisible()
  // Space collapses it again: aria flips back and the panel returns to 0 height
  await ai.press(' ')
  await expect(ai).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(() => aiPanelHeight(page)).toBe(0)
})

test('expanded state persists across reload', async ({ page }) => {
  await page.goto('/')
  await aiHeader(page).click()
  await expect(aiHeader(page)).toHaveAttribute('aria-expanded', 'true')
  await page.reload()
  // restored from localStorage after reload
  await expect(aiHeader(page)).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('main a[href="/topics/gradient-descent/"]').first()).toBeVisible()
})

test('expanding a section lets its topic links navigate', async ({ page }) => {
  await page.goto('/')
  await aiHeader(page).click()
  await page.locator('main a[href="/topics/gradient-descent/"]').first().click()
  await expect(page).toHaveURL(/\/topics\/gradient-descent\/?$/)
  await expect(page.locator('figure').first()).toBeVisible()
})
