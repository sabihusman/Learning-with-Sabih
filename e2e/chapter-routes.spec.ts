import { test, expect } from '@playwright/test'
import { SECTIONS } from '../app/topicList'
import { sectionSlug } from '../app/sectionColors'

// One static /chapters/<slug>/ page per section. e2e/smoke.spec.ts already exercises
// every individual topic page's Figure, so these focus on the chapter page itself:
// the right title, the real topic count, and a link for every topic in that section.

for (const section of SECTIONS) {
  const slug = sectionSlug(section.name)
  const count = section.topics.length

  test(`chapter "${slug}" shows "${section.name}" with its real topic count and links`, async ({ page }) => {
    await page.goto(`/chapters/${slug}/`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(section.name)
    await expect(page.getByText(`${count} ${count === 1 ? 'topic' : 'topics'}`)).toBeVisible()

    const links = page.locator('main a[href^="/topics/"]')
    expect(await links.count()).toBe(count)

    // every topic in this section has its own link, carrying its real title
    for (const topic of section.topics) {
      await expect(page.locator(`main a[href="${topic.href}"]`)).toContainText(topic.title)
    }
  })
}

test('a chapter page topic row links to the real topic page', async ({ page }) => {
  await page.goto('/chapters/ai-and-ml/')
  await page.locator('main a[href="/topics/gradient-descent/"]').click()
  await expect(page).toHaveURL(/\/topics\/gradient-descent\/?$/)
  await expect(page.locator('figure').first()).toBeVisible()
})

test('the chapter page back link returns to the homepage', async ({ page }) => {
  await page.goto('/chapters/data-and-compression/')
  await page.getByRole('link', { name: /All Chapters/i }).click()
  await expect(page).toHaveURL(/\/$/)
})
