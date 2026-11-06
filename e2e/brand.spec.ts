import { test, expect } from '@playwright/test'
import { SITE_NAME } from '../app/site'

// The brand matches the domain (learnwithsabih.com). Guards against the old
// "Learning with Sabih" name creeping back into titles or the wordmark.

test('the brand is Learn with Sabih', () => {
  expect(SITE_NAME).toBe('Learn with Sabih')
})

test('homepage title and topic wordmark use the brand, never the old name', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Learn with Sabih')
  expect(await page.content()).not.toContain('Learning with Sabih')

  await page.goto('/topics/dns/')
  await expect(page).toHaveTitle(/ - Learn with Sabih$/)
  await expect(page.getByText('Learn with Sabih', { exact: true }).first()).toBeVisible()
  expect(await page.content()).not.toContain('Learning with Sabih')
})
