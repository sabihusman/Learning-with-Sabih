'use client'

import { useEffect, useState } from 'react'
import Figure from './Figure'
import styles from './BinarySearchViz.module.css'

// Fixed, deterministic sorted set. 15 cells so the worst case is exactly
// ceil(log2(15)) = 4 comparisons (a perfect-tree size; 16 would need 5).
const ARR = [2, 5, 9, 13, 18, 24, 31, 37, 42, 48, 55, 61, 68, 74, 81]
const DEFAULT_TARGET = 48 // found in 3 comparisons (not the first probe)
const ABSENT_TARGET = 50 // sits between 48 and 55, so it is not in the list
const PLAY_MS = 850

const initSearch = () => ({ lo: 0, hi: ARR.length - 1, comparisons: 0, status: 'searching', foundIndex: null })

// One real, deterministic comparison. Pure: takes a state, returns the next.
function stepSearch(s, target) {
  if (s.status !== 'searching') return s
  const { lo, hi, comparisons } = s
  if (lo > hi) return { ...s, status: 'notfound' }
  const mid = Math.floor((lo + hi) / 2)
  const c = comparisons + 1
  if (ARR[mid] === target) return { lo, hi, comparisons: c, status: 'found', foundIndex: mid }
  if (ARR[mid] < target) {
    const nlo = mid + 1
    return { lo: nlo, hi, comparisons: c, status: nlo > hi ? 'notfound' : 'searching', foundIndex: null }
  }
  const nhi = mid - 1
  return { lo, hi: nhi, comparisons: c, status: lo > nhi ? 'notfound' : 'searching', foundIndex: null }
}

// ── SVG geometry ──────────────────────────────────────────────────────────────
const VB_W = 600
const PAD_X = 10
const CELL_OUTER = (VB_W - 2 * PAD_X) / ARR.length
const CELL_Y = 46
const CELL_H = 40
const VB_H = 112
const cellLeft = (i) => PAD_X + i * CELL_OUTER + 2
const cellMidX = (i) => PAD_X + i * CELL_OUTER + CELL_OUTER / 2

function cellKind(i, s, midDisplay) {
  if (s.status === 'found' && i === s.foundIndex) return 'found'
  if (s.status === 'notfound') return 'eliminated'
  if (i < s.lo || i > s.hi) return 'eliminated'
  if (i === midDisplay) return 'mid'
  return 'active'
}
const FILL = { found: '#1f6f5c', mid: '#fcf3f1', active: '#fffefb', eliminated: '#ece9e1' }
const STROKE = { found: '#1f6f5c', mid: '#c0392b', active: '#d8d4cc', eliminated: '#e2e0d8' }
const TEXT = { found: '#ffffff', mid: '#1a1a1a', active: '#1a1a1a', eliminated: '#b9b6ae' }

