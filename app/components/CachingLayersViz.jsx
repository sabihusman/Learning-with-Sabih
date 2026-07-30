'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
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

const PLAY_MS = 1400

// Palette: the site family (ink / fade / accent) plus the ok-green and the amber
// fetched tone already used by the Caching figure. No new colors.
const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b' // a database trip, or a key leaving a layer
const OK = '#1f6f5c' // served by a cache layer
const OK_BG = '#e6f2ec'
const ERR_BG = '#fbecea'
const FETCH_BG = '#f6e7c8' // a key just copied into a layer
const LINE = '#e2e0d8'
const PANEL_BG = '#faf9f6'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 460
const VB_H = 316

// Top: the read stream as two rows of 12 tokens.
const TOK_W = 24
const TOK_H = 20
const TOK_GAP = 8
const PER_ROW = 12
const STREAM_X = 42
const ROW_Y = [18, 44]
const tokenX = (i) => STREAM_X + (i % PER_ROW) * (TOK_W + TOK_GAP)
const tokenY = (i) => ROW_Y[Math.floor(i / PER_ROW)]

// The four layer bands, closest to the reader first. The database band is last
// and has no slots; it always holds every key.
const LAYER_X = 70
const LAYER_W = 320
const LAYER_CX = LAYER_X + LAYER_W / 2
const BAND_TOP = { browser: 92, cdn: 148, redis: 204, [DB_ID]: 260 }
const BAND_H = { browser: 40, cdn: 40, redis: 40, [DB_ID]: 44 }
const SLOT_W = 56
const SLOT_H = 24
const SLOT_GAP = 8
const slotX = (j) => LAYER_X + 14 + j * (SLOT_W + SLOT_GAP)

// Order of the bands for miss/copy logic: index 0 is closest to the reader.
const BAND_IDS = [...LAYERS.map((l) => l.id), DB_ID]

