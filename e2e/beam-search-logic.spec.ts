import { test, expect } from '@playwright/test'
import { TREE, MAX_BEAM_WIDTH, siblingSumsValid, greedyDecode, beamSearch } from '../app/components/beamSearchData'

// Pure-function correctness for the beam search figure's search logic. No page, no
// browser: these assert directly on the same tree and functions the component renders,
// so a change to the tree or the algorithms that breaks the figure's central claim
// fails here, not just visually.

test('every sibling group in the tree sums to 1', () => {
  expect(siblingSumsValid(TREE)).toBe(true)
})

test('beam search at width 1 is exactly greedy decoding', () => {
  const greedy = greedyDecode(TREE)
  const beam1 = beamSearch(TREE, 1)
  expect(beam1).toHaveLength(1)
  expect(beam1[0].ids).toEqual(greedy.ids)
  expect(beam1[0].tokens).toEqual(greedy.tokens)
  expect(beam1[0].logProb).toBeCloseTo(greedy.logProb, 10)
})

test('a wider beam finds a sequence with strictly higher total log-probability than greedy', () => {
  const greedy = greedyDecode(TREE)
  for (let k = 2; k <= MAX_BEAM_WIDTH; k++) {
    const beam = beamSearch(TREE, k)
    expect(beam[0].logProb).toBeGreaterThan(greedy.logProb)
  }
  // the trap: greedy's own first choice is a strictly worse commitment than the
  // token beam search ends up preferring
  const winner = beamSearch(TREE, 2)[0]
  expect(winner.tokens).not.toEqual(greedy.tokens)
  expect(winner.logProb - greedy.logProb).toBeGreaterThan(1) // a wide, unmistakable margin
})

test('beam survivors are sorted by descending log-probability and never exceed k', () => {
  for (let k = 1; k <= MAX_BEAM_WIDTH; k++) {
    const beam = beamSearch(TREE, k)
    expect(beam.length).toBeLessThanOrEqual(k)
    for (let i = 1; i < beam.length; i++) {
      expect(beam[i - 1].logProb).toBeGreaterThanOrEqual(beam[i].logProb)
    }
  }
})
