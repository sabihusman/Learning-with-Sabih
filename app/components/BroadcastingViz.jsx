'use client'

import { useState } from 'react'
import Figure from './Figure'
import styles from './BroadcastingViz.module.css'
import { SHAPES, shapeString, alignShapes } from './broadcastData'

const dimsOf = (key) => SHAPES.find((s) => s.key === key).dims

export default function BroadcastingViz() {
  const [aKey, setAKey] = useState('4,1')
  const [bKey, setBKey] = useState('3')

  const a = dimsOf(aKey)
  const b = dimsOf(bKey)
  const { rows, ok, result, failIndex } = alignShapes(a, b)
  const n = rows.length

  const swap = () => {
    setAKey(bKey)
    setBKey(aKey)
  }

  const controls = [{ label: 'Swap A and B', onClick: swap }]

  const status = ok
    ? `Shapes ${shapeString(a)} and ${shapeString(b)} broadcast to ${shapeString(result)}.`
    : `Shapes ${shapeString(a)} and ${shapeString(b)} cannot broadcast.`

  const readouts = [
    { label: 'shape A', value: shapeString(a) },
    { label: 'shape B', value: shapeString(b) },
    { label: 'result', value: ok ? shapeString(result) : 'none' },
  ]

  const fail = ok ? null : rows[failIndex]
  const posFromRight = ok ? null : n - failIndex

  // grid: a label column plus one column per aligned dimension
  const gridCols = `auto repeat(${n}, minmax(56px, auto))`

  return (
    <Figure
      eyebrow="Tensors"
      title="Broadcasting two shapes"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Pick shapes A and B and read the alignment from the right. Try (3,) with (4,) to see a clean failure, then (4, 1) with (3,) to watch both size-1 dimensions stretch to make (4, 3). The shorter shape is always padded with 1s on its left, never its right."
    >
      <div className={styles.selectors}>
        <div className={styles.selector} role="group" aria-label="Shape A">
          <span className={`${styles.selLabel} ${styles.selLabelA}`}>Shape A</span>
          <div className={styles.segGroup}>
            {SHAPES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`${styles.seg} ${aKey === s.key ? styles.segActiveA : ''}`}
                aria-pressed={aKey === s.key}
                onClick={() => setAKey(s.key)}
              >
                {shapeString(s.dims)}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.selector} role="group" aria-label="Shape B">
          <span className={`${styles.selLabel} ${styles.selLabelB}`}>Shape B</span>
          <div className={styles.segGroup}>
            {SHAPES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`${styles.seg} ${bKey === s.key ? styles.segActiveB : ''}`}
                aria-pressed={bKey === s.key}
                onClick={() => setBKey(s.key)}
              >
                {shapeString(s.dims)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.stage}>
        <div
          className={styles.align}
          style={{ gridTemplateColumns: gridCols }}
          role="img"
          aria-label={`Aligning shape A ${shapeString(a)} and shape B ${shapeString(b)} from the right. ${status}`}
        >
          <span className={`${styles.rowLabel} ${styles.rowLabelA}`}>A</span>
          {rows.map((r) => {
            const aPad = r.aIn === null
            return (
              <div key={`ra-${r.pos}`} className={`${styles.cell} ${styles.cellA} ${aPad ? styles.cellPad : ''}`}>
                <span>{aPad ? 1 : r.aIn}</span>
                {aPad && <span className={styles.padTag}>pad</span>}
                {!aPad && r.reason === 'a-stretch' && <span className={styles.stretch}>{`stretch to ${r.result}`}</span>}
              </div>
            )
          })}

          <span className={`${styles.rowLabel} ${styles.rowLabelB}`}>B</span>
          {rows.map((r) => {
            const bPad = r.bIn === null
            return (
              <div key={`rb-${r.pos}`} className={`${styles.cell} ${styles.cellB} ${bPad ? styles.cellPad : ''}`}>
                <span>{bPad ? 1 : r.bIn}</span>
                {bPad && <span className={styles.padTag}>pad</span>}
                {!bPad && r.reason === 'b-stretch' && <span className={styles.stretch}>{`stretch to ${r.result}`}</span>}
              </div>
            )
          })}

          <span className={styles.rowLabel} aria-hidden="true" />
          {rows.map((r) => (
            <div key={`rm-${r.pos}`} className={`${styles.mark} ${r.compatible ? styles.markOk : styles.markFail}`} aria-hidden="true">
              {r.compatible ? '✓' : '✗'}
            </div>
          ))}

          <span className={`${styles.rowLabel} ${styles.rowLabelR}`}>{'→'}</span>
          {rows.map((r) => (
            <div
              key={`rr-${r.pos}`}
              className={`${styles.cell} ${styles.resultCell} ${r.compatible ? '' : styles.resultFail}`}
            >
              {r.compatible ? r.result : '✗'}
            </div>
          ))}
        </div>
      </div>

      <div className={`${styles.verdict} ${ok ? styles.verdictOk : styles.verdictFail}`}>
        {ok ? `Broadcasts to ${shapeString(result)}` : 'Cannot broadcast'}
      </div>

      {!ok && (
        <p className={styles.failDetail}>
          {`The aligned sizes ${fail.aEff} and ${fail.bEff} are not compatible (position ${posFromRight} from the right): they are not equal and neither is 1, so the shapes cannot broadcast together.`}
        </p>
      )}

      <p className={styles.note}>
        The compatibility of each dimension pair and the result shape are computed for real
        from the standard NumPy-style broadcasting rule: align from the right, pad the
        shorter shape with 1s on the left, a pair fits when the sizes are equal or one is 1,
        and the result takes the larger size. The shapes are kept small and simple so the
        alignment stays easy to read.
      </p>
    </Figure>
  )
}
