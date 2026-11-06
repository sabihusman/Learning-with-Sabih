'use client'

import { useMemo, useState } from 'react'
import Figure from './Figure'
import ChoiceGroup from './ChoiceGroup'
import { usePacedInterval } from './usePacedInterval'
import {
  DB_ID,
  DEFAULT_POLICIES,
  HTTP_MAX_AGE_S,
  LAST_STEP,
  LATENCY_LABEL,
  POLICIES,
  READER_NAME,
  REDIS_TTL_S,
  RESOURCES,
  STREAM,
  headerFor,
  hitRate,
  simulate,
  statusFor,
} from './cachingLayersData'
import shared from './vizShared.module.css'
import styles from './CachingLayersViz.module.css'

// One read per tick at 1x; the shared speed control scales it.
const PLAY_MS = 900

const PATH = Object.fromEntries(RESOURCES.map((r) => [r.id, r.path]))
const SHORT = { logo: 'logo', profile: 'me', prices: 'prices' }

// Each box: which layer it is, its rule, and its latency label.
const BOXES = [
  { id: 'browser:ana', title: "Ana's browser", kind: 'browser', rule: 'stores a response if its header allows (public or private)' },
  { id: 'browser:ben', title: "Ben's browser", kind: 'browser', rule: 'stores a response if its header allows (public or private)' },
  { id: 'cdn', title: 'CDN, shared by every reader', kind: 'cdn', rule: 'stores public responses only' },
  { id: 'redis', title: 'Redis, next to the app', kind: 'redis', rule: `the app's cache: filled after a database read, TTL ${REDIS_TTL_S} s` },
  { id: DB_ID, title: 'Database', kind: 'database', rule: 'always has the answer' },
]

const entryLabel = (key) => {
  const [res, reader] = key.split(':')
  return reader ? `${PATH[res]} (${READER_NAME[reader]})` : PATH[res]
}

function markFor(box, state) {
  if (!state.read) return null
  const served = state.servedBy === 'browser' ? `browser:${state.read.reader}` : state.servedBy
  if (box.id === served) return { tone: 'served', text: 'served this read' }
  if (state.stored.includes(box.id)) return { tone: 'stored', text: 'stored a copy' }
  if (state.refused.includes(box.id)) return { tone: 'refused', text: `did not store: ${headerFor(state.policy)}` }
  return null
}

export default function CachingLayersViz() {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [policies, setPolicies] = useState(DEFAULT_POLICIES)

  const states = useMemo(() => simulate(policies), [policies])
  const state = states[step]
  const done = step >= LAST_STEP
  const isPlaying = playing && !done

  usePacedInterval(isPlaying, PLAY_MS, () => setStep((s) => Math.min(LAST_STEP, s + 1)))

  const controls = [
    { label: 'Step', onClick: () => setStep((s) => Math.min(LAST_STEP, s + 1)), disabled: done, variant: 'primary' },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    {
      label: 'Reset',
      onClick: () => {
        setPlaying(false)
        setStep(0)
      },
      disabled: step === 0,
    },
  ]

  const readouts = [
    { label: 'browser', value: state.counts.browser },
    { label: 'CDN', value: state.counts.cdn },
    { label: 'Redis', value: state.counts.redis },
    { label: 'database', value: state.counts.database },
    { label: 'hit rate', value: `${hitRate(state)}%` },
    { label: 'private data leaked', value: state.leaks },
  ]

  return (
    <Figure
      eyebrow="Caching layers"
      title="Who keeps a copy, and why"
      controls={controls}
      status={statusFor(state)}
      readouts={readouts}
      speedControl
      tryThis="Step to read 5: Redis serves /api/prices, and still nothing above it keeps a copy, because the response says no-store. Then set /api/prices to public and step again: the CDN and the browsers start serving it, and Redis goes quiet. Finally set /api/me to public and watch the CDN hand Ana's profile to Ben."
    >
      <div className={styles.policies}>
        {RESOURCES.map((r) => (
          <ChoiceGroup
            key={r.id}
            label={`${r.path} Cache-Control`}
            options={POLICIES}
            value={policies[r.id]}
            onChange={(p) => setPolicies((prev) => ({ ...prev, [r.id]: p }))}
            testPrefix={`policy-${r.id}`}
          />
        ))}
        <p className={styles.policyNote}>{`public and private responses carry max-age=${HTTP_MAX_AGE_S}.`}</p>
      </div>

      <ol className={styles.stream} aria-label="Read stream">
        {STREAM.map((read, i) => {
          const n = i + 1
          const past = n <= step
          return (
            <li
              key={n}
              className={`${styles.token} ${n === step ? styles.current : ''} ${past ? styles.past : ''}`}
              data-served={past ? states[n].servedBy : undefined}
              title={`${READER_NAME[read.reader]} reads ${PATH[read.res]} at t=${read.t} s`}
            >
              {`${READER_NAME[read.reader][0]}:${SHORT[read.res]}`}
            </li>
          )
        })}
      </ol>
      <div className={styles.clock}>{state.read ? `read ${step} of ${LAST_STEP}, t = ${state.t} s` : `0 of ${LAST_STEP} reads`}</div>

      <div className={styles.stack}>
        {BOXES.map((box) => {
          const mark = markFor(box, state)
          const entries = box.id === DB_ID ? null : state.contents[box.id]
          const leakHere = box.id === 'cdn' && state.leakedFrom
          return (
            <section
              key={box.id}
              className={`${styles.box} ${styles[box.kind]} ${mark ? styles[mark.tone] : ''}`}
              data-testid={`box-${box.id}`}
              data-mark={mark?.tone}
            >
              <header className={styles.boxHead}>
                <span className={styles.boxTitle}>{box.title}</span>
                <span className={styles.latency}>{LATENCY_LABEL[box.kind]}</span>
              </header>
              <div className={styles.rule}>{box.rule}</div>
              {entries && (
                <ul className={styles.entries} data-testid={`entries-${box.id}`}>
                  {entries.length === 0 && <li className={styles.empty}>empty</li>}
                  {entries.map((e) => (
                    <li key={e.key}>
                      {entryLabel(e.key)} <span className={styles.ttl}>{`${e.secondsLeft} s left`}</span>
                    </li>
                  ))}
                </ul>
              )}
              {mark && <div className={styles.mark}>{mark.text}</div>}
              {leakHere && <div className={styles.leak}>{`served ${READER_NAME[state.leakedFrom]}'s private data to ${READER_NAME[state.read.reader]}`}</div>}
            </section>
          )
        })}
      </div>

      <p className={shared.caption}>
        Browsers and the CDN cache HTTP responses, and only as the response&apos;s Cache-Control header allows; Redis
        is the application&apos;s own cache, filled after a database read. A Redis hit therefore never puts anything in
        a browser or the CDN by itself. The read stream and the three resources are hand-written; every outcome is
        computed. Latencies are typical lookup costs, shown as labels.
      </p>
    </Figure>
  )
}
