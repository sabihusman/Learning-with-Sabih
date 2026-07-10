'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import {
  STREAM,
  POLICIES,
  initialState,
  tick,
  killServer,
  reviveServer,
  isDone,
  maxLoad,
} from './loadBalancingData'
import styles from './LoadBalancingViz.module.css'

const PLAY_MS = 1100

// Palette: the site family (ink / fade / accent) plus the ok-green already used
// elsewhere and the amber "long" tone from the Caching figure. No new colors.
const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b' // overload, down servers, dropped requests
const OK = '#1f6f5c' // the request a server is actively processing
const OK_BG = '#e6f2ec'
const ERR_BG = '#fbecea'
const LONG_BG = '#f6e7c8' // a long (multi-tick) request in the stream
const LINE = '#e2e0d8'
const PANEL_BG = '#faf9f6'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 460
const VB_H = 216

// stream row (top)
const TOK_W = 20
const TOK_H = 16
const TOK_GAP = 6
const STREAM_X = 25
const STREAM_Y = 18
const tokenX = (i) => STREAM_X + i * (TOK_W + TOK_GAP)

// load balancer box (middle-left)
const LB_X = 34
const LB_W = 104
const LB_H = 44
const LB_Y = 96
const LB_CX = LB_X + LB_W
const LB_CY = LB_Y + LB_H / 2

// server boxes (right, stacked)
const SRV_X = 246
const SRV_W = 200
const SRV_H = 44
const SRV_GAP = 12
const SRV_Y0 = 48
const serverY = (i) => SRV_Y0 + i * (SRV_H + SRV_GAP)
const serverCY = (i) => serverY(i) + SRV_H / 2

