// The attention-mask rule: what is each word ALLOWED to attend to, not the actual
// attention weights. Reuses the shared attention sentence unmodified so this topic
// reads as a direct sequel to Attention and Transformers.
import { SENTENCE, INK, FADE, PAPER } from './attentionData'

export { SENTENCE, INK, FADE, PAPER }

export const MODES = ['encoder', 'decoder']

// Can rowIndex (the word doing the looking) attend to colIndex (the word being
// looked at)? Encoder: every word sees every word, no restriction. Decoder: causal
// mask, a word sees itself and only the words before it (colIndex <= rowIndex),
// because generation is left to right and later words do not exist yet.
export function canAttend(mode, rowIndex, colIndex) {
  if (mode === 'encoder') return true
  return colIndex <= rowIndex
}

// Full N x N boolean grid for a mode, computed cell by cell from canAttend.
export function maskGrid(mode) {
  return SENTENCE.map((_, row) => SENTENCE.map((_, col) => canAttend(mode, row, col)))
}

// Which words a given row (word) can see under the current mode, for the readout.
export function visibleWords(mode, rowIndex) {
  return SENTENCE.filter((_, col) => canAttend(mode, rowIndex, col))
}
