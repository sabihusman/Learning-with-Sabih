'use client'

import { useState } from 'react'
import Figure from './Figure'
import {
  OPS,
  MODES,
  REPLICAS,
  START_BALANCE,
  scheduleFor,
  totalStepsFor,
  writeCostFor,
  stateAt,
  killAt,
} from './replicationData'
import styles from './ReplicationViz.module.css'

// Reader-driven only. There is no interval, no animation frame, and no auto-advance
// anywhere in this component: every value below is stateAt(mode, step), a pure
// function of the step index. That is also why it takes no speed control.

// Palette: the site family already used by the Systems figures. No new colors.
const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b' // stale, lost, failed
const OK = '#1f6f5c' // fresh, arrived
const OK_BG = '#e6f2ec'
const ERR_BG = '#fbecea'
const WAIT = '#caa24a' // in flight / waiting
const WAIT_BG = '#f6e7c8'
const LINE = '#e2e0d8'
const PANEL_BG = '#faf9f6'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 440
const VB_H = 296

const STRIP_X0 = 18
const STRIP_X1 = 422
const STRIP_Y = 20
const STRIP_H = 12

const P_X = 16
const P_Y = 62
const P_W = 152
const P_H = 74

const R_X = 228
const R_W = 196
const R_H = 78
const R1_Y = 54
const R2_Y = 148

const CHIP_W = 56
const CHIP_H = 17
const CHIP_GAP = 4

const PANEL_X = 16
const PANEL_Y = 238
const PANEL_W = VB_W - 32
const PANEL_H = 46

const replicaY = (id) => (id === 'r1' ? R1_Y : R2_Y)

