'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import {
  TYPE,
  CHECKLIST,
  LAST_STEP,
  mustImplement,
  canTake,
} from './abstractInterfaceData'
import styles from './AbstractInterfaceViz.module.css'

const PLAY_MS = 1300

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 470
const ROWS_TOP = 46
const ROW_H = 42
const ROW_H_TALL = 58 // rows that carry an extra sub-line (count, instantiate)
const MARK_X = 10
const TEXT_X = 34

const VERDICT = {
  yes: { glyph: '✓', color: '#1f8a5b' }, // check
  no: { glyph: '✗', color: '#c0392b' }, // cross
  partial: { glyph: '~', color: '#b8860b' },
  one: { glyph: '1', color: '#46617e' },
  many: { glyph: '∞', color: '#46617e' }, // infinity
}

// Precompute each row's y and height so the taller rows (with a sub-line) get room.
function rowLayout() {
  let y = ROWS_TOP
  return CHECKLIST.map((row) => {
    const tall = Boolean(row.subAbstract || row.strikeCode)
    const h = tall ? ROW_H_TALL : ROW_H
    const top = y
    y += h
    return { top, h, tall }
  })
}
const LAYOUT = rowLayout()
const VB_H = ROWS_TOP + LAYOUT.reduce((s, r) => s + r.h, 0) + 6

export default function AbstractInterfaceViz() {
  const [mode, setMode] = useState('abstract')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const done = step >= LAST_STEP
  const isPlaying = playing && !done

  const svgRef = useRef(null)

  // Auto-advance with setInterval (never a rAF/anime chain) so play keeps progressing
  // in a backgrounded tab. Keyed on `done` so it tears down when the checklist finishes;
  // the effect body only sets/clears the interval, never setState directly.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(LAST_STEP, s + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done])

  // Cosmetic flourish only: when the mode flips, fade the checklist column in so the
  // switched verdicts register. Pure animation, no state change.
  useEffect(() => {
    if (!svgRef.current) return
    const col = svgRef.current.querySelector('[data-verdicts]')
    if (col) animate(col, { opacity: [0.35, 1], duration: 320, ease: 'outQuad' })
  }, [mode])

  const onStep = () => setStep((s) => Math.min(LAST_STEP, s + 1))
  const reset = () => {
    setPlaying(false)
    setStep(0)
  }
  // Toggling the contract kind keeps the current step, so you can stop on a row (e.g.
  // row 4) and flip modes to watch just that verdict change.
  const toggleMode = () => setMode((m) => (m === 'abstract' ? 'interface' : 'abstract'))

  const modeLabel = mode === 'abstract' ? 'abstract class Robot' : 'interface Robot'
  const take = canTake(mode)

  const controls = [
    { label: mode === 'abstract' ? 'abstract class' : 'interface', onClick: toggleMode, active: mode === 'interface' },
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]

  const readouts = [
    { label: 'must implement', value: mustImplement(mode) },
    { label: 'extend / implement', value: take.value },
    { label: 'row', value: `${step} / ${LAST_STEP}` },
  ]

  const status =
    step === 0
      ? 'Press Step to reveal what this kind of contract can and cannot carry.'
      : mode === 'abstract'
        ? CHECKLIST[step - 1].statusAbstract
        : CHECKLIST[step - 1].statusInterface

  return (
    <Figure
      eyebrow="Abstract classes and interfaces"
      title="Two kinds of contract"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Step through the checklist for an abstract class, then use the toggle to switch the same Robot to an interface and watch the verdicts change. Pause on row 4: an abstract class can only be extended by one class, but a class can implement many interfaces, so GuardBot can implement Robot and Alarmed at once. Both kinds force implementers to provide doJob(), and neither can be created with new. The difference is what else the contract is allowed to carry."
    >
      <div className={styles.layout}>
        {/* The Robot type definition, changing with the mode. Lines are strings so the
            braces and comments are never parsed as JSX. */}
        <pre className={styles.code} aria-label={`${modeLabel} definition`}>
          {TYPE[mode].lines.map((ln, i) => (
            <code
              key={`${ln.code}-${i}`}
              className={`${styles.codeLine} ${ln.hot ? styles.codeHot : ''} ${ln.dim ? styles.codeDim : ''}`}
            >
              {ln.code}
              {ln.comment ? <span className={styles.comment}>{`  ${ln.comment}`}</span> : null}
            </code>
          ))}
        </pre>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={styles.svg}
          role="img"
          aria-label={`Contract comparison for ${modeLabel}. Must implement ${mustImplement(mode)} method; a class can take on ${take.value} ${take.word}. ${status}`}
        >
          <text x={MARK_X} y={26} className={styles.header}>
            {modeLabel}
          </text>
          <line x1={MARK_X} y1={34} x2={VB_W - 10} y2={34} stroke="#e2e0d8" strokeWidth={1} />

          <g data-verdicts>
            {CHECKLIST.map((row, i) => {
              const revealed = i < step
              const lay = LAYOUT[i]
              const v = row[mode]
              const mark = VERDICT[v.verdict]
              const sub = mode === 'abstract' ? row.subAbstract : row.subInterface
              const y = lay.top
              return (
                <g key={row.id} opacity={revealed ? 1 : 0.28}>
                  <text x={MARK_X} y={y + 14} className={styles.mark} fill={mark.color}>
                    {mark.glyph}
                  </text>
                  <text x={TEXT_X} y={y + 14} className={styles.label}>
                    {row.label}
                  </text>
                  <text x={TEXT_X} y={y + 30} className={styles.note} fill={mark.color}>
                    {v.note}
                  </text>
                  {/* row 4: the concrete implementer declaration for this mode */}
                  {sub && (
                    <text x={TEXT_X} y={y + 46} className={styles.sub}>
                      {sub}
                    </text>
                  )}
                  {/* row 5: the simulated does-not-compile instantiation */}
                  {row.strikeCode && (
                    <text x={TEXT_X} y={y + 46} className={styles.strikeRow}>
                      <tspan className={styles.strike}>{row.strikeCode}</tspan>
                      <tspan className={styles.doesNotCompile}>{'  does not compile'}</tspan>
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      <p className={styles.caption}>
        The must-implement count and the extend-or-implement limit are read from the type
        definition for the current mode, not typed in per row, so the readouts always match
        the contract shown. The checklist is a fixed, deterministic sequence; the
        does-not-compile row is simulated, not a live compiler.
      </p>
    </Figure>
  )
}
