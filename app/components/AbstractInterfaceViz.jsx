'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import { DEFAULTS, evaluate, buildDefinition } from './abstractInterfaceData'
import styles from './AbstractInterfaceViz.module.css'

// Renders one code panel from a `lines` array of { code, comment, hot, dim,
// error }. Lines are plain strings, never parsed as JSX.
function CodePanel({ title, lines, ariaLabel }) {
  return (
    <pre className={styles.code} aria-label={ariaLabel}>
      <div className={styles.codeTitle}>{title}</div>
      {lines.map((ln, i) => (
        <code
          key={`${ln.code}-${i}`}
          className={`${styles.codeLine} ${ln.hot ? styles.codeHot : ''} ${ln.dim ? styles.codeDim : ''} ${
            ln.error ? styles.codeError : ''
          } ${ln.strike ? styles.strike : ''}`}
        >
          {ln.code}
          {ln.comment ? <span className={styles.comment}>{`  ${ln.comment}`}</span> : null}
        </code>
      ))}
    </pre>
  )
}

export default function AbstractInterfaceViz() {
  const [kind, setKind] = useState(DEFAULTS.kind)
  const [implementsDoJob, setImplementsDoJob] = useState(DEFAULTS.implementsDoJob)
  const [hasBattery, setHasBattery] = useState(DEFAULTS.hasBattery)
  const [takesAlarmed, setTakesAlarmed] = useState(DEFAULTS.takesAlarmed)
  const [hasChargeBody, setHasChargeBody] = useState(DEFAULTS.hasChargeBody)
  const [triedNew, setTriedNew] = useState(DEFAULTS.triedNew)

  const state = { kind, implementsDoJob, hasBattery, takesAlarmed, hasChargeBody, triedNew }
  const verdict = evaluate(state)
  const { robotLines, guardBotLines, newLine } = buildDefinition(state)

  const verdictRef = useRef(null)

  // Cosmetic flourish only: fade the verdict in when it changes. Pure
  // animation, no state change, no onComplete chaining.
  useEffect(() => {
    if (verdictRef.current) {
      animate(verdictRef.current, { opacity: [0.3, 1], duration: 280, ease: 'outQuad' })
    }
  }, [verdict.compiles, verdict.message])

  const isDefault =
    kind === DEFAULTS.kind &&
    implementsDoJob === DEFAULTS.implementsDoJob &&
    hasBattery === DEFAULTS.hasBattery &&
    takesAlarmed === DEFAULTS.takesAlarmed &&
    hasChargeBody === DEFAULTS.hasChargeBody &&
    triedNew === DEFAULTS.triedNew

  const reset = () => {
    setKind(DEFAULTS.kind)
    setImplementsDoJob(DEFAULTS.implementsDoJob)
    setHasBattery(DEFAULTS.hasBattery)
    setTakesAlarmed(DEFAULTS.takesAlarmed)
    setHasChargeBody(DEFAULTS.hasChargeBody)
    setTriedNew(DEFAULTS.triedNew)
  }

  const controls = [{ label: 'Reset', onClick: reset, disabled: isDefault }]

  const readouts = [
    { label: 'contract', value: kind === 'abstract' ? 'abstract class' : 'interface' },
    { label: 'GuardBot', value: `${kind === 'abstract' ? 'extends' : 'implements'} ${takesAlarmed ? 'Robot, Alarmed' : 'Robot'}` },
    { label: 'verdict', value: verdict.compiles ? 'compiles' : 'does not compile' },
  ]

  return (
    <Figure
      eyebrow="Abstract classes and interfaces"
      title="Build GuardBot against a contract"
      controls={controls}
      status={verdict.message}
      readouts={readouts}
      tryThis="Every toggle below is live: nothing to step through. Start by removing doJob() from GuardBot and watch the compile error name it. Switch to interface and add battery back: it compiles, because an interface field is a constant every implementer shares, not per-object state. Switch back to abstract class and turn on Alarmed: extending two classes is illegal, but the same toggle in interface mode is fine, because a class can implement any number of interfaces. Press try new Robot() any time to see why neither kind of contract can be instantiated directly."
    >
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>contract kind</span>
        <button
          type="button"
          onClick={() => setKind('abstract')}
          aria-pressed={kind === 'abstract'}
          className={`${styles.toggle} ${kind === 'abstract' ? styles.toggleOn : ''}`}
        >
          Abstract class
        </button>
        <button
          type="button"
          onClick={() => setKind('interface')}
          aria-pressed={kind === 'interface'}
          className={`${styles.toggle} ${kind === 'interface' ? styles.toggleOn : ''}`}
        >
          Interface
        </button>
      </div>

      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>GuardBot</span>
        <button
          type="button"
          onClick={() => setImplementsDoJob((v) => !v)}
          aria-pressed={implementsDoJob}
          className={`${styles.toggle} ${implementsDoJob ? styles.toggleOn : ''}`}
        >
          {implementsDoJob ? 'implements doJob()' : 'doJob() missing'}
        </button>
        <button
          type="button"
          onClick={() => setTakesAlarmed((v) => !v)}
          aria-pressed={takesAlarmed}
          className={`${styles.toggle} ${takesAlarmed ? styles.toggleOn : ''}`}
        >
          {takesAlarmed ? 'also takes Alarmed' : 'Robot only'}
        </button>
      </div>

      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>Robot contract</span>
        <button
          type="button"
          onClick={() => setHasBattery((v) => !v)}
          aria-pressed={hasBattery}
          className={`${styles.toggle} ${hasBattery ? styles.toggleOn : ''}`}
        >
          {hasBattery ? 'battery field: yes' : 'battery field: no'}
        </button>
        <button
          type="button"
          onClick={() => setHasChargeBody((v) => !v)}
          aria-pressed={hasChargeBody}
          className={`${styles.toggle} ${hasChargeBody ? styles.toggleOn : ''}`}
        >
          {hasChargeBody ? 'charge() body: yes' : 'charge() body: no'}
        </button>
      </div>

      <div className={styles.controlRow}>
        <button type="button" onClick={() => setTriedNew(true)} disabled={triedNew} className={styles.tryNewBtn}>
          try new Robot()
        </button>
      </div>

      <div className={styles.panels}>
        <CodePanel title="Robot (the contract)" lines={robotLines} ariaLabel="The Robot contract definition" />
        <CodePanel
          title="GuardBot (the implementer)"
          lines={newLine ? [...guardBotLines, newLine] : guardBotLines}
          ariaLabel="The GuardBot class definition"
        />
      </div>

      <div
        ref={verdictRef}
        className={`${styles.verdict} ${verdict.compiles ? styles.verdictOk : styles.verdictError}`}
      >
        <span className={styles.verdictBadge}>{verdict.compiles ? '✓ compiles' : '✗ does not compile'}</span>
      </div>

      <p className={styles.caption}>
        Every verdict above is computed from the same rule function against the toggles you set; nothing is
        hand-typed per combination. The &quot;does not compile&quot; cases are simulated, the same treatment as the
        Encapsulation figure: nothing is compiled in your browser.
      </p>
    </Figure>
  )
}
