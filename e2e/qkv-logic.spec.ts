import { test, expect } from '@playwright/test'
import { WORDS, DIMS, matches } from '../app/components/qkvData'

// Pure-function correctness for the QKV figure. No page, no browser: these assert
// directly on the same matches() function the component renders, so a change that
// breaks the scaled dot-product softmax (real formula, valid distribution, and the
// intended coreference/predicate relationships) fails here.

const EPS = 1e-9

// The teaching claim per picked word: which other word its Query should attend to
// most strongly. "it" -> "animal" is the coreference case; "tired" -> "it" is the
// predicate-to-subject case; "animal" and "street" are self-referential anchors.
const INTENDED_TOP = { animal: 'animal', street: 'street', it: 'animal', tired: 'it' }

test('every weight is in [0,1] and sums to 1 for every picked word (valid softmax)', () => {
  for (const w of WORDS) {
    const ms = matches(w.id)
    for (const m of ms) {
      expect(m.weight).toBeGreaterThanOrEqual(0)
      expect(m.weight).toBeLessThanOrEqual(1)
    }
    const sum = ms.reduce((s, m) => s + m.weight, 0)
    expect(sum).toBeCloseTo(1, 9)
  }
})

test('weight ordering matches raw score ordering (softmax is monotonic)', () => {
  for (const w of WORDS) {
    const ms = matches(w.id)
    const byMatch = [...ms].sort((a, b) => b.match - a.match).map((m) => m.id)
    const byWeight = [...ms].sort((a, b) => b.weight - a.weight).map((m) => m.id)
    expect(byWeight).toEqual(byMatch)
  }
})

test('each picked word attends most strongly to its intended match, with a clear gap over the runner-up', () => {
  for (const w of WORDS) {
    const ms = [...matches(w.id)].sort((a, b) => b.weight - a.weight)
    const [top, runnerUp] = ms
    expect(top.label).toBe(INTENDED_TOP[w.label])
    expect(top.weight - runnerUp.weight).toBeGreaterThan(0.1)
  }
})

test('"it" attends to "animal" (the coreference case), matching a fully independent re-derivation', () => {
  const it = WORDS.find((w) => w.label === 'it')
  const animal = WORDS.find((w) => w.label === 'animal')
  const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)

  const scores = WORDS.map((w) => dot(it.q, w.k) / Math.sqrt(DIMS))
  const mx = Math.max(...scores)
  const exps = scores.map((s) => Math.exp(s - mx))
  const sum = exps.reduce((a, b) => a + b, 0)
  const expected = WORDS.map((w, i) => ({ id: w.id, weight: exps[i] / sum }))

  const actual = matches(it.id)
  for (const e of expected) {
    const a = actual.find((x) => x.id === e.id)
    expect(Math.abs(a.weight - e.weight)).toBeLessThan(EPS)
  }

  const animalWeight = actual.find((m) => m.id === animal.id).weight
  const topWeight = Math.max(...actual.map((m) => m.weight))
  expect(animalWeight).toBeCloseTo(topWeight, 9)
})

test('all Q, K, V components stay within [0,1] (opacity encoding in VecCells assumes this range)', () => {
  for (const w of WORDS) {
    for (const vec of [w.q, w.k, w.v]) {
      for (const val of vec) {
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }
    }
  }
})
