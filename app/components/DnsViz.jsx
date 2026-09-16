'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import { useAnimationSpeedRef } from './animationSpeed'
import { usePacedInterval } from './usePacedInterval'
import { prefersReducedMotion } from './motion'
import { INK, FADE, OK, OK_BG, AMBER, AMBER_BG, RULE, PANEL, MONO } from './vizPalette'
import shared from './vizShared.module.css'
import {
  DOMAIN,
  ANSWER_IP,
  TTL_MIN,
  TTL_MAX,
  TTL_DEFAULT,
  TTL_STEP,
  TTL_TICK_MS,
  BOXES,
  initialState,
  step,
  lookup,
  tickTtl,
  reset,
  isDone,
  serversAsked,
  stepsTaken,
  totalSteps,
  askedBoxes,
} from './dnsData'
import styles from './DnsViz.module.css'

const PLAY_MS = 1000

// Colours come from the shared palette: amber marks a referral (in-between,
// not there yet); green marks a real answer, cached or fresh.

// Smallest SVG label is 7.5px in a 460-wide viewBox, so the drawing keeps a
// 430px floor (7px rendered) and scrolls sideways inside the card on phones.
const SVG_MIN_WIDTH = 430

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
// Centered on the canvas rather than on the resolver box: at this width,
// centering on the resolver (index 1, near the left) pushed the panel's left
// edge to x=-10, clipping the "CA" off "CACHE (at the resolver)".
const CACHE_X = (VB_W - CACHE_W) / 2

const idxOf = (id) => BOXES.indexOf(id)
const arcDip = (distance) => 16 + distance * 14

