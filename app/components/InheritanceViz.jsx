'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import RobotAvatar from './RobotAvatar'
import {
  CLASSES,
  LAYOUT,
  BOX_W,
  BOX_H,
  STAGE_W,
  STAGE_H,
  LEAF,
  LEAF_METHODS,
  ancestry,
  resolveMembers,
  boxMethods,
  lookupPath,
} from './inheritanceData'
import styles from './InheritanceViz.module.css'

const TAG_COLOR = { own: '#2c6e7f', inherited: '#9b9892', overridden: '#b07a2e' }
const TAG_LABEL = { own: 'own', inherited: 'inherited', overridden: 'overridden' }
const CLASS_NAMES = Object.keys(CLASSES)

// connector anchor points (parent bottom-centre -> child top-centre)
const bottomCenter = (name) => ({ x: LAYOUT[name].x + BOX_W / 2, y: LAYOUT[name].y + BOX_H })
const topCenter = (name) => ({ x: LAYOUT[name].x + BOX_W / 2, y: LAYOUT[name].y })

// where the lookup probe sits when checking a given class (just left of the box)
const probePos = (name) => ({ x: LAYOUT[name].x - 30, y: LAYOUT[name].y + BOX_H / 2 - 13 })

export default function InheritanceViz() {
  const [selected, setSelected] = useState(LEAF)
  const [running, setRunning] = useState(false)
  const [checking, setChecking] = useState(null) // class currently probed
  const [visited, setVisited] = useState([]) // classes already passed (not found)
  const [resolved, setResolved] = useState(null) // class where the method was found
  const [called, setCalled] = useState(null) // method name last called

  const probeRef = useRef(null)
  const timerRef = useRef(null)

  // Move the probe to a class box. anime drives the visual climb; the step sequence
  // itself is timer-driven (below) so the walk always completes even if the tab is
  // backgrounded and rAF-based animations are throttled.
  const moveProbe = (cls) => {
    const target = probePos(cls)
    if (probeRef.current) {
      animate(probeRef.current, {
        translateX: target.x,
        translateY: target.y,
        duration: 520,
        ease: 'inOutQuad',
      })
    }
  }

  const callMethod = (method) => {
    if (running) return
    const path = lookupPath(LEAF, method)
    clearTimeout(timerRef.current)
    setRunning(true)
    setResolved(null)
    setVisited([])
    setChecking(null)
    setCalled(method)
    setSelected(LEAF)
    if (probeRef.current) probeRef.current.style.opacity = '1'

    let i = 0
    const STEP_MS = 820
    const advance = () => {
      const { cls, found } = path[i]
      setChecking(cls)
      moveProbe(cls)
      timerRef.current = setTimeout(() => {
        if (found) {
          setResolved(cls)
          setChecking(null)
          setRunning(false)
        } else {
          setVisited((v) => [...v, cls])
          i += 1
          advance()
        }
      }, STEP_MS)
    }
    advance()
  }

  // tidy up a pending walk if the component unmounts mid-climb
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const reset = () => {
    clearTimeout(timerRef.current)
    setRunning(false)
    setChecking(null)
    setVisited([])
    setResolved(null)
    setCalled(null)
    setSelected(LEAF)
    if (probeRef.current) probeRef.current.style.opacity = '0'
  }

  const controls = [
    ...LEAF_METHODS.map((m) => ({ label: `${m}()`, onClick: () => callMethod(m), disabled: running })),
    { label: 'Reset', onClick: reset, disabled: running },
  ]

  const resolvedClass = resolved ? CLASSES[resolved] : null
  const resolvedIsOverride = resolved && called ? resolvedClass.overrides.includes(called) : false

  const status = running
    ? `Looking up ${called}() ... climbing from ${LEAF}`
    : resolved
      ? `${LEAF}.${called}() runs ${resolved}'s version${resolvedIsOverride ? ' (override)' : ''}`
      : 'Call a method on AttackGuardBot (the leaf) to trace the lookup'

  const readouts = [
    { label: 'selected', value: selected },
    { label: 'call site', value: LEAF },
    { label: 'resolved in', value: resolved || '—' },
  ]

  const detail = resolveMembers(selected)

  const boxState = (name) => {
    if (resolved === name) return styles.found
    if (checking === name) return styles.checking
    if (visited.includes(name)) return styles.passed
    if (selected === name) return styles.selected
    return ''
  }

  return (
    <Figure
      eyebrow="Inheritance"
      title="A robot family tree and the method-lookup walk"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Click any class to see its members color-coded: green for members defined on that class (own), amber for a method it overrides from a parent, grey for members inherited unchanged. Then call a method on AttackGuardBot, the leaf, and watch the lookup walk climb the chain. attack() is found right on the leaf. move() is not on the leaf or GuardBot, so the walk climbs all the way to Robot. reportStatus() is overridden on GuardBot, so the walk stops there and never reaches Robot's version. That early stop is why an override wins."
    >
      <div className={styles.legend}>
        {['own', 'overridden', 'inherited'].map((t) => (
          <span key={t} className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: TAG_COLOR[t] }} />
            {TAG_LABEL[t]}
          </span>
        ))}
      </div>

      <div className={styles.wrap}>
        <div className={styles.stageScroll}>
          <div className={styles.stage} style={{ width: STAGE_W, height: STAGE_H }}>
            {/* connector lines behind the boxes */}
            <svg className={styles.lines} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} width={STAGE_W} height={STAGE_H} aria-hidden="true">
              {CLASS_NAMES.filter((n) => CLASSES[n].parent).map((n) => {
                const a = bottomCenter(CLASSES[n].parent)
                const b = topCenter(n)
                return <path key={n} d={`M ${a.x} ${a.y} C ${a.x} ${(a.y + b.y) / 2}, ${b.x} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`} fill="none" stroke="#d4d0c8" strokeWidth={1.5} />
              })}
            </svg>

            {/* class boxes */}
            {CLASS_NAMES.map((name) => {
              const c = CLASSES[name]
              const bm = boxMethods(name)
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelected(name)}
                  className={`${styles.box} ${boxState(name)}`}
                  style={{ left: LAYOUT[name].x, top: LAYOUT[name].y, width: BOX_W, height: BOX_H }}
                  aria-pressed={selected === name}
                >
                  <span className={styles.boxTag}>class</span>
                  <span className={styles.boxHead}>
                    <RobotAvatar color={c.color} size={26} title={`${name} robot`} />
                    <span className={styles.boxName}>{name}</span>
                  </span>
                  {c.parent ? (
                    <span className={styles.extends}>extends {c.parent}</span>
                  ) : (
                    <span className={styles.base}>base class</span>
                  )}
                  <span className={styles.boxMembers}>
                    {c.fields.map((f) => (
                      <span key={f} className={styles.chipField}>{f}</span>
                    ))}
                    {bm.map((m) => (
                      <span key={m.name} className={styles.chipMethod} style={{ color: TAG_COLOR[m.tag] }}>
                        {m.tag === 'overridden' ? '↻' : '+'}
                        {m.name}()
                      </span>
                    ))}
                  </span>
                  {checking === name && <span className={styles.badgeChecking}>checking</span>}
                  {resolved === name && <span className={styles.badgeFound}>&#10003; found</span>}
                  {visited.includes(name) && resolved !== name && <span className={styles.badgePassed}>&#10007; not here</span>}
                </button>
              )
            })}

            {/* lookup probe */}
            <div ref={probeRef} className={styles.probe} style={{ opacity: 0 }} aria-hidden="true">
              {called ? `${called}()` : '?'}
            </div>
          </div>
        </div>

        {/* member detail for the selected class */}
        <div className={styles.detail}>
          <div className={styles.detailHead}>
            <RobotAvatar color={CLASSES[selected].color} size={30} title={`${selected} robot`} />
            <div>
              <div className={styles.detailName}>{selected}</div>
              <div className={styles.detailParent}>
                {CLASSES[selected].parent ? `extends ${CLASSES[selected].parent}` : 'base class'}
              </div>
            </div>
          </div>

          <div className={styles.detailSection}>fields</div>
          <ul className={styles.memberList}>
            {detail.fields.map((f) => (
              <li key={f.name} className={styles.memberItem}>
                <span className={styles.dot} style={{ background: TAG_COLOR[f.tag] }} />
                <span className={styles.memberName}>{f.name}</span>
                <span className={styles.memberTag} style={{ color: TAG_COLOR[f.tag] }}>{TAG_LABEL[f.tag]}</span>
              </li>
            ))}
          </ul>

          <div className={styles.detailSection}>methods</div>
          <ul className={styles.memberList}>
            {detail.methods.map((m) => (
              <li key={m.name} className={styles.memberItem}>
                <span className={styles.dot} style={{ background: TAG_COLOR[m.tag] }} />
                <span className={styles.memberName}>{m.name}()</span>
                <span className={styles.memberTag} style={{ color: TAG_COLOR[m.tag] }}>
                  {m.tag === 'inherited' ? `inherited from ${m.from}` : TAG_LABEL[m.tag]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Figure>
  )
}
