// Hand-authored, illustrative multi-head attention for one example sentence. NONE
// of this is a real attention computation. Each head has its own hand-set weights so
// it draws a DIFFERENT relationship over the same sentence, which is the whole point:
// a transformer runs many heads in parallel, each watching a different pattern.
//
// The sentence, word layout, and colours are reused from the attention topic so the
// two read as a pair (same look). attentionData is imported read-only, not modified.
import { WORDS, SENTENCE, INK, FADE, PAPER } from './attentionData'

export { WORDS, SENTENCE, INK, FADE, PAPER }

const N = WORDS.length

// Indices: 0 the, 1 animal, 2 didn't, 3 cross, 4 the, 5 street, 6 because, 7 it,
//          8 was, 9 tired.

// Head 0: coreference. The pronoun "it" reaches back to "animal"; related nouns and
// the predicate link up. This is the single-head case from the attention topic.
const COREF = {
  7: { 1: 1.0, 9: 0.5, 8: 0.3 }, // it -> animal (strong), tired, was
  1: { 7: 0.75, 0: 0.35, 3: 0.3 }, // animal -> it
  9: { 7: 0.7, 1: 0.4 }, // tired -> it, animal
  3: { 1: 0.45, 5: 0.4 },
  5: { 3: 0.35, 1: 0.25 },
}

// Head 2: verb to its arguments. Verbs attend to their subject and object, so
// "cross" reaches "animal" and "street", and the predicate "tired/was" reaches "it".
const VERB = {
  3: { 1: 0.9, 5: 0.8, 4: 0.3 }, // cross -> animal (subject), street (object)
  9: { 7: 0.85, 8: 0.5 }, // tired -> it (subject), was
  8: { 9: 0.7, 7: 0.5 }, // was -> tired, it
  7: { 9: 0.8, 8: 0.5 }, // it -> tired, was (its predicate)
  1: { 3: 0.7 }, // animal -> cross (its verb)
  5: { 3: 0.7 }, // street -> cross
}

// Head 1: previous-word (a positional pattern). Every word looks mainly at the word
// just before it, a known head behaviour. Built from a rule, still hand-designed.
const ADJACENT = {}
for (let i = 0; i < N; i += 1) {
  ADJACENT[i] = {}
  if (i - 1 >= 0) ADJACENT[i][i - 1] = 0.9
  if (i + 1 < N) ADJACENT[i][i + 1] = 0.3
}

// For the authored heads, words without an authored row fall back to weak attention
// on their immediate neighbours, so clicking any word still shows something.
function fallback(id) {
  const w = {}
  if (id - 1 >= 0) w[id - 1] = 0.4
  if (id + 1 < N) w[id + 1] = 0.4
  return w
}

export const HEADS = [
  { id: 0, name: 'Coreference', color: '#c0392b', blurb: 'pronouns and the nouns they refer to', weights: COREF, useFallback: true },
  { id: 1, name: 'Previous word', color: '#2f6f7e', blurb: 'each word looks back at the one before it', weights: ADJACENT, useFallback: false },
  { id: 2, name: 'Verb to arguments', color: '#9a6b1f', blurb: 'verbs and their subject and object', weights: VERB, useFallback: true },
]

// Outgoing weights for one head, from a word to every other (0..1).
export function weightsFor(head, id) {
  const row = head.weights[id]
  if (row) return row
  return head.useFallback ? fallback(id) : ADJACENT[id] ?? {}
}

// Top-k attended words for the readout, strongest first.
export function topLinks(head, id, k = 3) {
  return Object.entries(weightsFor(head, id))
    .map(([target, weight]) => ({ id: Number(target), weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, k)
}
