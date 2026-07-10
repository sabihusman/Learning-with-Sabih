'use client'

import { useRef, useState } from 'react'
import Figure from './Figure'
import { CANDIDATES, T_MIN, T_MAX, probsAt, entropy, sampleWith } from './temperatureData'
import styles from './TemperatureViz.module.css'

const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

// ── SVG geometry ──────────────────────────────────────────────────────────────
const VB_W = 500
const TOP = 18
const ROW_H = 36
const LABEL_W = 64
const PCT_W = 56
const BAR_X = LABEL_W + 8
const BAR_MAX = VB_W - BAR_X - PCT_W - 8
const VB_H = TOP + CANDIDATES.length * ROW_H + 8

// Simple seeded PRNG so the harness / browser session can be reproducible if needed.
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function TemperatureViz() {
  const [t, setT] = useState(1.0)
  const [history, setHistory] = useState([])
  const rngRef = useRef(mulberry32(1))

  const probs = probsAt(t)
  // initial value satisfies eslint/sonar (reduce on a possibly-empty array)
  const top = probs.reduce((a, b) => (a.p >= b.p ? a : b), { word: '—', p: 0 })
  const ent = entropy(probs)

  const sample = () => {
    const r = rngRef.current()
    const word = sampleWith(probs, r)
    setHistory((h) => [word, ...h].slice(0, 12))
  }
  const reset = () => {
    rngRef.current = mulberry32(1)
    setHistory([])
  }

  const status =
    t <= 0.3
      ? 'low temperature: the top option dominates'
      : t >= 1.4
      ? 'high temperature: probabilities flatten out'
      : 'balanced temperature: top option leads, others have a chance'

  const readouts = [
    { label: 'temperature', value: t.toFixed(2) },
    { label: 'top word', value: `${top.word} (${(top.p * 100).toFixed(1)}%)` },
    { label: 'entropy', value: `${ent.toFixed(2)} bits` },
  ]

  return (
    <Figure
      eyebrow="Language models"
      title="Temperature reshapes the next-word distribution"
      status={status}
      readouts={readouts}
      tryThis={`At each step a model produces a probability for every candidate next word. Temperature reshapes that distribution before a word is sampled. Slide low (near 0.1) and "mat" wins almost every time, so the output is predictable and safe. Slide high (near 2.0) and probabilities flatten out, so unlikely words like "roof" or even "moon" get a real chance, making the output more creative but also more error-prone. Hit Sample to draw a word from the current distribution; do it several times at each end to see how often each word appears. The candidate words and their base scores are hand-set for illustration; the softmax-with-temperature math reshaping them is the real formula models use.`}
    >
      <p className={styles.context}>
        The cat sat on the <span className={styles.blank}>___</span>
      </p>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', maxWidth: 520, height: 'auto', display: 'block', margin: '0 auto' }}
        aria-label="Probability bars for each candidate next word. Higher temperature flattens the bars, lower temperature peaks them at the top word."
      >
        {probs.map((p, i) => {
          const y = TOP + i * ROW_H
          const w = Math.max(p.p * BAR_MAX, 1)
          const isTop = p.word === top.word
          return (
            <g key={p.word}>
              <text x={LABEL_W} y={y + ROW_H / 2 + 4} fontSize={13} fill={INK} fontFamily={MONO} fontWeight={isTop ? 700 : 400} textAnchor="end">
                {p.word}
              </text>
              <rect x={BAR_X} y={y + 8} width={BAR_MAX} height={ROW_H - 16} rx={3} fill="#f0ede6" />
              <rect
                x={BAR_X}
                y={y + 8}
                width={w}
                height={ROW_H - 16}
                rx={3}
                fill={isTop ? ACCENT : '#2f6f7e'}
                opacity={0.45 + p.p * 0.5}
                style={{ transition: 'width 220ms ease-out, fill 200ms ease' }}
              />
              <text x={BAR_X + BAR_MAX + 6} y={y + ROW_H / 2 + 4} fontSize={12} fill={INK} fontFamily={MONO} fontWeight={isTop ? 700 : 400}>
                {`${(p.p * 100).toFixed(1)}%`}
              </text>
            </g>
          )
        })}
      </svg>

      <div className={styles.sliderRow}>
        <span className={styles.sliderLabel}>temperature</span>
        <input
          className={styles.slider}
          type="range"
          min={T_MIN}
          max={T_MAX}
          step={0.05}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          aria-label="Temperature"
        />
        <span className={styles.tValue}>{t.toFixed(2)}</span>
      </div>
      <div className={styles.endsRow}>
        <span className={styles.left}>← low: predictable, focused (facts, code)</span>
        <span className={styles.right}>high: creative, surprising (brainstorming) →</span>
      </div>

      <div className={styles.sampleRow}>
        <button type="button" className={styles.sampleBtn} onClick={sample}>
          Sample a word
        </button>
        <button type="button" className={styles.sampleBtn} onClick={reset} style={{ background: '#f4f2ec', color: INK, border: '1px solid #d8d4cc' }}>
          Reset
        </button>
        <span className={styles.sampleResult}>
          {history.length === 0 ? 'no samples yet' : `last: ${history[0]}`}
        </span>
        <span className={styles.sampleHistory}>{history.length > 1 && `recent: ${history.slice(0, 12).join(', ')}`}</span>
      </div>

      <p className={styles.note}>
        Candidate scores are hand-authored to keep the demo legible; a real model produces a probability for every
        token in its vocabulary. The softmax-with-temperature math here is the real one.
      </p>
    </Figure>
  )
}