export default function ReplicationViz() {
  const [mode, setMode] = useState('async')
  const [step, setStep] = useState(0)
  const [killed, setKilled] = useState(null) // the killAt() result, frozen at its step

  const sched = scheduleFor(mode)
  const total = totalStepsFor(mode)
  const state = stateAt(mode, step)
  const done = step >= total

  const pickMode = (id) => {
    if (id === mode) return
    setMode(id)
    setStep(0)
    setKilled(null)
  }
  const onStep = () => setStep((s) => Math.min(total, s + 1))
  const onBack = () => setStep((s) => Math.max(0, s - 1))
  const onReset = () => {
    setStep(0)
    setKilled(null)
  }
  const onKill = () => setKilled(killAt(sched, step))

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done || !!killed },
    { label: 'Back', onClick: onBack, disabled: step === 0 || !!killed },
    { label: 'Reset', onClick: onReset, disabled: step === 0 && !killed },
    { label: 'Kill the primary', onClick: onKill, disabled: !!killed },
  ]

  const readouts = [
    { label: 'primary', value: killed ? 'gone' : state.primary },
    ...state.replicas.map((r) => ({
      label: killed && killed.promoted.id === r.id ? `${r.name} (primary)` : r.name,
      value: r.value,
    })),
    { label: 'reads served stale', value: state.staleReads },
    { label: 'step', value: `${step} / ${total}` },
  ]

  return (
    <Figure
      eyebrow="Replication"
      title="One balance, three copies, and the lag between them"
      controls={controls}
      status={statusFor(state, killed, mode)}
      readouts={readouts}
      tryThis="Step through in asynchronous mode and watch the pending lists fill: those are writes the client was already told had succeeded, sitting on the primary and not yet on a replica. Kill the primary while a pending list is non-empty and the promoted replica has no way to recover exactly those writes. Then switch to synchronous, watch the step counter for the same twenty operations, and kill the primary mid-wait: nothing acknowledged is ever lost, and the extra steps are what bought that."
    >
      <div className={styles.controlsRow}>
        <span className={styles.groupLabel}>replication</span>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`${styles.btn} ${mode === m.id ? styles.btnOn : ''}`}
            aria-pressed={mode === m.id}
            onClick={() => pickMode(m.id)}
          >
            {m.label}
          </button>
        ))}
        <span className={styles.groupLabel}>
          {`${totalStepsFor(mode)} steps for ${OPS.length} ops, ${writeCostFor(mode)} per write`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        role="img"
        aria-label={ariaFor(state, killed, mode, total)}
      >
        {/* ── STEP STRIP ─────────────────────────────────────────────────── */}
        <text x={STRIP_X0} y={11} fontSize={8.5} fill={FADE} fontFamily={MONO} letterSpacing="0.1em">
          {`STEPS (filled = write, hollow = read, pale = waiting for acks)`}
        </text>
        <Strip state={state} sched={sched} total={total} killedAt={killed ? killed.step : null} />

        {/* ── REPLICATION WIRES ──────────────────────────────────────────── */}
        {REPLICAS.map((r) => {
          const y = replicaY(r.id) + R_H / 2
          const promoted = killed && killed.promoted.id === r.id
          const cut = !!killed
          return (
            <g key={`wire-${r.id}`}>
              <line
                x1={P_X + P_W}
                y1={P_Y + P_H / 2}
                x2={R_X}
                y2={y}
                stroke={cut ? ACCENT : FADE}
                strokeWidth={1.3}
                strokeDasharray={cut ? '4 3' : undefined}
              />
              <text
                x={(P_X + P_W + R_X) / 2}
                y={(P_Y + P_H / 2 + y) / 2 - 4}
                fontSize={8}
                fill={cut ? ACCENT : FADE}
                fontFamily={MONO}
                textAnchor="middle"
              >
                {cut ? (promoted ? 'promoted' : 'orphaned') : `lag ${r.lag}`}
              </text>
            </g>
          )
        })}

        {/* ── PRIMARY ────────────────────────────────────────────────────── */}
        <g opacity={killed ? 0.45 : 1}>
          <rect
            x={P_X}
            y={P_Y}
            width={P_W}
            height={P_H}
            rx={8}
            fill={killed ? ERR_BG : PANEL_BG}
            stroke={killed ? ACCENT : LINE}
            strokeWidth={killed ? 1.6 : 1}
          />
          <text x={P_X + 12} y={P_Y + 17} fontSize={9.5} fill={INK} fontFamily={MONO} fontWeight={700}>
            PRIMARY
          </text>
          <text
            x={P_X + P_W / 2}
            y={P_Y + 45}
            fontSize={19}
            fill={killed ? ACCENT : INK}
            fontFamily={MONO}
            fontWeight={700}
            textAnchor="middle"
          >
            {killed ? 'down' : state.primary}
          </text>
          <text x={P_X + P_W / 2} y={P_Y + 62} fontSize={8} fill={FADE} fontFamily={MONO} textAnchor="middle">
            {killed ? `held ${killed.primaryValue} when it died` : 'balance, every write lands here first'}
          </text>
        </g>

        {/* ── REPLICAS ───────────────────────────────────────────────────── */}
        {state.replicas.map((r) => {
          const y = replicaY(r.id)
          const isTarget = !killed && state.event && state.event.kind === 'read' && state.event.replica === r.id
          const staleNow = isTarget && state.lastRead && state.lastRead.stale
          const promoted = killed && killed.promoted.id === r.id
          let stroke = LINE
          let fill = '#ffffff'
          if (promoted) {
            stroke = OK
            fill = OK_BG
          } else if (killed) {
            stroke = LINE
          } else if (isTarget) {
            stroke = staleNow ? ACCENT : OK
            fill = staleNow ? ERR_BG : OK_BG
          }
          return (
            <g key={r.id} opacity={killed && !promoted ? 0.5 : 1}>
              <rect x={R_X} y={y} width={R_W} height={R_H} rx={8} fill={fill} stroke={stroke} strokeWidth={isTarget || promoted ? 1.6 : 1} />
              <text x={R_X + 12} y={y + 17} fontSize={9.5} fill={INK} fontFamily={MONO} fontWeight={700}>
                {promoted ? `${r.name.toUpperCase()} - NOW PRIMARY` : r.name.toUpperCase()}
              </text>
              <text x={R_X + R_W - 12} y={y + 17} fontSize={8} fill={FADE} fontFamily={MONO} textAnchor="end">
                {`lag ${r.lag}`}
              </text>
              <text x={R_X + 12} y={y + 41} fontSize={17} fill={INK} fontFamily={MONO} fontWeight={700}>
                {r.value}
              </text>
              {isTarget && (
                <text
                  x={R_X + R_W - 12}
                  y={y + 41}
                  fontSize={9}
                  fill={staleNow ? ACCENT : OK}
                  fontFamily={MONO}
                  fontWeight={700}
                  textAnchor="end"
                >
                  {staleNow ? `read ${state.lastRead.returned}, stale` : `read ${state.lastRead.returned}, fresh`}
                </text>
              )}

              {/* the specific pending writes, not a depth count */}
              <text x={R_X + 12} y={y + 58} fontSize={8} fill={FADE} fontFamily={MONO} letterSpacing="0.08em">
                {pendingLabel(r.pending, mode)}
              </text>
              {r.pending.slice(0, 3).map((w, i) => (
                <g key={`${r.id}-p-${w.seq}`}>
                  <rect
                    x={R_X + 12 + i * (CHIP_W + CHIP_GAP)}
                    y={y + 62}
                    width={CHIP_W}
                    height={CHIP_H}
                    rx={4}
                    fill={WAIT_BG}
                    stroke={WAIT}
                    strokeWidth={1}
                  />
                  <text
                    x={R_X + 12 + i * (CHIP_W + CHIP_GAP) + CHIP_W / 2}
                    y={y + 62 + 12}
                    fontSize={8.5}
                    fill={INK}
                    fontFamily={MONO}
                    textAnchor="middle"
                  >
                    {`${w.value}@s${w.arrival[r.id]}`}
                  </text>
                </g>
              ))}
            </g>
          )
        })}

        {/* ── PANEL ──────────────────────────────────────────────────────── */}
        <rect
          x={PANEL_X}
          y={PANEL_Y}
          width={PANEL_W}
          height={PANEL_H}
          rx={6}
          fill={killed ? (killed.acknowledgedLost.length > 0 ? ERR_BG : OK_BG) : PANEL_BG}
          stroke={killed ? (killed.acknowledgedLost.length > 0 ? ACCENT : OK) : LINE}
          strokeWidth={killed ? 1.4 : 1}
        />
        {panelLines(state, killed, mode).map((line, i) => (
          <text
            key={`panel-${i}`}
            x={PANEL_X + 12}
            y={PANEL_Y + 18 + i * 13}
            fontSize={9}
            fill={i === 0 && killed ? (killed.acknowledgedLost.length > 0 ? ACCENT : OK) : INK}
            fontFamily={MONO}
            fontWeight={i === 0 ? 700 : 400}
          >
            {line}
          </text>
        ))}
      </svg>

      <p className={styles.caption}>
        One key holding one integer, a primary, and two replicas with authored lags of{' '}
        {REPLICAS.map((r) => `${r.lag}`).join(' and ')} steps. The balance starts at {START_BALANCE}. Nothing here is
        timed or sampled: every value, arrival, pending list, stale count, and loss set is computed from the step index
        over a frozen twenty-operation stream. Real systems replicate over a network whose delay varies, use quorums
        rather than all-replicas acknowledgement, and can often recover a failed primary rather than discarding it.
      </p>
    </Figure>
  )
}

