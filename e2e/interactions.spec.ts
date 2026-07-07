import { test, expect } from '@playwright/test'
import { readoutValue, projectEmbeddings, EMBEDDING_REPS } from './util'

test('confusion-matrix: moving the threshold slider changes precision/recall', async ({ page }) => {
  await page.goto('/topics/confusion-matrix/')
  const slider = page.locator('#cm-threshold')
  await expect(slider).toBeVisible()

  const recall = readoutValue(page, 'recall')
  const precision = readoutValue(page, 'precision')
  const recallBefore = (await recall.textContent())?.trim() ?? ''
  const precisionBefore = (await precision.textContent())?.trim() ?? ''

  // Native keyboard interaction fires the input event (range inputs cannot be
  // filled). "End" jumps to the max threshold, which must change both readouts.
  await slider.focus()
  await page.keyboard.press('End')

  await expect(recall).not.toHaveText(recallBefore)
  await expect(precision).not.toHaveText(precisionBefore)
})

test('gradient-descent: clicking Step advances the x readout', async ({ page }) => {
  await page.goto('/topics/gradient-descent/')
  const x = readoutValue(page, 'x')
  await expect(x).toBeVisible()
  const before = (await x.textContent())?.trim() ?? ''

  // Step is a synchronous optimizer step; the discrete x readout updates without
  // depending on the animation frame loop.
  await page.getByRole('button', { name: 'Step' }).click()
  await expect(x).not.toHaveText(before)
})

test('embeddings: clicking a word updates the nearest readout', async ({ page }) => {
  await page.goto('/topics/embeddings/')
  const canvas = page.locator('figure canvas')
  await expect(canvas).toBeVisible()
  await canvas.scrollIntoViewIfNeeded()

  // Give R3F a moment to mount, size the canvas, and run a frame so the scene
  // graph has world matrices for raycasting. We do not wait for any ongoing
  // animation to advance, only for the canvas to exist and be laid out.
  await page.waitForTimeout(1200)
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return

  const nearest = readoutValue(page, 'nearest 3')

  // Aim clicks at the projected positions of a few cluster representatives (with
  // small offsets to be forgiving) until the selection populates the readout.
  let updated = false
  for (const rep of EMBEDDING_REPS) {
    const [cx, cy] = projectEmbeddings(rep, box.width, box.height)
    for (const [ox, oy] of [
      [0, 0],
      [5, 0],
      [-5, 0],
      [0, 5],
      [0, -5],
    ]) {
      const x = cx + ox
      const y = cy + oy
      if (x < 2 || y < 2 || x > box.width - 2 || y > box.height - 2) continue
      await canvas.click({ position: { x, y } })
      await page.waitForTimeout(150)
      const text = (await nearest.textContent())?.trim() ?? ''
      if (text && text !== '—') {
        updated = true
        break
      }
    }
    if (updated) break
  }

  expect(updated, 'clicking a word should populate the "nearest" readout').toBeTruthy()
})

test('neural-networks: clicking Step advances the epoch readout', async ({ page }) => {
  await page.goto('/topics/neural-networks/')
  const epoch = readoutValue(page, 'epoch')
  await expect(epoch).toBeVisible()
  const before = (await epoch.textContent())?.trim() ?? ''

  // Step runs one synchronous training step and bumps the discrete epoch readout,
  // so this does not depend on the background rAF training loop advancing.
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(epoch).not.toHaveText(before)
})

test('rlhf: picking a response updates the feedback readout', async ({ page }) => {
  await page.goto('/topics/rlhf/')
  const feedback = readoutValue(page, 'feedback given')
  await expect(feedback).toBeVisible()
  const before = (await feedback.textContent())?.trim() ?? ''

  // The candidate responses are buttons labelled "mostly <trait>"; picking one
  // records feedback and updates the readout.
  await page.getByRole('button', { name: /mostly/ }).first().click()
  await expect(feedback).not.toHaveText(before)
})

