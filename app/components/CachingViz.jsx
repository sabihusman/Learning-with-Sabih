'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import {
  STREAM,
  CAPACITY,
  STATES,
  LAST_STEP,
  hitRate,
  statusFor,
} from './cachingData'
import styles from './CachingViz.module.css'

const PLAY_MS = 1300

// Palette: the site family (ink / fade / accent) plus the ok-green and error-red
// already used by the SQL and Normalization figures, plus the amber "touch" tone
// for a value just fetched. No new colors are invented for this section.
const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b' // eviction / the leaving key
const OK = '#1f6f5c' // a hit, served from the cache
const OK_BG = '#e6f2ec'
const ERR_BG = '#fbecea'
const FETCH_BG = '#f6e7c8' // a key just fetched from the origin
const LINE = '#e2e0d8'
const PANEL_BG = '#faf9f6'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

// ── SVG geometry ────────────────────────────────────────────────────────────────
// The three bands (stream, cache, origin) are stacked tightly: just enough gap
// between the cache and the origin for the fetch arrow and the eviction ghost to
// read at the steps where they appear, and no reserved blank space beyond that.
const VB_W = 460
const VB_H = 224

// Top: the request stream as a timeline of tokens.
const TOK_W = 26
const TOK_H = 22
const TOK_GAP = 10
const STREAM_X = 18
const STREAM_Y = 22
const tokenX = (i) => STREAM_X + i * (TOK_W + TOK_GAP)

// Middle: the CACHE service box and its three recency slots (newest on the left).
const CACHE_X = 70
const CACHE_Y = 66
const CACHE_W = 320
const CACHE_H = 66
const SLOT_W = 84
const SLOT_H = 34
const SLOT_GAP = 14
const SLOT_X0 = CACHE_X + 22
const SLOT_Y = CACHE_Y + 24
const slotX = (j) => SLOT_X0 + j * (SLOT_W + SLOT_GAP)
const CACHE_CX = CACHE_X + CACHE_W / 2

// Bottom: the ORIGIN service box (the slow store a miss must visit).
const ORIGIN_W = 168
const ORIGIN_H = 46
const ORIGIN_X = CACHE_CX - ORIGIN_W / 2
const ORIGIN_Y = 170
const ORIGIN_CX = ORIGIN_X + ORIGIN_W / 2

