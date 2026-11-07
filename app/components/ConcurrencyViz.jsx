'use client'

import { useState } from 'react'
import Figure from './Figure'
import ChoiceGroup from './ChoiceGroup'
import { usePacedInterval } from './usePacedInterval'
import {
  CORRECT,
  INC,
  MODES,
  ORDERS,
  START,
  TXS,
  canStep,
  initialState,
  isBlocked,
  isDone,
  modeOf,
  scheduledTx,
  step,
} from './concurrencyData'
import { BLUE, PURPLE } from './vizPalette'
import shared from './vizShared.module.css'
import styles from './ConcurrencyViz.module.css'

const PLAY_MS = 1050
const TX_COLOR = { T1: BLUE, T2: PURPLE }

function laneState(state, t) {
  const x = state.tx[t]
  if (x.done) return { label: 'committed', tone: 'ok' }
  if (isBlocked(state, t)) return { label: `waiting for ${t === 'T1' ? 'T2' : 'T1'}'s row lock`, tone: 'wait' }
  if (state.lock === t) return { label: 'holds the row lock', tone: 'ok' }
  if (x.pc === 0) return { label: x.retries ? 'starting again' : 'not started', tone: 'idle' }
  return { label: 'running', tone: 'idle' }
}

function varsLine(x) {
  const parts = []
  if (x.vars.balance !== undefined) parts.push(`:balance = ${x.vars.balance}`)
  if (x.vars.version !== undefined) parts.push(`:version = ${x.vars.version}`)
  return parts.length ? parts.join(', ') : 'no values read yet'
}

function Lane({ t, state }) {
  const x = state.tx[t]
  const script = modeOf(state.mode).script
  const ls = laneState(state, t)
  const active = state.last?.tx === t
  return (
    <div className={`${styles.lane} ${active ? styles.laneActive : ''}`} data-testid={`cc-lane-${t}`} data-state={ls.tone}>
      <div className={styles.laneTop}>
        <span className={styles.laneHead} style={{ color: TX_COLOR[t] }}>
          {t}
        </span>
        <span className={`${styles.badge} ${styles[`badge_${ls.tone}`]}`}>{ls.label}</span>
      </div>
      <ol className={styles.sql}>
        <li className={styles.sqlDone}>BEGIN;</li>
        {script.map((st, i) => {
          let cls = styles.sqlTodo
          if (x.done || i < x.pc) cls = styles.sqlDone
          else if (i === x.pc) cls = isBlocked(state, t) ? styles.sqlWait : styles.sqlNext
          return (
            <li key={i} className={cls} data-current={!x.done && i === x.pc ? 'true' : undefined}>
              {st.sql}
            </li>
          )
        })}
      </ol>
      <div className={styles.varsLine}>{varsLine(x)}</div>
      {x.rows !== null && <div className={styles.varsLine}>{`rows affected: ${x.rows}`}</div>}
      {x.pending && <div className={styles.pending}>{`uncommitted write: balance ${x.pending.balance}`}</div>}
      {x.retries > 0 && <div className={styles.varsLine}>{`retries: ${x.retries}`}</div>}
    </div>
  )
}

export default function ConcurrencyViz() {
  const [state, setState] = useState(() => initialState('naive'))
  const [order, setOrder] = useState('interleaved')
  const [tick, setTick] = useState(0)
  const [playing, setPlaying] = useState(false)

  const done = isDone(state)
  const isPlaying = playing && !done
  const mode = modeOf(state.mode)

  usePacedInterval(isPlaying, PLAY_MS, () => {
    setState((s) => (isDone(s) ? s : step(s, scheduledTx(s, order, tick))))
    setTick((n) => n + 1)
  })

  const restart = (modeId) => {
    setPlaying(false)
    setTick(0)
    setState(initialState(modeId))
  }

  const controls = [
    { label: 'Step T1', onClick: () => setState((s) => step(s, 'T1')), variant: 'primary', disabled: playing || !canStep(state, 'T1') },
    { label: 'Step T2', onClick: () => setState((s) => step(s, 'T2')), disabled: playing || !canStep(state, 'T2') },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: () => restart(state.mode), disabled: state.steps === 0 && !state.last },
  ]

  const correct = done && state.committed.balance === CORRECT
  const retries = state.tx.T1.retries + state.tx.T2.retries
  const readouts = [
    { label: 'committed balance', value: state.committed.balance },
    { label: 'row lock', value: state.lock ?? 'free' },
    ...TXS.map((t) => ({ label: t, value: laneState(state, t).label })),
    { label: 'retries', value: retries },
    { label: 'final balance', value: done ? `${state.committed.balance}${correct ? ' correct' : ' lost update'}` : '-' },
  ]

  let status
  if (state.last) status = state.last.note
  else status = `Both transactions add ${INC} to a balance of ${START}, so the right answer is ${CORRECT}. Choose the order yourself with Step T1 and Step T2, or press Play.`
  if (done) {
    status = correct
      ? `Both committed. Final balance ${state.committed.balance}: both increments applied${retries ? `, after ${retries} retry` : ''}.`
      : `Both committed. Final balance ${state.committed.balance}, not ${CORRECT}: one update was lost, and no error was raised.`
  }

  return (
    <Figure
      eyebrow="Transactions"
      title="Two transactions, one balance"
      controls={controls}
      speedControl
      status={status}
      readouts={readouts}
      tryThis="Run the unprotected mode and find the exact step where the loss becomes inevitable: it is the second read, not the second write. Then run the version check and watch the second write match zero rows. The bug was born at the stale read; every fix is a way of closing that gap."
    >
      <ChoiceGroup label="each transaction adds 50 by" options={MODES} value={state.mode} onChange={restart} testPrefix="cc-mode" />
      <ChoiceGroup
        label="Play order"
        options={ORDERS}
        value={order}
        onChange={(o) => {
          setOrder(o)
          restart(state.mode)
        }}
        testPrefix="cc-order"
      />

      <div className={styles.row} data-testid="cc-row">
        <span className={styles.rowLabel}>accounts, id = 1 (committed)</span>
        <span className={styles.balanceValue} data-testid="cc-balance">
          {state.committed.balance}
        </span>
        {mode.id === 'optimistic' && <span className={styles.rowMeta}>{`version ${state.committed.version}`}</span>}
        <span className={styles.rowMeta}>{`row lock: ${state.lock ?? 'free'}`}</span>
        <span className={styles.rowMeta}>{`correct final = ${CORRECT}`}</span>
      </div>

      <div className={styles.lanes}>
        {TXS.map((t) => (
          <Lane key={t} t={t} state={state} />
        ))}
      </div>

      {done && (
        <div className={`${styles.verdict} ${correct ? styles.verdictGood : styles.verdictBad}`} data-testid="cc-verdict">
          {correct ? `Final balance ${state.committed.balance}. Both increments applied.` : `Final balance ${state.committed.balance}, not ${CORRECT}. An update was lost.`}
        </div>
      )}

      <p className={shared.caption}>
        Real arithmetic on fixed numbers (start 100, each transaction adds 50, correct total 200). You pick the
        interleaving: run the transactions one after the other and every mode lands on 200; overlap them, both reading
        before either writes, and read, then write lands on 150 while the three fixes land on 200. In real systems the
        overlap is timing-dependent and does not always occur, which is exactly what makes the bug dangerous.
      </p>
    </Figure>
  )
}
