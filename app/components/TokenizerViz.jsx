'use client'

import { useState } from 'react'
import Figure from './Figure'
import { tokenize, counts, DEFAULT_TEXT } from './tokenizerData'
import { OK_BG, MUTED_BG, CATEGORICAL } from './vizPalette'
import shared from './vizShared.module.css'
import styles from './TokenizerViz.module.css'

// Calm fill for a word the model sees as ONE token; the categorical identity
// colours (as low-opacity fills) mark the pieces of a split word, so a
// broken-up word visibly differs from a whole one.
const WHOLE_BG = OK_BG
const PUNCT_BG = MUTED_BG
const hexToRgba = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
const PALETTE = CATEGORICAL.map((c) => hexToRgba(c, 0.22))

const SPELLING_TEXT = 'how many r letters are in strawberry'

export default function TokenizerViz() {
  const [text, setText] = useState(DEFAULT_TEXT)

  const tokens = tokenize(text)
  const c = counts(text)

  // group tokens by the original word they came from
  const groups = []
  tokens.forEach((t) => {
    const g = groups[t.wordIndex]
    if (g) g.items.push(t)
    else groups[t.wordIndex] = { word: t.word, isWord: t.isWord, items: [t] }
  })

  const controls = [
    { label: 'Default sentence', onClick: () => setText(DEFAULT_TEXT), active: text === DEFAULT_TEXT },
    { label: 'Spelling example', onClick: () => setText(SPELLING_TEXT), active: text === SPELLING_TEXT },
    { label: 'Clear', onClick: () => setText(''), disabled: text === '' },
  ]

  const readouts = [
    { label: 'tokens', value: c.tokens },
    { label: 'words', value: c.words },
    { label: 'characters', value: c.characters },
  ]
  const status = c.words > 0 ? `${c.tokens} tokens from ${c.words} words` : 'Type a sentence to tokenize it'

  let colorIdx = 0

  return (
    <Figure
      eyebrow="Language models"
      title="How text becomes tokens"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis={`Edit the sentence and watch the tokens change. Common words like "the" and "apple" stay as a single token, but longer or rarer words split into subword pieces, like un / break / able. Each block is one token with an integer ID; a model reads this stream of IDs, not the letters. That is why models stumble on spelling or counting letters: try the spelling example and notice "strawberry" is a single token, so the model never sees its individual r's. This splitter is a simplified illustration, not a real model's tokenizer.`}
    >
      <input
        className={shared.input}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Sentence to tokenize"
        spellCheck={false}
      />

      <div className={styles.tokens}>
        {groups.length === 0 && <span className={styles.empty}>No tokens yet. Type something above.</span>}
        {groups.map((g, gi) => {
          const split = g.isWord && g.items.length > 1
          return (
            <div key={gi} className={styles.group}>
              <div className={styles.pieces}>
                {g.items.map((t, ti) => {
                  const bg = !g.isWord ? PUNCT_BG : split ? PALETTE[colorIdx++ % PALETTE.length] : WHOLE_BG
                  return (
                    <div key={ti} className={styles.chip} style={{ background: bg }}>
                      <span className={styles.chipText}>{t.text}</span>
                      <span className={styles.chipId}>{t.id}</span>
                    </div>
                  )
                })}
              </div>
              {g.isWord && (
                <span className={`${styles.word} ${split ? styles.split : ''}`}>
                  {split ? `${g.word} = ${g.items.length} tokens` : g.word}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className={shared.legend}>
        <span className={shared.legendItem}>
          <span className={shared.swatch} style={{ background: WHOLE_BG }} />
          whole word
        </span>
        <span className={shared.legendItem}>
          <span className={shared.swatch} style={{ background: PALETTE[0] }} />
          sub-word piece
        </span>
        <span className={shared.legendItem}>
          <span className={shared.swatch} style={{ background: PUNCT_BG }} />
          punctuation
        </span>
      </div>

      <p className={shared.caption}>
        Token IDs come from a small fixed lookup, with a stable fallback for rare pieces. A real tokenizer learns its
        vocabulary from data and uses tens of thousands of tokens; this one is hand-made to show the idea.
      </p>
    </Figure>
  )
}
