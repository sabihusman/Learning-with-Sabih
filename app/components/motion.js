'use client'

// True when the viewer asked their OS for reduced motion. Steppers keep
// advancing state on their timers regardless; only decorative flourishes
// (anime.js pulses, glides, staggers) consult this and skip.
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