export default function CachingViz() {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const state = STATES[step]
  const done = step >= LAST_STEP
  const isPlaying = playing && !done

  const svgRef = useRef(null)

  // Auto-advance with setInterval (never a rAF/anime chain) so play keeps running in
  // a backgrounded tab. Keyed on `done` so it tears down the instant the stream ends;
  // the effect body only sets/clears the interval, never setState directly.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(LAST_STEP, s + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done])

  // Cosmetic flourish only: pulse the elements marked data-pulse (the current cache
  // slot and, on a miss, the origin fetch arrow) so each step's action registers.
  // Pure animation, no state change.
  useEffect(() => {
    if (step === 0 || !svgRef.current) return
    const nodes = Array.from(svgRef.current.querySelectorAll('[data-pulse]'))
    if (nodes.length === 0) return
    animate(nodes, { opacity: [0.4, 1], duration: 520, ease: 'outQuad' })
  }, [step])

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

  // Every readout is read from the real cache frame; origin fetches is kept beside
  // misses on purpose, because they are the same number: every miss is a trip to the
  // slow thing.
  const readouts = [
    { label: 'hits', value: state.hits },
    { label: 'misses', value: state.misses },
    { label: 'hit rate', value: `${hitRate(state)}%` },
    { label: 'origin fetches', value: state.misses },
  ]

  const isHit = state.event === 'hit'
  const frontTone = step === 0 ? null : isHit ? 'hit' : 'fetch'

  return (
    <Figure
      eyebrow="Caching"
      title="The cache remembers"
      controls={controls}
      status={statusFor(state)}
      readouts={readouts}
      tryThis="Watch key E arrive. It evicts the key that turns out to be needed again just two requests later, forcing a second trip to the origin. Which key would you have evicted instead? The cache only knows what was used recently; it cannot see that a key is about to be used again. That gap between recent and soon is why no single eviction policy wins every time."
    >
      <div className={styles.scroll}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        role="img"
        aria-label={`Caching, step ${step} of ${LAST_STEP}. ${state.hits} hits, ${state.misses} misses, hit rate ${hitRate(state)} percent. ${statusFor(state)}`}
      >
        <defs>
          <marker id="cache-fetch" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={ACCENT} />
          </marker>
        </defs>

        {/* ── REQUEST STREAM (the timeline) ───────────────────────────────── */}
        <text x={STREAM_X} y={12} fontSize={9} fill={FADE} fontFamily={MONO} letterSpacing="0.12em">
          REQUEST STREAM
        </text>
        {STREAM.map((key, i) => {
          const isCurrent = i === state.index
          const isConsumed = i < state.index
          const bg = isCurrent ? (isHit ? OK_BG : FETCH_BG) : '#ffffff'
          const stroke = isCurrent ? (isHit ? OK : ACCENT) : LINE
          return (
            <g key={`req-${i}`} opacity={isConsumed ? 0.32 : 1}>
              <rect
                x={tokenX(i)}
                y={STREAM_Y}
                width={TOK_W}
                height={TOK_H}
                rx={6}
                fill={bg}
                stroke={stroke}
                strokeWidth={isCurrent ? 1.8 : 1}
              />
              <text
                x={tokenX(i) + TOK_W / 2}
                y={STREAM_Y + TOK_H / 2 + 4}
                fontSize={12}
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

        {/* request travelling into the cache: a dashed connector from the current
            token down to the cache box (only once the stream has started) */}
        {step > 0 && (
          <line
            x1={tokenX(state.index) + TOK_W / 2}
            y1={STREAM_Y + TOK_H}
            x2={CACHE_CX}
            y2={CACHE_Y}
            stroke={FADE}
            strokeWidth={1}
            strokeDasharray="3 3"
            strokeOpacity={0.6}
          />
        )}

        {/* ── THE CACHE (a service box with three recency slots) ──────────── */}
        <text x={CACHE_X} y={CACHE_Y - 6} fontSize={9} fill={FADE} fontFamily={MONO} letterSpacing="0.12em">
          CACHE
        </text>
        <text x={CACHE_X + CACHE_W} y={CACHE_Y - 6} fontSize={8.5} fill={FADE} fontFamily={MONO} textAnchor="end">
          {`LRU, capacity ${CAPACITY}, newest on the left`}
        </text>
        <rect x={CACHE_X} y={CACHE_Y} width={CACHE_W} height={CACHE_H} rx={8} fill={PANEL_BG} stroke={LINE} strokeWidth={1} />

        {Array.from({ length: CAPACITY }).map((_, j) => {
          const key = state.order[j]
          const filled = key !== undefined
          const isFront = j === 0 && filled
          const tone = isFront ? frontTone : null
          const slotBg = tone === 'hit' ? OK_BG : tone === 'fetch' ? FETCH_BG : '#ffffff'
          const slotStroke = tone === 'hit' ? OK : tone === 'fetch' ? ACCENT : LINE
          const pulse = isFront && tone ? { 'data-pulse': true } : {}
          return (
            <g key={`slot-${j}`}>
              <rect
                x={slotX(j)}
                y={SLOT_Y}
                width={SLOT_W}
                height={SLOT_H}
                rx={6}
                fill={filled ? slotBg : PANEL_BG}
                stroke={filled ? slotStroke : LINE}
                strokeWidth={isFront && tone ? 1.8 : 1}
                strokeDasharray={filled ? undefined : '3 3'}
                {...pulse}
              />
              {filled ? (
                <text x={slotX(j) + SLOT_W / 2} y={SLOT_Y + SLOT_H / 2 + 5} fontSize={14} fill={INK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                  {key}
                </text>
              ) : (
                <text x={slotX(j) + SLOT_W / 2} y={SLOT_Y + SLOT_H / 2 + 4} fontSize={9} fill={FADE} fontFamily={MONO} textAnchor="middle">
                  empty
                </text>
              )}
              <text x={slotX(j) + SLOT_W / 2} y={SLOT_Y + SLOT_H + 12} fontSize={7.5} fill={FADE} fontFamily={MONO} textAnchor="middle">
                {j === 0 ? 'most recent' : j === CAPACITY - 1 ? 'least recent' : ''}
              </text>
            </g>
          )
        })}

        {/* the evicted key, shown leaving to the right in the error tone */}
        {state.evicted && (
          <g data-pulse>
            <rect x={CACHE_X + CACHE_W + 6} y={SLOT_Y} width={TOK_W + 6} height={SLOT_H} rx={6} fill={ERR_BG} stroke={ACCENT} strokeWidth={1.4} />
            <text x={CACHE_X + CACHE_W + 6 + (TOK_W + 6) / 2} y={SLOT_Y + SLOT_H / 2 + 5} fontSize={13} fill={ACCENT} fontFamily={MONO} fontWeight={700} textAnchor="middle">
              {state.evicted}
            </text>
            <text x={CACHE_X + CACHE_W + 6 + (TOK_W + 6) / 2} y={SLOT_Y + SLOT_H + 12} fontSize={7.5} fill={ACCENT} fontFamily={MONO} textAnchor="middle">
              evicted
            </text>
          </g>
        )}

        {/* ── THE ORIGIN (the slow store) ─────────────────────────────────── */}
        {/* fetch arrow from the origin up to the cache, drawn only on a miss */}
        {state.originFetch && (
          <line
            data-pulse
            x1={ORIGIN_CX}
            y1={ORIGIN_Y}
            x2={CACHE_CX}
            y2={CACHE_Y + CACHE_H}
            stroke={ACCENT}
            strokeWidth={1.6}
            markerEnd="url(#cache-fetch)"
          />
        )}
        <g opacity={state.originFetch ? 1 : 0.45}>
          <rect x={ORIGIN_X} y={ORIGIN_Y} width={ORIGIN_W} height={ORIGIN_H} rx={8} fill="#ffffff" stroke={FADE} strokeWidth={1.4} />
          <text x={ORIGIN_CX} y={ORIGIN_Y + 20} fontSize={11} fill={INK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
            ORIGIN
          </text>
          <text x={ORIGIN_CX} y={ORIGIN_Y + 35} fontSize={8.5} fill={FADE} fontFamily={MONO} textAnchor="middle">
            slow store, touched only on a miss
          </text>
        </g>
      </svg>
      </div>

      <p className={styles.caption}>
        The cache holds a real least-recently-used structure, capacity 3, and the hits,
        misses, and hit rate are counted straight from it as each request is processed,
        never typed in by hand. The 12-key stream is fixed and deliberately shaped to be
        instructive; real traffic is far messier, and least recently used is only one of
        several eviction policies.
      </p>
    </Figure>
  )
}
