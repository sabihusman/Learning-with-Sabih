// A small, deterministic, ILLUSTRATIVE tokenizer. This is NOT a real BPE tokenizer and
// has no learned vocabulary. The rules are hand-made so the lesson is legible: common
// whole words stay as one token, while longer or rarer words split into subword pieces
// (un / break / able). IDs come from a small fixed lookup, with a stable hash fallback
// for anything outside it, so the same input always yields the same tokens and IDs.
// The point is only to show that a model reads tokens, not letters or whole words.

export const DEFAULT_TEXT = 'the unbreakable apple tasted unbelievably good'

// Common words kept whole (a token each). Deliberately small and illustrative.
const COMMON = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'is', 'are',
  'was', 'were', 'it', 'its', 'i', 'you', 'he', 'she', 'they', 'we', 'my', 'your', 'this',
  'that', 'good', 'bad', 'big', 'red', 'cat', 'dog', 'apple', 'tree', 'house', 'water',
  'time', 'day', 'one', 'two', 'not', 'yes', 'no', 'cest',
])

// Peeled longest-first so "ably" wins over "ly", "able" over nothing, etc.
const PREFIXES = ['under', 'over', 'un', 're', 'pre', 'dis', 'non', 'mis', 'in']
const SUFFIXES = ['ably', 'able', 'ness', 'ment', 'tion', 'ing', 'edly', 'ly', 'ed', 'er', 'est', 'es', 's']

// Split a single word into subword pieces by peeling known prefixes/suffixes off a stem.
// Each piece must leave a stem of at least 3 letters, so short words stay whole.
export function splitWord(word) {
  const lower = word.toLowerCase()
  if (COMMON.has(lower)) return [word]

  const head = []
  let rest = word
  for (let i = 0; i < 2; i += 1) {
    const p = PREFIXES.find((pre) => rest.toLowerCase().startsWith(pre) && rest.length - pre.length >= 3)
    if (!p) break
    head.push(rest.slice(0, p.length))
    rest = rest.slice(p.length)
  }

  const tail = []
  for (let i = 0; i < 2; i += 1) {
    const s = SUFFIXES.find((suf) => rest.toLowerCase().endsWith(suf) && rest.length - suf.length >= 3)
    if (!s) break
    tail.unshift(rest.slice(rest.length - s.length))
    rest = rest.slice(0, rest.length - s.length)
  }

  const pieces = [...head, ...(rest ? [rest] : []), ...tail]
  return pieces.length ? pieces : [word]
}

// A small fixed vocabulary: stable IDs for the common words, the subword pieces that
// show up most, and punctuation.
const KNOWN = [
  ...COMMON,
  'un', 're', 'pre', 'dis', 'under', 'over', 'non', 'mis',
  'break', 'believ', 'tast', 'read', 'walk', 'talk', 'play', 'help', 'count', 'spell', 'rhyme',
  'able', 'ably', 'ness', 'ment', 'tion', 'ing', 'edly', 'ly', 'ed', 'er', 'est', 'es', 's',
  '.', ',', '!', '?', ';', ':', "'", '-',
]
const VOCAB = new Map()
KNOWN.forEach((piece, i) => {
  if (!VOCAB.has(piece)) VOCAB.set(piece, 100 + i)
})

// Stable integer ID for a piece: from the fixed vocab if present, else a deterministic
// hash in a separate "rare" range so the same piece always gets the same number.
export function idOf(piece) {
  const key = piece.toLowerCase()
  if (VOCAB.has(key)) return VOCAB.get(key)
  let h = 0
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return 9000 + (h % 990)
}

// Tokenize text into pieces. Words split by the rules above; punctuation is its own
// token. Each token records which original word it came from, for grouping in the UI.
export function tokenize(text) {
  const segs = text.match(/[A-Za-z0-9']+|[^\sA-Za-z0-9']/g) || []
  const tokens = []
  let wordIndex = 0
  segs.forEach((seg) => {
    const isWord = /[A-Za-z0-9']/.test(seg)
    const pieces = isWord ? splitWord(seg) : [seg]
    pieces.forEach((p) => tokens.push({ text: p, id: idOf(p), word: seg, wordIndex, isWord }))
    wordIndex += 1
  })
  return tokens
}

export function counts(text) {
  const words = (text.match(/[A-Za-z0-9']+/g) || []).length
  const characters = text.length
  const tokens = tokenize(text).length
  return { tokens, words, characters }
}
