'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import { useAnimationSpeedRef } from './animationSpeed'
import { prefersReducedMotion } from './motion'
import { DEFAULTS, evaluate, buildDefinition } from './abstractInterfaceData'
import styles from './AbstractInterfaceViz.module.css'
import shared from './vizShared.module.css'

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
  const speedRef = useAnimationSpeedRef()

  // Cosmetic flourish only: fade the verdict in when it changes. Pure
  // animation, no state change, no onComplete chaining. Duration follows the
  // shared speed multiplier; under reduced motion the end state is applied
  // immediately and the fade is skipped.
  useEffect(() => {
    if (!verdictRef.current) return
    if (prefersReducedMotion()) {
      verdictRef.current.style.opacity = 1
      return
    }
    animate(verdictRef.current, { opacity: [0.3, 1], duration: 280 / speedRef.current, ease: 'outQuad' })
  }, [verdict.compiles, verdict.message, speedRef])

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
      <div className={shared.group}>
        <span className={shared.groupLabel}>contract kind</span>
        <button type="button" onClick={() => setKind('abstract')} aria-pressed={kind === 'abstract'} className={shared.btn}>
          Abstract class
        </button>
        <button type="button" onClick={() => setKind('interface')} aria-pressed={kind === 'interface'} className={shared.btn}>
          Interface
        </button>
      </div>

      <div className={shared.group}>
        <span className={shared.groupLabel}>GuardBot</span>
        <button type="button" onClick={() => setImplementsDoJob((v) => !v)} aria-pressed={implementsDoJob} className={shared.btn}>
          {implementsDoJob ? 'implements doJob()' : 'doJob() missing'}
        </button>
        <button type="button" onClick={() => setTakesAlarmed((v) => !v)} aria-pressed={takesAlarmed} className={shared.btn}>
          {takesAlarmed ? 'also takes Alarmed' : 'Robot only'}
        </button>
      </div>

      <div className={shared.group}>
        <span className={shared.groupLabel}>Robot contract</span>
        <button type="button" onClick={() => setHasBattery((v) => !v)} aria-pressed={hasBattery} className={shared.btn}>
          {hasBattery ? 'battery field: yes' : 'battery field: no'}
        </button>
        <button type="button" onClick={() => setHasChargeBody((v) => !v)} aria-pressed={hasChargeBody} className={shared.btn}>
          {hasChargeBody ? 'charge() body: yes' : 'charge() body: no'}
        </button>
      </div>

      <div className={shared.group}>
        <button
          type="button"
          onClick={() => setTriedNew(true)}
          disabled={triedNew}
          className={shared.btn}
          data-variant="danger"
        >
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

      <p className={shared.caption}>
        Every verdict above is computed from the same rule function against the toggles you set; nothing is
        hand-typed per combination. The &quot;does not compile&quot; cases are simulated, the same treatment as the
        Encapsulation figure: nothing is compiled in your browser.
      </p>
    </Figure>
  )
}