// ── strip ───────────────────────────────────────────────────────────────────────

function Strip({ state, sched, total, killedAt }) {
  const gap = total > 24 ? 1.5 : 3
  const tw = (STRIP_X1 - STRIP_X0 - gap * (total - 1)) / total
  const readAt = new Map(state.reads.map((r) => [r.step, r]))
  const current = killedAt ?? state.step

  return (
    <g>
      {Array.from({ length: total }, (_, i) => {
        const s = i + 1
        const e = sched.events[s]
        const executed = s <= state.step
        const isCurrent = s === current && current > 0
        let fill = '#ffffff'
        let stroke = LINE
        if (e.kind === 'write') {
          fill = executed ? INK : '#ffffff'
          stroke = executed ? INK : LINE
        } else if (e.kind === 'wait') {
          fill = executed ? WAIT_BG : '#ffffff'
          stroke = executed ? WAIT : LINE
        } else if (executed) {
          const r = readAt.get(s)
          fill = r && r.stale ? ERR_BG : OK_BG
          stroke = r && r.stale ? ACCENT : OK
        }
        return (
          <rect
            key={`tick-${s}`}
            x={STRIP_X0 + i * (tw + gap)}
            y={STRIP_Y}
            width={tw}
            height={STRIP_H}
            rx={2}
            fill={fill}
            stroke={isCurrent ? INK : stroke}
            strokeWidth={isCurrent ? 1.8 : 0.9}
            opacity={executed || isCurrent ? 1 : 0.5}
          />
        )
      })}
      {current > 0 && (
        <text
          x={STRIP_X0 + (current - 1) * (tw + gap) + tw / 2}
          y={STRIP_Y + STRIP_H + 10}
          fontSize={8}
          fill={INK}
          fontFamily={MONO}
          textAnchor="middle"
        >
          {`s${current}`}
        </text>
      )}
    </g>
  )
}

// ── copy helpers ────────────────────────────────────────────────────────────────

function pendingLabel(pending, mode) {
  if (pending.length === 0) return 'NOTHING PENDING, CAUGHT UP'
  return mode === 'sync' ? 'IN FLIGHT, NOT YET ACKNOWLEDGED' : 'ACKNOWLEDGED, NOT YET ARRIVED'
}

function writeList(writes) {
  return writes.map((w) => `${w.value} (issued s${w.issueStep})`).join(', ')
}

