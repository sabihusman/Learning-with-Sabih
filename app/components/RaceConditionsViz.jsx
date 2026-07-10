'use client'

import { useEffect, useState } from 'react'
import Figure from './Figure'
import {
  START,
  CORRECT,
  STEPS,
  initialState,
  isDone,
  applyStep,
  applyLockedStep,
  CLEAN,
  INTERLEAVED,
} from './raceConditionsData'
import styles from './RaceConditionsViz.module.css'

const PLAY_MS = 900
const PATTERNS = { clean: CLEAN, interleaved: INTERLEAVED }

function stepLabel(pc) {
  return pc >= STEPS.length ? 'done' : STEPS[pc]
}

function ThreadLane({ id, thread, holdsLock }) {
  const finished = thread.pc >= STEPS.length
  return (
    <div className={`${styles.lane} ${holdsLock ? styles.laneLocked : ''}`}>
      <div className={styles.laneHead}>{`thread ${id}`}</div>
      <span className={`${styles.badge} ${finished ? styles.badgeDone : ''}`}>{stepLabel(thread.pc)}</span>
      <div className={styles.registerLine}>register: {thread.register === null ? '-' : thread.register}</div>
      {holdsLock && <div className={styles.lockLine}>holds lock</div>}
    </div>
  )
}

