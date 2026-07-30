'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import { useAnimationSpeed } from './animationSpeed'
import {
  LAYERS,
  DB_ID,
  LATENCY_LABEL,
  STREAM,
  LAST_STEP,
  STATES,
  hitRate,
  statusFor,
} from './cachingLayersData'
import styles from './CachingLayersViz.module.css'

// Baseline durations at 1x. Every timing in the figure (Play tick, fast-run
// tick, and every animation keyframe) is divided by the shared animation-speed
// multiplier (animationSpeed.js), so 0.5x runs everything twice as slow in
// lockstep and 1.5x speeds everything up. Because the whole sequence and the
// tick scale by the same factor, the per-step sequence (longest path ~610ms at
// 1x) fits inside one Play tick (700ms at 1x) at every speed.
const PLAY_MS = 700
const FAST_MS = 250

// Palette: the site family (ink / fade / accent) plus the ok-green and the amber
// fetched tone already used by the Caching figure. No new colors.
const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b' // a database trip, or a key just copied in
const OK = '#1f6f5c' // served by a cache layer
const OK_BG = '#e6f2ec'
const ERR_BG = '#fbecea'
const FETCH_BG = '#f6e7c8' // a key just copied into a layer
const LINE = '#e2e0d8'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 460
const VB_H = 316

// Top: the read stream as two rows of 12 tokens (unchanged from the box version).
const TOK_W = 24
const TOK_H = 20
const TOK_GAP = 8
const PER_ROW = 12
const STREAM_X = 42
const ROW_Y = [18, 44]
const tokenX = (i) => STREAM_X + (i % PER_ROW) * (TOK_W + TOK_GAP)
const tokenY = (i) => ROW_Y[Math.floor(i / PER_ROW)]
const STREAM_BOTTOM = 70 // where the falling dot starts

// Each cache layer is a sagging wire strung between two brackets. The database
// keeps a distinct solid shape at the bottom.
const WIRE_X1 = 90
const WIRE_X2 = 370
const LAYER_CX = (WIRE_X1 + WIRE_X2) / 2
const WIRE_Y = { browser: 108, cdn: 164, redis: 220 }
const DB_TOP = 258
const DB_H = 44
const LABEL_X = 70
const LABEL_X2 = 390
const BEAD_R = 8

// The wire is a shallow quadratic curve; its control-point drop (and so its sag)
// deepens slightly with the number of beads it carries. All of this is derived
// from STATES[step] at render time, so the drawing is correct with every
// animation removed.
const wireCtrl = (beadCount) => 8 + 5 * beadCount
const wirePath = (y, ctrl) => `M ${WIRE_X1} ${y} Q ${LAYER_CX} ${y + ctrl} ${WIRE_X2} ${y}`
// An empty layer reads as a torn wire: two drooping dashed halves with a gap.
const tornPaths = (y) => [
  `M ${WIRE_X1} ${y} Q ${WIRE_X1 + 70} ${y + 6} ${LAYER_CX - 16} ${y + 9}`,
  `M ${LAYER_CX + 16} ${y + 9} Q ${WIRE_X2 - 70} ${y + 6} ${WIRE_X2} ${y}`,
]
// Point on the quadratic wire at parameter t (0..1), for placing beads.
const beadPoint = (y, ctrl, t) => ({
  x: (1 - t) * (1 - t) * WIRE_X1 + 2 * (1 - t) * t * LAYER_CX + t * t * WIRE_X2,
  y: y + 2 * (1 - t) * t * ctrl,
})

