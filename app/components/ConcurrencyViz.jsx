'use client'

import { useEffect, useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './ConcurrencyViz.module.css'

// Two transactions, T1 and T2, both add INC to the same shared balance. The correct
// final balance is START + 2*INC. Everything below is real integer arithmetic on these
// fixed numbers: the buggy interleaving genuinely lands on 150 because T2 writes from a
// stale read, and the locked interleaving genuinely lands on 200. No randomness, no
// fabricated results.
const START = 100
const INC = 50
const CORRECT = START + 2 * INC // 200
const PLAY_MS = 1050

// palette (shared project tokens, matching the SQL-section figures)
const GREEN = '#1f6f5c'
const RED = '#c0392b'
const AMBER_FILL = '#fdf3ee'
const INK = '#1a1a1a'
const FADE = '#9b9892'

const STATE_LABEL = {
  idle: 'idle',
  read: 'read',
  locked: 'holding lock',
  waiting: 'waiting for lock',
  committed: 'committed',
}

// Build the ordered interleaving for one mode. The script lists the steps in the exact
// order they happen across BOTH transactions (the interleaving is the whole point); each
// frame carries the resulting shared balance and each transaction's state and last-read
// value. All numbers are computed here from START/INC, not written in by hand.
function buildRun(locking) {
  if (!locking) {
    // one specific bad interleaving that loses T1's update
    const t1Write = START + INC // 150
    const t2Write = START + INC // 150, because T2 also read the ORIGINAL 100
    return {
      script: [
        'T1: read balance',
        'T2: read balance   (before T1 has written)',
        'T1: write balance = read + 50, then commit',
        'T2: write balance = read + 50, then commit',
      ],
      frames: [
        {
          balance: START,
          t1: { state: 'read', read: START },
          t2: { state: 'idle', read: null },
          actor: 't1',
          idx: 0,
          note: `T1 reads the balance: ${START}.`,
        },
        {
          balance: START,
          t1: { state: 'read', read: START },
          t2: { state: 'read', read: START },
          actor: 't2',
          idx: 1,
          note: `T2 reads the balance too, before T1 has written anything, so it also sees ${START}. This stale read is the seed of the bug.`,
        },
        {
          balance: t1Write,
          t1: { state: 'committed', read: START },
          t2: { state: 'read', read: START },
          actor: 't1',
          idx: 2,
          note: `T1 writes ${START} + ${INC} = ${t1Write} and commits.`,
        },
        {
          balance: t2Write,
          t1: { state: 'committed', read: START },
          t2: { state: 'committed', read: START, stale: true },
          actor: 't2',
          idx: 3,
          done: true,
          note: `T2 writes ${START} + ${INC} = ${t2Write}, using the stale ${START} it read earlier. It overwrites T1's update. The final balance is ${t2Write}, not ${CORRECT}. T1's increment was lost.`,
        },
      ],
    }
  }

  // locking: T2 must wait for T1 to commit, then reads the updated value
  const t1Write = START + INC // 150
  const t2Write = t1Write + INC // 200
  return {
    script: [
      'T1: read balance, hold lock on the row',
      'T2: read balance -> blocked, wait for the lock',
      'T1: write balance = read + 50, commit, release lock',
      'T2: lock acquired, read the updated balance',
      'T2: write balance = read + 50, then commit',
    ],
    frames: [
      {
        balance: START,
        t1: { state: 'locked', read: START },
        t2: { state: 'idle', read: null },
        actor: 't1',
        idx: 0,
        note: `T1 reads the balance (${START}) and holds a lock on the row so no one else can change it.`,
      },
      {
        balance: START,
        t1: { state: 'locked', read: START },
        t2: { state: 'waiting', read: null },
        actor: 't2',
        idx: 1,
        note: 'T2 wants the same row, but T1 holds the lock. T2 waits instead of reading a stale value.',
      },
      {
        balance: t1Write,
        t1: { state: 'committed', read: START },
        t2: { state: 'waiting', read: null },
        actor: 't1',
        idx: 2,
        note: `T1 writes ${START} + ${INC} = ${t1Write} and commits, releasing the lock.`,
      },
      {
        balance: t1Write,
        t1: { state: 'committed', read: START },
        t2: { state: 'read', read: t1Write },
        actor: 't2',
        idx: 3,
        note: `T2 stops waiting, takes the lock, and reads the updated balance: ${t1Write}.`,
      },
      {
        balance: t2Write,
        t1: { state: 'committed', read: START },
        t2: { state: 'committed', read: t1Write },
        actor: 't2',
        idx: 4,
        done: true,
        note: `T2 writes ${t1Write} + ${INC} = ${t2Write} and commits. Both increments are applied, so the balance is ${t2Write}. Correct.`,
      },
    ],
  }
}

function badge(state) {
  if (state === 'waiting') return { background: AMBER_FILL, color: RED, border: `1px solid ${RED}` }
  if (state === 'committed' || state === 'locked') return { background: '#e9f1ee', color: GREEN, border: `1px solid ${GREEN}` }
  if (state === 'read') return { background: '#ffffff', color: INK, border: '1px solid #d8d4cc' }
  return { background: '#f4f2ec', color: FADE, border: '1px solid #e2e0d8' }
}

function Lane({ id, tx, active }) {
  const b = badge(tx.state)
  const stale = tx.stale
  return (
    <div className={`${styles.lane} ${active ? styles.laneActive : ''}`}>
      <div className={styles.laneHead}>{id}</div>
      <span className={styles.badge} style={b}>
        {STATE_LABEL[tx.state]}
      </span>
      <div className={styles.readLine} style={stale ? { color: RED } : undefined}>
        read: {tx.read === null ? '-' : tx.read}
        {stale ? ' (stale)' : ''}
      </div>
    </div>
  )
}

export default function ConcurrencyViz() {
  const [locking, setLocking] = useState(false)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const run = useMemo(() => buildRun(locking), [locking])
  const total = run.frames.length
  const done = step >= total
  const f = step > 0 ? run.frames[step - 1] : null
  const isPlaying = playing && !done

  // Auto-advance with setInterval (never requestAnimationFrame) so the interleaving keeps
  // progressing in a backgrounded tab. Keyed on done/total so it tears down at the end and
  // rebinds when the mode toggle swaps the script. No setState in the effect body.
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
  const setMode = (v) => {
    setPlaying(false)
    setStep(0)
    setLocking(v)
  }

  const balance = f ? f.balance : START
  const t1 = f ? f.t1 : { state: 'idle', read: null }
  const t2 = f ? f.t2 : { state: 'idle', read: null }
  const finished = done && f
  const correct = finished && balance === CORRECT

  const balanceColor = finished ? (correct ? GREEN : RED) : INK

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]

  const finalReadout = finished ? (correct ? `${balance} correct` : `${balance} wrong (lost update)`) : '-'
  const readouts = [
    { label: 'shared balance', value: balance },
    { label: 'T1', value: t1.read === null ? STATE_LABEL[t1.state] : `${STATE_LABEL[t1.state]}, read ${t1.read}` },
    { label: 'T2', value: t2.read === null ? STATE_LABEL[t2.state] : `${STATE_LABEL[t2.state]}, read ${t2.read}` },
    { label: 'final balance', value: finalReadout },
  ]

  let status
  if (f) {
    status = f.note
  } else if (locking) {
    status = 'Idle. With locking: T2 will wait for T1 to commit, then read the updated balance. Step or play.'
  } else {
    status = 'Idle. No protection: this one interleaving lets T2 overwrite T1 with a stale read. Step or play.'
  }

  return (
    <Figure
      eyebrow="Transactions"
      title="Two transactions, one balance, a lost update"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Both T1 and T2 add 50 to a balance that starts at 100, so the right answer is 200. With No protection, step through one bad interleaving: T1 and T2 both read 100, T1 writes 150, then T2 writes 150 from the stale 100 it read, overwriting T1. One update is lost and the balance ends at 150. Switch to With locking and step again: T2 has to wait until T1 commits, then reads the updated 150 and writes 200. This is one specific ordering chosen to make the bug visible; in a real system it is timing-dependent and does not always happen, which is what makes it dangerous."
    >
      <div className={styles.controls}>
        <span className={styles.label}>mode</span>
        <div className={styles.modeGroup} role="group" aria-label="Concurrency mode">
          <button type="button" className={`${styles.modeBtn} ${!locking ? styles.modeActive : ''}`} aria-pressed={!locking} onClick={() => setMode(false)}>
            No protection
          </button>
          <button type="button" className={`${styles.modeBtn} ${locking ? styles.modeActive : ''}`} aria-pressed={locking} onClick={() => setMode(true)}>
            With locking
          </button>
        </div>
      </div>

      <div className={styles.balanceBox} style={{ borderColor: balanceColor }}>
        <span className={styles.balanceLabel}>shared balance</span>
        <span className={styles.balanceValue} style={{ color: balanceColor }}>
          {balance}
        </span>
        <span className={styles.balanceGoal}>correct final = {CORRECT}</span>
      </div>

      <div className={styles.lanes}>
        <Lane id="T1" tx={t1} active={f?.actor === 't1'} />
        <Lane id="T2" tx={t2} active={f?.actor === 't2'} />
      </div>

      <div className={styles.script} aria-hidden="true">
        {run.script.map((line, i) => {
          const isT2 = line.startsWith('T2')
          return (
            <div key={line} className={`${styles.scriptLine} ${i === (step - 1) ? styles.scriptLineActive : ''}`} style={{ borderLeftColor: isT2 ? '#9a5a86' : '#2f6f8f' }}>
              {line}
            </div>
          )
        })}
      </div>

      {finished && (
        <div className={styles.verdict} style={{ color: correct ? GREEN : RED, borderColor: correct ? GREEN : RED }}>
          {correct
            ? `Final balance ${balance}. Both increments applied.`
            : `Final balance ${balance}, not ${CORRECT}. T1's update was lost.`}
        </div>
      )}

      <p className={styles.note}>
        The balances are real arithmetic on fixed numbers (start {START}, each transaction adds {INC}, correct total{' '}
        {CORRECT}). No protection really lands on {START + INC} because T2 writes from a stale read; with locking it
        really lands on {CORRECT}. The buggy run is one specific interleaving chosen to make the lost update visible; in
        real systems it is timing-dependent and does not always occur. The lock and wait are shown as concepts, not as
        specific SQL syntax.
      </p>
    </Figure>
  )
}
