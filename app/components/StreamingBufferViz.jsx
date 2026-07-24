'use client'

import { useEffect, useRef, useState } from 'react'
import Figure from './Figure'
import {
  PLAYBACK_RATE,
  NET_MIN,
  NET_MAX,
  NET_DEFAULT,
  BUFFER_CAP,
  BUFFER_START,
  RESUME_SEC,
  TICK_MS,
  tick,
} from './streamingData'
import styles from './StreamingBufferViz.module.css'

// House rule: the simulation advances on a plain setInterval + setState cadence.
// No rAF-driven loops, no anime.js chaining; pausing tears the interval down.

export default function StreamingBufferViz() {
  const [playing, setPlaying] = useState(false)
  const [netRate, setNetRate] = useState(NET_DEFAULT)
  const [sim, setSim] = useState({ buffer: BUFFER_START, stalled: false })

  // The interval reads the live slider value through a ref so dragging the
  // slider mid-play does not tear down and restart the timer. The ref is
  // synced in an effect (not during render, per the react-hooks/refs rule).
  const netRef = useRef(NET_DEFAULT)
  useEffect(() => {
    netRef.current = netRate
  }, [netRate])

  // Each tick integrates over the wall-clock time actually elapsed (capped at
  // 1s), not the nominal period: a hidden or backgrounded tab clamps intervals
  // to ~1 per second, and measuring dt keeps the simulation running at true
  // speed instead of silently slowing down.
  useEffect(() => {
    if (!playing) return undefined
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 1)
      last = now
      setSim((s) => tick(s, netRef.current, dt))
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [playing])

  const reset = () => {
    setPlaying(false)
    setNetRate(NET_DEFAULT)
    setSim({ buffer: BUFFER_START, stalled: false })
  }

  const controls = [
    {
      label: playing ? 'Pause' : 'Play',
      onClick: () => setPlaying((p) => !p),
      variant: 'primary',
    },
    { label: 'Reset', onClick: reset },
  ]

  let status
  if (!playing) status = 'Paused. Press Play to start streaming.'
  else if (sim.stalled) status = `Stalled: the buffer hit zero. Refilling to ${RESUME_SEC}s before playback resumes.`
  else if (netRate > PLAYBACK_RATE) status = 'Network is faster than playback: the buffer grows toward its cap.'
  else if (netRate < PLAYBACK_RATE) status = 'Network is slower than playback: the buffer is draining. The stall is coming.'
  else status = 'Network exactly matches playback: the buffer holds level.'

  const readouts = [
    { label: 'buffer', value: `${sim.buffer.toFixed(1)}s` },
    { label: 'network', value: `${netRate.toFixed(1)}x` },
    { label: 'playback', value: sim.stalled || !playing ? '0x (frozen)' : `${PLAYBACK_RATE.toFixed(1)}x` },
    { label: 'state', value: !playing ? 'paused' : sim.stalled ? 'buffering' : 'playing' },
  ]

  const fillPct = (sim.buffer / BUFFER_CAP) * 100
  const resumePct = (RESUME_SEC / BUFFER_CAP) * 100

  return (
    <Figure
      eyebrow="Systems"
      title="The playback buffer: a cushion between network and screen"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis={
        'Press Play and let the buffer grow, then drag the network slider below 1.0x and watch the buffer drain: playback stays perfectly smooth the whole way down, which is exactly what the cushion is for. When it hits zero the video stalls. Restore the network and watch it refill to 2s before playback dares to resume.'
      }
    >
      <div className={styles.wrap}>
        {/* the pipeline: network -> buffer -> screen */}
        <div className={styles.pipeline}>
          <div className={`${styles.node} ${playing && netRate > 0 ? styles.nodeActive : ''}`}>
            <div className={styles.nodeTitle}>network</div>
            <div className={styles.nodeSub}>{netRate.toFixed(1)}x, variable</div>
          </div>
          <div className={styles.arrow} aria-hidden="true">{playing && netRate > 0 ? '»' : '·'}</div>

          <div className={styles.bufferBox}>
            <div className={styles.nodeTitle}>buffer</div>
            <div
              className={styles.bar}
              role="img"
              aria-label={`Buffer holds ${sim.buffer.toFixed(1)} of ${BUFFER_CAP} seconds`}
            >
              <div
                className={`${styles.fill} ${sim.stalled ? styles.fillStalled : ''}`}
                style={{ width: `${fillPct}%` }}
                data-testid="buffer-fill"
              />
              <div className={styles.resumeMark} style={{ left: `${resumePct}%` }} title={`resume threshold: ${RESUME_SEC}s`} />
            </div>
            <div className={styles.barScale}>
              <span>0s</span>
              <span>{BUFFER_CAP}s</span>
            </div>
          </div>

          <div className={styles.arrow} aria-hidden="true">{playing && !sim.stalled ? '»' : '·'}</div>
          <div className={`${styles.node} ${playing && !sim.stalled ? styles.nodeActive : ''} ${sim.stalled ? styles.nodeStalled : ''}`}>
            <div className={styles.nodeTitle}>screen</div>
            <div className={styles.nodeSub} data-testid="screen-state">
              {!playing ? 'paused' : sim.stalled ? 'buffering...' : 'playing 1.0x'}
            </div>
          </div>
        </div>

        {/* network-speed slider */}
        <label className={styles.sliderLabel} htmlFor="net-rate">
          <span>Network speed</span>
          <span className={styles.sliderValue}>{netRate.toFixed(1)}x playback rate</span>
        </label>
        <input
          id="net-rate"
          className={styles.slider}
          type="range"
          min={NET_MIN}
          max={NET_MAX}
          step={0.1}
          value={netRate}
          onChange={(e) => setNetRate(Number(e.target.value))}
          aria-label="Network speed as a multiple of the playback rate"
        />
        <div className={styles.endsRow}>
          <span>dead connection</span>
          <span>plenty of headroom</span>
        </div>
      </div>

      <p className={styles.note}>
        The buffer level is genuinely integrated: every tick adds what the network delivered and subtracts what
        playback consumed over the elapsed time, and the stall and resume states fall out of that arithmetic, nothing
        is scripted. The
        rates and units are illustrative (seconds of video, multiples of realtime), not a real codec or player: real
        players juggle chunked downloads, variable bitrates, and codecs this single bar does not model.
      </p>
    </Figure>
  )
}
