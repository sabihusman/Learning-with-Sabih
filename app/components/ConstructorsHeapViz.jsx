'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import {
  CODE_LINES,
  STATES,
  LAST_STEP,
  referenceCount,
  heapObjectCount,
} from './constructorsHeapData'
import styles from './ConstructorsHeapViz.module.css'

const PLAY_MS = 1300

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 420
const VB_H = 210

// Left column: the stack frame and its variable slots.
const STACK_X = 20
const STACK_W = 150
const SLOT_X = STACK_X + 14
const SLOT_W = 122
const SLOT_H = 30
const SLOT_GAP = 12
const SLOT_TOP = 74 // first slot's y

// Right column: the heap object box.
const HEAP_X = 262
const HEAP_W = 138
const HEAP_TOP = 78
const HEAP_H = 66

const slotY = (i) => SLOT_TOP + i * (SLOT_H + SLOT_GAP)

export default function ConstructorsHeapViz() {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const state = STATES[step]
  const done = step >= LAST_STEP
  const isPlaying = playing && !done

  const svgRef = useRef(null)

  // Auto-advance with setInterval (never a rAF/anime chain) so play keeps progressing
  // in a backgrounded tab. Keyed on `done` so it tears down the instant the trace
  // finishes; the effect body only sets/clears the interval, no direct setState.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(LAST_STEP, s + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done])

  // Cosmetic flourish only: when the field mutates on the final step, pulse both
  // arrows to make "same object, two names" land. Pure animation, no state change.
  useEffect(() => {
    if (!state.highlight || !svgRef.current) return
    const nodes = Array.from(svgRef.current.querySelectorAll('[data-arrow]'))
    if (nodes.length === 0) return
    animate(nodes, {
      opacity: [1, 0.35, 1],
      duration: 620,
      ease: 'inOutQuad',
    })
  }, [step, state.highlight])

  const onStep = () => setStep((s) => Math.min(LAST_STEP, s + 1))
  const reset = () => {
    setPlaying(false)
    setStep(0)
  }

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]

  const readouts = [
    { label: 'References', value: referenceCount(state) },
    { label: 'Heap objects', value: heapObjectCount(state) },
    { label: 'step', value: `${step} / ${LAST_STEP}` },
  ]

  const heapCX = HEAP_X // left edge of the heap box (arrow target)
  const heapCY = HEAP_TOP + HEAP_H / 2

  return (
    <Figure
      eyebrow="Constructors"
      title="One object, two names"
      controls={controls}
      status={state.status}
      readouts={readouts}
      tryThis="Step to the end. Why did a.name change when the code never touched a? Because b = a copied the reference, not the object: both variables name the same box on the heap, so a change through either is a change to the one object."
    >
      <div className={styles.layout}>
        {/* The code under trace. Lines come from data as strings, rendered in a mono
            block; the active line is highlighted as each step runs. */}
        <pre className={styles.code} aria-label="Java snippet being traced">
          {CODE_LINES.map((text, i) => (
            <code
              key={text}
              className={`${styles.codeLine} ${state.line === i + 1 ? styles.codeActive : ''}`}
            >
              {text}
            </code>
          ))}
        </pre>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={styles.svg}
          role="img"
          aria-label={`Memory trace, step ${step} of ${LAST_STEP}: ${referenceCount(state)} references pointing at ${heapObjectCount(state)} heap object. ${state.status}`}
        >
          {/* arrowhead marker */}
          <defs>
            <marker id="ch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#46617e" />
            </marker>
          </defs>

          {/* ── THE STACK ─────────────────────────────────────────────── */}
          <text x={STACK_X} y={40} className={styles.panelLabel}>
            THE STACK
          </text>
          <rect
            x={STACK_X}
            y={54}
            width={STACK_W}
            height={VB_H - 74}
            rx={8}
            fill="#faf9f6"
            stroke="#e2e0d8"
            strokeWidth={1}
          />
          <text x={STACK_X + 10} y={68} className={styles.frameTag}>
            main() frame
          </text>

          {['a', 'b'].map((varName, i) => {
            const slot = state.slots.find((s) => s.name === varName)
            const present = Boolean(slot)
            const y = slotY(i)
            return (
              <g key={varName} opacity={present ? 1 : 0.28}>
                <text x={SLOT_X - 4} y={y + SLOT_H / 2 + 4} className={styles.slotName}>
                  {varName}
                </text>
                <rect
                  x={SLOT_X + 16}
                  y={y}
                  width={SLOT_W - 16}
                  height={SLOT_H}
                  rx={5}
                  fill="#fffefb"
                  stroke={slot && slot.ref ? '#46617e' : '#b9c6d8'}
                  strokeWidth={slot && slot.ref ? 1.6 : 1}
                />
                {present && !slot.ref && (
                  <text x={SLOT_X + 16 + (SLOT_W - 16) / 2} y={y + SLOT_H / 2 + 5} className={styles.dash}>
                    &ndash;
                  </text>
                )}
                {present && slot.ref && (
                  <text x={SLOT_X + 16 + (SLOT_W - 16) / 2} y={y + SLOT_H / 2 + 4} className={styles.refTag}>
                    ref
                  </text>
                )}

                {/* reference arrow from this slot to the heap object */}
                {present && slot.ref && state.heap && (
                  <line
                    data-arrow
                    x1={SLOT_X + SLOT_W}
                    y1={y + SLOT_H / 2}
                    x2={heapCX - 2}
                    y2={heapCY}
                    stroke="#46617e"
                    strokeWidth={1.6}
                    markerEnd="url(#ch-arrow)"
                  />
                )}
              </g>
            )
          })}

          {/* ── THE HEAP ──────────────────────────────────────────────── */}
          <text x={HEAP_X} y={40} className={styles.panelLabel}>
            THE HEAP
          </text>
          {state.heap ? (
            <g>
              <rect
                x={HEAP_X}
                y={HEAP_TOP}
                width={HEAP_W}
                height={HEAP_H}
                rx={8}
                fill="#ffffff"
                stroke="#46617e"
                strokeWidth={1.6}
              />
              <text x={HEAP_X + 12} y={HEAP_TOP + 22} className={styles.heapType}>
                Dog
              </text>
              <line
                x1={HEAP_X + 10}
                y1={HEAP_TOP + 30}
                x2={HEAP_X + HEAP_W - 10}
                y2={HEAP_TOP + 30}
                stroke="#e2e0d8"
                strokeWidth={1}
              />
              {/* The box exists once allocated (step 2), but the name field only
                  appears once the constructor has initialized it (step 3). */}
              {state.heap.name === null ? (
                <text x={HEAP_X + 12} y={HEAP_TOP + 50} className={styles.heapEmpty}>
                  fields uninitialized
                </text>
              ) : (
                <text x={HEAP_X + 12} y={HEAP_TOP + 50} className={styles.heapField}>
                  name ={' '}
                  <tspan className={state.highlight ? styles.heapValueHot : styles.heapValue}>
                    {`"${state.heap.name}"`}
                  </tspan>
                </text>
              )}
            </g>
          ) : (
            <text x={HEAP_X} y={HEAP_TOP + 40} className={styles.heapEmpty}>
              no object yet
            </text>
          )}
        </svg>
      </div>

      <p className={styles.caption}>
        References and heap objects are counted straight from the current step, not typed
        in by hand, so the readout always matches the picture. The trace is a fixed,
        deterministic sequence; there is no randomness.
      </p>
    </Figure>
  )
}
