import { test, expect } from '@playwright/test'
import {
  SYMBOLS,
  shannonEntropy,
  buildHuffmanCodes,
  averageCodeLength,
  isPrefixFree,
  adjustProbability,
  buildHuffmanTree,
  codesFromTree,
  forestAfter,
  buildMessage,
  messageCounts,
  encodeMessage,
  decodeTrace,
  MESSAGE_LENGTH,
} from '../app/components/entropyCompressionData'

// Pure-function correctness for the entropy/Huffman figure. No page, no browser: these
// assert directly on the same functions the component renders, so a change that breaks
// the figure's central claim (Huffman never beats the entropy floor) fails here.

test('entropy of a powers-of-1/2 set is 1.75 bits', () => {
  expect(shannonEntropy([0.5, 0.25, 0.125, 0.125])).toBeCloseTo(1.75, 9)
})

test('entropy of a uniform 4-symbol set is 2.0 bits', () => {
  expect(shannonEntropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(2.0, 9)
})

test('Huffman average length is never below entropy; strictly above for non-power-of-2, equal for power-of-2', () => {
  const sets = [
    [0.4, 0.3, 0.2, 0.1],
    [0.7, 0.15, 0.1, 0.05],
    [0.5, 0.25, 0.125, 0.125],
    [0.25, 0.25, 0.25, 0.25],
    [0.6, 0.25, 0.1, 0.05],
  ]
  for (const probs of sets) {
    const codes = buildHuffmanCodes(SYMBOLS, probs)
    const avg = averageCodeLength(SYMBOLS, probs, codes)
    const H = shannonEntropy(probs)
    expect(avg).toBeGreaterThanOrEqual(H - 1e-9)
  }

  // non-power-of-2: strictly greater
  const skewed = [0.4, 0.3, 0.2, 0.1]
  const skewedCodes = buildHuffmanCodes(SYMBOLS, skewed)
  const skewedAvg = averageCodeLength(SYMBOLS, skewed, skewedCodes)
  expect(skewedAvg).toBeGreaterThan(shannonEntropy(skewed) + 1e-6)

  // power-of-2: equal within tolerance
  const clean = [0.5, 0.25, 0.125, 0.125]
  const cleanCodes = buildHuffmanCodes(SYMBOLS, clean)
  const cleanAvg = averageCodeLength(SYMBOLS, clean, cleanCodes)
  expect(cleanAvg).toBeCloseTo(shannonEntropy(clean), 9)
})

test('Huffman codes form a valid prefix code for several probability sets', () => {
  const sets = [
    [0.4, 0.3, 0.2, 0.1],
    [0.7, 0.15, 0.1, 0.05],
    [0.5, 0.25, 0.125, 0.125],
    [0.25, 0.25, 0.25, 0.25],
  ]
  for (const probs of sets) {
    const codes = buildHuffmanCodes(SYMBOLS, probs)
    expect(isPrefixFree(Object.values(codes))).toBe(true)
  }
})

test('adjusting one probability always renormalizes the table to sum to 1', () => {
  let probs = [0.4, 0.3, 0.2, 0.1]
  for (const [index, target] of [
    [0, 0.9],
    [2, 0.5],
    [3, 0.0],
    [1, 1.0],
  ] as const) {
    probs = adjustProbability(probs, index, target)
    const sum = probs.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 9)
    expect(probs[index]).toBeCloseTo(target, 9)
  }
})

// Item 31: the tree the figure draws is the build that makes the codes, the message
// follows the probabilities, and decoding by walking the tree returns the message.

const SETS = [
  [0.4, 0.3, 0.2, 0.1],
  [0.5, 0.25, 0.125, 0.125],
  [0.25, 0.25, 0.25, 0.25],
  [0.7, 0.15, 0.1, 0.05],
  [0.6, 0.4, 0, 0],
  [1, 0, 0, 0],
]

test('each merge joins the two smallest standing trees, and the forest shrinks by one per merge', () => {
  for (const probs of SETS) {
    const tree = buildHuffmanTree(SYMBOLS, probs)
    expect(tree.merges).toHaveLength(Math.max(0, tree.leaves.length - 1))
    tree.merges.forEach((m, k) => {
      const standing = forestAfter(tree, k).map((id) => tree.nodes[id].prob)
      const smallest = [...standing].sort((a, b) => a - b).slice(0, 2)
      expect([tree.nodes[m.left].prob, tree.nodes[m.right].prob]).toEqual(smallest)
      expect(forestAfter(tree, k + 1)).toHaveLength(standing.length - 1)
    })
  }
})