export default function DnsViz() {
  const [state, setState] = useState(() => initialState())
  const [playing, setPlaying] = useState(false)
  const [ttlSeconds, setTtlSeconds] = useState(TTL_DEFAULT)
  const svgRef = useRef(null)

  const done = isDone(state)
  const isPlaying = playing && !done

  // Stable ref to the shared animation-speed multiplier: the TTL countdown
  // and the flourish read it at fire time, so a speed change never rebinds
  // the countdown or replays the flourish.
  const speedRef = useAnimationSpeedRef()

  // The playback and TTL intervals read the live slider value through a ref
  // so dragging mid-run does not tear down and restart either timer. The
  // value is stamped onto the answer at the moment that event fires.
  const ttlRef = useRef(TTL_DEFAULT)
  useEffect(() => {
    ttlRef.current = ttlSeconds
  }, [ttlSeconds])

  // Auto-advance through the shared paced-interval hook (setInterval, never
  // a rAF/anime chain): gated on playing until done, paced by the shared
  // animation-speed multiplier.
  usePacedInterval(playing && !done, PLAY_MS, () => setState((s) => (isDone(s) ? s : step(s, ttlRef.current))))

  // The cached entry ages in real wall-clock time, independent of Play/Step:
  // a real TTL counts down whether or not anyone is watching the chain
  // animate. Each tick integrates the elapsed time actually measured
  // (capped at 1s), so a backgrounded tab does not throw the countdown off;
  // the measured elapsed time is then scaled by the animation speed so the
  // whole figure, countdown included, runs at the one chosen pace.
  const hasCache = Boolean(state.cache)
  useEffect(() => {
    if (!hasCache) return undefined
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 1) * speedRef.current
      last = now
      setState((s) => tickTtl(s, dt))
    }, TTL_TICK_MS)
    return () => window.clearInterval(id)
  }, [hasCache, speedRef])

  // Cosmetic flourish only: pulse the elements marked data-pulse (the two
  // boxes currently talking, and the message token). Pure animation, no
  // state change. Reduced motion: the nodes already render at full opacity,
  // so the pulse is simply skipped.
  useEffect(() => {
    if (!state.lastEvent || !svgRef.current) return
    if (prefersReducedMotion()) return
    const nodes = Array.from(svgRef.current.querySelectorAll('[data-pulse]'))
    if (nodes.length === 0) return
    animate(nodes, { opacity: [0.4, 1], duration: 450 / speedRef.current, ease: 'outQuad' })
  }, [state.cursor, state.lastEvent, speedRef])

  const onStep = () => setState((s) => (isDone(s) ? s : step(s, ttlRef.current)))
  const doReset = () => {
    setPlaying(false)
    setState((s) => reset(s))
  }
  const doLookup = () => setState((s) => (isDone(s) ? lookup(s) : s))

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: doReset, disabled: state.cursor === 0 && !state.cache },
  ]

  const cacheRemaining = state.cache ? Math.ceil(state.cache.remaining) : null
  const readouts = [
    { label: 'servers asked', value: serversAsked(state) },
    { label: 'steps', value: `${stepsTaken(state)}/${totalSteps(state)}` },
    { label: 'cache', value: state.cache ? `${DOMAIN} = ${state.cache.ip} (ttl ${cacheRemaining}s left)` : 'empty' },
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
      speedControl
      status={status}
      readouts={readouts}
      tryThis={`Step through the first lookup and count how many servers actually knew ${DOMAIN}'s address: only the last one, the authoritative server. Root and TLD only ever hand back a referral, never the answer. Then press Look up again: root, TLD, and auth stay dark, servers asked drops from 4 to 1, and the answer comes straight back from cache.`}
    >
      <div className={shared.group}>
        <button type="button" className={shared.btn} onClick={doLookup} disabled={!done}>
          Look up again
        </button>
      </div>

      <div className={shared.group}>
        <label className={shared.groupLabel} htmlFor="dns-ttl">
          TTL (server-set cache lifetime)
        </label>
        <input
          id="dns-ttl"
          className={shared.slider}
          type="range"
          min={TTL_MIN}
          max={TTL_MAX}
          step={TTL_STEP}
          value={ttlSeconds}
          onChange={(e) => setTtlSeconds(Number(e.target.value))}
          aria-label="TTL in seconds: how long the resolver keeps a fresh answer cached before it must ask again"
        />
        <span className={styles.sliderValue}>{ttlSeconds}s</span>
      </div>

      <div className={shared.scroll}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        style={{ minWidth: SVG_MIN_WIDTH }}
        role="img"
        aria-label={`Resolving ${DOMAIN}. ${serversAsked(state)} servers asked so far, step ${stepsTaken(state)} of ${totalSteps(state)}. Cache is ${state.cache ? `${DOMAIN} equals ${state.cache.ip}, ${cacheRemaining} seconds left on its ttl` : 'empty'}.`}
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
                fill={wasAsked ? PANEL : '#ffffff'}
                stroke={wasAsked ? INK : RULE}
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
            const color = e.kind === 'referral' ? AMBER : e.kind === 'query' ? INK : OK
            const bg = e.kind === 'referral' ? AMBER_BG : e.kind === 'query' ? '#ffffff' : OK_BG
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
          stroke={state.cache ? OK : RULE}
          strokeWidth={state.cache ? 1.3 : 1}
          strokeDasharray={state.cache ? undefined : '3 3'}
        />
        <text x={CACHE_X + CACHE_W / 2} y={CACHE_Y + CACHE_H / 2 + 4} fontSize={9.5} fill={state.cache ? OK : FADE} fontFamily={MONO} fontWeight={state.cache ? 700 : 400} textAnchor="middle">
          {state.cache ? `${DOMAIN} = ${state.cache.ip}  (ttl ${cacheRemaining}s left)` : 'empty'}
        </text>
      </svg>
      </div>

      <p className={shared.caption}>
        Heavily simplified: one query type (an A record lookup for{' '}
        {DOMAIN}, a reserved example domain per RFC 2606), one recursive
        resolver, and no device or browser cache shown, only the resolver&apos;s.
        Root and TLD each stand in for the many real server instances at that
        tier, and the referral chain here is abbreviated to one server per
        tier; a real lookup can also involve CNAME redirects this figure
        skips. The answer, {ANSWER_IP}, is from the documentation-only
        TEST-NET-1 range (RFC 5737); its TTL is whatever the slider above is
        set to, not a number the real example.com would actually choose. The counts above are read from the run. The referral chain itself is a
        fixed script rather than something the resolver computes, so each
        run replays a set walk while the counters stay derived from what
        that run processes.
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
      return `${capName(e.from)} holds the actual record and answers: ${ANSWER_IP}, TTL ${state.cache.ttl}s. The resolver caches it immediately.`
    }
    return `The resolver hands the answer back to your device: ${ANSWER_IP}.`
  }
  if (e.kind === 'cached-answer') {
    return `Cache hit. The resolver already had ${DOMAIN} = ${ANSWER_IP} cached, so it answers immediately without asking anyone else.`
  }
  return ''
}
