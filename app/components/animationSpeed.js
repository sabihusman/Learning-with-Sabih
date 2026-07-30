'use client'

import { useSyncExternalStore } from 'react'

// One site-wide animation-speed setting, following the FontSizeControl pattern:
// persisted in localStorage, read through useSyncExternalStore so every mounted
// control reflects a change immediately (including from another tab via the
// 'storage' event), with a fixed server snapshot so hydration is safe. The
// value is shared; the chips that set it render per-figure (see Figure's
// speedControl prop). Durations divide by the multiplier: 1.5x is faster,
// 0.5x is half speed.
export const SPEED_OPTIONS = [
  { value: '1.5', label: '1.5x', name: 'Fast', multiplier: 1.5 },
  { value: '1', label: '1x', name: 'Normal', multiplier: 1 },
  { value: '0.75', label: '0.75x', name: 'Slower', multiplier: 0.75 },
  { value: '0.5', label: '0.5x', name: 'Half speed', multiplier: 0.5 },
]
const DEFAULT_VALUE = '1'
const STORAGE_KEY = 'animSpeed'
const CHANGE_EVENT = 'animspeedchange'

function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return SPEED_OPTIONS.some((o) => o.value === stored) ? stored : DEFAULT_VALUE
  } catch {
    return DEFAULT_VALUE
  }
}

function subscribe(callback) {
  window.addEventListener('storage', callback)
  window.addEventListener(CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(CHANGE_EVENT, callback)
  }
}

export function setAnimationSpeed(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* ignore persistence failures */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

// The active option's string value, for rendering the chips.
export function useAnimationSpeedSetting() {
  return useSyncExternalStore(subscribe, readStored, () => DEFAULT_VALUE)
}

// The numeric multiplier, for pacing math in figure components.
export function useAnimationSpeed() {
  const value = useAnimationSpeedSetting()
  return SPEED_OPTIONS.find((o) => o.value === value).multiplier
}
