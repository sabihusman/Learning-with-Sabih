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

test('cap-theorem: partition forces the consistency/availability tradeoff', async ({ page }) => {
  await page.goto('/topics/cap-theorem/')
  const consistency = page.getByRole('button', { name: 'Prefer consistency' })
  const availability = page.getByRole('button', { name: 'Prefer availability' })
  const refused = readoutValue(page, 'refused')
  const divergences = readoutValue(page, 'divergences')

  // The choice buttons are disabled while the link is healthy (no tradeoff to make).
  await expect(availability).toBeDisabled()

  // Partition the network (a real, focusable button), which enables the choice.
  const net = page.getByRole('button', { name: /^Network:/ })
  await net.focus()
  await page.keyboard.press('Enter')
  await expect(availability).toBeEnabled()

  // Consistency: stepping through refuses operations; nothing diverges.
  await expect(consistency).toHaveAttribute('aria-pressed', 'true')
  const step = page.getByRole('button', { name: 'Step' })
  await step.click()
  await expect(refused).toHaveText('1')
  await expect(divergences).toHaveText('0')

  // Reset, switch to availability: now operations succeed but the replicas diverge.
  await page.getByRole('button', { name: 'Reset' }).click()
  await availability.click()
  await step.click()
  await expect(divergences).not.toHaveText('0')
  await expect(refused).toHaveText('0')
})

test('tcp-and-udp: protocol toggle and loss slider are keyboard reachable', async ({ page }) => {
  await page.goto('/topics/tcp-and-udp/')
  const tcp = page.getByRole('button', { name: 'TCP' })
  const udp = page.getByRole('button', { name: 'UDP' })
  await expect(tcp).toHaveAttribute('aria-pressed', 'true')

  const slider = page.getByRole('slider', { name: 'packet loss percent' })
  await expect(slider).toHaveValue('25')

  // Default TCP run at the default 25% loss: dropped packets get retransmitted,
  // so more than 8 sends happen, yet all 8 still arrive.
  const sent = readoutValue(page, 'sent')
  const delivered = readoutValue(page, 'delivered')
  const retransmits = readoutValue(page, 'retransmits')
  const step = page.getByRole('button', { name: 'Step' })
  for (let i = 0; i < 11; i += 1) await step.click()
  await expect(delivered).toHaveText('8')
  await expect(retransmits).not.toHaveText('0')
  await expect(sent).not.toHaveText('8')

  // Switching protocol (a real, focusable button) resets the run.
  await page.getByRole('button', { name: 'Reset' }).click()
  await udp.focus()
  await page.keyboard.press('Enter')
  await expect(udp).toHaveAttribute('aria-pressed', 'true')
  await expect(tcp).toHaveAttribute('aria-pressed', 'false')

  // Same seed, same 25% loss: UDP never recovers a drop, so delivery is
  // incomplete and out of order.
  const lost = readoutValue(page, 'lost')
  const inOrder = readoutValue(page, 'in order')
  for (let i = 0; i < 8; i += 1) await step.click()
  await expect(lost).not.toHaveText('0')
  await expect(inOrder).toHaveText('no')

  // The loss slider is a native range input: fully reachable and adjustable
  // by keyboard, and changing it resets the run.
  await slider.focus()
  await page.keyboard.press('Home')
  await expect(slider).toHaveValue('0')
  await expect(step).toBeEnabled()
})

test('dns: a second lookup hits cache, and expiring it forces a cold walk again', async ({ page }) => {
  await page.goto('/topics/dns/')
  const step = page.getByRole('button', { name: 'Step' })
  const lookupAgain = page.getByRole('button', { name: 'Look up again' })
  const expireCache = page.getByRole('button', { name: 'Expire cache (TTL)' })
  const serversAsked = readoutValue(page, 'servers asked')
  const steps = readoutValue(page, 'steps')
  const cache = readoutValue(page, 'cache')

  await expect(cache).toHaveText('empty')
  // Real buttons, but gated: nothing to look up again or expire until the
  // first run (cold, 8 steps) completes.
  await expect(lookupAgain).toBeDisabled()
  await expect(expireCache).toBeDisabled()

  for (let i = 0; i < 8; i += 1) await step.click()
  await expect(serversAsked).toHaveText('4')
  await expect(steps).toHaveText('8/8')
  await expect(cache).not.toHaveText('empty')

  // Look up again (real, focusable button): same name, cache is warm now, so
  // this run is a 2-step cache hit that asks only the resolver.
  await lookupAgain.focus()
  await page.keyboard.press('Enter')
  await expect(steps).toHaveText('0/2')
  await step.click()
  await step.click()
  await expect(serversAsked).toHaveText('1')
  await expect(steps).toHaveText('2/2')

  // Expiring the cache and looking up again forces the full 8-step chain.
  await expireCache.focus()
  await page.keyboard.press('Enter')
  await expect(cache).toHaveText('empty')
  await lookupAgain.click()
  await expect(steps).toHaveText('0/8')
})

