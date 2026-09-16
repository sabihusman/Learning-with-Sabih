'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, stagger } from 'animejs'
import Figure from './Figure'
import RobotAvatar from './RobotAvatar'
import { useAnimationSpeedRef } from './animationSpeed'
import { prefersReducedMotion } from './motion'
import { BLUE, OK, AMBER } from './vizPalette'
import shared from './vizShared.module.css'
import styles from './CompositionViz.module.css'

// Three capabilities, shared by both sides. On the inheritance side each capability
// (and each combination) needs its own class; on the composition side each is a
// module you snap in. Colours are shared identity tokens (CATEGORICAL), matching
// the robot palette used across the OOP section.
const CAP_ORDER = ['Fly', 'Swim', 'Dig']
const CAP = {
  Fly: { adj: 'Flying', method: 'fly', module: 'FlightModule', color: BLUE },
  Swim: { adj: 'Swimming', method: 'swim', module: 'SwimModule', color: OK },
  Dig: { adj: 'Digging', method: 'dig', module: 'DigModule', color: AMBER },
}
const ROBOT_COLOR = OK

// Baseline flourish timings at 1x; every one divides by the shared speed multiplier.
const RIPPLE_MS = 360
const RIPPLE_STAGGER_MS = 110
const CHIP_MS = 440

const sortCaps = (caps) => CAP_ORDER.filter((c) => caps.includes(c))
const className = (caps) => sortCaps(caps).map((c) => CAP[c].adj).join('') + 'Robot'
const keyOf = (caps) => sortCaps(caps).join('+')

// the leaf classes the user can add on the inheritance side
const FLY = ['Fly']
const SWIM = ['Swim']
const FLY_SWIM = ['Fly', 'Swim']
// adding the Dig capability needs a class for Dig combined with every existing combo
const DIG_EXPLOSION = [['Dig'], ['Fly', 'Dig'], ['Swim', 'Dig'], ['Fly', 'Swim', 'Dig']]

