import { test, expect } from '@playwright/test'
import { SECTIONS, TOPICS } from '../app/topicList'
import { sectionSlug } from '../app/sectionColors'

// The homepage: a hero with real topic/chapter counts (never hardcoded) plus one card
// per chapter, each linking to its live /chapters/<slug>/ route. See
// e2e/chapter-routes.spec.ts for what's inside those pages, and
// e2e/section-colors-logic.spec.ts for the slug/color guarantees these cards depend on.

test('the hero headline and dynamic subline render', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Computer Science, an interactive study guide')
  const expectedSubline = `${TOPICS.length} hands-on topics across ${SECTIONS.length} chapters. Every one is a live demo, drag, slide and break things until they make sense.`
  await expect(page.getByText(expectedSubline)).toBeVisible()
})

test('all six chapter cards render with their real topic count and link to the right chapter route', async ({ page }) => {
  await page.goto('/')
  const cards = page.locator('main a[href^="/chapters/"]')
  expect(await cards.count()).toBe(SECTIONS.length)

  for (const section of SECTIONS) {
    const count = section.topics.length
    const href = `/chapters/${sectionSlug(section.name)}/`
    const card = page.locator(`main a[href="${href}"]`)
    await expect(card).toBeVisible()
    await expect(card).toContainText(section.name)
    await expect(card).toContainText(`${count} ${count === 1 ? 'topic' : 'topics'}`)
  }
})

test('a chapter card has no nested interactive elements - the whole card is the one link', async ({ page }) => {
  await page.goto('/')
  const firstCard = page.locator('main a[href^="/chapters/"]').first()
  expect(await firstCard.locator('a, button').count()).toBe(0)
})

test('clicking a chapter card navigates to its live chapter route', async ({ page }) => {
  await page.goto('/')
  await page.locator('main a[href="/chapters/ai-and-ml/"]').click()
  await expect(page).toHaveURL(/\/chapters\/ai-and-ml\/?$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AI and ML')
})
