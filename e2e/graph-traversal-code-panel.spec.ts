import { test, expect } from '@playwright/test'

// The static code panel on the Graph Traversal figure. It is driven only by the
// BFS/DFS toggle: it reads neither the step index nor the frames, so none of the
// assertions below touch Step, Play, or Reset. Every locator is scoped to the panel
// container rather than the page, so a match elsewhere on the page cannot satisfy a
// test here.

const panelOf = (page) => page.getByTestId('traversal-code')

test('BFS mode shows the queue line and not the stack line', async ({ page }) => {
  await page.goto('/topics/graph-traversal/')
  const panel = panelOf(page)
  await expect(panel).toBeVisible()

  // BFS is the default selection.
  await expect(page.getByRole('button', { name: 'BFS', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await expect(panel).toContainText('frontier.shift()')
  await expect(panel).not.toContainText('frontier.pop()')
  await expect(panel).toContainText('for (const nb of neighbours(node)) {')
  await expect(panel).not.toContainText('.reverse()')
})

test('DFS mode shows the stack line and not the queue line', async ({ page }) => {
  await page.goto('/topics/graph-traversal/')
  const panel = panelOf(page)

  await page.getByRole('button', { name: 'DFS', exact: true }).click()
  await expect(page.getByRole('button', { name: 'DFS', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await expect(panel).toContainText('frontier.pop()')
  await expect(panel).not.toContainText('frontier.shift()')
  await expect(panel).toContainText('for (const nb of [...neighbours(node)].reverse()) {')
})

test('both markers render, and the listings differ in exactly two lines', async ({ page }) => {
  await page.goto('/topics/graph-traversal/')
  const panel = panelOf(page)

  const linesOf = async () => panel.locator('code').allTextContents()

  await expect(panel).toContainText('the difference')
  await expect(panel).toContainText('so the orders compare fairly')
  const bfsLines = await linesOf()

  await page.getByRole('button', { name: 'DFS', exact: true }).click()
  await expect(panel).toContainText('frontier.pop()')
  await expect(panel).toContainText('the difference')
  await expect(panel).toContainText('so the orders compare fairly')
  const dfsLines = await linesOf()

  expect(dfsLines.length, 'listing length must match between modes').toBe(bfsLines.length)
  const differing = bfsLines.map((l, i) => (l === dfsLines[i] ? null : i)).filter((i) => i !== null)
  expect(differing, 'exactly two lines may differ between BFS and DFS').toHaveLength(2)
  expect(bfsLines[differing[0] as number]).toBe('  const node = frontier.shift()')
  expect(dfsLines[differing[0] as number]).toBe('  const node = frontier.pop()')
  expect(bfsLines[differing[1] as number]).toBe('  for (const nb of neighbours(node)) {')
  expect(dfsLines[differing[1] as number]).toBe('  for (const nb of [...neighbours(node)].reverse()) {')
})

test('the panel does not react to stepping', async ({ page }) => {
  await page.goto('/topics/graph-traversal/')
  const panel = panelOf(page)

  const before = await panel.locator('code').allTextContents()
  const step = page.getByRole('button', { name: 'Step', exact: true })
  for (let i = 0; i < 4; i += 1) await step.click()
  const after = await panel.locator('code').allTextContents()

  expect(after, 'the listing is static across steps').toEqual(before)
})
