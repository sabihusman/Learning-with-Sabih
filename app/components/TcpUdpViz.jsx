'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import {
  DEFAULT_LOSS_PCT,
  MAX_LOSS_PCT,
  initialState,
  step,
  setLoss,
  setProtocol,
  reset,
  isDone,
  sentCount,
  deliveredCount,
  lostCount,
  isInOrder,
  heldSeqs,
  totalTicks,
} from './tcpUdpData'
import styles from './TcpUdpViz.module.css'

const PLAY_MS = 900
const PACKET_COUNT = 8

// Palette: the site family (ink / fade / accent) plus the ok-green and amber
// already used elsewhere in the section. No new colors.
const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b' // a lost packet
const OK = '#1f6f5c' // an arrived / released packet
const OK_BG = '#e6f2ec'
const ERR_BG = '#fbecea'
const HOLD = '#caa24a' // a held packet, waiting behind an earlier gap
const HOLD_BG = '#f6e7c8'
const LINE = '#e2e0d8'
const PANEL_BG = '#faf9f6'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 460
const VB_H = 172

const QUEUE_LABEL_Y = 10
const QUEUE_Y = 18
const QUEUE_H = 20
const QUEUE_GAP = 5
const QUEUE_MARGIN = 14

const NODE_W = 100
const NODE_H = 46
const NODE_Y = 54
const SENDER_X = 30
const RECEIVER_X = 330
const SENDER_CX = SENDER_X + NODE_W / 2
const RECEIVER_CX = RECEIVER_X + NODE_W / 2
const CHANNEL_Y = NODE_Y + NODE_H / 2
const CHANNEL_MX = (SENDER_X + NODE_W + RECEIVER_X) / 2

const SLOTS_LABEL_Y = 116
const SLOTS_Y = 124
const SLOTS_H = 24
const SLOTS_GAP = 6
const SLOTS_W = 42
const SLOTS_X0 = (VB_W - (PACKET_COUNT * SLOTS_W + (PACKET_COUNT - 1) * SLOTS_GAP)) / 2
const slotX = (i) => SLOTS_X0 + i * (SLOTS_W + SLOTS_GAP)

const clamp = (v) => Math.min(MAX_LOSS_PCT, Math.max(0, v))