test('joins: switching the join type changes the result row-count status', async ({ page }) => {
  await page.goto('/topics/joins/')
  const status = page.getByText(/JOIN returns/)
  await expect(status).toBeVisible()
  const before = (await status.textContent())?.trim() ?? ''

  // Default is INNER; FULL keeps the unmatched rows, so the row-count status changes.
  await page.getByRole('button', { name: 'FULL', exact: true }).click()
  await expect(status).not.toHaveText(before)
})

test('group-by: switching the grouping column and aggregate updates the result', async ({ page }) => {
  await page.goto('/topics/group-by/')
  const groupBy = readoutValue(page, 'group by')
  await expect(groupBy).toBeVisible()
  const groupBefore = (await groupBy.textContent())?.trim() ?? ''

  // Default groups by country; switching to plan reclusters and updates the readout.
  await page.getByRole('button', { name: 'plan', exact: true }).click()
  await expect(groupBy).not.toHaveText(groupBefore)

  // Changing the aggregate rewrites the SQL shown beneath the figure.
  const sql = page.locator('figure pre')
  const sqlBefore = (await sql.textContent())?.trim() ?? ''
  await page.getByRole('button', { name: 'SUM', exact: true }).click()
  await expect(sql).not.toHaveText(sqlBefore)
})

test('window-functions: switching the ranking function updates the view and SQL', async ({ page }) => {
  await page.goto('/topics/window-functions/')
  // The table shows row_number, rank, and dense_rank side by side; the controls
  // choose the active function, which updates the "view" readout and the SQL rather
  // than the values themselves.
  const view = readoutValue(page, 'view')
  const sql = page.locator('figure pre')
  await expect(view).toBeVisible()
  const viewBefore = (await view.textContent())?.trim() ?? ''
  const sqlBefore = (await sql.textContent())?.trim() ?? ''

  await page.getByRole('button', { name: 'RANK', exact: true }).click()
  await expect(view).not.toHaveText(viewBefore)
  await expect(sql).not.toHaveText(sqlBefore)
})

test('percentiles: the handle is fully keyboard operable', async ({ page }) => {
  await page.goto('/topics/percentiles-and-tail-latency/')
  const slider = page.getByRole('slider', { name: 'percentile' })
  await expect(slider).toBeVisible()
  // starts at p50
  await expect(slider).toHaveValue('50')
  const slower = readoutValue(page, 'requests slower')
  const slowerAtP50 = (await slower.textContent())?.trim() ?? ''

  // Arrow nudges by 1 (native range behaviour), so the derived readout updates.
  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(slider).toHaveValue('51')

  // Shift+Arrow nudges by 5 (custom handler), reachable without a mouse.
  await page.keyboard.press('Shift+ArrowRight')
  await expect(slider).toHaveValue('56')

  // End jumps to p100, where nothing is slower than the max latency.
  await page.keyboard.press('End')
  await expect(slider).toHaveValue('100')
  await expect(slower).not.toHaveText(slowerAtP50)

  // Reset returns the handle to p50.
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(slider).toHaveValue('50')
})

test('load-balancing: policy switch and kill toggle are keyboard reachable', async ({ page }) => {
  await page.goto('/topics/load-balancing/')
  const rr = page.getByRole('button', { name: 'Round robin' })
  const lc = page.getByRole('button', { name: 'Least connections' })
  await expect(rr).toHaveAttribute('aria-pressed', 'true')

  // Switching policy (a real button, focusable and Enter-activatable) flips the pair.
  await lc.focus()
  await page.keyboard.press('Enter')
  await expect(lc).toHaveAttribute('aria-pressed', 'true')
  await expect(rr).toHaveAttribute('aria-pressed', 'false')

  // The per-server kill toggle is a real button; killing marks the server down and
  // drives the derived "dropped" readout once it was holding work.
  const dropped = readoutValue(page, 'dropped')
  await expect(dropped).toHaveText('0')
  for (let i = 0; i < 4; i += 1) await page.getByRole('button', { name: 'Step' }).click()
  const kill = page.getByRole('button', { name: /Server 1:/ })
  await kill.click()
  await expect(kill).toHaveText(/down/)
  await expect(dropped).not.toHaveText('0')
})
