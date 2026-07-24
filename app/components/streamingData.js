// Buffer simulation for the streaming topic. The buffer level genuinely
// integrates: every tick adds what the network delivered and subtracts what
// playback consumed, and the stall/resume states fall out of that arithmetic.
// The rates and units are illustrative (seconds of video, x realtime), not a
// real codec or player.

// All rates are in seconds of video per second of wall clock.
export const PLAYBACK_RATE = 1 // steady playback: 1s of video per second
export const NET_MIN = 0
export const NET_MAX = 3
export const NET_DEFAULT = 1.6

export const BUFFER_CAP = 10 // the player stops downloading past this
export const BUFFER_START = 3 // seconds buffered when the demo loads
export const RESUME_SEC = 2 // a stalled player waits for this much before resuming

export const TICK_MS = 150 // simulation cadence (setInterval period)

// One simulation tick: returns the next {buffer, stalled} given the current
// state, the network rate, and the tick length in seconds. Pure, so it can be
// tested and inspected directly.
//
// While stalled, playback consumes nothing (the video is frozen) but the
// network keeps filling; playback resumes once RESUME_SEC is buffered.
// The buffer never exceeds BUFFER_CAP (the player pauses downloading) and
// never goes below zero.
export function tick(state, netRate, dtSec) {
  const draining = state.stalled ? 0 : PLAYBACK_RATE
  const next = Math.max(0, Math.min(BUFFER_CAP, state.buffer + (netRate - draining) * dtSec))
  let stalled = state.stalled
  if (!stalled && next <= 0) stalled = true
  else if (stalled && next >= RESUME_SEC) stalled = false
  return { buffer: next, stalled }
}