export default function LoadBalancingViz() {
  const [state, setState] = useState(() => initialState('rr'))
  const [playing, setPlaying] = useState(false)
  const svgRef = useRef(null)

  const done = isDone(state)
  const isPlaying = playing && !done

  // Auto-advance with setInterval (never a rAF/anime chain). Keyed on `done` so it
  // tears down when the run finishes; the effect body only sets/clears the interval.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setState((s) => (isDone(s) ? s : tick(s))), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done])

  // Cosmetic flourish only: pulse the arrow and server the last request was routed
  // to, so each dispatch registers. Pure animation, no state change.
  useEffect(() => {
    if (!state.lastAssign || !svgRef.current) return
    const nodes = Array.from(svgRef.current.querySelectorAll('[data-pulse]'))
    if (nodes.length === 0) return
    animate(nodes, { opacity: [0.35, 1], duration: 480, ease: 'outQuad' })
  }, [state.tick, state.lastAssign])

  const onStep = () => setState((s) => (isDone(s) ? s : tick(s)))
  const reset = () => {
    setPlaying(false)
    setState((s) => initialState(s.policy))
  }
  const setPolicy = (p) => {
    if (p === state.policy) return
    setPlaying(false)
    setState(initialState(p)) // switching policy replays the same stream from the start
  }
  const toggleServer = (id) => {
    setState((s) => {
      const sv = s.servers.find((x) => x.id === id)
      return sv.up ? killServer(s, id) : reviveServer(s, id)
    })
  }

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: state.tick === 0 && state.dropped === 0 },
  ]

  const readouts = [
    ...state.servers.map((sv) => ({
      label: `server ${sv.id}`,
      value: sv.up ? sv.queue.length : 'down',
    })),
    { label: 'max load', value: maxLoad(state) },
    { label: 'completed', value: state.completed },
    { label: 'dropped', value: state.dropped },
  ]

  const policyLabel = POLICIES.find((p) => p.id === state.policy).label
  const remaining = STREAM.length - state.nextIndex
  const status = done
    ? `Done. ${policyLabel} finished the stream in ${state.tick} ticks. Peak server load was ${state.peakLoad}, ${state.dropped} dropped.`
    : `${policyLabel}. ${remaining} of ${STREAM.length} requests still incoming. Max server load right now is ${maxLoad(state)}.`

  return (
    <Figure
      eyebrow="Load balancing"
      title="One door, many servers"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Run the whole stream once under Round robin and watch max load climb to 4 on one server while the others sit near idle. Reset, switch to Least connections, and run the same stream: max load never passes 2. Then try killing server 2 partway through each run. Round robin keeps feeding its dead slot's neighbours until one is buried; least connections just routes around the gap."
    >
      {/* policy switch + per-server kill toggles: real buttons, keyboard reachable */}
      <div className={styles.controlsRow}>
        <span className={styles.groupLabel}>policy</span>
        {POLICIES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.btn} ${state.policy === p.id ? styles.btnOn : ''}`}
            aria-pressed={state.policy === p.id}
            onClick={() => setPolicy(p.id)}
          >
            {p.label}
          </button>
        ))}
        <span className={styles.groupLabel} style={{ marginLeft: 8 }}>
          servers
        </span>
        {state.servers.map((sv) => (
          <button
            key={sv.id}
            type="button"
            className={`${styles.btn} ${sv.up ? '' : styles.btnDown}`}
            aria-pressed={!sv.up}
            onClick={() => toggleServer(sv.id)}
          >
            {`Server ${sv.id}: ${sv.up ? 'up' : 'down'}`}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        role="img"
        aria-label={`Load balancing under ${policyLabel}. Server loads ${state.servers
          .map((s) => (s.up ? s.queue.length : 'down'))
          .join(', ')}. Max load ${maxLoad(state)}, ${state.completed} completed, ${state.dropped} dropped.`}
      >
        <defs>
          <marker id="lb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={FADE} />
          </marker>
        </defs>

        {/* ── REQUEST STREAM ─────────────────────────────────────────────── */}
        <text x={STREAM_X} y={10} fontSize={8.5} fill={FADE} fontFamily={MONO} letterSpacing="0.12em">
          REQUEST STREAM (number = ticks of work)
        </text>
        {STREAM.map((req, i) => {
          const dispatched = i < state.nextIndex
          const current = i === state.nextIndex - 1
          const long = req.dur > 1
          return (
            <g key={`req-${i}`} opacity={dispatched && !current ? 0.3 : 1}>
              <rect
                x={tokenX(i)}
                y={STREAM_Y}
                width={TOK_W}
                height={TOK_H}
                rx={4}
                fill={current ? OK_BG : long ? LONG_BG : '#ffffff'}
                stroke={current ? OK : long ? '#caa24a' : LINE}
                strokeWidth={current ? 1.8 : 1}
              />
              <text x={tokenX(i) + TOK_W / 2} y={STREAM_Y + TOK_H / 2 + 3.5} fontSize={9} fill={INK} fontFamily={MONO} fontWeight={long ? 700 : 400} textAnchor="middle">
                {req.dur}
              </text>
            </g>
          )
        })}

        {/* ── LOAD BALANCER ──────────────────────────────────────────────── */}
        <text x={LB_X} y={LB_Y - 6} fontSize={8.5} fill={FADE} fontFamily={MONO} letterSpacing="0.12em">
          LOAD BALANCER
        </text>
        <rect x={LB_X} y={LB_Y} width={LB_W} height={LB_H} rx={8} fill={PANEL_BG} stroke={LINE} strokeWidth={1} />
        <text x={LB_X + LB_W / 2} y={LB_Y + 18} fontSize={10} fill={INK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
          one door
        </text>
        <text x={LB_X + LB_W / 2} y={LB_Y + 32} fontSize={8} fill={FADE} fontFamily={MONO} textAnchor="middle">
          {policyLabel.toLowerCase()}
        </text>

        {/* ── ARROWS + SERVERS ───────────────────────────────────────────── */}
        {state.servers.map((sv, i) => {
          const y = serverY(i)
          const cy = serverCY(i)
          const targeted = state.lastAssign && state.lastAssign.serverId === sv.id
          const overloaded = sv.queue.length >= 3
          return (
            <g key={`srv-${sv.id}`}>
              {/* routing arrow from the balancer */}
              <line
                data-pulse={targeted || undefined}
                x1={LB_CX}
                y1={LB_CY}
                x2={SRV_X - 2}
                y2={cy}
                stroke={targeted ? INK : LINE}
                strokeWidth={targeted ? 1.8 : 1}
                markerEnd="url(#lb-arrow)"
                opacity={sv.up ? 1 : 0.3}
                strokeDasharray={sv.up ? undefined : '3 3'}
              />

              {/* server box */}
              <rect
                data-pulse={targeted || undefined}
                x={SRV_X}
                y={y}
                width={SRV_W}
                height={SRV_H}
                rx={8}
                fill={sv.up ? PANEL_BG : ERR_BG}
                stroke={sv.up ? (overloaded ? ACCENT : LINE) : ACCENT}
                strokeWidth={sv.up ? (overloaded ? 1.6 : 1) : 1.4}
                strokeDasharray={sv.up ? undefined : '4 3'}
              />
              <text x={SRV_X + 10} y={y + 15} fontSize={9.5} fill={sv.up ? INK : ACCENT} fontFamily={MONO} fontWeight={700}>
                {`SERVER ${sv.id}`}
              </text>
              <text x={SRV_X + SRV_W - 10} y={y + 15} fontSize={9} fill={overloaded ? ACCENT : FADE} fontFamily={MONO} fontWeight={overloaded ? 700 : 400} textAnchor="end">
                {sv.up ? `active ${sv.queue.length}` : 'DOWN'}
              </text>

              {/* the queue of request tokens on this server (front = processing) */}
              {sv.up &&
                sv.queue.map((job, qi) => (
                  <g key={`job-${job.reqId}`}>
                    <rect
                      x={SRV_X + 10 + qi * 19}
                      y={y + 22}
                      width={15}
                      height={15}
                      rx={3}
                      fill={qi === 0 ? OK_BG : '#ffffff'}
                      stroke={qi === 0 ? OK : FADE}
                      strokeWidth={qi === 0 ? 1.4 : 1}
                    />
                    <text x={SRV_X + 10 + qi * 19 + 7.5} y={y + 22 + 11} fontSize={8.5} fill={INK} fontFamily={MONO} textAnchor="middle">
                      {job.reqId}
                    </text>
                  </g>
                ))}

              {/* dropped-request ghosts, shown leaving a just-killed server */}
              {!sv.up &&
                state.lastDrops.map((rid, di) => (
                  <g key={`drop-${rid}`} data-pulse>
                    <rect x={SRV_X + 10 + di * 19} y={y + 22} width={15} height={15} rx={3} fill={ERR_BG} stroke={ACCENT} strokeWidth={1.2} strokeDasharray="2 2" />
                    <text x={SRV_X + 10 + di * 19 + 7.5} y={y + 22 + 11} fontSize={8.5} fill={ACCENT} fontFamily={MONO} textAnchor="middle">
                      {rid}
                    </text>
                  </g>
                ))}
            </g>
          )
        })}
      </svg>

      <p className={styles.caption}>
        Each server handles one request at a time; the rest queue behind it, so its
        active count is the queue length and a long request holds up everything after
        it. Least connections sends each request to the up server with the shortest
        queue, ties going to the lowest number. Switching policy replays the same
        stream from the start, and a killed server loses whatever it was holding. Every
        count is read from the simulation, not typed in.
      </p>
    </Figure>
  )
}
