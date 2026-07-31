'use client'

import { useEffect, useRef } from 'react'
import { useAnimationSpeed } from './animationSpeed'

// The house Play-timer pattern, owned once. While `running` is true, `onTick`
// fires every `baseMs` divided by the shared animation-speed multiplier
// (animationSpeed.js): 1.5x is faster, 0.5x half speed. The interval is set
// and cleared in the effect body only, state changes happen only inside the
// tick, and a speed change mid-run swaps the interval for the new cadence so
// the next tick is re-timed with no tick skipped or doubled. Never a rAF
// chain, so a backgrounded tab keeps progressing.
//
// `onTick` is read through a ref, so consumers can pass a fresh inline
// closure every render; the timer does NOT rebind when that closure's
// captured data changes, only when `running`, `baseMs`, or the speed does.
export function usePacedInterval(running, baseMs, onTick) {
  const speed = useAnimationSpeed()

  const tickRef = useRef(onTick)
  useEffect(() => {
    tickRef.current = onTick
  })

  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => tickRef.current(), baseMs / speed)
    return () => clearInterval(id)
  }, [running, baseMs, speed])
}
