'use client'

import { useRef, useState, useEffect } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import RobotAvatar from './RobotAvatar'
import { usePacedInterval } from './usePacedInterval'
import { useAnimationSpeedRef } from './animationSpeed'
import { prefersReducedMotion } from './motion'
import { BLUE, AMBER, PURPLE, LINE } from './vizPalette'
import styles from './PolymorphismViz.module.css'

// Three concrete robot types, each overriding activate(). Colors match the rest of
// the OOP section (CleaningBot blue, GuardBot amber, ChefBot purple, the robot
// mapping's identity set). The message is the exact activate() output the prose's
// Java prints.
const BOTS = {
  CleaningBot: { color: BLUE, message: 'Starting vacuum and mop', action: 'sweep' },
  GuardBot: { color: AMBER, message: 'Arming sensors and patrol route', action: 'radar' },
  ChefBot: { color: PURPLE, message: 'Preheating oven and checking recipes', action: 'heat' },
}
const INITIAL_SLOTS = ['CleaningBot', 'GuardBot', 'ChefBot']

// The action visual that plays inside a card when its robot's activate() runs. SVG +
// CSS keyframes (keyed to replay); deterministic and hand-authored per type. Under
// reduced motion the keyframes are guarded in CSS (they end at their final state),
// so no JS branch is needed here.
function ActionVisual({ action, color, playKey }) {
  if (action === 'sweep') {
    return (
      <svg viewBox="0 0 80 40" className={styles.actionSvg} aria-hidden="true">
        <line x1="6" y1="34" x2="74" y2="34" stroke={LINE} strokeWidth="1.5" />
        {[0, 1, 2, 3].map((i) => (
          <circle key={`${playKey}-${i}`} className={styles.sweepDust} style={{ animationDelay: `${i * 70}ms` }} cx={18 + i * 14} cy="30" r="2.4" fill={color} />
        ))}
      </svg>
    )
  }
  if (action === 'radar') {
    return (
      <svg viewBox="0 0 80 40" className={styles.actionSvg} aria-hidden="true">
        <circle cx="40" cy="22" r="3" fill={color} />
        {[0, 1, 2].map((i) => (
          <circle key={`${playKey}-${i}`} className={styles.radarRing} style={{ animationDelay: `${i * 220}ms` }} cx="40" cy="22" r="6" fill="none" stroke={color} strokeWidth="1.6" />
        ))}
      </svg>
    )
  }
  // heat
  return (
    <svg viewBox="0 0 80 40" className={styles.actionSvg} aria-hidden="true">
      <rect x="30" y="30" width="20" height="6" rx="1.5" fill={color} />
      {[0, 1, 2].map((i) => (
        <path
          key={`${playKey}-${i}`}
          className={styles.heatWave}
          style={{ animationDelay: `${i * 160}ms` }}
          d={`M ${33 + i * 7} 28 q 3 -5 0 -10 q -3 -5 0 -10`}
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

export default function PolymorphismViz() {
  const [slots, setSlots] = useState(INITIAL_SLOTS)
  const [running, setRunning] = useState(false)
  const [callAt, setCallAt] = useState(-1) // slot index the call is visiting
  const [reacted, setReacted] = useState({}) // slot index -> reacted
  const [playKey, setPlayKey] = useState(0) // bump to replay action visuals

  const stageRef = useRef(null)
  const tokenRef = useRef(null)
  const cardRefs = useRef([])
  const timerRef = useRef(null)
  const speedRef = useAnimationSpeedRef()

  useEffect(() => () => clearTimeout(timerRef.current), [])

  // Move the "activate()" token over card `i`. anime drives the visible travel; the
  // sequence itself is timer-driven so it completes even if rAF is throttled. Under
  // reduced motion the token jumps straight to position instead of gliding.
  const moveTokenTo = (i) => {
    const card = cardRefs.current[i]
    const token = tokenRef.current
    if (!card || !token) return
    const x = card.offsetLeft + card.offsetWidth / 2 - token.offsetWidth / 2
    const y = card.offsetTop - token.offsetHeight - 4
    if (prefersReducedMotion()) {
      token.style.transform = `translateX(${x}px) translateY(${y}px)`
      return
    }
    animate(token, { translateX: x, translateY: y, duration: 480 / speedRef.current, ease: 'inOutQuad' })
  }

  const activate = () => {
    if (running) return
    clearTimeout(timerRef.current)
    setRunning(true)
    setReacted({})
    setCallAt(-1)
    setPlayKey((k) => k + 1)
    if (tokenRef.current) tokenRef.current.style.opacity = '1'

    let i = 0
    const step = () => {
      const idx = i // snapshot: the functional updater below must not read the mutated i
      setCallAt(idx)
      moveTokenTo(idx)
      timerRef.current = setTimeout(() => {
        setReacted((r) => ({ ...r, [idx]: true }))
        i += 1
        if (i < slots.length) {
          timerRef.current = setTimeout(step, 340 / speedRef.current)
        } else {
          timerRef.current = setTimeout(() => {
            setRunning(false)
            setCallAt(-1)
          }, 650 / speedRef.current)
        }
      }, 520 / speedRef.current)
    }
    step()
  }

  // Deterministic rearrange: rotate the objects through the slots so each concrete
  // object lands in a different slot, while the declared type (Robot) stays fixed.
  const shuffle = () => {
    if (running) return
    clearTimeout(timerRef.current)
    setSlots((s) => [s[s.length - 1], ...s.slice(0, s.length - 1)])
    setReacted({})
    setCallAt(-1)
    if (tokenRef.current) tokenRef.current.style.opacity = '0'
  }

  const reset = () => {
    clearTimeout(timerRef.current)
    setSlots(INITIAL_SLOTS)
    setRunning(false)
    setReacted({})
    setCallAt(-1)
    if (tokenRef.current) tokenRef.current.style.opacity = '0'
  }

  const controls = [
    { label: 'activate()', onClick: activate, variant: 'primary', disabled: running },
    { label: 'Shuffle', onClick: shuffle, disabled: running },
    { label: 'Reset', onClick: reset, disabled: running },
  ]

  const reactedCount = Object.keys(reacted).length
  const status = running
    ? 'Broadcasting activate() to each Robot in the list ...'
    : reactedCount > 0
      ? 'Each robot ran its own activate(): behavior follows the object'
      : 'Press activate() to call the same method on every robot'

  const readouts = [
    { label: 'declared type', value: 'Robot' },
    { label: 'objects', value: slots.length },
    { label: 'dispatch', value: 'runtime (actual type)' },
  ]

  return (
    <Figure
      eyebrow="Polymorphism"
      title="One activate() call, many behaviors"
      controls={controls}
      speedControl
      status={status}
      readouts={readouts}
      tryThis="Every slot is declared as type Robot, but each holds a different concrete robot. Press activate() and the same call travels to each one, yet each runs its own overridden activate(): the CleaningBot sweeps, the GuardBot sweeps a sensor ring, the ChefBot sends up heat. Now press Shuffle to move the objects into different slots and activate() again. The behavior follows the object, not the slot or the declared Robot type. That runtime choice of which activate() to run is dynamic dispatch."
    >
      <div className={styles.loopBar}>
        <span className={styles.loopCode}>for (Robot bot : bots) bot.activate();</span>
      </div>

      <div className={styles.stage} ref={stageRef}>
        <div className={styles.row}>
          {slots.map((type, i) => {
            const bot = BOTS[type]
            const isReacted = !!reacted[i]
            return (
              <div
                key={i}
                ref={(el) => {
                  cardRefs.current[i] = el
                }}
                className={`${styles.card} ${callAt === i ? styles.active : ''} ${isReacted ? styles.reacted : ''}`}
                style={{ borderColor: isReacted ? bot.color : undefined }}
              >
                <div className={styles.declared}>
                  Robot <span className={styles.slotIdx}>[{i}]</span>
                </div>
                <RobotAvatar color={bot.color} size={44} title={`${type} robot`} />
                <div className={styles.actual} style={{ color: bot.color }}>
                  {type}
                </div>

                <div className={styles.actionStage}>
                  {isReacted && <ActionVisual action={bot.action} color={bot.color} playKey={playKey} />}
                </div>

                <div className={styles.message}>{isReacted ? bot.message : ''}</div>
              </div>
            )
          })}
        </div>

        {/* the travelling activate() call */}
        <div ref={tokenRef} className={styles.token} style={{ opacity: 0 }} aria-hidden="true">
          activate()
        </div>
      </div>
    </Figure>
  )
}
