'use client'

import { useState } from 'react'
import Figure from './Figure'
import { usePacedInterval } from './usePacedInterval'
import shared from './vizShared.module.css'
import {
  HOSTS,
  ROUTER,
  SWITCHES,
  hostById,
  sameNetwork,
  pathFor,
  headersAt,
  readsAt,
  DEFAULT_SRC,
  DEFAULT_DST,
  PAYLOAD,
} from './networkStackData'
import styles from './NetworkStackViz.module.css'

// House rule: auto-play advances one hop per tick of the shared paced interval
// (setInterval, never rAF), paced by the site-wide animation-speed multiplier.
const HOP_MS = 1400 // one hop per 1.4s at 1x while playing

export default function NetworkStackViz() {
  const [srcId, setSrcId] = useState(DEFAULT_SRC)
  const [dstId, setDstId] = useState(DEFAULT_DST)
  const [hop, setHop] = useState(0)
  const [playing, setPlaying] = useState(false)

  const path = pathFor(srcId, dstId)
  const lastHop = path.length - 1
  const arrived = hop >= lastHop
  const headers = headersAt(srcId, dstId, hop)
  const reads = readsAt(path, hop)
  const device = path[hop]

  // Auto-play: one hop per tick while playing, stopping the player at arrival.
  // The tick closure is read fresh each render by the hook, so it sees the
  // current hop without a mirror ref.
  usePacedInterval(playing && !arrived, HOP_MS, () => {
    const next = Math.min(hop + 1, lastHop)
    setHop(next)
    if (next >= lastHop) setPlaying(false)
  })

  const restart = () => {
    setHop(0)
    setPlaying(false)
  }

  const pick = (which, id) => {
    if (which === 'src') setSrcId(id)
    else setDstId(id)
    restart()
  }

  const controls = [
    {
      label: 'Step',
      onClick: () => setHop((h) => Math.min(h + 1, lastHop)),
      variant: 'primary',
      disabled: playing || arrived,
    },
    { label: playing ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: arrived && !playing },
    { label: 'Reset', onClick: restart },
  ]

  let status
  if (arrived && hop > 0) status = `Delivered: ${device.label} strips the headers and reads the payload.`
  else if (device.kind === 'host') status = `${device.label} wraps the payload in a layer 3 header, then a layer 2 header for the first link.`
  else if (device.kind === 'switch') status = `${device.label} reads only the layer 2 header and forwards the frame inside its own network.`
  else status = 'The router reads the layer 3 header, strips the old layer 2 header, and writes a fresh one for the next network.'

  const readouts = [
    { label: 'route', value: `${hostById(srcId).name} to ${hostById(dstId).name}${sameNetwork(srcId, dstId) ? ' (same network)' : ' (crosses the router)'}` },
    { label: 'hop', value: `${hop} / ${lastHop}` },
    { label: 'current device reads', value: reads === 'l2' ? 'layer 2 header' : reads === 'l3' ? 'layer 3 header' : 'payload' },
  ]

  const deviceActive = (kind, netOrId) => {
    if (device.kind !== kind) return false
    if (kind === 'host') return device.id === netOrId
    if (kind === 'switch') return device.net === netOrId
    return true
  }

  const hostChip = (h) => (
    <div
      key={h.id}
      className={`${styles.device} ${deviceActive('host', h.id) ? styles.deviceActive : ''}`}
      data-testid={`device-${h.id}`}
    >
      <div className={styles.deviceName}>{h.name}</div>
      <div className={styles.addr}>{h.ip}</div>
      <div className={styles.addr}>{h.l2}</div>
      {deviceActive('host', h.id) && <span className={styles.packet} data-testid="packet">packet</span>}
    </div>
  )

  return (
    <Figure
      eyebrow="Networking"
      title="Two networks, two switches, one router"
      controls={controls}
      speedControl
      status={status}
      readouts={readouts}
      tryThis={
        "Send from Host A to Host B and the packet never touches the router: the switch alone delivers it, reading nothing but the layer 2 header. Then send from Host A to Host C and step slowly through the router hop: the layer 2 header is thrown away and rewritten for the second network, while the layer 3 addresses ride through untouched. That one swap is the whole division of labor between switches and routers."
      }
    >
      <div className={styles.wrap}>
        {/* ── top panel: encapsulation ── */}
        <div className={styles.encapPanel}>
          <div className={styles.panelTitle}>What is wrapped around the payload right now</div>
          {headers.rewritten && (
            <div className={styles.rewriteBadge} data-testid="rewrite-badge">
              Layer 2 header replaced. Layer 3 unchanged.
            </div>
          )}
          <div className={styles.encapRow}>
            {headers.rewritten && (
              <div className={`${styles.headerBox} ${styles.l2Box} ${styles.stripped}`} data-testid="old-l2">
                <div className={styles.headerLabel}>old layer 2 (stripped)</div>
                <div className={styles.headerFields}>
                  <s>{headers.oldL2.src} to {headers.oldL2.dst}</s>
                </div>
              </div>
            )}
            <div
              className={`${styles.headerBox} ${styles.l2Box} ${reads === 'l2' ? styles.reading : ''} ${headers.rewritten ? styles.freshL2 : ''}`}
              data-testid="l2-header"
            >
              <div className={styles.headerLabel}>{headers.rewritten ? 'new layer 2 (just written)' : 'layer 2'}</div>
              <div className={styles.headerFields}>{headers.l2.src} to {headers.l2.dst}</div>
              <div className={`${styles.headerBox} ${styles.l3Box} ${reads === 'l3' ? styles.reading : ''}`} data-testid="l3-header">
                <div className={styles.headerLabel}>layer 3{headers.rewritten ? ' (unchanged)' : ''}</div>
                <div className={styles.headerFields}>{headers.l3.src} to {headers.l3.dst}</div>
                <div className={`${styles.headerBox} ${styles.payloadBox} ${reads === 'payload' ? styles.reading : ''}`}>
                  <div className={styles.headerLabel}>payload</div>
                  <div className={styles.headerFields}>&quot;{PAYLOAD}&quot;</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── bottom panel: delivery map ── */}
        <div className={styles.map}>
          <div className={styles.network}>
            <div className={styles.netLabel}>Network 1 (192.168.1.0/24)</div>
            <div className={styles.hostRow}>{HOSTS.filter((h) => h.net === 1).map(hostChip)}</div>
            <div
              className={`${styles.device} ${styles.switchBox} ${deviceActive('switch', 1) ? styles.deviceActive : ''}`}
              data-testid="device-switch1"
            >
              <div className={styles.deviceName}>{SWITCHES[1]}</div>
              <div className={styles.addr}>reads layer 2</div>
              {deviceActive('switch', 1) && <span className={styles.packet} data-testid="packet">packet</span>}
            </div>
          </div>

          <div
            className={`${styles.device} ${styles.routerBox} ${deviceActive('router') ? styles.deviceActive : ''}`}
            data-testid="device-router"
          >
            <div className={styles.deviceName}>Router</div>
            <div className={styles.addr}>{ROUTER.if1.ip} | {ROUTER.if1.l2}</div>
            <div className={styles.addr}>{ROUTER.if2.ip} | {ROUTER.if2.l2}</div>
            <div className={styles.addr}>reads layer 3</div>
            {deviceActive('router') && <span className={styles.packet} data-testid="packet">packet</span>}
          </div>

          <div className={styles.network}>
            <div className={styles.netLabel}>Network 2 (192.168.2.0/24)</div>
            <div className={styles.hostRow}>{HOSTS.filter((h) => h.net === 2).map(hostChip)}</div>
            <div
              className={`${styles.device} ${styles.switchBox} ${deviceActive('switch', 2) ? styles.deviceActive : ''}`}
              data-testid="device-switch2"
            >
              <div className={styles.deviceName}>{SWITCHES[2]}</div>
              <div className={styles.addr}>reads layer 2</div>
              {deviceActive('switch', 2) && <span className={styles.packet} data-testid="packet">packet</span>}
            </div>
          </div>
        </div>

        {/* ── source / destination pickers ── */}
        <div className={styles.pickers}>
          <div className={shared.group}>
            <span className={`${shared.groupLabel} ${styles.pickerLabel}`}>From</span>
            {HOSTS.map((h) => (
              <button
                key={h.id}
                type="button"
                data-testid={`src-${h.id}`}
                className={shared.btn}
                data-active={srcId === h.id ? 'true' : undefined}
                disabled={dstId === h.id}
                onClick={() => pick('src', h.id)}
              >
                {h.name}
              </button>
            ))}
          </div>
          <div className={shared.group}>
            <span className={`${shared.groupLabel} ${styles.pickerLabel}`}>To</span>
            {HOSTS.map((h) => (
              <button
                key={h.id}
                type="button"
                data-testid={`dst-${h.id}`}
                className={shared.btn}
                data-active={dstId === h.id ? 'true' : undefined}
                disabled={srcId === h.id}
                onClick={() => pick('dst', h.id)}
              >
                {h.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className={shared.caption}>
        The path, per-hop headers, and the router&apos;s layer 2 rewrite are computed from the small topology model
        above, and the layer 3 addresses are real RFC 1918 private IPv4 addresses (one /24 subnet per network). The
        layer 2 labels are deliberately simplified stand-ins, not real MAC addresses, and how the devices learn where
        to forward (ARP, routing tables) is not modeled here at all.
      </p>
    </Figure>
  )
}
