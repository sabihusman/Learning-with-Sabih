import { test, expect } from '@playwright/test'
import { D_MODEL, SEQ_LEN, POSITIONS, peValue, peVector, similarity } from '../app/components/positionalEncodingData'

// Pure-function correctness for the Positional Encoding figure. No page, no browser:
// these assert directly on the same functions the component renders, so a change that
// breaks the figure's central claims (real sin/cos formula, even dims sine, odd dims
// cosine, nearby positions more similar) fails here.

const EPS = 1e-9

test('D_MODEL is even and POSITIONS has SEQ_LEN entries starting at 0', () => {
  expect(D_MODEL % 2).toBe(0)
  expect(POSITIONS.length).toBe(SEQ_LEN)
  expect(POSITIONS[0]).toBe(0)
  expect(POSITIONS[POSITIONS.length - 1]).toBe(SEQ_LEN - 1)
})

test('peVector(0, D_MODEL) is [0,1,0,1,...]: sin(0)=0 and cos(0)=1 in every pair', () => {
  const vec = peVector(0, D_MODEL)
  expect(vec.length).toBe(D_MODEL)
  for (let dim = 0; dim < D_MODEL; dim += 1) {
    expect(vec[dim]).toBeCloseTo(dim % 2 === 0 ? 0 : 1, 9)
  }
})

test('even dims use sine, odd dims use cosine, matching hand-computed values', () => {
  // pos=2, pair i=0 (dims 0,1): angle = 2 / 10000^0 = 2
  expect(peValue(2, 0, D_MODEL)).toBeCloseTo(Math.sin(2), 9)
  expect(peValue(2, 1, D_MODEL)).toBeCloseTo(Math.cos(2), 9)

  // pos=3, pair i=1 (dims 2,3): angle = 3 / 10000^(2 / D_MODEL)
  const angle = 3 / 10000 ** (2 / D_MODEL)
  expect(peValue(3, 2, D_MODEL)).toBeCloseTo(Math.sin(angle), 9)
  expect(peValue(3, 3, D_MODEL)).toBeCloseTo(Math.cos(angle), 9)
})

test('peValue matches a fully independent re-derivation of the formula for several cases', () => {
  const cases: Array<[number, number]> = [
    [0, 0],
    [1, 1],
    [4, 2],
    [5, 5],
    [9, 6],
    [9, 7],
  ]
  for (const [pos, dim] of cases) {
    const pairIndex = Math.floor(dim / 2)
    const expectedAngle = pos / 10000 ** ((2 * pairIndex) / D_MODEL)
    const expected = dim % 2 === 0 ? Math.sin(expectedAngle) : Math.cos(expectedAngle)
    expect(Math.abs(peValue(pos, dim, D_MODEL) - expected)).toBeLessThan(EPS)
  }
})

test('every peVector has the same squared norm (dModel / 2), so raw dot product already orders like cosine similarity', () => {
  for (const pos of POSITIONS) {
    const vec = peVector(pos, D_MODEL)
    const squaredNorm = vec.reduce((sum, v) => sum + v * v, 0)
    expect(squaredNorm).toBeCloseTo(D_MODEL / 2, 9)
  }
})

test('an adjacent position is more similar to a selected position than a distant one', () => {
  const selected = 4
  const adjacent = similarity(selected, selected + 1)
  const distant = similarity(selected, selected + 5)
  expect(adjacent).toBeGreaterThan(distant)

  // the selected position is always maximally similar to itself
  const self = similarity(selected, selected)
  expect(self).toBeGreaterThan(adjacent)
})

test('similarity is symmetric', () => {
  expect(similarity(2, 7)).toBeCloseTo(similarity(7, 2), 9)
})
