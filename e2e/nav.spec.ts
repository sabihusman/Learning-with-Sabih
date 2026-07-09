import { test, expect } from '@playwright/test'

// Bottom-of-page prev/next topic navigation. Neighbors come from the shared ordered
// list; these expectations follow the current order (Tokenization, Why Models Struggle
// with Math, Embeddings ... around the middle; Gradient Descent first, Entropy and
// Compression last).
const topicNav = (page) => page.getByRole('navigation', { name: 'Topic navigation' })

test('middle topic shows previous and next with correct neighbor names', async ({ page }) => {
  await page.goto('/topics/why-models-struggle-with-math/')
  const nav = topicNav(page)
  await expect(nav).toBeVisible()

  const prev = nav.getByRole('link').filter({ hasText: 'Previous' })
  const next = nav.getByRole('link').filter({ hasText: 'Next' })

  await expect(prev).toContainText('Tokenization')
  await expect(prev).toHaveAttribute('href', /\/topics\/tokenization\/?$/)
  await expect(next).toContainText('Embeddings')
  await expect(next).toHaveAttribute('href', /\/topics\/embeddings\/?$/)

  // clicking Next navigates to that topic
  await next.click()
  await expect(page).toHaveURL(/\/topics\/embeddings\/?$/)
})

test('first topic has no previous', async ({ page }) => {
  await page.goto('/topics/gradient-descent/')
  const nav = topicNav(page)
  await expect(nav).toBeVisible()
  await expect(nav).toContainText('Neural Networks') // next still present
  await expect(nav).not.toContainText('Previous')
})

test('last topic has no next', async ({ page }) => {
  await page.goto('/topics/entropy-and-compression/')
  const nav = topicNav(page)
  await expect(nav).toBeVisible()
  await expect(nav).toContainText('Composition vs Inheritance') // previous still present
  await expect(nav).not.toContainText('Next')
})
