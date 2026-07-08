'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import {
  DOMAIN,
  ANSWER_IP,
  ANSWER_TTL,
  BOXES,
  initialState,
  step,
  lookup,
  expireCache,
  reset,
  isDone,
  serversAsked,
  stepsTaken,
  totalSteps,
  askedBoxes,
} from './dnsData'
import styles from './DnsViz.module.css'

const PLAY_MS = 1000

// Palette: the site family (ink / fade / accent) plus the ok-green and amber
// already used elsewhere in the section. No new colors. Amber marks a
// referral (not there yet); green marks a real answer, cached or fresh.
const INK = '#1a1a1a'
const FADE = '#9b9892'
const ACCENT = '#c0392b'
const OK = '#1f6f5c'
const OK_BG = '#e6f2ec'
const HOLD = '#caa24a'
const HOLD_BG = '#f6e7c8'
const LINE = '#e2e0d8'
const PANEL_BG = '#faf9f6'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

// Short header, full name (for status text/aria), and zone label (shown as a
// second line for the three server tiers; device and resolver have none).
const BOX_INFO = {
  device: { header: 'DEVICE', name: 'your device', zone: null },
  resolver: { header: 'RESOLVER', name: 'the recursive resolver', zone: null },
  root: { header: 'ROOT', name: 'a root server', zone: '.' },
  tld: { header: 'TLD', name: 'the .com TLD server', zone: '.com' },
  auth: { header: 'AUTH', name: "example.com's authoritative server", zone: 'example.com' },
}

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 460
const VB_H = 184

const TITLE_Y = 10

const BOX_Y = 24
const BOX_H = 42
const BOX_W = 80
const BOX_GAP = 10
const BOX_X0 = (VB_W - (BOXES.length * BOX_W + (BOXES.length - 1) * BOX_GAP)) / 2
const boxX = (i) => BOX_X0 + i * (BOX_W + BOX_GAP)
const boxCX = (i) => boxX(i) + BOX_W / 2
const BOX_BOTTOM = BOX_Y + BOX_H

const CACHE_LABEL_Y = 138
const CACHE_Y = 144
const CACHE_H = 26
const CACHE_W = 300
const CACHE_X = boxCX(BOXES.indexOf('resolver')) - CACHE_W / 2

const idxOf = (id) => BOXES.indexOf(id)
const arcDip = (distance) => 16 + distance * 14