export default function CompositionViz() {
  // INHERITANCE side: list of leaf classes (each a capability combo)
  const [leaves, setLeaves] = useState([])
  const [rippling, setRippling] = useState(false)
  const [broken, setBroken] = useState(false) // base change has rippled
  // COMPOSITION side: which modules are snapped in
  const [modules, setModules] = useState({ Fly: false, Swim: false, Dig: false })
  const [note, setNote] = useState('')

  const baseRef = useRef(null)
  const leafRefs = useRef({})
  const chipRefs = useRef({})
  const timerRef = useRef(null)

  // Stable ref to the shared animation-speed multiplier: the flourishes and the
  // ripple timer read it at fire time, so a speed change never replays one.
  const speedRef = useAnimationSpeedRef()

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const hasLeaf = (caps) => leaves.some((l) => keyOf(l) === keyOf(caps))
  const addLeaf = (caps) => {
    setBroken(false)
    setLeaves((ls) => (ls.some((l) => keyOf(l) === keyOf(caps)) ? ls : [...ls, caps]))
  }
  const addDig = () => {
    setBroken(false)
    setLeaves((ls) => {
      const next = [...ls]
      DIG_EXPLOSION.forEach((caps) => {
        if (!next.some((l) => keyOf(l) === keyOf(caps))) next.push(caps)
      })
      return next
    })
  }

  // Change something in the base Robot: a ripple cascades down every subclass and
  // the combined (duplicated) ones break. anime animates the cascade; the break
  // state is timer-driven so it lands even if rAF is throttled. Both the stagger
  // and the timer divide by the shared speed multiplier; under reduced motion the
  // stagger is skipped and the end state lands at once.
  const changeBase = () => {
    if (rippling || leaves.length === 0) return
    setBroken(false)
    if (prefersReducedMotion()) {
      setBroken(true)
      return
    }
    setRippling(true)
    const speed = speedRef.current
    const nodes = [baseRef.current, ...leaves.map((l) => leafRefs.current[keyOf(l)])].filter(Boolean)
    animate(nodes, {
      scale: [{ to: 1.06 }, { to: 1 }],
      duration: RIPPLE_MS / speed,
      delay: stagger(RIPPLE_STAGGER_MS / speed),
      ease: 'inOutQuad',
    })
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setBroken(true)
      setRippling(false)
    }, (RIPPLE_STAGGER_MS * nodes.length + RIPPLE_MS) / speed)
  }

  const toggleModule = (cap) => {
    const turningOn = !modules[cap]
    setModules((m) => ({ ...m, [cap]: !m[cap] }))
    setNote('')
    if (turningOn && chipRefs.current[cap] && !prefersReducedMotion()) {
      animate(chipRefs.current[cap], { scale: [0.5, 1], translateX: [-14, 0], duration: CHIP_MS / speedRef.current, ease: 'outBack' })
    }
  }

  const upgradeModule = () => {
    if (!modules.Fly) {
      setNote('Snap in the FlightModule first, then upgrade it.')
      return
    }
    if (chipRefs.current.Fly && !prefersReducedMotion()) {
      animate(chipRefs.current.Fly, { scale: [1, 1.14, 1], duration: CHIP_MS / speedRef.current, ease: 'inOutQuad' })
    }
    setNote('FlightModule upgraded. Only flight-capable robots change; nothing else is touched.')
  }

  const reset = () => {
    clearTimeout(timerRef.current)
    setLeaves([])
    setRippling(false)
    setBroken(false)
    setModules({ Fly: false, Swim: false, Dig: false })
    setNote('')
  }

  const moduleCount = Object.values(modules).filter(Boolean).length
  const composedCaps = sortCaps(CAP_ORDER.filter((c) => modules[c]))

  const controls = [{ label: 'Reset', onClick: reset, disabled: rippling }]

  const readouts = [
    { label: 'inheritance classes', value: 1 + leaves.length },
    { label: 'composition classes', value: 1 },
    { label: 'modules snapped in', value: moduleCount },
  ]

  const status =
    leaves.length >= 3
      ? `Inheritance: ${1 + leaves.length} classes and climbing. Composition: still 1 class, ${moduleCount} modules.`
      : 'Build the same capabilities two ways and compare how each side grows'

  return (
    <Figure
      eyebrow="Composition"
      title="Composition vs inheritance: building the same robot two ways"
      controls={controls}
      speedControl
      status={status}
      readouts={readouts}
      tryThis="Left, by inheritance: add FlyingRobot and SwimmingRobot, then a robot that does both needs its own FlyingSwimmingRobot with the flight and swim code copied in (amber dup tags). Add the Dig capability and the class count explodes, one class per combination. Press Change base class to watch a change in Robot ripple down and break the combined subclasses. Right, by composition: snap FlightModule and SwimModule into one Robot and it gains both capabilities with no new class. Upgrade a module and only that module changes. Same goal, two very different shapes."
    >
      <div className={styles.columns}>
        {/* ── INHERITANCE SIDE ──────────────────────────────────────────── */}
        <section className={styles.side}>
          <header className={styles.sideHead}>
            <span className={styles.sideTitle}>Inheritance</span>
            <span className={styles.sideTag}>is-a, one class per combination</span>
          </header>

          <div className={styles.treeArea}>
            <div ref={baseRef} className={`${styles.classBox} ${styles.base} ${broken ? styles.changed : ''}`}>
              <span className={styles.boxTag}>base</span>
              <span className={styles.boxName}>
                <RobotAvatar color={ROBOT_COLOR} size={24} title="Robot" /> Robot
              </span>
              {broken && <span className={styles.changedBadge}>changed</span>}
            </div>

            {leaves.length > 0 && (
              <div className={styles.leaves}>
                {leaves.map((caps) => {
                  const k = keyOf(caps)
                  const dup = caps.length > 1
                  const isBroken = broken && dup
                  return (
                    <div
                      key={k}
                      ref={(el) => {
                        leafRefs.current[k] = el
                      }}
                      className={`${styles.classBox} ${styles.leaf} ${isBroken ? styles.brokenBox : ''} ${broken && !dup ? styles.affectedBox : ''}`}
                    >
                      <span className={styles.boxName}>{className(caps)}</span>
                      <span className={styles.ext}>extends Robot</span>
                      <span className={styles.methods}>
                        {sortCaps(caps).map((c) => (
                          <span key={c} className={dup ? styles.dupMethod : styles.method}>
                            {CAP[c].method}(){dup ? ' dup' : ''}
                          </span>
                        ))}
                      </span>
                      {isBroken && <span className={styles.brokenBadge}>&#9888; broken</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className={styles.btnRow}>
            <button type="button" className={shared.btn} onClick={() => addLeaf(FLY)} disabled={hasLeaf(FLY)}>
              + FlyingRobot
            </button>
            <button type="button" className={shared.btn} onClick={() => addLeaf(SWIM)} disabled={hasLeaf(SWIM)}>
              + SwimmingRobot
            </button>
            <button type="button" className={shared.btn} onClick={() => addLeaf(FLY_SWIM)} disabled={hasLeaf(FLY_SWIM)}>
              + FlyingSwimmingRobot
            </button>
            <button type="button" className={shared.btn} onClick={addDig} disabled={hasLeaf(['Fly', 'Swim', 'Dig'])}>
              + add Dig capability
            </button>
            <button
              type="button"
              className={shared.btn}
              data-variant="danger"
              onClick={changeBase}
              disabled={rippling || leaves.length === 0}
            >
              Change base class
            </button>
          </div>
        </section>

        {/* ── COMPOSITION SIDE ──────────────────────────────────────────── */}
        <section className={styles.side}>
          <header className={styles.sideHead}>
            <span className={styles.sideTitle}>Composition</span>
            <span className={styles.sideTag}>has-a, snap in modules</span>
          </header>

          <div className={styles.composeArea}>
            <div className={styles.composedRobot}>
              <RobotAvatar color={ROBOT_COLOR} size={52} title="Robot with modules" />
              <span className={styles.composedName}>Robot</span>
              <span className={styles.composedCaps}>
                {composedCaps.length ? `can ${composedCaps.map((c) => CAP[c].method + '()').join(', ')}` : 'no modules yet'}
              </span>
            </div>

            <div className={styles.modules}>
              {CAP_ORDER.map((cap) => {
                const on = modules[cap]
                return (
                  <button
                    key={cap}
                    type="button"
                    ref={(el) => {
                      chipRefs.current[cap] = el
                    }}
                    onClick={() => toggleModule(cap)}
                    className={`${styles.module} ${on ? styles.moduleOn : ''}`}
                    style={on ? { borderColor: CAP[cap].color, color: CAP[cap].color } : undefined}
                    aria-pressed={on}
                  >
                    <span className={styles.moduleDot} style={{ background: on ? CAP[cap].color : 'transparent', borderColor: CAP[cap].color }} />
                    {CAP[cap].module}
                    <span className={styles.moduleState}>{on ? 'snapped in' : 'off'}</span>
                  </button>
                )
              })}
            </div>

            <button type="button" className={shared.btn} onClick={upgradeModule}>
              Upgrade FlightModule
            </button>
            {note && <p className={styles.note}>{note}</p>}
          </div>
        </section>
      </div>
    </Figure>
  )
}
