'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import {
  OPS,
  CHOICES,
  initialState,
  step,
  setLink,
  setChoice,
  reset,
  isDone,
  hasConflict,
} from './capTheoremData'
import styles from './CapTheoremViz.module.css'

const PLAY_MS = 1300

// Palette: the site family (ink / fade / accent) plus the ok-green already used
// elsewhere. No new colors.
const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b' // partition, refusal, and disagreement
const OK = '#1f6f5c' // agreement / a replicated write
const OK_BG = '#e6f2ec'
const ERR_BG = '#fbecea'
const LINE = '#e2e0d8'
const PANEL_BG = '#faf9f6'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 460
const VB_H = 210

// op sequence row
const OP_W = 58
const OP_H = 20
const OP_GAP = 8
const OP_Y = 20
const OP_X0 = (VB_W - (OPS.length * OP_W + (OPS.length - 1) * OP_GAP)) / 2
const opX = (i) => OP_X0 + i * (OP_W + OP_GAP)

// nodes
const NODE_W = 110
const NODE_H = 58
const NODE_Y = 66
const NODE_A_X = 55
const NODE_B_X = 295
const NODE_A_CX = NODE_A_X + NODE_W / 2
const NODE_B_CX = NODE_B_X + NODE_W / 2
const LINK_Y = NODE_Y + NODE_H / 2
const LINK_MX = (NODE_A_X + NODE_W + NODE_B_X) / 2

// clients
const CLIENT_W = 80
const CLIENT_H = 34
const CLIENT_Y = 158
const CLIENT_A_X = NODE_A_CX - CLIENT_W / 2
const CLIENT_B_X = NODE_B_CX - CLIENT_W / 2

const opLabel = (op) => `${op.client} ${op.op === 'write' ? `w${op.value}` : 'r'}`