export default function TcpUdpViz() {
  const [state, setState] = useState(() => initialState('TCP', DEFAULT_LOSS_PCT))
  const [playing, setPlaying] = useState(false)
  const svgRef = useRef(null)

  const done = isDone(state)
  const isPlaying = playing && !done
  const isUdp = state.protocol === 'UDP'

  // Auto-advance with setInterval (never a rAF/anime chain). Keyed on `done` so
  // it tears down when the run finishes; the effect body only sets/clears the
  // timer.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setState((s) => (isDone(s) ? s : step(s))), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done])

  // Cosmetic flourish only: pulse the elements marked data-pulse (the acting
  // node and the in-flight token). Pure animation, no state change.
  useEffect(() => {
    if (!state.lastEvent || !svgRef.current) return
    const nodes = Array.from(svgRef.current.querySelectorAll('[data-pulse]'))
    if (nodes.length === 0) return
    animate(nodes, { opacity: [0.4, 1], duration: 450, ease: 'outQuad' })
  }, [state.cursor, state.lastEvent])

  const onStep = () => setState((s) => (isDone(s) ? s : step(s)))
  const doReset = () => {
    setPlaying(false)
    setState((s) => reset(s))
  }
  const onLossChange = (v) => setState((s) => setLoss(s, clamp(v)))
  const onProtocol = (p) => setState((s) => setProtocol(s, p))

  // Native range arrows already move by 1; intercept Shift+Arrow to move by 5
  // so the whole interaction works without a mouse, matching the Percentiles
  // slider convention.
  const onSliderKeyDown = (e) => {
    if (!e.shiftKey) return
    let d = 0
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = 5
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -5
    if (d !== 0) {
      e.preventDefault()
      onLossChange(state.lossPct + d)
    }
  }

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: doReset, disabled: state.cursor === 0 },
  ]

  const readouts = isUdp
    ? [
        { label: 'sent', value: sentCount(state) },
        { label: 'delivered', value: deliveredCount(state) },
        { label: 'lost', value: lostCount(state) },
        { label: 'in order', value: deliveredCount(state) === 0 ? '-' : isInOrder(state) ? 'yes' : 'no' },
      ]
    : [
        { label: 'sent', value: sentCount(state) },
        { label: 'delivered', value: deliveredCount(state) },
        { label: 'retransmits', value: state.retransmits },
        { label: 'time cost (ticks)', value: `${state.cursor}/${totalTicks(state)}` },
      ]

  const held = isUdp ? [] : heldSeqs(state)
  const status = statusFor(state, isUdp)

  return (
    <Figure
      eyebrow="TCP and UDP"
      title="Reliable, or fast"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Set loss to about 25 percent and run both protocols with the same seed. UDP finishes in 8 ticks but delivers with permanent gaps; TCP takes more ticks and more sends, and some arrived packets sit visibly held until a missing one behind them is retransmitted, but ends complete and in order. At 0 percent loss, step through both: nothing is dropped, so there is nothing to retransmit or hold, and the two protocols behave identically."
    >
      <div className={styles.controlsRow}>
        <span className={styles.groupLabel}>protocol</span>
        <button
          type="button"
          className={`${styles.btn} ${state.protocol === 'TCP' ? styles.btnOn : ''}`}
          aria-pressed={state.protocol === 'TCP'}
          onClick={() => onProtocol('TCP')}
        >
          TCP
        </button>
        <button
          type="button"
          className={`${styles.btn} ${state.protocol === 'UDP' ? styles.btnOn : ''}`}
          aria-pressed={state.protocol === 'UDP'}
          onClick={() => onProtocol('UDP')}
        >
          UDP
        </button>
        <span className={styles.groupLabel} style={{ marginLeft: 8 }}>
          loss
        </span>
        <input
          type="range"
          className={styles.slider}
          min={0}
          max={MAX_LOSS_PCT}
          step={1}
          value={state.lossPct}
          onChange={(e) => onLossChange(Number(e.target.value))}
          onKeyDown={onSliderKeyDown}
          aria-label="packet loss percent"
          aria-valuetext={`${state.lossPct} percent`}
        />
        <span className={styles.sliderValue}>{`${state.lossPct}%`}</span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        role="img"
        aria-label={`${state.protocol}, ${state.lossPct} percent loss. Sent ${sentCount(state)}, delivered ${deliveredCount(state)}${isUdp ? `, lost ${lostCount(state)}` : `, retransmits ${state.retransmits}`}.`}
      >
        {/* ── SEND QUEUE (fixed order, precomputed and reproducible) ───────── */}
        <text x={QUEUE_MARGIN} y={QUEUE_LABEL_Y} fontSize={8.5} fill={FADE} fontFamily={MONO} letterSpacing="0.12em">
          SENDS (seeded, same drops both protocols)
        </text>
        {(() => {
          const n = state.queue.length
          const w = Math.min(40, (VB_W - 2 * QUEUE_MARGIN - (n - 1) * QUEUE_GAP) / n)
          const x0 = (VB_W - (n * w + (n - 1) * QUEUE_GAP)) / 2
          return state.queue.map((e, i) => {
            const executed = i < state.cursor
            const current = i === state.cursor - 1
            let bg = '#ffffff'
            let stroke = LINE
            if (executed) {
              if (e.lost) {
                bg = ERR_BG
                stroke = ACCENT
              } else if (e.retransmit) {
                bg = HOLD_BG
                stroke = HOLD
              } else {
                bg = OK_BG
                stroke = OK
              }
            }
            return (
              <g key={`ev-${i}`} opacity={executed && !current ? 0.55 : 1}>
                <rect
                  x={x0 + i * (w + QUEUE_GAP)}
                  y={QUEUE_Y}
                  width={w}
                  height={QUEUE_H}
                  rx={4}
                  fill={bg}
                  stroke={stroke}
                  strokeWidth={current ? 1.8 : 1}
                />
                <text
                  x={x0 + i * (w + QUEUE_GAP) + w / 2}
                  y={QUEUE_Y + QUEUE_H / 2 + 3.5}
                  fontSize={9.5}
                  fill={INK}
                  fontFamily={MONO}
                  fontWeight={e.retransmit ? 700 : 400}
                  textAnchor="middle"
                >
                  {e.retransmit ? `R${e.seq}` : e.seq}
                </text>
              </g>
            )
          })
        })()}

        {/* ── CHANNEL: SENDER -> RECEIVER ────────────────────────────────── */}
        <line x1={SENDER_X + NODE_W} y1={CHANNEL_Y} x2={RECEIVER_X} y2={CHANNEL_Y} stroke={FADE} strokeWidth={1.4} />
        {state.lastEvent && (
          <g data-pulse>
            {state.lastEvent.lost ? (
              <>
                <rect x={CHANNEL_MX - 15} y={CHANNEL_Y - 9} width={30} height={18} rx={4} fill={ERR_BG} stroke={ACCENT} strokeWidth={1.3} />
                <text x={CHANNEL_MX} y={CHANNEL_Y + 3.5} fontSize={9.5} fill={ACCENT} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                  {`${state.lastEvent.seq} ×`}
                </text>
              </>
            ) : (
              <>
                <rect x={CHANNEL_MX - 15} y={CHANNEL_Y - 9} width={30} height={18} rx={4} fill={OK_BG} stroke={OK} strokeWidth={1.3} />
                <text x={CHANNEL_MX} y={CHANNEL_Y + 3.5} fontSize={9.5} fill={OK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                  {state.lastEvent.retransmit ? `R${state.lastEvent.seq}` : state.lastEvent.seq}
                </text>
              </>
            )}
          </g>
        )}

        {/* ── SENDER / RECEIVER ──────────────────────────────────────────── */}
        <g>
          <rect data-pulse={state.lastEvent ? true : undefined} x={SENDER_X} y={NODE_Y} width={NODE_W} height={NODE_H} rx={8} fill={PANEL_BG} stroke={LINE} strokeWidth={1} />
          <text x={SENDER_X + 10} y={NODE_Y + 15} fontSize={9.5} fill={INK} fontFamily={MONO} fontWeight={700}>
            SENDER
          </text>
          <text x={SENDER_CX} y={NODE_Y + 34} fontSize={9} fill={FADE} fontFamily={MONO} textAnchor="middle">
            {senderLine(state)}
          </text>
        </g>
        <g>
          <rect data-pulse={state.lastEvent ? true : undefined} x={RECEIVER_X} y={NODE_Y} width={NODE_W} height={NODE_H} rx={8} fill={PANEL_BG} stroke={LINE} strokeWidth={1} />
          <text x={RECEIVER_X + 10} y={NODE_Y + 15} fontSize={9.5} fill={INK} fontFamily={MONO} fontWeight={700}>
            RECEIVER
          </text>
          <text x={RECEIVER_CX} y={NODE_Y + 34} fontSize={9} fill={FADE} fontFamily={MONO} textAnchor="middle">
            {receiverLine(state, isUdp)}
          </text>
        </g>

        {/* ── RECEIVER SLOTS (one per final seq, the gaps-vs-holding contrast) ── */}
        <text x={SLOTS_X0} y={SLOTS_LABEL_Y} fontSize={8.5} fill={FADE} fontFamily={MONO} letterSpacing="0.12em">
          {isUdp ? 'DELIVERED TO APPLICATION (gaps are permanent)' : 'RELEASED TO APPLICATION (in order only)'}
        </text>
        {Array.from({ length: PACKET_COUNT }, (_, idx) => {
          const seq = idx + 1
          const sendTicked = state.cursor > idx // that seq's original send has been processed
          let bg = '#ffffff'
          let stroke = LINE
          let label = String(seq)
          let textColor = FADE
          if (isUdp) {
            if (state.delivered.includes(seq)) {
              bg = OK_BG
              stroke = OK
              textColor = OK
            } else if (sendTicked) {
              bg = ERR_BG
              stroke = ACCENT
              label = '×'
              textColor = ACCENT
            }
          } else if (state.released.includes(seq)) {
            bg = OK_BG
            stroke = OK
            textColor = OK
          } else if (held.includes(seq)) {
            bg = HOLD_BG
            stroke = HOLD
            textColor = HOLD
          }
          return (
            <g key={`slot-${seq}`}>
              <rect x={slotX(idx)} y={SLOTS_Y} width={SLOTS_W} height={SLOTS_H} rx={5} fill={bg} stroke={stroke} strokeWidth={1.2} />
              <text x={slotX(idx) + SLOTS_W / 2} y={SLOTS_Y + SLOTS_H / 2 + 4} fontSize={10.5} fill={textColor} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                {label}
              </text>
            </g>
          )
        })}
      </svg>

      <p className={styles.caption}>
        Heavily simplified: 8 fixed packets, one-way channel, no three-way
        handshake, no congestion control or windowing, and acks are implied
        rather than drawn. TCP&apos;s retransmit here is modeled as a
        guaranteed-to-arrive resend appended after the original sends, not real
        ack and timeout timing, so every run finishes in a bounded number of
        ticks. Loss is pseudo-random from a fixed seed, so the same loss
        setting always produces the same drops; real networks are burstier.
        Every readout above is read from the simulation, not typed in.
      </p>
    </Figure>
  )
}

