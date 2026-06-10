'use client'

import { useCallback, useSyncExternalStore } from 'react'
import styles from './FontSizeControl.module.css'

// Three reading-text sizes. The value is the --read-scale multiplier; prose and
// the contents list size off that one variable (see globals.css / the prose and
// page CSS modules). Figures are unaffected. Medium (1) is the default.
const OPTIONS = [
  { value: 'small', label: 'S', name: 'Small', scale: '0.9' },
  { value: 'medium', label: 'M', name: 'Medium', scale: '1' },
  { value: 'large', label: 'L', name: 'Large', scale: '1.15' },
]
const STORAGE_KEY = 'readScale'
const CHANGE_EVENT = 'readscalechange'

// Read the persisted choice as an external store, so the active button reflects
// localStorage without a setState-in-effect. The text itself is already sized by
// the pre-paint script in the root layout, so there is no flash of the wrong size.
function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return OPTIONS.some((o) => o.value === stored) ? stored : 'medium'
  } catch {
    return 'medium'
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

// Shared across every page (topics nav + contents header).
export default function FontSizeControl() {
  const active = useSyncExternalStore(subscribe, readStored, () => 'medium')

  const choose = useCallback((option) => {
    document.documentElement.style.setProperty('--read-scale', option.scale)
    try {
      localStorage.setItem(STORAGE_KEY, option.value)
    } catch {
      /* ignore persistence failures */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return (
    <div className={styles.control} role="group" aria-label="Reading text size">
      <span className={styles.label} aria-hidden="true">
        Text
      </span>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => choose(option)}
          className={`${styles.btn} ${active === option.value ? styles.active : ''}`}
          aria-label={option.name}
          aria-pressed={active === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
