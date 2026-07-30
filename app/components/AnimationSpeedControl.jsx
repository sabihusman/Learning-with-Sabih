'use client'

import { SPEED_OPTIONS, setAnimationSpeed, useAnimationSpeedSetting } from './animationSpeed'
import styles from './AnimationSpeedControl.module.css'

// The per-figure chips for the shared animation-speed setting. Rendered by the
// Figure shell when a figure opts in with speedControl; the value itself is one
// site-wide store (see animationSpeed.js).
export default function AnimationSpeedControl() {
  const active = useAnimationSpeedSetting()

  return (
    <div className={styles.control} role="group" aria-label="Animation speed">
      <span className={styles.label} aria-hidden="true">
        speed
      </span>
      {SPEED_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setAnimationSpeed(option.value)}
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