export default function CachingLayersViz() {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [fastRun, setFastRun] = useState(false)
  const speed = useAnimationSpeed()

  const state = STATES[step]
  const done = step >= LAST_STEP
  const isPlaying = playing && !done
  const isFastRunning = fastRun && !done

  const dotRef = useRef(null)
  const pulseRef = useRef(null)

  // The animation effect below is keyed on step alone (re-running it on a speed
  // change would replay the current step's motion), so it reads the multiplier
  // through a ref kept in sync here.
  const speedRef = useRef(1)
  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  // Play: auto-advance with setInterval (never a rAF/anime chain). The effect
  // body only sets and clears the interval; setState happens only in the tick.
  // speed is a dependency, so changing it mid-Play swaps the interval for the
  // new cadence: the pending tick is re-timed, no step is skipped or doubled.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(LAST_STEP, s + 1)), PLAY_MS / speed)
    return () => clearInterval(id)
  }, [playing, done, speed])

  // Run remaining: the same state path, just on a faster interval. Same house
  // pattern; pressing the button again or Reset clears fastRun and tears down.
  useEffect(() => {
    if (!fastRun || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(LAST_STEP, s + 1)), FAST_MS / speed)
    return () => clearInterval(id)
  }, [fastRun, done, speed])

  // Cosmetic per-step motion: the read dot falls from the stream strip to the
  // serving layer and settles with a small bounce; on a database serve a
  // copy-back pulse travels up through the layers that receive copies. Keyframe
  // arrays only: no onComplete chaining, no rAF, no state changes. Skipped
  // entirely under prefers-reduced-motion; the state-derived drawing (wires,
  // beads, sag, tints) carries the figure on its own.
  useEffect(() => {
    if (step === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Every duration and delay is a baseline value divided by the current speed
    // multiplier; nothing is timed outside this scaling.
    const ms = (v) => v / speedRef.current
    const frame = STATES[step]
    const dot = dotRef.current
    if (dot) {
      const serveY = frame.servedBy === DB_ID ? DB_TOP + 14 : WIRE_Y[frame.servedBy]
      const dy = serveY - STREAM_BOTTOM
      animate(dot, {
        translateY: [
          { to: dy + 5, duration: ms(300), ease: 'inQuad' },
          { to: dy - 3, duration: ms(90), ease: 'outQuad' },
          { to: dy, duration: ms(70), ease: 'inOutQuad' },
        ],
        opacity: [
          { to: 1, duration: ms(40) },
          { to: 1, duration: ms(320) },
          { to: 0, duration: ms(140), delay: ms(40) },
        ],
      })
    }
    const pulse = pulseRef.current
    if (pulse) {
      animate(pulse, {
        translateY: [{ to: WIRE_Y.browser - DB_TOP, duration: ms(210), ease: 'outQuad', delay: ms(380) }],
        opacity: [
          { to: 1, duration: ms(50), delay: ms(380) },
          { to: 0, duration: ms(120) },
        ],
      })
    }
  }, [step])

  const onStep = () => setStep((s) => Math.min(LAST_STEP, s + 1))
  const togglePlay = () => {
    setFastRun(false)
    setPlaying((p) => !p)
  }
  const toggleFastRun = () => {
    if (isFastRunning) {
      setFastRun(false)
    } else {
      setPlaying(false)
      setFastRun(true)
    }
  }
  const reset = () => {
    setPlaying(false)
    setFastRun(false)
    setStep(0)
  }

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: togglePlay, disabled: done },
    { label: isFastRunning ? 'Stop' : 'Run remaining', onClick: toggleFastRun, disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]

  // Every readout is read straight from the precomputed frame, never recomputed.
  const readouts = [
    { label: 'browser', value: state.counts.browser },
    { label: 'CDN', value: state.counts.cdn },
    { label: 'Redis', value: state.counts.redis },
    { label: 'database', value: state.counts.database },
    { label: 'cache served', value: state.cacheServed },
    { label: 'hit rate', value: `${hitRate(state)}%` },
  ]

  const servedByCache = state.servedBy !== null && state.servedBy !== DB_ID
  const dbServes = state.servedBy === DB_ID

  return (
    <Figure
      eyebrow="Caching Layers"
      title="Reads fall through the stack"
      controls={controls}
      speedControl
      status={statusFor(state)}
      readouts={readouts}
      tryThis="Step through the first few reads and watch everything fall to the database while the caches are cold. Then watch the same keys come back: each copy written on the way up lets the next read stop higher, and by the second half most reads never get past the browser or the CDN. Watch read 12, a one-off key: it pushes the hot key out of the CDN, and the very next read of that key has to fall all the way down to Redis to find it."
    >
      <div className={styles.scroll}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        role="img"
        aria-label={`Caching layers, read ${step} of ${LAST_STEP}. Browser served ${state.counts.browser}, CDN ${state.counts.cdn}, Redis ${state.counts.redis}, database ${state.counts.database}. Cache hit rate ${hitRate(state)} percent. ${statusFor(state)}`}
      >
        {/* ── READ STREAM (two rows of 12) ────────────────────────────────── */}
        <text x={STREAM_X} y={10} fontSize={9} fill={FADE} fontFamily={MONO} letterSpacing="0.12em">
          READ STREAM
        </text>
        {STREAM.map((key, i) => {
          const isCurrent = i === state.index
          const isConsumed = i < state.index
          const bg = isCurrent ? (servedByCache ? OK_BG : FETCH_BG) : '#ffffff'
          const stroke = isCurrent ? (servedByCache ? OK : ACCENT) : LINE
          return (
            <g key={`read-${i}`} opacity={isConsumed ? 0.32 : 1}>
              <rect
                x={tokenX(i)}
                y={tokenY(i)}
                width={TOK_W}
                height={TOK_H}
                rx={5}
                fill={bg}
                stroke={stroke}
                strokeWidth={isCurrent ? 1.8 : 1}
              />
              <text
                x={tokenX(i) + TOK_W / 2}
                y={tokenY(i) + TOK_H / 2 + 4}
                fontSize={11}
                fill={INK}
                fontFamily={MONO}
                fontWeight={isCurrent ? 700 : 500}
                textAnchor="middle"
              >
                {key}
              </text>
            </g>
          )
        })}

        {/* ── THE THREE CACHE LAYERS AS SAGGING WIRES ─────────────────────── */}
        {LAYERS.map((layer) => {
          const y = WIRE_Y[layer.id]
          const keys = state.orders[layer.id]
          const held = keys.length > 0
          const ctrl = wireCtrl(keys.length)
          const isServing = state.servedBy === layer.id
          const gotCopy = state.copiedInto.includes(layer.id)
          const wireStroke = isServing ? OK : held ? INK : FADE
          return (
            <g key={layer.id} data-wire={layer.id} data-integrity={held ? 'held' : 'empty'}>
              <text x={LABEL_X} y={y - 16} fontSize={9} fill={FADE} fontFamily={MONO} letterSpacing="0.12em">
                {layer.label}
              </text>
              <text x={LABEL_X2} y={y - 16} fontSize={8} fill={FADE} fontFamily={MONO} textAnchor="end">
                {`LRU, capacity ${layer.capacity}, ${LATENCY_LABEL[layer.id]}`}
              </text>

              {/* wall brackets */}
              <line x1={WIRE_X1 - 2} y1={y - 9} x2={WIRE_X1 - 2} y2={y + 9} stroke={INK} strokeWidth={2.5} />
              <line x1={WIRE_X2 + 2} y1={y - 9} x2={WIRE_X2 + 2} y2={y + 9} stroke={INK} strokeWidth={2.5} />

              {/* the wire itself: solid catenary when holding keys, torn dashed
                  halves with a mid-span gap when empty */}
              {held ? (
                <path d={wirePath(y, ctrl)} fill="none" stroke={wireStroke} strokeWidth={isServing ? 2 : 1.5} />
              ) : (
                tornPaths(y).map((d) => (
                  <path key={d} d={d} fill="none" stroke={FADE} strokeWidth={1.2} strokeDasharray="4 4" />
                ))
              )}

              {/* beads: one per key currently held, sitting on the wire */}
              {keys.map((key, j) => {
                const t = (j + 1) / (keys.length + 1)
                const p = beadPoint(y, ctrl, t)
                const isFront = j === 0
                const servedBead = isFront && isServing
                const copiedBead = isFront && gotCopy
                const beadFill = servedBead ? OK_BG : copiedBead ? FETCH_BG : '#ffffff'
                const beadStroke = servedBead ? OK : copiedBead ? ACCENT : LINE
                return (
                  <g key={`${layer.id}-bead-${key}`} data-bead data-bead-layer={layer.id}>
                    <circle cx={p.x} cy={p.y} r={BEAD_R} fill={beadFill} stroke={beadStroke} strokeWidth={servedBead || copiedBead ? 1.6 : 1.1} />
                    <text x={p.x} y={p.y + 3.5} fontSize={10} fill={INK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                      {key}
                    </text>
                  </g>
                )
              })}

              {/* integrity sublabel, state-derived */}
              <text x={WIRE_X1} y={y + 30} fontSize={7.5} fill={held ? OK : FADE} fontFamily={MONO}>
                {held ? 'reads bounce' : 'falls through'}
              </text>
            </g>
          )
        })}

        {/* ── THE DATABASE (distinct solid shape, always serves; its name is
               inside the box, so no outer label that would crowd the redis
               sublabel above) ─────────────────────────────────────────────── */}
        <text x={LABEL_X2} y={DB_TOP - 8} fontSize={8} fill={FADE} fontFamily={MONO} textAnchor="end">
          {LATENCY_LABEL[DB_ID]}
        </text>
        <g data-db data-serving={dbServes ? 'true' : 'false'}>
          <rect
            x={LABEL_X}
            y={DB_TOP}
            width={LABEL_X2 - LABEL_X}
            height={DB_H}
            rx={8}
            fill={dbServes ? ERR_BG : '#ffffff'}
            stroke={dbServes ? ACCENT : FADE}
            strokeWidth={1.4}
          />
          <text x={LAYER_CX} y={DB_TOP + 19} fontSize={11} fill={INK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
            DATABASE
          </text>
          <text x={LAYER_CX} y={DB_TOP + 33} fontSize={8.5} fill={dbServes ? ACCENT : FADE} fontFamily={MONO} textAnchor="middle">
            {dbServes ? 'source of truth' : 'untouched'}
          </text>
        </g>

        {/* ── COSMETIC MOTION ELEMENTS (invisible until animated; never
               rendered as visible content, so reduced motion simply never
               shows them) ─────────────────────────────────────────────────── */}
        {step > 0 && (
          <g key={`dot-${state.step}`} ref={dotRef} opacity={0}>
            <circle cx={LAYER_CX} cy={STREAM_BOTTOM} r={5} fill={servedByCache ? OK : ACCENT} />
          </g>
        )}
        {step > 0 && dbServes && (
          <g key={`pulse-${state.step}`} ref={pulseRef} opacity={0}>
            <circle cx={LAYER_CX} cy={DB_TOP - 4} r={4} fill={ACCENT} />
          </g>
        )}
      </svg>
      </div>

      <p className={styles.caption}>
        The three cache layers are real least-recently-used structures (capacities 2, 3,
        and 4) processed over a fixed 24-read stream; which layer serves each read, every
        count, and every eviction are computed from them, never typed in. The stream is
        hand-authored to be instructive, and the per-layer latency figures are labels for
        scale, not measured timing. Real stacks differ: capacities are vastly larger,
        layers can be missing, and policies vary per layer.
      </p>
    </Figure>
  )
}