export default function DnsViz() {
  const [state, setState] = useState(() => initialState())
  const [playing, setPlaying] = useState(false)
  const svgRef = useRef(null)

  const done = isDone(state)
  const isPlaying = playing && !done

  // Auto-advance with setInterval (never a rAF/anime chain). Keyed on `done`
  // so it tears down when the run finishes; the effect body only sets/clears
  // the timer.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setState((s) => (isDone(s) ? s : step(s))), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done])

  // Cosmetic flourish only: pulse the elements marked data-pulse (the two
  // boxes currently talking, and the message token). Pure animation, no
  // state change.
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
  const doLookup = () => setState((s) => (isDone(s) ? lookup(s) : s))
  const doExpire = () => setState((s) => (isDone(s) && s.cache ? expireCache(s) : s))

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: doReset, disabled: state.cursor === 0 && !state.cache },
  ]

  const readouts = [
    { label: 'servers asked', value: serversAsked(state) },
    { label: 'steps', value: `${stepsTaken(state)}/${totalSteps(state)}` },
    { label: 'cache', value: state.cache ? `${DOMAIN} = ${state.cache.ip} (ttl ${state.cache.ttl}s)` : 'empty' },
  ]

  const asked = askedBoxes(state)
  const e = state.lastEvent
  const activeIds = e ? [e.from, e.to] : []
  const status = statusFor(state)

  return (
    <Figure
      eyebrow="DNS"
      title="The phone book is distributed"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis={`Step through the first lookup and count how many servers actually knew ${DOMAIN}'s address: only the last one, the authoritative server. Root and TLD only ever hand back a referral, never the answer. Then press Look up again: root, TLD, and auth stay dark, servers asked drops from 4 to 1, and the answer comes straight back from cache.`}
    >
      <div className={styles.controlsRow}>
        <button type="button" className={styles.btn} onClick={doLookup} disabled={!done}>
          Look up again
        </button>
        <button type="button" className={styles.btn} onClick={doExpire} disabled={!done || !state.cache}>
          Expire cache (TTL)
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        role="img"
        aria-label={`Resolving ${DOMAIN}. ${serversAsked(state)} servers asked so far, step ${stepsTaken(state)} of ${totalSteps(state)}. Cache is ${state.cache ? `${DOMAIN} equals ${state.cache.ip}, ttl ${state.cache.ttl} seconds` : 'empty'}.`}
      >
        <text x={VB_W / 2} y={TITLE_Y} fontSize={8.5} fill={FADE} fontFamily={MONO} letterSpacing="0.1em" textAnchor="middle">
          {`RESOLVING ${DOMAIN.toUpperCase()}`}
        </text>

        {/* ── SERVICE BOXES ──────────────────────────────────────────────── */}
        {BOXES.map((id, i) => {
          const info = BOX_INFO[id]
          const wasAsked = asked.has(id)
          const active = activeIds.includes(id)
          return (
            <g key={id}>
              <rect
                data-pulse={active || undefined}
                x={boxX(i)}
                y={BOX_Y}
                width={BOX_W}
                height={BOX_H}
                rx={8}
                fill={wasAsked ? PANEL_BG : '#ffffff'}
                stroke={wasAsked ? INK : LINE}
                strokeWidth={active ? 1.6 : 1}
                opacity={wasAsked ? 1 : 0.55}
              />
              <text x={boxCX(i)} y={BOX_Y + 18} fontSize={9} fill={wasAsked ? INK : FADE} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                {info.header}
              </text>
              {info.zone && (
                <text x={boxCX(i)} y={BOX_Y + 32} fontSize={7.5} fill={FADE} fontFamily={MONO} textAnchor="middle">
                  {info.zone}
                </text>
              )}
            </g>
          )
        })}

        {/* ── MESSAGE: arcs below the row between whichever two are talking ── */}
        {e &&
          (() => {
            const a = idxOf(e.from)
            const b = idxOf(e.to)
            const lo = Math.min(a, b)
            const hi = Math.max(a, b)
            const distance = hi - lo
            const dip = arcDip(distance)
            const x1 = boxCX(lo)
            const x2 = boxCX(hi)
            const midX = (x1 + x2) / 2
            const peakY = BOX_BOTTOM + dip
            const color = e.kind === 'referral' ? HOLD : e.kind === 'query' ? INK : OK
            const bg = e.kind === 'referral' ? HOLD_BG : e.kind === 'query' ? '#ffffff' : OK_BG
            const labelW = Math.min(260, Math.max(70, e.label.length * 5.4 + 16))
            return (
              <g>
                <path
                  d={`M ${x1} ${BOX_BOTTOM} Q ${midX} ${peakY + 8} ${x2} ${BOX_BOTTOM}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.3}
                  strokeDasharray={e.kind === 'referral' ? '3 3' : undefined}
                  opacity={0.8}
                />
                <g data-pulse>
                  <rect x={midX - labelW / 2} y={peakY - 10} width={labelW} height={20} rx={5} fill={bg} stroke={color} strokeWidth={1.3} />
                  <text x={midX} y={peakY + 4} fontSize={8.5} fill={color} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                    {e.label}
                  </text>
                </g>
              </g>
            )
          })()}

        {/* ── CACHE (at the resolver) ────────────────────────────────────── */}
        <text x={CACHE_X} y={CACHE_LABEL_Y} fontSize={8.5} fill={FADE} fontFamily={MONO} letterSpacing="0.1em">
          CACHE (at the resolver)
        </text>
        <rect
          x={CACHE_X}
          y={CACHE_Y}
          width={CACHE_W}
          height={CACHE_H}
          rx={5}
          fill={state.cache ? OK_BG : '#ffffff'}
          stroke={state.cache ? OK : LINE}
          strokeWidth={state.cache ? 1.3 : 1}
          strokeDasharray={state.cache ? undefined : '3 3'}
        />
        <text x={CACHE_X + CACHE_W / 2} y={CACHE_Y + CACHE_H / 2 + 4} fontSize={9.5} fill={state.cache ? OK : FADE} fontFamily={MONO} fontWeight={state.cache ? 700 : 400} textAnchor="middle">
          {state.cache ? `${DOMAIN} = ${state.cache.ip}  (ttl ${state.cache.ttl}s)` : 'empty'}
        </text>
      </svg>

      <p className={styles.caption}>
        Heavily simplified: one query type (an A record lookup for{' '}
        {DOMAIN}, a reserved example domain per RFC 2606), one recursive
        resolver, and no device or browser cache shown, only the resolver&apos;s.
        Root and TLD each stand in for the many real server instances at that
        tier, and the referral chain here is abbreviated to one server per
        tier; a real lookup can also involve CNAME redirects this figure
        skips. The answer, {ANSWER_IP} with a {ANSWER_TTL} second TTL, is from
        the documentation-only TEST-NET-1 range (RFC 5737). Every readout
        above is read from the simulation, not typed in.
      </p>
    </Figure>
  )
}

function nameFor(id) {
  return BOX_INFO[id].name
}

function capName(id) {
  const n = nameFor(id)
  return n.charAt(0).toUpperCase() + n.slice(1)
}

function statusFor(state) {
  const e = state.lastEvent
  if (!e) {
    return state.runKind === 'miss'
      ? `Cache is empty. Step through: the resolver has never seen ${DOMAIN} before, so it must walk the whole chain.`
      : `Cache holds ${DOMAIN} = ${state.cache.ip}. Step through: this time the resolver already knows the answer.`
  }
  if (e.kind === 'query') {
    if (e.from === 'device') {
      return `Your device asks the resolver: "${e.label}" That is the only question the device ever asks; everything after this is the resolver's problem.`
    }
    return `The resolver asks ${nameFor(e.to)}: "${e.label}"`
  }
  if (e.kind === 'referral') {
    return `${capName(e.from)} does not hold the answer. It replies with a referral: ${e.label.replace('referral: ', '')}. Root and TLD servers never hold the final record, only who to ask next.`
  }
  if (e.kind === 'answer') {
    if (e.to === 'resolver') {
      return `${capName(e.from)} holds the actual record and answers: ${ANSWER_IP}, TTL ${ANSWER_TTL}s. The resolver caches it immediately.`
    }
    return `The resolver hands the answer back to your device: ${ANSWER_IP}.`
  }
  if (e.kind === 'cached-answer') {
    return `Cache hit. The resolver already had ${DOMAIN} = ${ANSWER_IP} cached, so it answers immediately without asking anyone else.`
  }
  return ''
}
