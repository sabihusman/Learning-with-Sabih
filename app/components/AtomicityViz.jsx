'use client'

import { useEffect, useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './AtomicityViz.module.css'

// Fixed starting numbers. Everything below is real integer arithmetic on these, so a
// rolled-back transaction literally restores A to A_START and the total to the start
// total. No randomness, no fabricated values.
const A_START = 100
const B_START = 0
const AMOUNT = 40
const START_TOTAL = A_START + B_START
const PLAY_MS = 950

// palette (shared project tokens, matching the SQL-section figures)
const GREEN = '#1f6f5c'
const GREEN_FILL = '#e9f1ee'
const AMBER_FILL = '#fdf3ee'
const AMBER_STROKE = '#c0392b'
const IDLE_FILL = '#fffefb'
const IDLE_STROKE = '#e2e0d8'
const INK = '#1a1a1a'
const FADE = '#9b9892'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

// Build the ordered statements for one transaction. Each frame carries the resulting
// balances, so stepping is just reading the next frame; the numbers are precomputed
// here by real subtraction/addition, not derived on the fly in the view.
function buildFrames(failAfterDebit) {
  const debited = A_START - AMOUNT // 60
  const credited = B_START + AMOUNT // 40
  const begin = {
    line: 'BEGIN;',
    a: A_START,
    b: B_START,
    state: 'running',
    note: 'Transaction begins. The database keeps enough information to undo these changes if anything fails.',
  }
  const debit = {
    line: "UPDATE accounts SET balance = balance - 40 WHERE id = 'A';",
    a: debited,
    b: B_START,
    state: 'running',
    note: 'Step 1 of 2: debit 40 from A. Inside the transaction A now reads 60.',
  }
  if (!failAfterDebit) {
    return [
      begin,
      debit,
      {
        line: "UPDATE accounts SET balance = balance + 40 WHERE id = 'B';",
        a: debited,
        b: credited,
        state: 'running',
        note: 'Step 2 of 2: credit 40 to B. Both halves of the transfer have now run.',
      },
      {
        line: 'COMMIT;',
        a: debited,
        b: credited,
        state: 'committed',
        note: 'Both steps succeeded, so the transaction commits. The transfer is permanent and the total is still 100.',
      },
    ]
  }
  return [
    begin,
    debit,
    {
      line: '-- failure after step 1, before step 2',
      a: debited,
      b: B_START,
      state: 'error',
      note: 'A failure hits before B is credited. Only half the transfer happened: 40 left A and reached no one, so the total reads 60. Without atomicity this broken state could stick.',
    },
    {
      line: 'ROLLBACK;',
      a: A_START,
      b: B_START,
      state: 'rolledback',
      note: 'Atomicity: the transaction rolls back, undoing step 1. A is restored to 100, B is untouched, and the total is back to 100. All-or-nothing.',
    },
  ]
}

function stateLabel(state) {
  if (state === 'running') return 'running'
  if (state === 'committed') return 'committed'
  if (state === 'error') return 'error (uncommitted)'
  if (state === 'rolledback') return 'rolled back'
  return 'idle'
}

function idleStatus(failAfterDebit) {
  if (failAfterDebit) {
    return 'Idle. Fail after debit is ON: stepping will run the debit, hit a failure, then roll back.'
  }
  return 'Idle. Step or play to run BEGIN, debit A, credit B, COMMIT.'
}

// Pure colour derivation, kept out of the component so the render body stays simple.
function accountColors(aChanged, bChanged, broken) {
  return {
    aFill: aChanged ? AMBER_FILL : IDLE_FILL,
    aStroke: aChanged ? AMBER_STROKE : IDLE_STROKE,
    bFill: bChanged ? GREEN_FILL : IDLE_FILL,
    bStroke: bChanged ? GREEN : IDLE_STROKE,
    totalFill: broken ? AMBER_FILL : GREEN_FILL,
    totalStroke: broken ? AMBER_STROKE : GREEN,
    totalText: broken ? AMBER_STROKE : GREEN,
  }
}

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 300
const VB_H = 150
const CARD_W = 112
const CARD_H = 72
const AX = 16
const BX = 172
const CARD_Y = 16
const MIDY = CARD_Y + CARD_H / 2
const TOTAL_X = 80
const TOTAL_Y = 108
const TOTAL_W = 140
const TOTAL_H = 28
const SVG_STYLE = { maxWidth: 460 }

export default function AtomicityViz() {
  const [failAfterDebit, setFailAfterDebit] = useState(false)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const frames = useMemo(() => buildFrames(failAfterDebit), [failAfterDebit])
  const total = frames.length
  const done = step >= total
  const f = step > 0 ? frames[step - 1] : null
  const isPlaying = playing && !done

  // Auto-advance with setInterval (never requestAnimationFrame) so the sequence keeps
  // progressing in a backgrounded tab. Keyed on `done`/`total` so it tears down at the
  // end and rebinds when the fail toggle swaps the script. No setState in the body.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(total, s + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done, total])

  const onStep = () => setStep((s) => Math.min(total, s + 1))
  const reset = () => {
    setPlaying(false)
    setStep(0)
  }
  const toggleFail = () => {
    setPlaying(false)
    setStep(0)
    setFailAfterDebit((v) => !v)
  }

  const a = f ? f.a : A_START
  const b = f ? f.b : B_START
  const runningTotal = a + b
  const state = f ? f.state : 'idle'
  const broken = runningTotal !== START_TOTAL
  const aChanged = a !== A_START
  const bChanged = b !== B_START
  const c = accountColors(aChanged, bChanged, broken)
  const arrowColor = bChanged ? GREEN : FADE
  const activeIndex = step - 1

  // The two account cards are identical markup with different data, so render them
  // from a small config to keep one copy of the card.
  const cards = [
    { key: 'A', x: AX, label: 'Account A', balance: a, changed: aChanged, fill: c.aFill, stroke: c.aStroke, delta: `-${AMOUNT}`, deltaColor: AMBER_STROKE },
    { key: 'B', x: BX, label: 'Account B', balance: b, changed: bChanged, fill: c.bFill, stroke: c.bStroke, delta: `+${AMOUNT}`, deltaColor: GREEN },
  ]

  let status
  if (f) {
    status = f.note
  } else {
    status = idleStatus(failAfterDebit)
  }

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]

  const readouts = [
    { label: 'account A', value: a },
    { label: 'account B', value: b },
    { label: 'total (A + B)', value: runningTotal },
    { label: 'transaction', value: stateLabel(state) },
  ]

  const ariaLabel = `Account A holds ${a} and account B holds ${b}, for a total of ${runningTotal}. Transaction state: ${stateLabel(state)}.`

  return (
    <Figure
      eyebrow="Transactions"
      title="A transfer is all-or-nothing"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Run it with fail after debit off: step through BEGIN, the debit, the credit, and COMMIT. A drops to 60, B rises to 40, and the total stays 100 the whole way. Now turn fail after debit on and step again. The debit runs, then the failure hits before the credit, so the total briefly reads 60, money that has left A and reached no one. Watch ROLLBACK undo the debit and restore A to 100, with the total back to 100."
    >
      <div className={styles.controls}>
        <div className={styles.line}>
          <span className={styles.label}>fail after debit</span>
          <button
            type="button"
            className={`${styles.toggle} ${failAfterDebit ? styles.toggleOn : ''}`}
            aria-pressed={failAfterDebit}
            onClick={toggleFail}
          >
            {failAfterDebit ? 'on' : 'off'}
          </button>
        </div>
      </div>

      <div className={styles.plotWrap}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={styles.svg} style={SVG_STYLE} role="img" aria-label={ariaLabel}>
          {/* transfer arrow A -> B */}
          <line x1={AX + CARD_W} y1={MIDY} x2={BX} y2={MIDY} stroke={arrowColor} strokeWidth={1.5} strokeDasharray="3 3" />
          <path d={`M ${BX - 6} ${MIDY - 4} L ${BX} ${MIDY} L ${BX - 6} ${MIDY + 4} Z`} fill={arrowColor} />
          <text x={(AX + CARD_W + BX) / 2} y={MIDY - 6} fontSize={9} fill={FADE} fontFamily={MONO} textAnchor="middle">
            {AMOUNT}
          </text>

          {/* Account cards (A and B share one markup block) */}
          {cards.map((cd) => (
            <g key={cd.key}>
              <rect x={cd.x} y={CARD_Y} width={CARD_W} height={CARD_H} rx={6} fill={cd.fill} stroke={cd.stroke} strokeWidth={1.4} className={styles.card} />
              <text x={cd.x + 10} y={CARD_Y + 18} fontSize={10} fill={FADE} fontFamily={MONO} letterSpacing="0.04em">
                {cd.label}
              </text>
              <text x={cd.x + CARD_W / 2} y={CARD_Y + 48} fontSize={26} fill={INK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                {cd.balance}
              </text>
              {cd.changed && (
                <text x={cd.x + CARD_W / 2} y={CARD_Y + 64} fontSize={11} fill={cd.deltaColor} fontFamily={MONO} textAnchor="middle">
                  {cd.delta}
                </text>
              )}
            </g>
          ))}

          {/* total pill */}
          <rect x={TOTAL_X} y={TOTAL_Y} width={TOTAL_W} height={TOTAL_H} rx={14} fill={c.totalFill} stroke={c.totalStroke} strokeWidth={1.4} className={styles.card} />
          <text x={TOTAL_X + 16} y={TOTAL_Y + TOTAL_H / 2 + 4} fontSize={10} fill={FADE} fontFamily={MONO} letterSpacing="0.04em">
            total
          </text>
          <text x={TOTAL_X + TOTAL_W - 16} y={TOTAL_Y + TOTAL_H / 2 + 5} fontSize={16} fill={c.totalText} fontFamily={MONO} fontWeight={700} textAnchor="end">
            {runningTotal}
          </text>
        </svg>
      </div>

      <div className={styles.script} aria-hidden="true">
        {frames.map((fr, i) => (
          <div key={fr.line} className={`${styles.scriptLine} ${i === activeIndex ? styles.scriptLineActive : ''}`}>
            {fr.line}
          </div>
        ))}
      </div>

      <p className={styles.note}>
        The transfer, the failure, and the rollback are real integer arithmetic on the fixed starting balances
        (A = {A_START}, B = {B_START}, transfer {AMOUNT}). A rolled-back transaction restores A to {A_START} exactly, so
        the total returns to {START_TOTAL}. The example is kept to one tiny two-step transfer to make the all-or-nothing
        rule visible; real transactions can span many statements and tables, but the atomicity guarantee is the same.
      </p>
    </Figure>
  )
}
