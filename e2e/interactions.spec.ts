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
