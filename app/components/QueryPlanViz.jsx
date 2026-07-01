'use client'

import { useState } from 'react'
import Figure from './Figure'
import styles from './QueryPlanViz.module.css'
import {
  P1_N,
  P1_SCORES,
  p1Costs,
  P1_MAX_COST,
  p1ThresholdFor,
  P2_TABLES,
  P2_ORDERS,
  p2Cost,
  p2StepRows,
  p2OrderById,
  P2_SQL,
} from './queryPlanData'

// one labelled cost bar; `chosen` marks the plan/order the planner would pick (lower cost)
function CostBar({ name, cost, chosen, max, unit }) {
  const pct = Math.max(3, (cost / max) * 100)
  return (
    <div className={`${styles.bar} ${chosen ? styles.barChosen : ''}`}>
      <div className={styles.barHead}>
        <span className={styles.barName}>{name}</span>
        {chosen && <span className={styles.barTag}>planner picks</span>}
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.barCost}>
        cost {cost.toFixed(cost < 100 ? 1 : 0)}
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

function Part1() {
  const [m, setM] = useState(3)
  const { index, scan, chosen } = p1Costs(m)
  const pct = Math.round((m / P1_N) * 100)
  const explain =
    chosen === 'index'
      ? `Index Scan using users_score_idx on users  (rows=${m}  cost=${index.toFixed(1)})`
      : `Seq Scan on users  (rows=${m}  cost=${scan.toFixed(1)})  Filter: score <= ${p1ThresholdFor(m)}`

  return (
    <div className={styles.part}>
      <pre className={styles.sql}>{`SELECT * FROM users WHERE score <= ${p1ThresholdFor(m)};`}</pre>

      <div className={styles.controlLine}>
        <span className={styles.label}>matches</span>
        <input className={styles.range} type="range" min={1} max={P1_N} step={1} value={m} onChange={(e) => setM(Number(e.target.value))} aria-label="rows matching the filter" />
        <span className={styles.value}>
          {m} of {P1_N} rows ({pct}%)
        </span>
      </div>

      {/* selectivity strip: the sorted table, the M lowest-score rows match */}
      <div className={styles.strip} aria-hidden="true">
        {P1_SCORES.map((s, i) => (
          <span key={i} className={i < m ? styles.cellMatch : styles.cell} />
        ))}
      </div>

      <div className={styles.plans}>
        <CostBar name="Index Scan" cost={index} chosen={chosen === 'index'} max={P1_MAX_COST} />
        <CostBar name="Seq Scan" cost={scan} chosen={chosen === 'scan'} max={P1_MAX_COST} />
      </div>

      <div className={styles.explainLabel}>Simplified EXPLAIN (illustrative, not real Postgres output)</div>
      <pre className={styles.explain}>{explain}</pre>
    </div>
  )
}

function Part2() {
  const [orderId, setOrderId] = useState('good')
  const order = p2OrderById(orderId)
  const goodCost = p2Cost(p2OrderById('good'))
  const badCost = p2Cost(p2OrderById('bad'))
  const max = Math.max(goodCost, badCost)

  const stepText = order.steps.map((step, i) => {
    const rows = p2StepRows(step)
    // the table(s) newly added at this step = this step's set minus the previous step's set
    const prev = i === 0 ? [] : order.steps[i - 1]
    const added = step.filter((t) => !prev.includes(t))
    return { key: i, text: i === 0 ? `join ${step.join(' + ')}` : `then join ${added.join(' + ')}`, rows }
  })

  return (
    <div className={styles.part}>
      <pre className={styles.sql}>{P2_SQL}</pre>

      <div className={styles.chips}>
        {P2_TABLES.map((t) => (
          <div key={t.name} className={styles.chip}>
            <span className={styles.chipName}>{t.name}</span>
            <span className={styles.chipSize}>{t.size.toLocaleString()} rows</span>
            {t.note && <span className={styles.chipNote}>{t.note}</span>}
          </div>
        ))}
      </div>

      <div className={styles.controlLine}>
        <span className={styles.label}>join order</span>
        <div className={styles.toggleGroup} role="group" aria-label="Join order">
          {P2_ORDERS.map((o) => (
            <button key={o.id} type="button" className={`${styles.toggleBtn} ${o.id === orderId ? styles.toggleActive : ''}`} aria-pressed={o.id === orderId} onClick={() => setOrderId(o.id)}>
              {o.id === 'good' ? 'good order' : 'bad order'}
            </button>
          ))}
        </div>
      </div>

      {/* the selected order's intermediate results, step by step */}
      <div className={styles.steps}>
        {stepText.map((s) => (
          <div key={s.key} className={styles.step}>
            <span className={styles.stepLabel}>{s.text}</span>
            <span className={styles.stepRows}>{s.rows.toLocaleString()} rows</span>
          </div>
        ))}
        <div className={styles.stepTotal}>
          <span className={styles.stepLabel}>total intermediate rows</span>
          <span className={styles.stepRows}>{p2Cost(order).toLocaleString()}</span>
        </div>
      </div>

      <div className={styles.plans}>
        <CostBar name="Good order" cost={goodCost} chosen={goodCost <= badCost} max={max} unit="rows" />
        <CostBar name="Bad order" cost={badCost} chosen={badCost < goodCost} max={max} unit="rows" />
      </div>
    </div>
  )
}

export default function QueryPlanViz() {
  const [part, setPart] = useState('p1')

  const status =
    part === 'p1'
      ? 'Index vs scan: as more rows match, the cheaper plan flips from the index to a full scan.'
      : 'Join order: joining the small, filtered table first keeps the intermediate result small.'

  return (
    <Figure
      eyebrow="Planning"
      title="How the engine decides to run your query"
      status={status}
      tryThis="Part 1, index vs scan: drag the matches slider. When only a few rows match, the index plan is cheaper and the planner picks it; as more rows match, the index cost climbs past the flat cost of just scanning the whole table, and the choice flips to Seq Scan. Part 2, join order: the same query joined in two orders. Joining the small filtered customers first keeps the middle result tiny; joining the two big tables first blows it up. Both costs come from one simple, transparent model, so the direction of each tradeoff is the real lesson, not the exact numbers."
    >
      <div className={styles.partToggle} role="group" aria-label="Planner decision">
        <button type="button" className={`${styles.partBtn} ${part === 'p1' ? styles.partActive : ''}`} aria-pressed={part === 'p1'} onClick={() => setPart('p1')}>
          1 &middot; index vs scan
        </button>
        <button type="button" className={`${styles.partBtn} ${part === 'p2' ? styles.partActive : ''}`} aria-pressed={part === 'p2'} onClick={() => setPart('p2')}>
          2 &middot; join order
        </button>
      </div>

      {part === 'p1' ? <Part1 /> : <Part2 />}

      <p className={styles.note}>
        The costs and row counts come from one simplified, transparent model on fixed data. A real planner is far more
        complex, using table statistics, a detailed cost model, and many plan types, and real EXPLAIN output looks
        different. What is real here is the direction of each tradeoff: selectivity flips index versus scan, and join
        order changes how big the intermediate results get.
      </p>
    </Figure>
  )
}