test('beam-search: raising beam width finds a better sequence, k=1 collapses to greedy', async ({ page }) => {
  await page.goto('/topics/beam-search/')
  const slider = page.getByRole('slider', { name: 'Beam width k' })
  await expect(slider).toBeVisible()
  await expect(slider).toHaveValue('2')

  const advantage = readoutValue(page, 'beam advantage')
  const bestLogProb = readoutValue(page, 'best beam log-prob')

  // Default k=2 already beats greedy (this is the whole point of the figure).
  await expect(advantage).not.toHaveText('0.000')

  // k=1 (native range keyboard control) must collapse the beam walk onto greedy
  // exactly: the advantage readout, derived from real state, drops to zero.
  await slider.focus()
  await page.keyboard.press('Home')
  await expect(slider).toHaveValue('1')
  await expect(advantage).toHaveText('0.000')

  // Raising it back to k=3 restores (at least) the k=2 advantage.
  await page.keyboard.press('End')
  await expect(slider).toHaveValue('3')
  await expect(advantage).not.toHaveText('0.000')

  // Beam survivor chips are real, focusable, keyboard-activatable buttons; clicking
  // one other than the winner changes which sequence is traced (aria-pressed moves).
  const chips = page.getByRole('group', { name: /Surviving beam sequences/ }).getByRole('button')
  await expect(chips).toHaveCount(3)
  const first = chips.nth(0)
  const second = chips.nth(1)
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await second.focus()
  await page.keyboard.press('Enter')
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await expect(first).toHaveAttribute('aria-pressed', 'false')

  // best-beam-log-prob stays fixed (it always reports the winner, not the selection).
  await expect(bestLogProb).toHaveText('-1.261')
})

test('entropy-and-compression: dragging a probability to 100% collapses entropy and the Huffman gap widens to exactly 1 bit', async ({ page }) => {
  await page.goto('/topics/entropy-and-compression/')
  const sliderA = page.getByRole('slider', { name: 'Probability of symbol A' })
  await expect(sliderA).toBeVisible()
  await expect(sliderA).toHaveValue('40')

  const entropy = readoutValue(page, 'entropy')
  const gap = readoutValue(page, 'gap')
  const nonzero = readoutValue(page, 'nonzero symbols')

  // The default table has a deliberate, visible gap: not power-of-two probabilities.
  await expect(entropy).toHaveText('1.846 bits')
  await expect(gap).toHaveText('0.054 bits')
  await expect(nonzero).toHaveText('4')

  // Pushing A to 100% (native range keyboard control) renormalizes B, C, D to 0: one
  // symbol left, entropy collapses to 0, and the single-symbol Huffman code still
  // costs 1 bit, so the gap widens to exactly 1.
  await sliderA.focus()
  await page.keyboard.press('End')
  await expect(sliderA).toHaveValue('100')
  await expect(entropy).toHaveText('0.000 bits')
  await expect(gap).toHaveText('1.000 bits')
  await expect(nonzero).toHaveText('1')

  const sliderB = page.getByRole('slider', { name: 'Probability of symbol B' })
  await expect(sliderB).toHaveValue('0')
})

test('decision-boundary: the fit trains automatically, and nudging a point restarts and re-chases it', async ({ page }) => {
  // Three separate full training runs happen in this test, and each one is a
  // real setInterval-driven process (not sped up), so give it more than the
  // default budget.
  test.setTimeout(90000)
  await page.goto('/topics/decision-boundary/')
  const iterations = readoutValue(page, 'iterations')
  const misclassified = readoutValue(page, 'misclassified')

  // Training starts on its own and runs to the fixed 200-step budget.
  await expect(iterations).toHaveText('200/200', { timeout: 20000 })
  await expect(misclassified).toHaveText('0 of 14')

  // Each point is a real, focusable element: Tab reaches it (the point-picker)
  // and arrow keys nudge it. Nudging restarts the timer, dropping the counter
  // back below the budget.
  const point = page.getByRole('button', { name: 'Class 0 point 7' })
  await point.focus()
  await page.keyboard.press('ArrowRight')
  await expect(iterations).not.toHaveText('200/200')

  // Nudge it far enough into class 1's territory that no straight line can
  // separate the data anymore, then let the fixed-length run finish.
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('ArrowRight')
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('ArrowUp')
  await expect(iterations).toHaveText('200/200', { timeout: 20000 })
  await expect(misclassified).not.toHaveText('0 of 14')

  // Refit (real, focusable button) restarts from w = 0 on the current
  // (still-moved) points; the data is still unseparable, so it still fails.
  const refit = page.getByRole('button', { name: 'Refit' })
  await refit.focus()
  await page.keyboard.press('Enter')
  await expect(iterations).toHaveText('200/200', { timeout: 20000 })
  await expect(misclassified).not.toHaveText('0 of 14')

  // Reset restores the original point positions and refits from scratch.
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(iterations).toHaveText('200/200', { timeout: 20000 })
  await expect(misclassified).toHaveText('0 of 14')
})
