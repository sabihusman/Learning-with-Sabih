import { test, expect } from '@playwright/test'
import { WORDS, DIMS, queryOf, keyOf, rawScores, softmax, attentionRow, attentionMatrix, topLinks } from '../app/components/attentionData'

// Invariants for the Attention figure. The headline one: every row of
// attention weights sums to exactly 1, because the weights come from softmax,
// whatever the scores are and however the reader nudges them.

const EPS = 1e-12
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const labelOf = (id: number) => WORDS[id].label

test.describe('attention logic', () => {
  test('every row sums to 1 and every weight is positive, scaled and unscaled', () => {
    for (const scaled of [true, false]) {
      for (const row of attentionMatrix({ scaled })) {
        expect(Math.abs(sum(row) - 1)).toBeLessThan(EPS)
        for (const w of row) expect(w).toBeGreaterThan(0)
      }
    }
  })

  test('rows still sum to 1 under any nudge the figure allows, on any key', () => {
    for (const q of WORDS) {
      for (const k of WORDS) {
        for (let nudge = -5; nudge <= 5; nudge += 0.5) {
          const { weights } = attentionRow(q.id, { adjust: { [k.id]: nudge } })
          expect(Math.abs(sum(weights) - 1)).toBeLessThan(EPS)
        }
      }
    }
  })

  test('raw scores are Q dot K, and scaling divides by the square root of the vector size', () => {
    for (const q of WORDS) {
      const raw = rawScores(q.id)
      WORDS.forEach((k, j) => {
        const expected = queryOf(q.id).reduce((s, x, d) => s + x * keyOf(k.id)[d], 0)
        expect(raw[j]).toBeCloseTo(expected, 12)
      })
      const { scores } = attentionRow(q.id, { scaled: true })
      scores.forEach((s, j) => expect(s).toBeCloseTo(raw[j] / Math.sqrt(DIMS), 12))
    }
  })

  test('raising one score raises its weight and lowers every other weight', () => {
    const base = attentionRow(7).weights
    const nudged = attentionRow(7, { adjust: { 5: 1 } }).weights
    expect(nudged[5]).toBeGreaterThan(base[5])
    nudged.forEach((w, j) => {
      if (j !== 5) expect(w).toBeLessThan(base[j])
    })
  })

  test('softmax is shift-invariant and turns equal scores into equal weights', () => {
    expect(softmax([1, 2, 3])).toEqual(softmax([101, 102, 103]).map((x) => expect.closeTo(x, 12)) as unknown as number[])
    for (const w of softmax([0.7, 0.7, 0.7, 0.7])) expect(w).toBeCloseTo(0.25, 12)
  })

  test('the sentence relationships come out of the arithmetic', () => {
    const top = (id: number, k: number) => topLinks(id, k).map((l) => labelOf(l.id))
    expect(top(7, 1)).toEqual(['animal']) // it -> animal
    expect(top(3, 2)).toEqual(['street', 'animal']) // cross -> street, animal
    expect(top(9, 1)).toEqual(['it']) // tired -> it
    expect(top(6, 1)).toEqual(['tired']) // because -> tired
    expect(attentionRow(7).weights[1]).toBeGreaterThan(0.4)
  })

  test('the Try this is doable: "street" can overtake "animal" in the "it" row within the slider range', () => {
    const w = attentionRow(7, { adjust: { 5: 5 } }).weights
    expect(w[5]).toBeGreaterThan(w[1])
    expect(Math.abs(sum(w) - 1)).toBeLessThan(EPS)
  })

  test('the flattest row belongs to "the"', () => {
    const entropy = (w: number[]) => -w.reduce((s, x) => s + x * Math.log(x), 0)
    const ranked = WORDS.map((w) => ({ label: w.label, h: entropy(attentionRow(w.id).weights) })).sort((a, b) => b.h - a.h)
    expect(ranked[0].label).toBe('the')
    expect(ranked[1].label).toBe('the')
  })

  test('turning off the square-root scaling makes a row sharper', () => {
    const maxOf = (scaled: boolean) => Math.max(...attentionRow(7, { scaled }).weights)
    expect(maxOf(false)).toBeGreaterThan(maxOf(true))
  })
})

test.describe('attention figure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/topics/attention/')
    await expect(page.getByTestId('softmax-lab')).toBeVisible()
  })

  test('the lab and all ten heatmap rows read 1.00', async ({ page }) => {
    await expect(page.getByTestId('lab-sum')).toHaveText('1.00')
    const sums = page.getByTestId('row-sum')
    await expect(sums).toHaveCount(10)
    for (const text of await sums.allTextContents()) expect(text).toBe('1.00')
  })

  test('nudging a score re-normalizes the row: weights change, the sum stays 1.00', async ({ page }) => {
    const animalRow = page.getByTestId('lab-row').nth(1)
    const before = Number(await animalRow.getAttribute('data-weight'))
    // keyboard, as a reader without a mouse would: End jumps to the +5 maximum
    await page.getByTestId('nudge').focus()
    await page.keyboard.press('End')
    await expect(page.getByTestId('nudge')).toHaveValue('5')
    await expect(page.getByTestId('lab-sum')).toHaveText('1.00')
    const after = Number(await animalRow.getAttribute('data-weight'))
    expect(after).toBeLessThan(before)
    const weights = await page.getByTestId('lab-row').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-weight'))))
    expect(Math.abs(weights.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-9)
  })

  test('the scaling toggle changes the weights and the sum stays 1.00', async ({ page }) => {
    const animalRow = page.getByTestId('lab-row').nth(1)
    const scaled = Number(await animalRow.getAttribute('data-weight'))
    await page.getByRole('button', { name: /Divide by √d/ }).click()
    await expect(page.getByTestId('lab-sum')).toHaveText('1.00')
    expect(Number(await animalRow.getAttribute('data-weight'))).toBeGreaterThan(scaled)
  })

  test('clicking a heatmap row picks that query word in the lab', async ({ page }) => {
    await page.getByRole('button', { name: 'Show outgoing attention from "cross"' }).click()
    await expect(page.getByTestId('query-3')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('lab-sum')).toHaveText('1.00')
  })
})