export default function RaceConditionsViz() {
  const [run, setRun] = useState(() => ({ race: initialState(), tick: 0 }))
  const [playing, setPlaying] = useState(false)
  const [lockEnabled, setLockEnabled] = useState(false)
  const [pattern, setPattern] = useState('interleaved')

  const { race } = run
  const done = isDone(race)
  const threadA = race.threads.A
  const threadB = race.threads.B
  const idle = threadA.pc === 0 && threadB.pc === 0

  // Auto-advance with setInterval (never requestAnimationFrame), so a paused/backgrounded
  // tab still catches up on resume. Keyed on done/lockEnabled/pattern so it tears down at
  // the end and rebinds when a toggle swaps the run; each tick reads fresh state through
  // the functional setState updater, so there is no stale-closure drift. No setState in
  // the effect body itself.
  useEffect(() => {
    if (!playing || done) return undefined
    const order = PATTERNS[pattern]
    const id = setInterval(() => {
      setRun((prev) => {
        if (isDone(prev.race)) return prev
        const threadId = order[prev.tick % order.length]
        const stepFn = lockEnabled ? applyLockedStep : applyStep
        return { race: stepFn(prev.race, threadId), tick: prev.tick + 1 }
      })
    }, PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done, lockEnabled, pattern])

  const stepManual = (threadId) => {
    const stepFn = lockEnabled ? applyLockedStep : applyStep
    setRun((prev) => ({ race: stepFn(prev.race, threadId), tick: prev.tick }))
  }

  const reset = () => {
    setPlaying(false)
    setRun({ race: initialState(), tick: 0 })
  }

  const setLock = (value) => {
    setPlaying(false)
    setRun({ race: initialState(), tick: 0 })
    setLockEnabled(value)
  }

  const setPatternMode = (value) => {
    setPlaying(false)
    setRun({ race: initialState(), tick: 0 })
    setPattern(value)
  }

  const blockedA = lockEnabled && race.lock !== null && race.lock !== 'A'
  const blockedB = lockEnabled && race.lock !== null && race.lock !== 'B'
  const disabledA = threadA.pc >= STEPS.length || blockedA || playing
  const disabledB = threadB.pc >= STEPS.length || blockedB || playing

  const correct = done && race.balance === CORRECT

  const controls = [
    { label: 'Step A', onClick: () => stepManual('A'), disabled: disabledA },
    { label: 'Step B', onClick: () => stepManual('B'), disabled: disabledB },
    { label: playing ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: idle && run.tick === 0 },
  ]

  const readouts = [
    { label: 'shared balance', value: race.balance },
    {
      label: 'thread A',
      value: `${stepLabel(threadA.pc)}${threadA.register === null ? '' : `, register ${threadA.register}`}`,
    },
    {
      label: 'thread B',
      value: `${stepLabel(threadB.pc)}${threadB.register === null ? '' : `, register ${threadB.register}`}`,
    },
    { label: 'final balance', value: done ? `${race.balance}${correct ? ' correct' : ' lost update'}` : '-' },
  ]

  let status
  if (idle) {
    status = lockEnabled
      ? 'Idle. With the lock on, whichever thread reads first holds it until it writes back. Step or play.'
      : 'Idle. No lock: step A and B by hand, or auto-play a preset order, and watch whether an update survives.'
  } else if (done) {
    status = correct
      ? `Both threads finished. Final balance ${race.balance}, both increments applied.`
      : `Both threads finished. Final balance ${race.balance}, not ${CORRECT}. An update was lost.`
  } else if (race.lock) {
    status = `Thread ${race.lock} holds the lock and is mid-sequence; the other thread cannot step until it writes back.`
  } else {
    status = 'In progress. Keep stepping or watch auto-play to see how this interleaving resolves.'
  }

  return (
    <Figure
      eyebrow="Race Conditions"
      title="Two threads, one shared balance"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Turn the lock off, then auto-play the Interleaved order: both threads read 100 before either writes, so one thread's +1 overwrites the other and the balance lands on 101, not 102. Switch to the Clean order and it lands on 102, since A finishes before B ever reads. Now turn the lock on and try the Interleaved order again: the second thread that tries to read is blocked until the first thread finishes writing, so it always ends at 102, no matter which order you press Step A and Step B in."
    >
      <div className={styles.controlsRow}>
        <span className={styles.groupLabel}>lock</span>
        <button
          type="button"
          className={`${styles.btn} ${!lockEnabled ? styles.btnOn : ''}`}
          aria-pressed={!lockEnabled}
          onClick={() => setLock(false)}
        >
          off
        </button>
        <button
          type="button"
          className={`${styles.btn} ${lockEnabled ? styles.btnOn : ''}`}
          aria-pressed={lockEnabled}
          onClick={() => setLock(true)}
        >
          on
        </button>

        <span className={styles.groupLabel} style={{ marginLeft: 8 }}>
          auto-play order
        </span>
        <button
          type="button"
          className={`${styles.btn} ${pattern === 'clean' ? styles.btnOn : ''}`}
          aria-pressed={pattern === 'clean'}
          onClick={() => setPatternMode('clean')}
        >
          clean
        </button>
        <button
          type="button"
          className={`${styles.btn} ${pattern === 'interleaved' ? styles.btnOn : ''}`}
          aria-pressed={pattern === 'interleaved'}
          onClick={() => setPatternMode('interleaved')}
        >
          interleaved
        </button>
      </div>

      <div className={styles.balanceBox}>
        <span className={styles.balanceLabel}>shared balance</span>
        <span className={styles.balanceValue}>{race.balance}</span>
        <span className={styles.balanceGoal}>correct final = {CORRECT}</span>
      </div>

      <div className={styles.lanes}>
        <ThreadLane id="A" thread={threadA} holdsLock={race.lock === 'A'} />
        <ThreadLane id="B" thread={threadB} holdsLock={race.lock === 'B'} />
      </div>

      {done && (
        <div className={`${styles.verdict} ${correct ? styles.verdictGood : styles.verdictBad}`}>
          {correct
            ? `Final balance ${race.balance}. Both increments applied.`
            : `Final balance ${race.balance}, not ${CORRECT}. An update was lost.`}
        </div>
      )}

      <p className={styles.note}>
        The balance and each register are real state (start {START}, each thread adds 1, correct total {CORRECT}).
        Every number above comes from actually folding READ/ADD/WRITE steps over that state in whatever order you
        step or auto-play; the lock works by refusing a blocked thread&apos;s step, not by swapping in a different
        animation. This models one shared variable and two threads; real races involve many threads, CPU caches,
        and instruction reordering not shown here.
      </p>
    </Figure>
  )
}