export default function BinarySearchViz() {
  const [target, setTarget] = useState(DEFAULT_TARGET)
  const [search, setSearch] = useState(initSearch)
  const [playing, setPlaying] = useState(false)

  const searching = search.status === 'searching'
  const isPlaying = playing && searching

  // Auto-advance: setInterval, never requestAnimationFrame, so it keeps progressing in
  // a backgrounded tab. Keyed on search.status so it tears the interval down the moment
  // the search finishes (status leaves 'searching'); no setState in the effect body.
  useEffect(() => {
    if (!playing || !searching) return undefined
    const id = setInterval(() => setSearch((s) => stepSearch(s, target)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, searching, target])

  const onStep = () => setSearch((s) => stepSearch(s, target))
  const reset = () => {
    setPlaying(false)
    setSearch(initSearch())
  }
  const chooseTarget = (v) => {
    setPlaying(false)
    setTarget(v)
    setSearch(initSearch())
  }

  // the index being compared this step (or the found cell once found)
  const midDisplay =
    searching && search.lo <= search.hi ? Math.floor((search.lo + search.hi) / 2) : search.status === 'found' ? search.foundIndex : null

  const present = ARR.indexOf(target)
  const linearCount = present >= 0 ? present + 1 : ARR.length

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: !searching },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: !searching },
    { label: 'Reset', onClick: reset, disabled: search.comparisons === 0 && searching },
  ]

  const status =
    search.status === 'found'
      ? `Found ${target} at index ${search.foundIndex} in ${search.comparisons} comparisons`
      : search.status === 'notfound'
        ? `${target} is not in the list (${search.comparisons} comparisons)`
        : search.comparisons === 0
          ? `Searching for ${target}. Step to compare the middle of the range.`
          : `Step ${search.comparisons}: comparing the middle of the active range`

  const readouts = [
    { label: 'target', value: target },
    { label: 'binary search', value: `${search.comparisons} ${search.comparisons === 1 ? 'comparison' : 'comparisons'}` },
    { label: 'linear scan', value: `${linearCount} ${linearCount === 1 ? 'comparison' : 'comparisons'}` },
  ]

  return (
    <Figure
      eyebrow="Searching"
      title="Binary search"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Click a cell to pick a target, then Step. Binary search checks the middle of the active range and throws away the half that cannot contain the target, so the search space halves every comparison. Watch lo and hi close in while the eliminated cells grey out. Compare the two readouts: binary search finishes in a handful of comparisons where a linear scan would check far more. Try the missing value to see the search end in not-found."
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={styles.svg}
        role="img"
        aria-label={`A sorted array of ${ARR.length} values. Binary search keeps a lo-to-hi window, compares the middle cell to the target, and greys out the half that is eliminated each step.`}
      >
        {/* pointers above the array */}
        {searching && search.lo === search.hi && (
          <Pointer x={cellMidX(search.lo)} y={12} label="lo hi" color="#6b6862" />
        )}
        {searching && search.lo !== search.hi && (
          <>
            <Pointer x={cellMidX(search.lo)} y={12} label="lo" color="#6b6862" />
            <Pointer x={cellMidX(search.hi)} y={12} label="hi" color="#6b6862" />
          </>
        )}
        {midDisplay !== null && (
          <Pointer x={cellMidX(midDisplay)} y={30} label={search.status === 'found' ? 'found' : 'mid'} color={search.status === 'found' ? '#1f6f5c' : '#c0392b'} />
        )}

        {/* cells */}
        {ARR.map((v, i) => {
          const kind = cellKind(i, search, midDisplay)
          const clickable = true
          return (
            <g key={i} onClick={() => chooseTarget(v)} style={{ cursor: clickable ? 'pointer' : 'default' }}>
              <rect
                x={cellLeft(i)}
                y={CELL_Y}
                width={CELL_OUTER - 4}
                height={CELL_H}
                rx={3}
                fill={FILL[kind]}
                stroke={STROKE[kind]}
                strokeWidth={kind === 'mid' ? 2 : 1}
              />
              <text x={cellMidX(i)} y={CELL_Y + CELL_H / 2 + 4} fontSize="12.5" fontFamily="ui-monospace, monospace" fill={TEXT[kind]} textAnchor="middle">
                {v}
              </text>
              <text x={cellMidX(i)} y={CELL_Y + CELL_H + 13} fontSize="8.5" fontFamily="ui-monospace, monospace" fill="#9b9892" textAnchor="middle">
                {i}
              </text>
            </g>
          )
        })}
      </svg>

      <div className={styles.targetRow}>
        <span className={styles.hint}>Click any cell to choose a target, or</span>
        <button type="button" className={styles.absentBtn} onClick={() => chooseTarget(ABSENT_TARGET)}>
          search a missing value ({ABSENT_TARGET})
        </button>
      </div>

      <p className={styles.caption}>
        The search is real: lo, hi, and the comparison count are computed live, and the linear-scan number is the
        position this target would sit at. The list is kept small for clarity; real datasets are far larger, where the
        gap between the two counts is enormous.
      </p>
    </Figure>
  )
}

function Pointer({ x, y, label, color }) {
  return (
    <g>
      <text x={x} y={y} fontSize="9.5" fontFamily="ui-monospace, monospace" fontWeight="700" fill={color} textAnchor="middle">
        {label}
      </text>
      <text x={x} y={y + 11} fontSize="9" fill={color} textAnchor="middle">
        &#9660;
      </text>
    </g>
  )
}
