'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import {
  ACTIONS,
  LAST_STEP,
  replay,
  invariantBroken,
  formatMoney,
} from './encapsulationData'
import styles from './EncapsulationViz.module.css'

const PLAY_MS = 1300

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 440
const VB_H = 232

// Left: the account panel (balance + invariant badge).
const ACC_X = 16
const ACC_W = 176

// Right: the outside-code action list.
const CODE_X = 212
const ROW_TOP = 70
const ROW_H = 46

// The class definition, with the balance line varying by mode. Rendered as strings so
// the `<=` in the guard is never parsed as JSX.
function classLines(mode) {
  const fieldLine =
    mode === 'public'
      ? { text: 'double balance;', comment: '// anyone can write it', hot: true }
      : { text: 'private double balance;', comment: '// only withdraw() can', hot: true }
  return [
    { text: 'class BankAccount {', comment: '' },
    { text: `    ${fieldLine.text}`, comment: fieldLine.comment, hot: true },
    { text: '    void withdraw(double amount) {', comment: '' },
    { text: '        if (amount <= balance) balance -= amount;', comment: '' },
    { text: '    }', comment: '' },
    { text: '}', comment: '' },
  ]
}

export default function EncapsulationViz() {
  const [mode, setMode] = useState('public')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const { balance, outcomes } = replay(mode, step)
  const broken = invariantBroken(balance)
  const done = step >= LAST_STEP
  const isPlaying = playing && !done

  const balanceRef = useRef(null)

  // Auto-advance with setInterval (never a rAF/anime chain) so play keeps progressing
  // in a backgrounded tab. Keyed on `done` so it tears down when the run finishes; the
  // effect body only sets/clears the interval, never setState directly.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(LAST_STEP, s + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done])

  // Cosmetic flourish only: flash the balance figure when it changes. Pure animation.
  useEffect(() => {
    if (step === 0 || !balanceRef.current) return
    animate(balanceRef.current, {
      opacity: [0.3, 1],
      duration: 380,
      ease: 'outQuad',
    })
  }, [step, mode])

  const onStep = () => setStep((s) => Math.min(LAST_STEP, s + 1))
  const reset = () => {
    setPlaying(false)
    setStep(0)
  }
  // Toggling the access modifier replays the same actions from the top in the new mode.
  const toggleMode = () => {
    setPlaying(false)
    setStep(0)
    setMode((m) => (m === 'public' ? 'private' : 'public'))
  }

  const controls = [
    {
      label: mode === 'public' ? 'balance: public' : 'balance: private + withdraw()',
      onClick: toggleMode,
      active: mode === 'private',
    },
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]

  const readouts = [
    { label: 'balance', value: formatMoney(balance) },
    { label: 'invariant', value: broken ? 'BROKEN' : 'OK' },
    { label: 'step', value: `${step} / ${LAST_STEP}` },
  ]

  // Status: caption for the most recently executed action, else a lead-in.
  const status =
    step === 0
      ? 'Press Step to run three outside actions against the account.'
      : mode === 'public'
        ? ACTIONS[step - 1].statusPublic
        : ACTIONS[step - 1].statusPrivate

  const lines = classLines(mode)

  return (
    <Figure
      eyebrow="Encapsulation"
      title="The object defends itself"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Run the same three outside actions in both modes. With a public field, every write lands, including a direct assignment that forces the balance negative, so the account cannot protect its one rule. Switch to a private field with withdraw(), replay, and watch the object refuse the writes it must not allow: the direct assignment no longer compiles, and the overdraw is turned away by the guard. That is encapsulation, an object defending its own invariants."
    >
      <div className={styles.layout}>
        {/* The class under test. Lines are strings so the guard's <= is not parsed as JSX. */}
        <pre className={styles.code} aria-label="BankAccount class definition">
          {lines.map((ln) => (
            <code key={ln.text} className={`${styles.codeLine} ${ln.hot ? styles.codeHot : ''}`}>
              {ln.text}
              {ln.comment ? <span className={styles.comment}>{`  ${ln.comment}`}</span> : null}
            </code>
          ))}
        </pre>

        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={styles.svg}
          role="img"
          aria-label={`The account balance is ${formatMoney(balance)} and its invariant is ${broken ? 'broken' : 'intact'}. ${status}`}
        >
          {/* ── THE ACCOUNT ───────────────────────────────────────────── */}
          <text x={ACC_X} y={34} className={styles.panelLabel}>
            THE ACCOUNT
          </text>
          <rect
            x={ACC_X}
            y={46}
            width={ACC_W}
            height={VB_H - 66}
            rx={8}
            fill="#faf9f6"
            stroke="#e2e0d8"
            strokeWidth={1}
          />
          <text x={ACC_X + ACC_W / 2} y={82} className={styles.balanceLabel}>
            balance
          </text>
          <text
            ref={balanceRef}
            x={ACC_X + ACC_W / 2}
            y={128}
            className={styles.balance}
            fill={broken ? '#c0392b' : '#1a1a1a'}
          >
            {formatMoney(balance)}
          </text>

          {/* invariant badge */}
          <rect
            x={ACC_X + 28}
            y={150}
            width={ACC_W - 56}
            height={30}
            rx={15}
            fill={broken ? '#fbecea' : '#eaf5ef'}
            stroke={broken ? '#c0392b' : '#1f8a5b'}
            strokeWidth={1.4}
          />
          <text
            x={ACC_X + ACC_W / 2}
            y={170}
            className={styles.badge}
            fill={broken ? '#c0392b' : '#1f8a5b'}
          >
            {broken ? 'invariant BROKEN' : 'invariant OK'}
          </text>

          {/* ── OUTSIDE CODE ──────────────────────────────────────────── */}
          <text x={CODE_X} y={34} className={styles.panelLabel}>
            OUTSIDE CODE
          </text>
          {ACTIONS.map((action, i) => {
            const a = action[mode]
            const executed = i < step
            const current = i === step - 1
            const outcome = executed ? outcomes[i] : null
            const y = ROW_TOP + i * ROW_H
            const dim = !executed
            const strike = outcome === 'nocompile'
            const marker =
              outcome === 'applied'
                ? { glyph: '✓', color: mode === 'public' ? '#c0392b' : '#1f8a5b', label: 'applied' }
                : outcome === 'refused'
                  ? { glyph: '✗', color: '#1f8a5b', label: 'refused' }
                  : outcome === 'nocompile'
                    ? { glyph: '✗', color: '#9b9892', label: 'does not compile' }
                    : null
            return (
              <g key={action.id} opacity={dim ? 0.4 : 1}>
                {current && (
                  <rect x={CODE_X - 6} y={y - 16} width={VB_W - CODE_X - 4} height={ROW_H - 8} rx={5} fill="#eef3f7" />
                )}
                <text
                  x={CODE_X}
                  y={y}
                  className={`${styles.actionCode} ${strike ? styles.strike : ''}`}
                >
                  {a.code}
                </text>
                {marker && (
                  <text x={CODE_X} y={y + 17} className={styles.outcome} fill={marker.color}>
                    {`${marker.glyph} ${marker.label}`}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <p className={styles.caption}>
        The balance and the invariant are replayed from the account rules for the current
        mode and step, not typed in per frame, so the readouts always match the actions. The
        sequence is fixed and deterministic; there is no randomness.
      </p>
    </Figure>
  )
}