test('default build: D + C, then B, then A; codes A 0, B 10, D 110, C 111', () => {
  const tree = buildHuffmanTree(SYMBOLS, [0.4, 0.3, 0.2, 0.1])
  const label = (id: number) => tree.nodes[id].label ?? `(${tree.nodes[id].prob.toFixed(2)})`
  expect(tree.merges.map((m) => `${label(m.left)}+${label(m.right)}`)).toEqual(['D+C', 'B+(0.30)', 'A+(0.60)'])
  expect(codesFromTree(tree)).toEqual({ A: '0', B: '10', D: '110', C: '111' })
})

test('the message follows the probabilities, and encoding then decoding returns it exactly', () => {
  for (const probs of SETS) {
    const tree = buildHuffmanTree(SYMBOLS, probs)
    const codes = codesFromTree(tree)
    const message = buildMessage(SYMBOLS, probs)
    expect(message).toHaveLength(MESSAGE_LENGTH)
    const counts = messageCounts(SYMBOLS, probs)
    SYMBOLS.forEach((s, i) => {
      expect(message.filter((m) => m === s)).toHaveLength(counts[s])
      expect(Math.abs(counts[s] - probs[i] * MESSAGE_LENGTH)).toBeLessThan(1)
    })
    const { bits } = encodeMessage(message, codes)
    expect(bits.length).toBe(message.reduce((a, s) => a + codes[s].length, 0))
    const decoded = decodeTrace(bits, tree)
      .filter((s) => s.emitted)
      .map((s) => s.emitted)
    expect(decoded).toEqual(message)
  }
  // default: 8 A, 6 B, 4 C, 2 D -> 8 + 12 + 12 + 6 = 38 bits, against 40 for a fixed 2-bit code
  const m = buildMessage(SYMBOLS, [0.4, 0.3, 0.2, 0.1])
  expect(m.join('')).toBe('ABCABDACBAABCABDACBA')
  expect(encodeMessage(m, buildHuffmanCodes(SYMBOLS, [0.4, 0.3, 0.2, 0.1])).bits).toHaveLength(38)
})

test.describe('Huffman tree and stream figure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/topics/entropy-and-compression/')
    await expect(page.getByTestId('huff-tree')).toBeVisible()
  })

  test('building from the leaves merges the two smallest, one merge per press', async ({ page }) => {
    const tree = page.getByTestId('huff-tree')
    await expect(tree).toHaveAttribute('data-merges', '3')
    await page.getByRole('button', { name: 'Start from the leaves' }).click()
    await expect(tree).toHaveAttribute('data-standing', '4')
    await page.getByRole('button', { name: 'Merge the two smallest' }).click()
    await expect(page.getByTestId('huff-stage')).toContainText('Merge 1 of 3: D (10.0%) + C (20.0%) = 30.0%.')
    await expect(tree).toHaveAttribute('data-standing', '3')
    await expect(page.getByRole('button', { name: 'Decode next bit' })).toBeDisabled()
    await page.getByRole('button', { name: 'Merge the two smallest' }).click()
    await page.getByRole('button', { name: 'Merge the two smallest' }).click()
    await expect(tree).toHaveAttribute('data-standing', '1')
    await expect(page.getByTestId('huff-stage')).toContainText('One tree left')
    await expect(page.getByRole('button', { name: 'Decode next bit' })).toBeEnabled()
  })

  test('decoding walks the tree bit by bit and returns the message', async ({ page }) => {
    const next = page.getByRole('button', { name: 'Decode next bit' })
    await next.click() // 0 -> A
    await expect(page.getByTestId('huff-decoded')).toContainText('1 of 20 symbols, 1 of 38 bits')
    await next.click() // 1 -> internal node
    await expect(page.getByTestId('huff-decode-note')).toContainText('not a leaf yet')
    await next.click() // 0 -> B
    await expect(page.getByTestId('huff-decode-note')).toContainText('reach leaf B')
    await page.getByRole('button', { name: 'Decode all' }).click()
    await expect(page.getByTestId('huff-decoded')).toContainText('A B C A B D A C B A A B C A B D A C B A')
    await expect(page.getByTestId('huff-decoded')).toContainText('20 of 20 symbols, 38 of 38 bits')
  })
})
