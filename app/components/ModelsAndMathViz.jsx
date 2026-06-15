'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import { PRESETS, getPreset, computeSteps, modelPicks, modelAnswer } from './modelsAndMathData'
import { INK, FADE, ACCENT, MONO } from './vizPalette'
import styles from './ModelsAndMathViz.module.css'

const GREEN = '#1f6f5c'
const BAR_MAX = 120 // px width of a probability bar at p = 1

// Illustrative next-token probability distribution for one predicted token, drawn as
// an SVG bar chart. The picked (most-likely) token is highlighted in accent.
function DistChart({ candidates, picked }) {
  const rowH = 26
  const h = candidates.length * rowH + 4
  return (
    <svg className={styles.dist} viewBox={`0 0 240 ${h}`} width="240" height={h} role="img" aria-label="Illustrative next-token probabilities; the most likely token is highlighted">
      {candidates.map(([tok, p], i) => {
        const y = i * rowH + 4
        const isPicked = tok === picked
        const w = Math.max(2, p * BAR_MAX)
        return (
          <g key={tok}>
            <text x={10} y={y + 13} fontSize={12} fontFamily={MONO} fontWeight={700} fill={isPicked ? ACCENT : INK} textAnchor="middle">{tok}</text>
            <rect x={26} y={y + 2} width={w.toFixed(1)} height={15} rx={2} fill={isPicked ? ACCENT : '#d8d4cc'} />
            <text x={26 + w + 6} y={y + 13} fontSize={10} fontFamily={MONO} fill={isPicked ? ACCENT : FADE}>{(p * 100).toFixed(0)}%</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function ModelsAndMathViz() {
  const [presetId, setPresetId] = useState('mult')
  const [step, setStep] = useState(0)

  const preset = getPreset(presetId)
  const comp = useMemo(() => computeSteps(preset), [preset])
  const picks = useMemo(() => modelPicks(preset), [preset])
  const totalSteps = Math.max(comp.steps.length, picks.length)

  const compShown = comp.steps.slice(0, Math.min(step, comp.steps.length))
  const modelShown = picks.slice(0, Math.min(step, picks.length))
  const calcDone = step >= comp.steps.length
  const modelDone = step >= picks.length
  const bothDone = calcDone && modelDone

  // distribution for the most recently predicted token (kept visible once done)
  const activeIdx = step >= 1 ? Math.min(step, picks.length) - 1 : -1
  const activeDist = activeIdx >= 0 ? preset.predict[activeIdx] : null

  const lastChipRef = useRef(null)

  // anime.js v4: pop the just-committed guess token in, so the "the model commits a
  // token" moment reads as a guess landing. Reveal is state-driven (this only
  // decorates), and stepping is user-driven, so there is no rAF-cadence to stall.
  useEffect(() => {
    if (modelShown.length > 0 && lastChipRef.current) {
      animate(lastChipRef.current, { scale: [0.4, 1], opacity: [0, 1], duration: 360, ease: 'outBack' })
    }
  }, [modelShown.length, presetId])

  const selectPreset = (id) => {
    setPresetId(id)
    setStep(0)
  }

  const controls = [
    ...PRESETS.map((p) => ({ label: p.label, onClick: () => selectPreset(p.id), active: presetId === p.id })),
    { label: 'Step', onClick: () => setStep((s) => Math.min(s + 1, totalSteps)), variant: 'primary', disabled: bothDone },
    { label: 'Reset', onClick: () => setStep(0), disabled: step === 0 },
  ]

  const predictedStr = modelShown.join('')
  const status = bothDone
    ? `The calculator computed ${comp.total}. The model predicted ${modelAnswer(preset)}: plausible, but wrong.`
    : step === 0
      ? 'Press Step to run both sides one token at a time'
      : `Step ${step} of ${totalSteps}`

  const readouts = [
    { label: 'computed', value: calcDone ? comp.total : '…' },
    { label: 'predicted', value: predictedStr ? predictedStr + (modelDone ? '' : '…') : '…' },
    { label: 'verdict', value: bothDone ? (String(comp.total) === modelAnswer(preset) ? 'match' : 'model is wrong') : '—' },
  ]

  return (
    <Figure
      eyebrow="Language models"
      title="One side computes, the other predicts"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Pick a problem and press Step. The left side runs the real algorithm in plain JavaScript and is always right. The right side imitates a language model: at each step it predicts the next answer token from a probability over likely tokens and commits the most likely one, with no arithmetic underneath. Watch it land on a plausible but wrong answer, and notice where it was nearly a coin flip. The probabilities here are hand-authored to illustrate the behavior, not drawn from a real model; the computation on the left, however, is genuinely correct."
    >
      <div className={styles.prompt}>{preset.prompt}</div>

      <div className={styles.columns}>
        {/* COMPUTE SIDE (genuinely correct) */}
        <section className={`${styles.panel} ${styles.compute}`}>
          <header className={styles.panelHead}>
            <span className={styles.panelTitle}>How a calculator does it</span>
            <span className={styles.panelSub}>runs the algorithm</span>
          </header>

          {preset.kind === 'count' && (
            <div className={styles.word} aria-hidden="true">
              {preset.word.split('').map((ch, i) => {
                const found = compShown.some((s) => s.pos === i)
                return (
                  <span key={i} className={`${styles.letter} ${found ? styles.letterHit : ''}`}>
                    {ch}
                  </span>
                )
              })}
            </div>
          )}

          <ol className={styles.computeList}>
            {compShown.map((s, i) => (
              <li key={i} className={styles.computeStep}>
                <span>{s.text}</span>
                <span className={styles.running}>{preset.kind === 'count' ? `count ${s.running}` : `total ${s.running}`}</span>
              </li>
            ))}
            {compShown.length === 0 && <li className={styles.hint}>press Step</li>}
          </ol>

          {calcDone && (
            <div className={`${styles.result} ${styles.correct}`}>
              = {comp.total} <span className={styles.badge}>&#10003; correct</span>
            </div>
          )}
        </section>

        {/* PREDICT SIDE (illustrative, plausibly wrong) */}
        <section className={`${styles.panel} ${styles.predict}`}>
          <header className={styles.panelHead}>
            <span className={styles.panelTitle}>How a language model does it</span>
            <span className={styles.panelSub}>predicts the next token</span>
          </header>

          <div className={styles.answerRow}>
            {modelShown.map((tok, i) => (
              <span key={i} ref={i === modelShown.length - 1 ? lastChipRef : null} className={styles.tokenChip}>
                {tok}
              </span>
            ))}
            {!modelDone && <span className={styles.tokenSlot}>?</span>}
            {modelShown.length === 0 && <span className={styles.hint}>press Step</span>}
          </div>

          {activeDist && (
            <div className={styles.distWrap}>
              <span className={styles.distLabel}>next-token guess</span>
              <DistChart candidates={activeDist.candidates} picked={picks[activeIdx]} />
            </div>
          )}

          {modelDone && (
            <div className={`${styles.result} ${styles.wrong}`}>
              = {modelAnswer(preset)} <span className={styles.badge}>&#10007; plausible, but wrong</span>
            </div>
          )}
        </section>
      </div>

      <p className={styles.caption}>
        The model never runs the math. It reads the prompt as tokens and predicts answer tokens from patterns it
        has seen, which is why it can be close but wrong, and why it miscounts.
      </p>
    </Figure>
  )
}