export default function CachingLayersViz() {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const state = STATES[step]
  const done = step >= LAST_STEP
  const isPlaying = playing && !done
  const servingIndex = state.servedBy === null ? -1 : BAND_IDS.indexOf(state.servedBy)

  const svgRef = useRef(null)

  // Auto-advance with setInterval (never a rAF/anime chain). The effect body only
  // sets and clears the interval; setState happens only inside the tick callback.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(LAST_STEP, s + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done])

  // Cosmetic flourish only: pulse the serving slot, the copied-in slots, and the
  // copy-back arrows. Pure animation, no state change, no onComplete.
  useEffect(() => {
    if (step === 0 || !svgRef.current) return
    const nodes = Array.from(svgRef.current.querySelectorAll('[data-pulse]'))
    if (nodes.length === 0) return
    animate(nodes, { opacity: [0.35, 1], duration: 520, ease: 'outQuad' })
  }, [step])

  const onStep = () => setStep((s) => Math.min(LAST_STEP, s + 1))
  const runRemaining = () => {
    setPlaying(false)
    setStep(LAST_STEP)
  }
  const reset = () => {
    setPlaying(false)
    setStep(0)
  }

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Run remaining', onClick: runRemaining, disabled: done },
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

  const servedByCache = servingIndex >= 0 && state.servedBy !== DB_ID
  const dbServes = state.servedBy === DB_ID

  return (
    <Figure
      eyebrow="Caching Layers"
      title="Reads fall through the stack"
      controls={controls}
      status={statusFor(state)}
      readouts={readouts}
      tryThis="Step through the first few reads and watch everything fall to the database while the caches are cold. Then watch the same keys come back: each copy written on the way up lets the next read stop higher, and by the second half most reads never get past the browser or the CDN. Watch read 12, a one-off key: it pushes the hot key out of the CDN, and the very next read of that key has to fall all the way down to Redis to find it."
    >
      <div className={styles.scroll}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        role="img"
        aria-label={`Caching layers, read ${step} of ${LAST_STEP}. Browser served ${state.counts.browser}, CDN ${state.counts.cdn}, Redis ${state.counts.redis}, database ${state.counts.database}. Cache hit rate ${hitRate(state)} percent. ${statusFor(state)}`}
      >
        <defs>
          <marker id="layers-up" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={ACCENT} />
          </marker>
        </defs>

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

        {/* ── THE THREE CACHE LAYERS ──────────────────────────────────────── */}
        {LAYERS.map((layer, li) => {
          const top = BAND_TOP[layer.id]
          const h = BAND_H[layer.id]
          const isServing = state.servedBy === layer.id
          const missedHere = servingIndex > li
          const gotCopy = state.copiedInto.includes(layer.id)
          const evictedKey = state.evicted[layer.id]
          return (
            <g key={layer.id}>
              <text x={LAYER_X} y={top - 6} fontSize={9} fill={FADE} fontFamily={MONO} letterSpacing="0.12em">
                {layer.label}
              </text>
              <text x={LAYER_X + LAYER_W} y={top - 6} fontSize={8} fill={FADE} fontFamily={MONO} textAnchor="end">
                {`LRU, capacity ${layer.capacity}, ${LATENCY_LABEL[layer.id]}`}
              </text>
              <rect
                x={LAYER_X}
                y={top}
                width={LAYER_W}
                height={h}
                rx={8}
                fill={isServing ? OK_BG : PANEL_BG}
                stroke={isServing ? OK : LINE}
                strokeWidth={isServing ? 1.6 : 1}
              />

              {/* recency slots, newest on the left */}
              {Array.from({ length: layer.capacity }).map((_, j) => {
                const key = state.orders[layer.id][j]
                const filled = key !== undefined
                const isFront = j === 0 && filled
                const servedSlot = isFront && isServing
                const copiedSlot = isFront && gotCopy
                const slotBg = servedSlot ? OK_BG : copiedSlot ? FETCH_BG : filled ? '#ffffff' : PANEL_BG
                const slotStroke = servedSlot ? OK : copiedSlot ? ACCENT : LINE
                const pulse = servedSlot || copiedSlot ? { 'data-pulse': true } : {}
                return (
                  <g key={`${layer.id}-slot-${j}`}>
                    <rect
                      x={slotX(j)}
                      y={top + 8}
                      width={SLOT_W}
                      height={SLOT_H}
                      rx={5}
                      fill={slotBg}
                      stroke={slotStroke}
                      strokeWidth={servedSlot || copiedSlot ? 1.6 : 1}
                      strokeDasharray={filled ? undefined : '3 3'}
                      {...pulse}
                    />
                    <text
                      x={slotX(j) + SLOT_W / 2}
                      y={top + 8 + SLOT_H / 2 + 4}
                      fontSize={filled ? 12 : 8}
                      fill={filled ? INK : FADE}
                      fontFamily={MONO}
                      fontWeight={filled ? 700 : 400}
                      textAnchor="middle"
                    >
                      {filled ? key : 'empty'}
                    </text>
                  </g>
                )
              })}

              {/* hit / miss verdict for this layer on the current read */}
              {isServing && (
                <text data-pulse x={LAYER_X + LAYER_W - 10} y={top + h / 2 + 3} fontSize={9} fill={OK} fontFamily={MONO} fontWeight={700} textAnchor="end">
                  HIT
                </text>
              )}
              {missedHere && (
                <text x={LAYER_X + LAYER_W - 10} y={top + h / 2 + 3} fontSize={9} fill={FADE} fontFamily={MONO} textAnchor="end">
                  MISS
                </text>
              )}

              {/* a key evicted from this layer this step, leaving to the right */}
              {evictedKey && (
                <g data-pulse>
                  <rect x={LAYER_X + LAYER_W + 8} y={top + 8} width={34} height={SLOT_H} rx={5} fill={ERR_BG} stroke={ACCENT} strokeWidth={1.2} />
                  <text x={LAYER_X + LAYER_W + 8 + 17} y={top + 8 + SLOT_H / 2 + 4} fontSize={11} fill={ACCENT} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                    {evictedKey}
                  </text>
                  <text x={LAYER_X + LAYER_W + 8 + 17} y={top + 8 + SLOT_H + 10} fontSize={7} fill={ACCENT} fontFamily={MONO} textAnchor="middle">
                    out
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* copy-back arrows: one per adjacent pair from the serving layer up */}
        {servingIndex > 0 &&
          BAND_IDS.slice(1, servingIndex + 1).map((id, k) => {
            const upperId = BAND_IDS[k]
            const y1 = BAND_TOP[id] - 2
            const y2 = BAND_TOP[upperId] + BAND_H[upperId] + 2
            return (
              <line
                key={`copy-${id}`}
                data-pulse
                x1={LAYER_CX}
                y1={y1}
                x2={LAYER_CX}
                y2={y2}
                stroke={ACCENT}
                strokeWidth={1.6}
                markerEnd="url(#layers-up)"
              />
            )
          })}

        {/* ── THE DATABASE (always serves) ────────────────────────────────── */}
        <text x={LAYER_X} y={BAND_TOP[DB_ID] - 6} fontSize={9} fill={FADE} fontFamily={MONO} letterSpacing="0.12em">
          DATABASE
        </text>
        <text x={LAYER_X + LAYER_W} y={BAND_TOP[DB_ID] - 6} fontSize={8} fill={FADE} fontFamily={MONO} textAnchor="end">
          {LATENCY_LABEL[DB_ID]}
        </text>
        <g opacity={dbServes || step === 0 ? 1 : 0.45}>
          <rect
            x={LAYER_X}
            y={BAND_TOP[DB_ID]}
            width={LAYER_W}
            height={BAND_H[DB_ID]}
            rx={8}
            fill={dbServes ? ERR_BG : '#ffffff'}
            stroke={dbServes ? ACCENT : FADE}
            strokeWidth={1.4}
            {...(dbServes ? { 'data-pulse': true } : {})}
          />
          <text x={LAYER_CX} y={BAND_TOP[DB_ID] + 19} fontSize={11} fill={INK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
            DATABASE
          </text>
          <text x={LAYER_CX} y={BAND_TOP[DB_ID] + 33} fontSize={8.5} fill={dbServes ? ACCENT : FADE} fontFamily={MONO} textAnchor="middle">
            {dbServes ? `serves ${state.key}, the slow way` : 'every key lives here'}
          </text>
        </g>
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