function panelLines(state, killed, mode) {
  if (killed) {
    const { promoted, primaryValue, promotedValue, acknowledgedLost, inFlightLost } = killed
    if (acknowledgedLost.length > 0) {
      return [
        `Primary down at s${killed.step}. ${promoted.name} promoted: it was furthest ahead.`,
        `Lost, already acknowledged to the client: ${writeList(acknowledgedLost)}.`,
        `The primary held ${primaryValue}. The balance is now ${promotedValue}.`,
      ]
    }
    if (inFlightLost.length > 0) {
      return [
        `Primary down at s${killed.step}. ${promoted.name} promoted: it was furthest ahead.`,
        `Dropped, but never acknowledged: ${writeList(inFlightLost)}. No client was told it succeeded.`,
        `The balance is ${promotedValue}, and every acknowledged write survives.`,
      ]
    }
    return [
      `Primary down at s${killed.step}. ${promoted.name} promoted: it was furthest ahead.`,
      'Nothing was lost: the promoted replica already held every write the primary had.',
      `The balance is ${promotedValue}.`,
    ]
  }

  const e = state.event
  if (!e) {
    return [
      `Step 0 of ${state.totalSteps}. ${mode === 'sync' ? 'Synchronous' : 'Asynchronous'} replication.`,
      `Balance ${state.primary} on all three nodes. Step forward to run the stream.`,
    ]
  }
  if (e.kind === 'write') {
    // On a write's issue step the primary is, by definition, holding that write.
    const value = state.primary
    return mode === 'sync'
      ? [`s${e.step}: write ${value} issued. Not acknowledged until both replicas hold it.`, 'The next few steps are the wait.']
      : [`s${e.step}: write ${value} lands on the primary and is acknowledged at once.`, 'It reaches each replica after that replica\'s lag.']
  }
  if (e.kind === 'wait') {
    return e.acks
      ? [`s${e.step}: both replicas now hold the write, so it is acknowledged.`, 'This is the step the client has been waiting on.']
      : [`s${e.step}: waiting. The write is not acknowledged while any replica is missing it.`, 'These are the extra steps synchronous replication costs.']
  }
  const rd = state.lastRead
  const name = REPLICAS.find((r) => r.id === e.replica).name
  return rd && rd.stale
    ? [`s${e.step}: read from ${name} returned ${rd.returned}.`, `The primary holds ${rd.primary}, so this read is stale.`]
    : [`s${e.step}: read from ${name} returned ${rd ? rd.returned : ''}.`, 'That matches the primary, so this read is fresh.']
}

function statusFor(state, killed, mode) {
  if (killed) {
    const n = killed.acknowledgedLost.length
    if (n > 0) {
      return `${killed.promoted.name} was promoted and ${n} acknowledged ${n === 1 ? 'write is' : 'writes are'} gone: ${writeList(
        killed.acknowledgedLost,
      )}. The client was told each of those had succeeded.`
    }
    if (killed.inFlightLost.length > 0) {
      return `${killed.promoted.name} was promoted. The dropped ${killed.inFlightLost.length === 1 ? 'write was' : 'writes were'} still in flight and never acknowledged, so nothing a client was promised is missing.`
    }
    return `${killed.promoted.name} was promoted with nothing pending, so no write was lost.`
  }
  const label = mode === 'sync' ? 'Synchronous' : 'Asynchronous'
  if (state.step === 0) {
    return `${label} replication over ${OPS.length} operations, which takes ${state.totalSteps} steps in this mode. Step forward, or kill the primary at any point.`
  }
  if (state.step >= state.totalSteps) {
    return `Stream finished in ${state.totalSteps} steps with ${state.staleReads} of the reads served stale.`
  }
  const pending = state.replicas.reduce((n, r) => n + r.pending.length, 0)
  return `Step ${state.step} of ${state.totalSteps}. ${pending} write${pending === 1 ? '' : 's'} in the replication pipeline right now.`
}

function ariaFor(state, killed, mode, total) {
  const base = `Replication figure, ${mode === 'sync' ? 'synchronous' : 'asynchronous'} mode, step ${state.step} of ${total}.`
  if (killed) {
    return `${base} Primary killed. ${killed.promoted.name} promoted holding ${killed.promotedValue}. ${killed.acknowledgedLost.length} acknowledged writes lost.`
  }
  const rep = state.replicas.map((r) => `${r.name} ${r.value}, ${r.pending.length} pending`).join('. ')
  return `${base} Primary ${state.primary}. ${rep}. ${state.staleReads} reads served stale.`
}
