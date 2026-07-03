'use client'

import { useState } from 'react'
import Figure from './Figure'
import styles from './TensorsViz.module.css'
import { LADDER, MAX_RANK, elementCount, shapeString, indexString } from './tensorData'

// Render an n-dimensional array recursively from its shape. The first axis lays out
// horizontally, the second vertically, and the last one or two axes become a 2D grid.
// Every leaf is a real <button> so it is keyboard-reachable, and each carries the full
// index path it sits at, computed from its position. `prefix` is the index path built
// up so far; `depth` picks the row/column orientation for the next split.
function renderArray(shape, prefix, depth, selectedKey, onPick) {
  // rank 0: a single cell, the whole scalar, indexed by the empty path
  if (shape.length === 0) {
    return (
      <div className={styles.scalarWrap}>
        <Cell path={[]} selectedKey={selectedKey} onPick={onPick} />
      </div>
    )
  }

  // rank 1 or 2: a real 2D grid (a vector is a 1-row grid)
  if (shape.length <= 2) {
    const rows = shape.length === 1 ? 1 : shape[0]
    const cols = shape.length === 1 ? shape[0] : shape[1]
    const cells = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const path = shape.length === 1 ? [...prefix, c] : [...prefix, r, c]
        cells.push(<Cell key={`${r}-${c}`} path={path} selectedKey={selectedKey} onPick={onPick} />)
      }
    }
    return (
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${cols}, 26px)` }}>
        {cells}
      </div>
    )
  }

  // rank 3+: peel the outer axis and lay its slices out, alternating orientation by depth
  const [outer, ...rest] = shape
  const orientation = depth % 2 === 0 ? styles.axisRow : styles.axisCol
  const slices = []
  for (let i = 0; i < outer; i++) {
    slices.push(
      <div key={i}>{renderArray(rest, [...prefix, i], depth + 1, selectedKey, onPick)}</div>
    )
  }
  return <div className={orientation}>{slices}</div>
}

function Cell({ path, selectedKey, onPick }) {
  const key = path.join(',')
  const isSelected = key === selectedKey
  const label = path.length === 0 ? 'the single scalar element' : `element ${indexString(path)}`
  return (
    <button
      type="button"
      className={`${styles.cell} ${isSelected ? styles.cellSelected : ''}`}
      aria-label={label}
      aria-pressed={isSelected}
      onClick={() => onPick(path)}
    />
  )
}

export default function TensorsViz() {
  const [rank, setRank] = useState(2)
  const [picked, setPicked] = useState(null) // the selected index path, or null

  const rung = LADDER[rank]
  const shape = rung.shape
  const count = elementCount(shape)

  const setRankAndClear = (r) => {
    setRank(r)
    setPicked(null) // a cell from the old shape no longer exists
  }

  const selectedKey = picked === null ? null : picked.join(',')

  const controls = LADDER.map((rung_) => ({
    label: `rank ${rung_.rank}`,
    onClick: () => setRankAndClear(rung_.rank),
    active: rung_.rank === rank,
  }))

  let pathValue
  let pathHint
  if (picked === null) {
    pathValue = null
    pathHint = rank === 0 ? 'Click the cell to read its index.' : 'Click any cell to read its index path.'
  } else if (picked.length === 0) {
    pathValue = '[]'
    pathHint = 'the whole scalar; a rank-0 tensor has no axes to index'
  } else {
    pathValue = indexString(picked)
    pathHint = `axis ${picked.map((v, d) => `${d}=${v}`).join(', ')}`
  }

  const status = `Rank ${rank}: ${rung.label}, shape ${shapeString(shape)}, ${count} ${count === 1 ? 'element' : 'elements'}.`

  const readouts = [
    { label: 'rank', value: rank },
    { label: 'shape', value: shapeString(shape) },
    { label: 'elements', value: count },
  ]

  return (
    <Figure
      eyebrow="Tensors"
      title="Climbing the dimensionality ladder"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Step the rank from 0 to 4 and watch the array grow: a scalar becomes a row, the row becomes a grid, the grid stacks into a cube, and the cube lines up into a batch. At each rank, click a cell to see its full index path, and check that the element count is exactly the shape multiplied out."
    >
      <div className={styles.stage}>{renderArray(shape, [], 0, selectedKey, setPicked)}</div>

      <div className={styles.pathBox}>
        {pathValue === null ? (
          <span className={styles.pathHint}>{pathHint}</span>
        ) : (
          <>
            <span className={styles.pathLabel}>index</span>
            <span className={styles.pathValue}>{pathValue}</span>
            <span className={styles.pathHint}>{pathHint}</span>
          </>
        )}
      </div>

      <div className={styles.rung}>
        <span className={styles.rungKind}>{`${rung.label}, shape ${shapeString(shape)}`}</span>
        <span className={styles.rungExample}>{`e.g. ${rung.example}`}</span>
      </div>

      <p className={styles.note}>
        The shape, the element count, and every index path are computed for real from the
        rank you pick. The dimension sizes are kept deliberately small so the array stays
        readable; nothing here is hard-coded per cell. Rank {MAX_RANK} is drawn as a row of
        stacks, which is a display choice, not a property of the tensor.
      </p>
    </Figure>
  )
}
