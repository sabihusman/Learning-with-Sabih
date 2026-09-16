'use client'

import { useState, useRef, useEffect } from 'react'
import Figure from './Figure'
import { useAnimationSpeedRef } from './animationSpeed'
import { INK, FADE, LINE, CONTROL_BG, MONO } from './vizPalette'
import { TRAITS, POS, NEG, initWeights, makeRound, updateWeights, topTrait } from './rlhfData'
import styles from './RlhfViz.module.css'
import shared from './vizShared.module.css'

// ── meter geometry (SVG diverging bars, zero in the centre) ───────────────────
const MW = 460
const ROW_H = 30
const TOP = 16
const TRACK_L = 116
const TRACK_R = 448
const CX = (TRACK_L + TRACK_R) / 2
const HALF = TRACK_R - CX
const MH = TOP + TRAITS.length * ROW_H + 22
const ACK_MS = 750

export default function RlhfViz() {
  const [round, setRound] = useState(0)
  const [picks, setPicks] = useState(0)
  const [weights, setWeights] = useState(() => initWeights())
  const [roundData, setRoundData] = useState(() => makeRound(0, initWeights()))
  const [chosenId, setChosenId] = useState(null)
  // brief post-pick acknowledgement: keep the chosen card highlighted (and the
  // meters shifting) for a beat before swapping in the next prompt, so the user
  // actually sees which response they picked. Timer-driven, not rAF.
  const [acking, setAcking] = useState(false)
  const ackTimer = useRef(null)
  // Stable ref to the shared animation-speed multiplier: read at fire time, so a
  // speed change never rewinds or replays the ack beat already in flight.
  const speedRef = useAnimationSpeedRef()

  useEffect(() => () => clearTimeout(ackTimer.current), [])

  const pick = (candidate) => {
    if (acking) return // ignore extra clicks during the acknowledgement beat
    const rejected = roundData.candidates.filter((c) => c.id !== candidate.id)
    const next = updateWeights(weights, candidate, rejected)
    setWeights(next) // meters animate now, while the pick is still shown
    setChosenId(candidate.id) // highlight the chosen card in the CURRENT round
    setPicks((p) => p + 1)
    setAcking(true)
    const r = round + 1
    clearTimeout(ackTimer.current)
    ackTimer.current = setTimeout(() => {
      setRound(r)
      setRoundData(makeRound(r, next)) // next prompt + candidates, biased by the updated weights
      setChosenId(null)
      setAcking(false)
    }, ACK_MS / speedRef.current)
  }

  const skip = () => {
    clearTimeout(ackTimer.current)
    setAcking(false)
    const r = round + 1
    setRound(r)
    setChosenId(null)
    setRoundData(makeRound(r, weights)) // new prompt, no feedback, weights unchanged
  }

  const reset = () => {
    clearTimeout(ackTimer.current)
    setAcking(false)
    const w = initWeights()
    setWeights(w)
    setRound(0)
    setPicks(0)
    setChosenId(null)
    setRoundData(makeRound(0, w))
  }

  const leaning = picks > 0 ? topTrait(weights).label : '—'

  const controls = [
    { label: 'Skip prompt', onClick: skip },
    { label: 'Reset', onClick: reset },
  ]
  const readouts = [
    { label: 'round', value: round },
    { label: 'feedback given', value: picks },
    { label: 'leaning toward', value: leaning },
  ]
  const status = picks === 0 ? 'Pick the response you prefer' : 'Your picks are reshaping the preference model'

  return (
    <Figure
      eyebrow="Alignment"
      title="Reinforcement learning from human feedback"
      controls={controls}
      speedControl
      status={status}
      readouts={readouts}
      tryThis="Keep choosing responses with the same quality, say always the most concise one, or always the most enthusiastic. Watch that trait's meter climb while the others fall, and notice the candidate responses start trending toward what you keep picking. This is a simplified stand-in, not a real language model: a real system trains a reward model on many human comparisons, then fine-tunes the language model against it."
    >
      <div className={styles.wrap}>
        {/* prompt */}
        <div className={styles.sectionLabel}>Prompt</div>
        <div className={styles.prompt}>{roundData.prompt}</div>

        {/* candidate responses */}
        <div className={styles.candidates}>
          {roundData.candidates.map((c) => {
            const picked = c.id === chosenId
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c)}
                className={`${styles.card} ${picked ? styles.cardPicked : ''}`}
              >
                <span className={styles.cardText}>{c.text}</span>
                <span className={`${styles.cardTag} ${picked ? styles.cardTagPicked : ''}`}>
                  {picked ? 'you picked this' : `mostly ${c.dominant}`}
                </span>
              </button>
            )
          })}
        </div>

        {/* learned preference meters: rendered straight from the true weights, with
            a CSS transition for a smooth shift (skipped under reduced motion). No
            animation-frame dependency, so the displayed value can never desync from
            the learned weight. */}
        <div className={styles.sectionLabel}>Learned preference weights</div>
        <div className={shared.scroll}>
        <svg role="img"
          viewBox={`0 0 ${MW} ${MH}`}
          className={styles.meters}
          style={{ minWidth: 385 }}
          aria-label="Preference weight per trait. Bars extend right (preferred) or left (disfavored) from a zero centre line."
        >
          <line x1={CX} y1={TOP - 4} x2={CX} y2={TOP + TRAITS.length * ROW_H} stroke={LINE} strokeWidth={1} />
          {[-1, 1].map((s) => (
            <text
              key={s}
              x={CX + s * HALF}
              y={MH - 6}
              fontSize={8}
              fill={FADE}
              textAnchor="middle"
              fontFamily={MONO}
            >
              {s > 0 ? 'prefers' : 'avoids'}
            </text>
          ))}
          {TRAITS.map((t, i) => {
            const w = weights[t.key]
            const rowY = TOP + i * ROW_H + ROW_H / 2
            const barW = Math.abs(w) * HALF
            const barX = w >= 0 ? CX : CX - barW
            const valX = w >= 0 ? Math.min(barX + barW + 5, TRACK_R) : Math.max(barX - 5, TRACK_L)
            return (
              <g key={t.key}>
                <text x={TRACK_L - 10} y={rowY + 3.5} fontSize={11} fill={INK} textAnchor="end" fontFamily={MONO}>
                  {t.label}
                </text>
                <rect x={TRACK_L} y={rowY - 8} width={TRACK_R - TRACK_L} height={16} fill={CONTROL_BG} rx={2} />
                <rect
                  x={barX.toFixed(1)}
                  width={Math.max(0, barW).toFixed(1)}
                  y={rowY - 8}
                  height={16}
                  rx={2}
                  fill={w >= 0 ? POS : NEG}
                  className={styles.barFill}
                  style={{ x: `${barX}px`, width: `${Math.max(0, barW)}px` }}
                />
                <text
                  x={valX}
                  y={rowY + 3.5}
                  fontSize={9}
                  fill={FADE}
                  textAnchor={w >= 0 ? 'start' : 'end'}
                  fontFamily={MONO}
                  className={styles.barValue}
                >
                  {w.toFixed(2)}
                </text>
              </g>
            )
          })}
        </svg>
        </div>

        {/* honesty disclaimer */}
        <p className={styles.disclaimer}>
          Simplified illustration: no real language model is running. The responses come from a fixed set of
          trait-based templates, and your picks nudge a tiny preference model with a seeded rule. A real system trains a
          reward model on many human comparisons, then fine-tunes the language model against that reward.
        </p>
      </div>
    </Figure>
  )
}