export default function CapTheoremViz() {
  const [state, setState] = useState(() => initialState())
  const [playing, setPlaying] = useState(false)
  const svgRef = useRef(null)

  const done = isDone(state)
  const isPlaying = playing && !done
  const disagree = state.a !== state.b
  const conflict = hasConflict(state)

  // Auto-advance with setInterval (never a rAF/anime chain). Keyed on `done` so it
  // tears down when the sequence finishes; the effect body only sets/clears the timer.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setState((s) => (isDone(s) ? s : step(s))), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done])

  // Cosmetic flourish only: pulse the elements marked data-pulse (the acting node and,
  // on a healthy write, the replication token). Pure animation, no state change.
  useEffect(() => {
    if (!state.lastOp || !svgRef.current) return
    const nodes = Array.from(svgRef.current.querySelectorAll('[data-pulse]'))
    if (nodes.length === 0) return
    animate(nodes, { opacity: [0.4, 1], duration: 500, ease: 'outQuad' })
  }, [state.opIndex, state.lastOp])

  const onStep = () => setState((s) => (isDone(s) ? s : step(s)))
  const doReset = () => {
    setPlaying(false)
    setState((s) => reset(s))
  }
  const toggleLink = () => {
    setState((s) => setLink(s, !s.linkHealthy))
  }
  const pickChoice = (c) => {
    setState((s) => setChoice(s, c))
  }

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: doReset, disabled: state.opIndex === 0 && state.refused === 0 && state.diverged === 0 },
  ]

  const readouts = [
    { label: 'Node A x', value: state.a },
    { label: 'Node B x', value: state.b },
    { label: 'refused', value: state.refused },
    { label: 'divergences', value: state.diverged },
    { label: 'link', value: state.linkHealthy ? 'healthy' : 'partitioned' },
  ]

  const status = statusFor(state, conflict)
  const actingA = state.lastOp && state.lastOp.client === 'A'
  const actingB = state.lastOp && state.lastOp.client === 'B'

  return (
    <Figure
      eyebrow="CAP theorem"
      title="Two copies, one truth"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Run the sequence three ways and watch which readout pays. Healthy link: nothing pays, both nodes end at 3. Partitioned and preferring consistency: every operation is refused, the count climbs to 6, but the data never diverges. Partitioned and preferring availability: nothing is refused, yet the nodes drift to 2 and 3 and the divergence count hits 6. Then heal the link after the availability run and see the conflict it left behind."
    >
      {/* network toggle + partition-behaviour choice: real buttons, keyboard reachable */}
      <div className={styles.controlsRow}>
        <span className={styles.groupLabel}>network</span>
        <button
          type="button"
          className={`${styles.btn} ${state.linkHealthy ? '' : styles.btnPartitioned}`}
          aria-pressed={!state.linkHealthy}
          onClick={toggleLink}
        >
          {state.linkHealthy ? 'Network: healthy' : 'Network: partitioned'}
        </button>
        <span className={styles.groupLabel} style={{ marginLeft: 8 }}>
          when partitioned
        </span>
        {CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`${styles.btn} ${state.choice === c.id ? styles.btnOn : ''}`}
            aria-pressed={state.choice === c.id}
            disabled={state.linkHealthy}
            onClick={() => pickChoice(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        role="img"
        aria-label={`CAP theorem, ${state.linkHealthy ? 'healthy link' : `partition, preferring ${state.choice === 'C' ? 'consistency' : 'availability'}`}. Node A has x=${state.a}, Node B has x=${state.b}. ${state.refused} refused, ${state.diverged} divergences.`}
      >
        {/* ── OPERATION SEQUENCE ─────────────────────────────────────────── */}
        <text x={OP_X0} y={10} fontSize={8.5} fill={FADE} fontFamily={MONO} letterSpacing="0.12em">
          OPERATIONS (w = write, r = read)
        </text>
        {OPS.map((op, i) => {
          const executed = i < state.opIndex
          const current = i === state.opIndex - 1
          let bg = '#ffffff'
          let stroke = LINE
          if (current && state.lastOp) {
            if (state.lastOp.outcome === 'refused') {
              bg = ERR_BG
              stroke = ACCENT
            } else if (state.lastOp.diverged) {
              bg = '#f6e7c8'
              stroke = '#caa24a'
            } else {
              bg = OK_BG
              stroke = OK
            }
          }
          return (
            <g key={`op-${i}`} opacity={executed && !current ? 0.35 : 1}>
              <rect x={opX(i)} y={OP_Y} width={OP_W} height={OP_H} rx={5} fill={bg} stroke={stroke} strokeWidth={current ? 1.8 : 1} />
              <text x={opX(i) + OP_W / 2} y={OP_Y + OP_H / 2 + 3.5} fontSize={11} fill={INK} fontFamily={MONO} fontWeight={op.op === 'write' ? 700 : 400} textAnchor="middle">
                {opLabel(op)}
              </text>
            </g>
          )
        })}

        {/* ── NETWORK LINK ───────────────────────────────────────────────── */}
        {state.linkHealthy ? (
          <g>
            <line x1={NODE_A_X + NODE_W} y1={LINK_Y} x2={NODE_B_X} y2={LINK_Y} stroke={FADE} strokeWidth={1.4} />
            <text x={LINK_MX} y={LINK_Y - 8} fontSize={8} fill={FADE} fontFamily={MONO} textAnchor="middle">
              replication
            </text>
            {/* replication message token on a healthy write */}
            {state.lastReplicated && state.lastOp && (
              <g data-pulse>
                <rect x={LINK_MX - 13} y={LINK_Y - 9} width={26} height={18} rx={4} fill={OK_BG} stroke={OK} strokeWidth={1.3} />
                <text x={LINK_MX} y={LINK_Y + 3.5} fontSize={9.5} fill={OK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                  {`x=${state.a}`}
                </text>
              </g>
            )}
          </g>
        ) : (
          <g>
            <line x1={NODE_A_X + NODE_W} y1={LINK_Y} x2={LINK_MX - 12} y2={LINK_Y} stroke={ACCENT} strokeWidth={1.4} strokeDasharray="4 3" />
            <line x1={LINK_MX + 12} y1={LINK_Y} x2={NODE_B_X} y2={LINK_Y} stroke={ACCENT} strokeWidth={1.4} strokeDasharray="4 3" />
            <text x={LINK_MX} y={LINK_Y - 6} fontSize={12} fill={ACCENT} fontFamily={MONO} fontWeight={700} textAnchor="middle">
              &#215;
            </text>
            <text x={LINK_MX} y={LINK_Y + 16} fontSize={8} fill={ACCENT} fontFamily={MONO} textAnchor="middle">
              partitioned
            </text>
          </g>
        )}

        {/* ── REPLICA NODES ──────────────────────────────────────────────── */}
        {[
          { id: 'A', x: NODE_A_X, cx: NODE_A_CX, val: state.a, acting: actingA },
          { id: 'B', x: NODE_B_X, cx: NODE_B_CX, val: state.b, acting: actingB },
        ].map((n) => (
          <g key={`node-${n.id}`}>
            <rect
              data-pulse={n.acting || undefined}
              x={n.x}
              y={NODE_Y}
              width={NODE_W}
              height={NODE_H}
              rx={8}
              fill={disagree ? ERR_BG : PANEL_BG}
              stroke={disagree ? ACCENT : LINE}
              strokeWidth={disagree ? 1.5 : 1}
            />
            <text x={n.x + 10} y={NODE_Y + 15} fontSize={9.5} fill={INK} fontFamily={MONO} fontWeight={700}>
              {`NODE ${n.id}`}
            </text>
            <text x={n.cx} y={NODE_Y + 44} fontSize={20} fill={disagree ? ACCENT : INK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
              {`x = ${n.val}`}
            </text>
          </g>
        ))}

        {/* ── CLIENTS ────────────────────────────────────────────────────── */}
        {[
          { id: 'A', x: CLIENT_A_X, cx: NODE_A_CX, acting: actingA },
          { id: 'B', x: CLIENT_B_X, cx: NODE_B_CX, acting: actingB },
        ].map((c) => {
          const refused = c.acting && state.lastOp.outcome === 'refused'
          return (
            <g key={`client-${c.id}`}>
              {/* wire up to the node */}
              <line x1={c.cx} y1={CLIENT_Y} x2={c.cx} y2={NODE_Y + NODE_H} stroke={LINE} strokeWidth={1} />
              <rect
                data-pulse={c.acting || undefined}
                x={c.x}
                y={CLIENT_Y}
                width={CLIENT_W}
                height={CLIENT_H}
                rx={6}
                fill={refused ? ERR_BG : '#ffffff'}
                stroke={refused ? ACCENT : c.acting ? INK : LINE}
                strokeWidth={c.acting ? 1.6 : 1}
              />
              <text x={c.x + CLIENT_W / 2} y={CLIENT_Y + 14} fontSize={9} fill={INK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                {`CLIENT ${c.id}`}
              </text>
              <text x={c.x + CLIENT_W / 2} y={CLIENT_Y + 26} fontSize={8.5} fill={refused ? ACCENT : FADE} fontFamily={MONO} textAnchor="middle">
                {c.acting ? clientLine(state.lastOp) : 'idle'}
              </text>
            </g>
          )
        })}
      </svg>

      <p className={styles.caption}>
        A deliberately small model: one key x, two replicas, and synchronous
        replication while the link is healthy. Consistency here means the two nodes
        never disagree (stricter than the ACID consistency of the Isolation Levels
        topic). Real systems use quorums, asynchronous replication, and finer-grained
        levels, and must resolve the conflict a healed availability partition leaves
        behind. Every count above is read from the simulation, not typed in.
      </p>
    </Figure>
  )
}

function clientLine(lastOp) {
  if (!lastOp) return 'idle'
  if (lastOp.op === 'write') return lastOp.outcome === 'refused' ? 'write refused' : `wrote x=${lastOp.value}`
  return lastOp.outcome === 'refused' ? 'read refused' : `read x=${lastOp.returned}`
}

function statusFor(state, conflict) {
  const { lastOp } = state
  if (conflict) {
    return `Link restored, but Node A has x=${state.a} and Node B has x=${state.b}. The system must now reconcile the two; resolving that conflict is out of scope here.`
  }
  if (!lastOp) {
    return state.linkHealthy
      ? 'Healthy link. Step through the sequence: with the network up you get both consistency and availability. The theorem is about what happens when the link breaks.'
      : `Partitioned, preferring ${state.choice === 'C' ? 'consistency' : 'availability'}. Step to see the price this choice pays.`
  }
  const who = `Client ${lastOp.client}`
  switch (lastOp.outcome) {
    case 'replicated':
      return `${who} wrote x=${lastOp.value}. It replicated across the link, so both nodes agree.`
    case 'agree':
      return `${who} read x=${lastOp.returned}. Both nodes agree.`
    case 'refused':
      return `${who}'s ${lastOp.op} was refused. To stay consistent during a partition, the system refuses what it cannot confirm across the link, so nothing diverges.`
    case 'local-write':
      return `${who} wrote x=${lastOp.value} to Node ${lastOp.client} only. The link is down, so it could not replicate: the nodes now disagree.`
    case 'stale-read':
      return `${who} read x=${lastOp.returned} from Node ${lastOp.client}. The other node holds a different value, so this read is stale.`
    default:
      return ''
  }
}
