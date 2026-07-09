import { test, expect } from '@playwright/test'
import {
  SYMBOLS,
  shannonEntropy,
  buildHuffmanCodes,
  averageCodeLength,
  isPrefixFree,
  adjustProbability,
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
