'use client'

import { useEffect, useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './IsolationLevelsViz.module.css'
import { LEVELS, PHENOMENA, buildTimeline } from './isolationData'

// Timer cadence for auto-play. setInterval + setState only (never requestAnimationFrame)
// so the timeline keeps advancing in a backgrounded tab.
const PLAY_MS = 1150

// lane colors match the sibling transaction figures
const T1_COLOR = '#2f6f8f'
const T2_COLOR = '#9a5a86'
const GREEN = '#1f6f5c'
const RED = '#c0392b'
const AMBER_FILL = '#fdf3ee'
const INK = '#1a1a1a'
const FADE = '#9b9892'

function laneStyle(status) {
  if (status === 'aborted' || status === 'rolled back' || status === 'uncommitted write') {
    return { background: AMBER_FILL, color: RED, border: `1px solid ${RED}` }
  }
  if (status === 'committed') return { background: '#e9f1ee', color: GREEN, border: `1px solid ${GREEN}` }
  if (status === 'idle') return { background: '#f4f2ec', color: FADE, border: '1px solid #e2e0d8' }
  return { background: '#ffffff', color: INK, border: '1px solid #d8d4cc' }
}

function Lane({ id, color, status, active }) {
  return (
    <div className={`${styles.lane} ${active ? styles.laneActive : ''}`}>
      <span className={styles.laneHead} style={{ color }}>
        {id}
      </span>
      <span className={styles.laneBadge} style={laneStyle(status)}>
        {status}
      </span>
    </div>
  )
}

export default function IsolationLevelsViz() {
  const [level, setLevel] = useState(1) // Read Committed, the PostgreSQL default
  const [phenKey, setPhenKey] = useState('nonrepeatable')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const run = useMemo(() => buildTimeline(phenKey, level), [phenKey, level])
  const { frames, occurs, deviation } = run
  const total = frames.length
  const done = step >= total
  const f = step > 0 ? frames[step - 1] : null
  const isPlaying = playing && !done

  // Auto-advance. Keyed on done/total so it tears down at the end and rebinds when the
  // level or phenomenon swaps the timeline. No setState in the effect body.
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
  const pickLevel = (i) => {
    setPlaying(false)
    setStep(0)
    setLevel(i)
  }
  const pickPhen = (k) => {
    setPlaying(false)
    setStep(0)
    setPhenKey(k)
  }

  const phenLabel = PHENOMENA.find((p) => p.key === phenKey).label
  const t1 = f ? f.t1 : 'idle'
  const t2 = f ? f.t2 : 'idle'
  const dbState = f ? f.db : 'idle'

  const outcomeText = done ? (occurs ? 'OCCURS' : 'PREVENTED') : '-'
  const outcomeColor = done ? (occurs ? RED : GREEN) : INK

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]

  const readouts = [
    { label: 'isolation level', value: LEVELS[level] },
    { label: 'phenomenon', value: phenLabel },
    { label: 'outcome', value: outcomeText },
    { label: 'vs SQL standard', value: deviation ? 'PG stricter here' : 'matches standard' },
  ]

  let status
  if (f) status = f.note
  else status = `Idle. Level ${LEVELS[level]}, ${phenLabel}. Step or play to run the two-transaction timeline.`

  return (
    <Figure
      eyebrow="Transactions"
      title="Isolation levels: what each one lets through"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Pick an isolation level and a phenomenon, then step through the two-transaction timeline to see whether PostgreSQL lets the phenomenon happen or prevents it. Try Non-repeatable read at Read Committed (it occurs), then raise the level to Repeatable Read (prevented). Two cells are marked PG stricter here: Dirty read at Read Uncommitted, and Phantom read at Repeatable Read. There the SQL standard allows the phenomenon but PostgreSQL prevents it anyway. Serialization anomaly is only prevented at Serializable, where PostgreSQL aborts one transaction rather than let the rule break."
    >
      <div className={styles.dials}>
        <div className={styles.dial}>
          <span className={styles.dialLabel}>isolation level</span>
          <div className={styles.segGroup} role="group" aria-label="Isolation level">
            {LEVELS.map((name, i) => (
              <button
                key={name}
                type="button"
                className={`${styles.seg} ${level === i ? styles.segActive : ''}`}
                aria-pressed={level === i}
                onClick={() => pickLevel(i)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.dial}>
          <span className={styles.dialLabel}>phenomenon</span>
          <div className={styles.segGroup} role="group" aria-label="Concurrency phenomenon">
            {PHENOMENA.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`${styles.seg} ${phenKey === p.key ? styles.segActive : ''}`}
                aria-pressed={phenKey === p.key}
                onClick={() => pickPhen(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.dbState}>
        <span className={styles.dbLabel}>database</span>
        <span className={styles.dbValue}>{dbState}</span>
      </div>

      <div className={styles.lanes}>
        <Lane id="T1" color={T1_COLOR} status={t1} active={f?.actor === 't1'} />
        <Lane id="T2" color={T2_COLOR} status={t2} active={f?.actor === 't2'} />
      </div>

      <div className={styles.script} aria-hidden="true">
        {frames.map((fr, i) => (
          <div
            key={fr.line}
            className={`${styles.scriptLine} ${i === step - 1 ? styles.scriptLineActive : ''}`}
            style={{ borderLeftColor: fr.actor === 't2' ? T2_COLOR : T1_COLOR }}
          >
            {fr.line}
          </div>
        ))}
      </div>

      {done && (
        <div className={styles.verdict} style={{ color: outcomeColor, borderColor: outcomeColor }}>
          {occurs
            ? `${phenLabel} OCCURS at ${LEVELS[level]}.`
            : `${phenLabel} is PREVENTED at ${LEVELS[level]}.`}
        </div>
      )}

      {deviation && (
        <div className={styles.deviation}>
          The SQL standard allows this here; PostgreSQL prevents it.
        </div>
      )}

      <p className={styles.note}>
        This is a scripted illustration of documented PostgreSQL behavior, not a live database. The outcomes are
        transcribed from the official PostgreSQL docs, Table 13.1. The timeline steps and numbers are hand-authored for
        clarity. PostgreSQL offers all four standard levels but implements three distinct ones internally (Read
        Uncommitted behaves like Read Committed), and it is stricter than the standard in two places: no dirty read at
        Read Uncommitted, and no phantom read at Repeatable Read.
      </p>
    </Figure>
  )
}
