'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import { DOMAIN_NAME, DATASET, PROMPTS } from './fineTuningData'
import styles from './FineTuningViz.module.css'

const STEP = 0.05 // progress increment per tick
const TICK_MS = 90 // timer cadence: setInterval, not rAF, so a hidden tab does not stall it

const isRowTuned = (p, phase, progress) =>
  p.kind === 'domain' && (phase === 'tuned' || (phase === 'tuning' && progress >= p.tuneAt))

export default function FineTuningViz() {
  // phase: 'base' (generic) -> 'tuning' (running) -> 'tuned' (specialized)
  const [phase, setPhase] = useState('base')
  const [progress, setProgress] = useState(0)

  const timerRef = useRef(null)
  const flippedRef = useRef(new Set()) // domain rows already animated, so each pops once
  const answerRefs = useRef({})
  const tunedChipRef = useRef(null)

  useEffect(() => () => clearInterval(timerRef.current), [])

  // Fade each domain answer in as it specializes. The answer text is already swapped
  // by render (state-driven); anime only adds the shift flourish, so the answer is
  // correct even if rAF is throttled and the animation never plays.
  useEffect(() => {
    PROMPTS.forEach((p) => {
      if (!isRowTuned(p, phase, progress) || flippedRef.current.has(p.id)) return
      flippedRef.current.add(p.id)
      const node = answerRefs.current[p.id]
      if (node) animate(node, { opacity: [0.15, 1], translateX: [-10, 0], duration: 420, ease: 'outQuad' })
    })
  }, [phase, progress])

  // Pop the "fine-tuned" chip when training completes.
  useEffect(() => {
    if (phase === 'tuned' && tunedChipRef.current) {
      animate(tunedChipRef.current, { scale: [0.6, 1], duration: 380, ease: 'outBack' })
    }
  }, [phase])

  const run = () => {
    if (phase !== 'base') return
    setPhase('tuning')
    setProgress(0)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(1, prev + STEP)
        if (next >= 1) {
          clearInterval(timerRef.current)
          setPhase('tuned')
        }
        return next
      })
    }, TICK_MS)
  }

  const reset = () => {
    clearInterval(timerRef.current)
    flippedRef.current = new Set()
    setPhase('base')
    setProgress(0)
  }

  const controls = [
    { label: 'Fine-tune on domain data', onClick: run, variant: 'primary', disabled: phase !== 'base' },
    { label: 'Reset', onClick: reset, disabled: phase === 'base' },
  ]

  const pct = Math.round(progress * 100)
  const status =
    phase === 'base'
      ? 'General base model: generic answers on the domain prompts'
      : phase === 'tuning'
        ? `Fine-tuning on ${DATASET.length} domain examples... ${pct}%`
        : `Fine-tuned on ${DOMAIN_NAME}: domain answers specialized, general answers retained`

  const readouts = [
    { label: 'model', value: phase === 'base' ? 'general base' : phase === 'tuning' ? 'fine-tuning…' : 'fine-tuned' },
    { label: 'trained on', value: `${DATASET.length} examples` },
    { label: 'domain answers', value: phase === 'base' ? 'generic' : phase === 'tuned' ? 'specialized' : 'specializing…' },
  ]

  const tuned = phase === 'tuned'
  const fillW = phase === 'base' ? 0 : progress

  return (
    <Figure
      eyebrow="Fine-tuning"
      title="Specializing a general model on domain data"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Press Fine-tune on domain data. A general base model is trained a little further on a small labeled set of support examples, and its answers to the domain prompts shift from generic to specialized, one at a time. Notice the two general-knowledge prompts: their answers do not change, because fine-tuning specializes behavior without erasing what the base model already knows. Reset to compare before and after. The answers here are hand-authored to show the behavior; no real model is being trained."
    >
      {/* base -> tuned flow (SVG) with a progress-filled arrow */}
      <svg className={styles.flow} viewBox="0 0 480 60" role="img" aria-label="A general base model is fine-tuned on domain data into a domain-tuned model; the arrow fills as training runs.">
        <rect x="6" y="14" width="150" height="32" rx="8" fill="#ffffff" stroke="#1a1a1a" strokeWidth="1.5" />
        <text x="81" y="34" fontSize="11" fontFamily="ui-monospace, monospace" textAnchor="middle" fill="#1a1a1a">general base</text>

        <line x1="162" y1="30" x2="318" y2="30" stroke="#d8d4cc" strokeWidth="3" strokeLinecap="round" />
        <line x1="162" y1="30" x2={(162 + 156 * fillW).toFixed(1)} y2="30" stroke="#c0392b" strokeWidth="3" strokeLinecap="round" />
        <polygon points="318,30 310,26 310,34" fill={tuned ? '#c0392b' : '#d8d4cc'} />
        <text x="240" y="20" fontSize="9.5" fontFamily="ui-monospace, monospace" textAnchor="middle" fill="#9b9892">fine-tune</text>

        <g ref={tunedChipRef} style={{ transformOrigin: '399px 30px' }}>
          <rect x="324" y="14" width="150" height="32" rx="8" fill={tuned ? '#fbeeec' : '#ffffff'} stroke={tuned ? '#c0392b' : '#d8d4cc'} strokeWidth="1.5" />
          <text x="399" y="34" fontSize="11" fontFamily="ui-monospace, monospace" textAnchor="middle" fill={tuned ? '#c0392b' : '#9b9892'} fontWeight={tuned ? 700 : 400}>domain-tuned</text>
        </g>
      </svg>

      {/* the labeled dataset fine-tuning trains on */}
      <div className={styles.dataset}>
        <span className={styles.datasetLabel}>Fine-tuning data: {DATASET.length} labeled {DOMAIN_NAME} examples</span>
        <ul className={styles.dataList}>
          {DATASET.map((d) => (
            <li key={d.in} className={styles.dataPair}>
              <span className={styles.dataIn}>{d.in}</span>
              <span className={styles.dataArrow}>&rarr;</span>
              <span className={styles.dataOut}>{d.out}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* test prompts: domain answers specialize, general answers are retained */}
      <ul className={styles.prompts}>
        {PROMPTS.map((p) => {
          const rowTuned = isRowTuned(p, phase, progress)
          const answer = rowTuned ? p.tuned : p.base
          return (
            <li key={p.id} className={styles.promptRow}>
              <span className={`${styles.tag} ${p.kind === 'domain' ? styles.tagDomain : styles.tagGeneral}`}>{p.kind}</span>
              <div className={styles.qa}>
                <div className={styles.q}>{p.q}</div>
                <div
                  key={rowTuned ? 'tuned' : 'base'}
                  ref={(el) => {
                    answerRefs.current[p.id] = el
                  }}
                  className={`${styles.answer} ${rowTuned ? styles.answerTuned : ''}`}
                >
                  {answer}
                </div>
              </div>
              {p.kind === 'domain' && rowTuned && <span className={styles.badgeSpecialized}>specialized</span>}
              {p.kind === 'general' && phase !== 'base' && <span className={styles.badgeRetained}>retained</span>}
            </li>
          )
        })}
      </ul>

      <p className={styles.caption}>
        Illustrative only: the before and after answers are hand-authored to show the effect of fine-tuning. No real
        model is trained here. RLHF, in the figure above, is one kind of fine-tuning where the specialized data is
        human preferences.
      </p>
    </Figure>
  )
}
