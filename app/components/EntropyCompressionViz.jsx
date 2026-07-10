'use client'

import { useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './EntropyCompressionViz.module.css'
import {
  SYMBOLS,
  DEFAULT_PROBS,
  adjustProbability,
  shannonEntropy,
  buildHuffmanCodes,
  averageCodeLength,
} from './entropyCompressionData'

const fmtBits = (v) => v.toFixed(3)
const fmtPct = (p) => `${(p * 100).toFixed(1)}%`

export default function EntropyCompressionViz() {
  const [probs, setProbs] = useState(DEFAULT_PROBS)

  const entropy = useMemo(() => shannonEntropy(probs), [probs])
  const codes = useMemo(() => buildHuffmanCodes(SYMBOLS, probs), [probs])
  const avgLength = useMemo(() => averageCodeLength(SYMBOLS, probs, codes), [probs, codes])
  const gap = avgLength - entropy
  const nonzeroCount = probs.filter((p) => p > 1e-9).length

  const onSlide = (index, rawPercent) => {
    setProbs((prev) => adjustProbability(prev, index, rawPercent / 100))
  }

  const status = `Entropy ${fmtBits(entropy)} bits/symbol; Huffman averages ${fmtBits(avgLength)} bits/symbol, a gap of ${fmtBits(gap)}.`

  const readouts = [
    { label: 'entropy', value: `${fmtBits(entropy)} bits` },
    { label: 'Huffman average', value: `${fmtBits(avgLength)} bits` },
    { label: 'gap', value: `${fmtBits(gap)} bits` },
    { label: 'nonzero symbols', value: nonzeroCount },
  ]

  return (
    <Figure
      eyebrow="Compression"
      title="Entropy and a live Huffman code over four symbols"
      status={status}
      readouts={readouts}
      tryThis="Drag toward powers of one-half, like 0.5/0.25/0.125/0.125, and the gap closes to zero: Huffman meets entropy exactly. Drag all four to 25% and both settle at 2.000 bits. Skew hard toward one symbol, like 0.7/0.15/0.10/0.05, and entropy drops well below 2 while the gap widens past 0.1."
    >
      <div className={styles.rows}>
        {SYMBOLS.map((label, i) => {
          const p = probs[i]
          const code = codes[label] ?? ''
          return (
            <div key={label} className={styles.row}>
              <div className={styles.rowHead}>
                <span className={styles.symbol}>{label}</span>
                <span className={styles.prob}>{fmtPct(p)}</span>
                <span className={styles.code}>{code || '-'}</span>
                <span className={styles.codeLen}>{code ? `${code.length} bit${code.length === 1 ? '' : 's'}` : ''}</span>
              </div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: fmtPct(p) }} />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={0.5}
                value={p * 100}
                onChange={(e) => onSlide(i, Number(e.target.value))}
                className={styles.slider}
                aria-label={`Probability of symbol ${label}`}
              />
            </div>
          )
        })}
      </div>

      <p className={styles.caption}>
        Moving one slider renormalizes the other three proportionally, so the table always sums to 100%. Entropy,
        the Huffman code for every symbol, and the average code length are all recomputed live from the current
        probabilities, not scripted.
      </p>
    </Figure>
  )
}
