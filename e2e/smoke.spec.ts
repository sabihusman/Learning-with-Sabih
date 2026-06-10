import { test, expect } from '@playwright/test'
import { trackConsoleErrors } from './util'

// Every topic that ships in the contents page. Each must load its Figure cleanly.
const TOPICS = [
  { slug: 'gradient-descent', name: 'Gradient Descent' },
  { slug: 'confusion-matrix', name: 'Confusion Matrix' },
  { slug: 'tokenization', name: 'Tokenization' },
  { slug: 'embeddings', name: 'Embeddings' },
  { slug: 'attention', name: 'Attention' },
  { slug: 'transformers', name: 'Transformers and Multi-Head Attention' },
  { slug: 'neural-networks', name: 'Neural Networks' },
  { slug: 'overfitting', name: 'Overfitting and Generalization' },
  { slug: 'rlhf', name: 'RLHF' },
  { slug: 'temperature', name: 'Temperature and Sampling' },
  { slug: 'relational-model', name: 'Tables and the Relational Model' },
  { slug: 'select-where-case', name: 'SELECT, WHERE and CASE' },
  { slug: 'joins', name: 'Joins' },
  { slug: 'group-by', name: 'GROUP BY and Aggregation' },
  { slug: 'window-functions', name: 'Window Functions' },
  { slug: 'funnel-analysis', name: 'Funnel Analysis' },
  { slug: 'classes-and-objects', name: 'Classes and Objects' },
  { slug: 'inheritance', name: 'Inheritance' },
  { slug: 'polymorphism', name: 'Polymorphism' },
]

test('home page loads with the contents list and no console errors', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const topicLinks = page.locator('main a[href^="/topics/"]')
  expect(await topicLinks.count()).toBeGreaterThanOrEqual(TOPICS.length)
  await page.waitForLoadState('networkidle')
  expect(errors, `console errors on home: ${errors.join(' | ')}`).toEqual([])
})

for (const topic of TOPICS) {
  test(`topic "${topic.slug}" loads its figure with no console errors`, async ({ page }) => {
    const errors = trackConsoleErrors(page)
    await page.goto(`/topics/${topic.slug}/`)
    // every topic renders at least one interaction inside the Figure shell (a few
    // topics, like Attention, embed more than one figure)
    await expect(page.locator('figure').first()).toBeVisible()
    // the figure title is rendered inside the shell
    await expect(page.locator('figure h3').first()).toBeVisible()
    // allow the lazily-imported 3D scenes to mount, then assert no errors surfaced
    await page.waitForTimeout(800)
    expect(errors, `console errors on ${topic.slug}: ${errors.join(' | ')}`).toEqual([])
  })
}

test('contents page links to every topic and navigation works', async ({ page }) => {
  await page.goto('/')
  const hrefs = await page.locator('main a[href^="/topics/"]').evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).getAttribute('href') as string)
  )
  expect(hrefs.length).toBeGreaterThanOrEqual(TOPICS.length)
  // each advertised slug has a link
  for (const topic of TOPICS) {
    expect(hrefs.some((h) => h.includes(`/topics/${topic.slug}/`))).toBeTruthy()
  }
  // clicking a topic link navigates to that page and renders its figure
  for (const href of hrefs) {
    await page.goto('/')
    await page.locator(`main a[href="${href}"]`).first().click()
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[/]/g, '\\/')}$`))
    await expect(page.locator('figure').first()).toBeVisible()
  }
})
