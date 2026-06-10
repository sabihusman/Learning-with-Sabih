'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import RobotAvatar, { ROBOT_PALETTE } from './RobotAvatar'
import styles from './ClassesObjectsViz.module.css'

// Distinct identities for the stamped instances, so each object on the right is
// clearly its own thing (the constructor name argument varies per instance).
const NAMES = ['Bolt', 'Nova', 'Sparky', 'Pixel']
const MAX_OBJECTS = 4
const clampBattery = (v) => Math.max(0, Math.min(100, v))

export default function ClassesObjectsViz() {
  // Blueprint state: the default the constructor stamps into new instances.
  const [defaultBattery, setDefaultBattery] = useState(100)
  const [isPrivate, setIsPrivate] = useState(false)
  // The objects stamped into "object memory", each with its own field copies.
  const [objects, setObjects] = useState([])
  const [report, setReport] = useState(null) // last reportStatus() output
  const [blocked, setBlocked] = useState(null) // { id, key } transient blocked flash

  const idRef = useRef(1)
  const cardRefs = useRef({})
  const animated = useRef(new Set())

  // Animate each newly stamped card in from the blueprint (scale + drop). The card's
  // resting CSS is fully visible, so if this never runs (e.g. a backgrounded tab) the
  // object is still shown; the animation is purely additive.
  useEffect(() => {
    objects.forEach((o) => {
      if (animated.current.has(o.id)) return
      const node = cardRefs.current[o.id]
      if (node) {
        animate(node, {
          opacity: [0, 1],
          scale: [0.6, 1],
          translateY: [-16, 0],
          duration: 460,
          ease: 'outBack',
        })
        animated.current.add(o.id)
      }
    })
  }, [objects])

  const stamp = () => {
    setObjects((objs) => {
      if (objs.length >= MAX_OBJECTS) return objs
      const i = objs.length
      const id = idRef.current++
      return [...objs, { id, name: NAMES[i], color: ROBOT_PALETTE[i % ROBOT_PALETTE.length], battery: defaultBattery }]
    })
  }

  const reset = () => {
    animated.current = new Set()
    cardRefs.current = {}
    setObjects([])
    setReport(null)
    setBlocked(null)
  }

  // Direct external field write: robot.batteryLevel -= 15. Allowed when the field is
  // public; bounces off with a blocked indicator when it is private.
  const directWrite = (id) => {
    if (isPrivate) {
      setBlocked((b) => ({ id, key: (b?.key ?? 0) + 1 }))
      const node = cardRefs.current[id]
      if (node) {
        animate(node, { translateX: [0, -5, 5, -4, 4, 0], duration: 320, ease: 'outQuad' })
      }
      return
    }
    setObjects((objs) => objs.map((o) => (o.id === id ? { ...o, battery: clampBattery(o.battery - 15) } : o)))
  }

  // Method call charge(): a setter the class exposes. It works in both modes because
  // it is the class's own method, and it enforces the 0-100 rule.
  const charge = (id) => {
    setObjects((objs) => objs.map((o) => (o.id === id ? { ...o, battery: clampBattery(o.battery + 15) } : o)))
  }

  // Method call reportStatus(): reads the field through the class's own API, so it
  // works even when the field is private.
  const reportStatus = (id) => {
    setObjects((objs) => {
      const o = objs.find((x) => x.id === id)
      if (o) setReport({ id: o.id, text: `${o.name} battery: ${o.battery}%` })
      return objs
    })
  }

  const controls = [
    { label: 'new Robot(...)', onClick: stamp, variant: 'primary', disabled: objects.length >= MAX_OBJECTS },
    { label: `batteryLevel: ${isPrivate ? 'private' : 'public'}`, onClick: () => setIsPrivate((p) => !p), active: isPrivate },
    { label: 'Reset', onClick: reset, disabled: objects.length === 0 },
  ]

  const readouts = [
    { label: 'instances', value: objects.length },
    { label: 'blueprint default', value: `${defaultBattery}%` },
    { label: 'access', value: isPrivate ? 'private' : 'public' },
  ]

  const status =
    objects.length === 0
      ? 'Stamp an object off the blueprint'
      : `${objects.length} independent Robot ${objects.length === 1 ? 'object' : 'objects'} in memory`

  return (
    <Figure
      eyebrow="Classes"
      title="A class blueprint and the objects stamped from it"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="The left panel is the Robot class: a blueprint listing the fields (name, batteryLevel) and a method (reportStatus). Adjust the blueprint's default batteryLevel, then press new Robot(...) to stamp instances into object memory on the right. Each object carries its own copy of the fields, so change one robot's battery with its direct field control and the others do not move. Now flip batteryLevel to private: direct external writes bounce off as blocked, while the object's own methods (charge, reportStatus) still work. That is encapsulation: the class controls access to its own state."
    >
      <div className={styles.stage}>
        {/* CLASS BLUEPRINT */}
        <div className={styles.blueprint}>
          <div className={styles.blueprintTag}>class</div>
          <div className={styles.className}>
            <RobotAvatar size={28} dim title="Robot blueprint" />
            <span>Robot</span>
          </div>

          <div className={styles.sectionLabel}>fields</div>
          <ul className={styles.members}>
            <li className={styles.member}>
              <span className={styles.memberName}>name</span>
              <span className={styles.memberType}>String</span>
            </li>
            <li className={`${styles.member} ${isPrivate ? styles.privateMember : ''}`}>
              <span className={styles.memberName}>
                {isPrivate && <span className={styles.lock} aria-hidden="true">&#128274;</span>}
                batteryLevel
              </span>
              <span className={styles.memberType}>{isPrivate ? 'private int' : 'int'}</span>
            </li>
          </ul>

          {/* editable default that flows into every new instance */}
          <div className={styles.defaultRow}>
            <span className={styles.defaultLabel}>default</span>
            <div className={styles.stepper}>
              <button
                type="button"
                onClick={() => setDefaultBattery((v) => clampBattery(v - 10))}
                aria-label="Decrease default batteryLevel"
                disabled={defaultBattery <= 0}
              >
                &minus;
              </button>
              <span className={styles.stepperValue}>{defaultBattery}%</span>
              <button
                type="button"
                onClick={() => setDefaultBattery((v) => clampBattery(v + 10))}
                aria-label="Increase default batteryLevel"
                disabled={defaultBattery >= 100}
              >
                +
              </button>
            </div>
          </div>

          <div className={styles.sectionLabel}>methods</div>
          <ul className={styles.members}>
            <li className={styles.member}>
              <span className={styles.methodName}>reportStatus()</span>
            </li>
            {isPrivate && (
              <li className={styles.member}>
                <span className={styles.methodName}>charge()</span>
              </li>
            )}
          </ul>
        </div>

        <div className={styles.arrow} aria-hidden="true">
          <span className={styles.arrowGlyph}>&rarr;</span>
          <span className={styles.arrowLabel}>new</span>
        </div>

        {/* OBJECT MEMORY */}
        <div className={styles.memory}>
          <div className={styles.memoryLabel}>object memory</div>
          {objects.length === 0 ? (
            <div className={styles.empty}>No objects yet. Press new Robot(...) to stamp one off the blueprint.</div>
          ) : (
            <div className={styles.cards}>
              {objects.map((o) => (
                <div
                  key={o.id}
                  ref={(el) => {
                    cardRefs.current[o.id] = el
                  }}
                  className={styles.card}
                >
                  <div className={styles.cardHead}>
                    <RobotAvatar color={o.color} size={40} title={`${o.name} robot`} />
                    <div className={styles.cardId}>
                      <span className={styles.objName}>{o.name}</span>
                      <span className={styles.objType}>Robot</span>
                    </div>
                  </div>

                  <div className={styles.batteryRow}>
                    <span className={styles.batteryLabel}>
                      {isPrivate && <span className={styles.lock} aria-hidden="true">&#128274;</span>}
                      batteryLevel
                    </span>
                    <span className={styles.batteryValue}>{o.battery}%</span>
                  </div>
                  <div className={styles.batteryBar}>
                    <div className={styles.batteryFill} style={{ width: `${o.battery}%`, background: o.color }} />
                  </div>

                  {blocked && blocked.id === o.id && (
                    <div key={blocked.key} className={styles.blockedFlash}>
                      &#10007; batteryLevel is private
                    </div>
                  )}

                  <div className={styles.actions}>
                    <div className={styles.actionGroup}>
                      <span className={styles.actionLabel}>direct</span>
                      <button
                        type="button"
                        className={`${styles.actBtn} ${styles.direct} ${isPrivate ? styles.blockedBtn : ''}`}
                        onClick={() => directWrite(o.id)}
                        title="External direct field write: r.batteryLevel -= 15"
                      >
                        r.batteryLevel&minus;
                      </button>
                    </div>
                    <div className={styles.actionGroup}>
                      <span className={styles.actionLabel}>method</span>
                      <button type="button" className={styles.actBtn} onClick={() => charge(o.id)} title="r.charge()">
                        charge()
                      </button>
                      <button type="button" className={styles.actBtn} onClick={() => reportStatus(o.id)} title="r.reportStatus()">
                        reportStatus()
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.console} aria-live="polite">
            {report ? <span>&gt; {report.text}</span> : <span className={styles.consoleHint}>reportStatus() output appears here</span>}
          </div>
        </div>
      </div>
    </Figure>
  )
}
