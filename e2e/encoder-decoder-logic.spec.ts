import { test, expect } from '@playwright/test'
import { SENTENCE, canAttend, maskGrid, visibleWords } from '../app/components/encoderDecoderData'

// Pure-function correctness for the encoder/decoder attention-mask figure. No page,
// no browser: these assert directly on the same canAttend/maskGrid the component
// renders, so a change that breaks the causal-mask rule fails here.

const N = SENTENCE.length

test('the sentence has ten words, shared unmodified with the attention topic', () => {
  expect(N).toBe(10)
  expect(SENTENCE.join(' ')).toBe("the animal didn't cross the street because it was tired")
})

test('encoder mode: every cell is true (full attention)', () => {
  const grid = maskGrid('encoder')
  expect(grid.length).toBe(N)
  for (const row of grid) {
    expect(row.length).toBe(N)
    for (const cell of row) expect(cell).toBe(true)
  }
})

test('decoder mode: cell (r, c) is true iff c <= r', () => {
  const grid = maskGrid('decoder')
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      expect(grid[r][c]).toBe(c <= r)
    }
  }
})

test('decoder mode: the upper triangle (c > r) is entirely false', () => {
  const grid = maskGrid('decoder')
  for (let r = 0; r < N; r += 1) {
    for (let c = r + 1; c < N; c += 1) {
      expect(grid[r][c]).toBe(false)
    }
  }
})

test('decoder mode: the diagonal (a word attending to itself) is always true', () => {
  for (let i = 0; i < N; i += 1) {
    expect(canAttend('decoder', i, i)).toBe(true)
  }
})

test('decoder mode: the first word sees only itself', () => {
  expect(visibleWords('decoder', 0)).toEqual([SENTENCE[0]])
})

test('decoder mode: the last word sees all ten words', () => {
  expect(visibleWords('decoder', N - 1)).toEqual(SENTENCE)
})

test('encoder mode: every word sees all ten words, including the first and last', () => {
  expect(visibleWords('encoder', 0)).toEqual(SENTENCE)
  expect(visibleWords('encoder', N - 1)).toEqual(SENTENCE)
})
