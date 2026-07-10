'use client'

import { useState } from 'react'
import Figure from './Figure'
import { ROWS, GROUP_KEYS, shardOf, balanceOf } from './shardingData'
import styles from './ShardingViz.module.css'

const KEY_LABELS = { id: 'id', country: 'country', plan: 'plan' }
const N_OPTIONS = [3, 4]

export default function ShardingViz() {
  const [keyColumn, setKeyColumn] = useState('id')
  const [n, setN] = useState(4)

  const { counts, max, min, hot } = balanceOf(keyColumn, n)
  const shards = Array.from({ length: n }, (_, shardIndex) =>
    ROWS.filter((row) => shardOf(row[keyColumn], n) === shardIndex)
  )
  const hotIndex = counts.indexOf(max)

  const readouts = [
    { label: 'rows', value: ROWS.length },
    { label: 'shards', value: n },
    { label: 'busiest shard', value: max },
    { label: 'quietest shard', value: min },
  ]

  const status = hot
    ? `Hot shard: shard ${hotIndex} holds ${max} of ${ROWS.length} rows. The "${KEY_LABELS[keyColumn]}" key has too few distinct values to spread evenly across ${n} shards.`
    : `Fairly balanced: shard loads range from ${min} to ${max} across ${n} shards.`

  return (
    <Figure
      eyebrow="Sharding"
      title="Which shard does a row live on?"
      status={status}
      readouts={readouts}
      tryThis="Start on the id key and note how evenly the shards fill. Switch to country for a milder spread, then to plan and watch one shard swallow most of the rows. Change the shard count between 3 and 4 and see the placements recompute."
    >
      <div className={styles.controlsRow}>
        <span className={styles.groupLabel}>partition key</span>
        {GROUP_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`${styles.btn} ${keyColumn === k ? styles.btnOn : ''}`}
            aria-pressed={keyColumn === k}
            onClick={() => setKeyColumn(k)}
          >
            {KEY_LABELS[k]}
          </button>
        ))}
        <span className={styles.groupLabel} style={{ marginLeft: 8 }}>
          shards
        </span>
        {N_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`${styles.btn} ${n === opt ? styles.btnOn : ''}`}
            aria-pressed={n === opt}
            onClick={() => setN(opt)}
          >
            {opt}
          </button>
        ))}
      </div>

      <div
        className={styles.shardRow}
        style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
        role="img"
        aria-label={`${ROWS.length} rows hashed by ${KEY_LABELS[keyColumn]} into ${n} shards. Counts: ${counts.join(', ')}. ${status}`}
      >
        {shards.map((rows, shardIndex) => {
          const isHot = hot && shardIndex === hotIndex
          return (
            <div key={shardIndex} className={`${styles.shard} ${isHot ? styles.shardHot : ''}`}>
              <div className={styles.shardHeader}>
                <span className={styles.shardIndex}>{`shard ${shardIndex}`}</span>
                <span className={styles.shardCount}>{rows.length}</span>
              </div>
              <div className={styles.shardBody}>
                {rows.length === 0 && <span className={styles.empty}>empty</span>}
                {rows.map((row) => (
                  <div key={row.id} className={styles.chip}>
                    <span className={styles.chipId}>{row.id}</span>
                    {keyColumn !== 'id' && <span className={styles.chipValue}>{row[keyColumn]}</span>}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <p className={styles.caption}>
        Every placement above is the real FNV-1a hash of the selected key, taken mod
        the shard count. The 14 rows here are hand-authored to make the skew easy to
        see; a real shard holds millions of rows and a real deployment uses far more
        than 3 or 4 shards.
      </p>
    </Figure>
  )
}
