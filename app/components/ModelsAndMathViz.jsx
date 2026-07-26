'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import {
  MULT_MIN,
  MULT_MAX,
  MULT_DEFAULT_A,
  MULT_DEFAULT_B,
  parseOperand,
  clampOperand,
  COUNT_PRESET,
  computeSteps,
  getPredict,
  modelPicks,
  modelAnswer,
} from './modelsAndMathData'
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
  const [mode, setMode] = useState('mult')
  const [step, setStep] = useState(0)

  // Operand state is always a valid clamped integer; the *Text state is only
  // what the two inputs display, so a field can sit empty or mid-edit without
  // ever pushing an invalid value into computeSteps.
  const [a, setA] = useState(MULT_DEFAULT_A)
  const [b, setB] = useState(MULT_DEFAULT_B)
  const [aText, setAText] = useState(String(MULT_DEFAULT_A))
  const [bText, setBText] = useState(String(MULT_DEFAULT_B))

  // Clamping happens on change, not just on blur: an out-of-range value like
  // "5000" snaps its field straight to "999" as soon as it parses, rather
  // than lingering out of range until the reader looks away.
  const commitOperand = (raw, setNum, setText) => {
    const parsed = parseOperand(raw)
    if (parsed == null) return false
    const clamped = clampOperand(parsed)
    setNum(clamped)
    setText(String(clamped))
    return true
  }
  const onAChange = (e) => {
    const raw = e.target.value
    setAText(raw)
    if (commitOperand(raw, setA, setAText)) setStep(0)
  }
  const onBChange = (e) => {
    const raw = e.target.value
    setBText(raw)
    if (commitOperand(raw, setB, setBText)) setStep(0)
  }
  // On blur, snap the field back to the last committed value: an empty or
  // invalid draft never lingers on screen once the reader looks away.
  const onABlur = () => setAText(String(a))
  const onBBlur = () => setBText(String(b))

  const preset = useMemo(
    () => (mode === 'count' ? COUNT_PRESET : { kind: 'mult', prompt: `${a} × ${b} = ?`, a, b }),
    [mode, a, b]
  )
  const comp = useMemo(() => computeSteps(preset), [preset])
  const predict = useMemo(() => getPredict(preset, comp), [preset, comp])
  const picks = useMemo(() => modelPicks(predict), [predict])
  const totalSteps = Math.max(comp.steps.length, picks.length)

  const compShown = comp.steps.slice(0, Math.min(step, comp.steps.length))
  const modelShown = picks.slice(0, Math.min(step, picks.length))
  const calcDone = step >= comp.steps.length
  const modelDone = step >= picks.length
  const bothDone = calcDone && modelDone
  const modelCorrect = bothDone && modelAnswer(predict) === String(comp.total)

  // distribution for the most recently predicted token (kept visible once done)
  const activeIdx = step >= 1 ? Math.min(step, picks.length) - 1 : -1
  const activeDist = activeIdx >= 0 ? predict[activeIdx] : null

  const lastChipRef = useRef(null)

  // anime.js v4: pop the just-committed guess token in, so the "the model commits a
  // token" moment reads as a guess landing. Reveal is state-driven (this only
  // decorates), and stepping is user-driven, so there is no rAF-cadence to stall.
  useEffect(() => {
    if (modelShown.length > 0 && lastChipRef.current) {
      animate(lastChipRef.current, { scale: [0.4, 1], opacity: [0, 1], duration: 360, ease: 'outBack' })
    }
  }, [modelShown.length, mode])

  const selectMode = (id) => {
    setMode(id)
    setStep(0)
  }

  const controls = [
    { label: 'Multiply', onClick: () => selectMode('mult'), active: mode === 'mult' },
    { label: COUNT_PRESET.label, onClick: () => selectMode('count'), active: mode === 'count' },
    { label: 'Step', onClick: () => setStep((s) => Math.min(s + 1, totalSteps)), variant: 'primary', disabled: bothDone },
    { label: 'Reset', onClick: () => setStep(0), disabled: step === 0 },
  ]

  const predictedStr = modelShown.join('')
  const status = bothDone
    ? `The calculator computed ${comp.total}. The model predicted ${modelAnswer(predict)}: ${modelCorrect ? 'correct this time' : 'plausible, but wrong'}.`
    : step === 0
      ? 'Press Step to run both sides one token at a time'
      : `Step ${step} of ${totalSteps}`

  const readouts = [
    { label: 'computed', value: calcDone ? comp.total : '…' },
    { label: 'predicted', value: predictedStr ? predictedStr + (modelDone ? '' : '…') : '…' },
    { label: 'verdict', value: bothDone ? (modelCorrect ? 'match' : 'model is wrong') : '—' },
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

      {mode === 'mult' && (
        <div className={styles.operandsRow}>
          <label className={styles.operandLabel}>
            <span>a</span>
            <input
              type="number"
              inputMode="numeric"
              min={MULT_MIN}
              max={MULT_MAX}
              step={1}
              value={aText}
              onChange={onAChange}
              onBlur={onABlur}
              className={styles.operandInput}
              aria-label={`First operand, an integer from ${MULT_MIN} to ${MULT_MAX}`}
            />
          </label>
          <span className={styles.operandTimes} aria-hidden="true">×</span>
          <label className={styles.operandLabel}>
            <span>b</span>
            <input
              type="number"
              inputMode="numeric"
              min={MULT_MIN}
              max={MULT_MAX}
              step={1}
              value={bText}
              onChange={onBChange}
              onBlur={onBBlur}
              className={styles.operandInput}
              aria-label={`Second operand, an integer from ${MULT_MIN} to ${MULT_MAX}`}
            />
          </label>
        </div>
      )}

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
            <div className={`${styles.result} ${modelCorrect ? styles.correct : styles.wrong}`}>
              = {modelAnswer(predict)}{' '}
              <span className={styles.badge}>
                {modelCorrect ? <>&#10003; correct this time</> : <>&#10007; plausible, but wrong</>}
              </span>
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
