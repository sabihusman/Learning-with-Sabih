'use client'

import styles from './CallStackPanel.module.css'

// A reusable, example-agnostic call-stack view. It renders whatever frame list it is
// given as a vertical stack that grows when a frame is pushed and shrinks when one is
// popped. It knows nothing about the algorithm producing the frames: Towers of Hanoi
// today, Fibonacci (the dynamic-programming topic) later. Keep all example-specific
// logic out of here and pass plain frame data in.
//
// Props:
//   frames   Array<{ id, name, args }> ordered base-first (frames[0] is the bottom of
//            the stack, the last entry is the current/top frame). `id` must be stable
//            for a given frame across renders so a frame that stays on the stack does
//            not re-animate while a freshly pushed one slides in. `name` is the routine
//            name; `args` is a short string of its arguments.
//   label    heading shown above the stack (default "Call stack").
//   reserve  minimum number of frame slots to hold space for, so the panel does not
//            jump in height as the stack grows and shrinks (default 0).
const FRAME_SLOT = 30 // px per slot, must match .frame height + gap in the CSS module

export default function CallStackPanel({ frames = [], label = 'Call stack', reserve = 0 }) {
  const slots = Math.max(reserve, frames.length)
  const top = frames.length - 1
  return (
    <div className={styles.wrap}>
      <div className={styles.label}>{label}</div>
      <div className={styles.stack} style={{ minHeight: `${slots * FRAME_SLOT + 8}px` }}>
        {frames.length === 0 ? (
          <div className={styles.empty}>stack empty</div>
        ) : (
          // render top frame first so the most recent call sits at the top of the pile
          frames
            .map((f, i) => ({ f, isTop: i === top }))
            .reverse()
            .map(({ f, isTop }) => (
              <div key={f.id} className={`${styles.frame} ${isTop ? styles.active : ''}`}>
                <span className={styles.name}>{f.name}</span>
                <span className={styles.args}>{f.args}</span>
              </div>
            ))
        )}
      </div>
    </div>
  )
}
