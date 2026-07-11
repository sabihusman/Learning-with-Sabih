import { test, expect } from '@playwright/test'
import { WORDS, SENTENCE, HEADS, weightsFor, topLinks } from '../app/components/transformerData'

// Pure-function correctness for the all-heads-at-once transformers figure. No page,
// no browser: these assert directly on the same HEADS/weightsFor/topLinks the
// component renders, so a change that breaks a head's teaching claim fails here.

const labelOf = (id: number) => WORDS.find((w) => w.id === id)?.label

test('there are three heads: Coreference, Previous word, Verb to arguments', () => {
  expect(HEADS.map((h) => h.name)).toEqual(['Coreference', 'Previous word', 'Verb to arguments'])
  expect(new Set(HEADS.map((h) => h.color)).size).toBe(3)
})

test('WORDS matches the ten-word sentence shared with the attention topic', () => {
  expect(WORDS.length).toBe(10)
  expect(WORDS.map((w) => w.label)).toEqual(SENTENCE)
})

test('Coreference: "it" attends most strongly to "animal"', () => {
  const coref = HEADS.find((h) => h.name === 'Coreference')
  const it = WORDS.find((w) => w.label === 'it')
  const top = topLinks(coref, it.id, 1)[0]
  expect(labelOf(top.id)).toBe('animal')
  expect(top.weight).toBeCloseTo(1.0, 9)
})

test('Verb to arguments: "cross" attends most strongly to its subject and object (animal, street)', () => {
  const verb = HEADS.find((h) => h.name === 'Verb to arguments')
  const cross = WORDS.find((w) => w.label === 'cross')
  const top2 = topLinks(verb, cross.id, 2).map((l) => labelOf(l.id))
  expect(top2).toEqual(['animal', 'street'])
})

test('Previous word: every word (except the first) attends most strongly to the word right before it', () => {
  const prev = HEADS.find((h) => h.name === 'Previous word')
  for (const w of WORDS) {
    if (w.id === 0) continue
    const top = topLinks(prev, w.id, 1)[0]
    expect(top.id).toBe(w.id - 1)
  }
})

test('every head\'s weights stay in [0,1] for every word with an authored or fallback row', () => {
  for (const head of HEADS) {
    for (const w of WORDS) {
      const row = weightsFor(head, w.id)
      for (const weight of Object.values(row)) {
        expect(weight).toBeGreaterThan(0)
        expect(weight).toBeLessThanOrEqual(1)
      }
    }
  }
})