function senderLine(state) {
  if (!state.lastEvent) return 'idle'
  const { seq, retransmit } = state.lastEvent
  return retransmit ? `resent seq ${seq}` : `sent seq ${seq}`
}

function receiverLine(state, isUdp) {
  const e = state.lastEvent
  if (!e) return 'idle'
  if (e.lost) return `seq ${e.seq} lost`
  if (isUdp) return `seq ${e.seq} arrived`
  const justReleased = state.released.length > 0 && state.released[state.released.length - 1] >= e.seq
  return justReleased ? `released through seq ${state.released[state.released.length - 1]}` : `seq ${e.seq} holding`
}

function statusFor(state, isUdp) {
  const e = state.lastEvent
  if (!e) {
    return isUdp
      ? `UDP, ${state.lossPct}% loss. Step through: every packet sends once, and a drop is just gone.`
      : `TCP, ${state.lossPct}% loss. Step through: a drop gets detected and resent, and the receiver holds anything out of order until the gap fills in.`
  }
  if (isUdp) {
    return e.lost ? `Packet ${e.seq} was dropped. UDP does not notice or recover: that sequence number is gone for good.` : `Packet ${e.seq} arrived and is delivered immediately, in whatever order it showed up.`
  }
  if (e.lost) return `Packet ${e.seq} was dropped. TCP will detect the gap and resend it later.`
  if (e.retransmit) return `Packet ${e.seq} arrived on retransmit. Anything that was waiting behind it can now release.`
  const held = heldSeqs(state)
  if (held.includes(e.seq)) return `Packet ${e.seq} arrived, but an earlier packet is still missing, so it holds in the buffer rather than reaching the application out of order.`
  return `Packet ${e.seq} arrived and released to the application immediately.`
}
