'use client'

import { useState } from 'react'
import Figure from './Figure'
import ChoiceGroup from './ChoiceGroup'
import { MODEL_COLUMNS, buildModel, bagOf } from './similarRowsData'
import { CUSTOMERS, INDEXES, LIMITS, LISTS, OPERATORS, fmtVec, search, sqlFor } from './vectorSearchData'
import shared from './vizShared.module.css'
import styles from './SimilarRowsViz.module.css'

// The pre-embedding method, kept as a bridge: co-occurrence counts weighted
// with PPMI over the table's own tokens (all four columns).
const PPMI = buildModel([...MODEL_COLUMNS])
const ROW_INDEX = Object.fromEntries(CUSTOMERS.map((c, i) => [c.id, i]))

const fmtD = (d) => d.toFixed(3)

export default function SimilarRowsViz() {
  const [queryId, setQueryId] = useState('C04')
  const [operator, setOperator] = useState('l2')
  const [k, setK] = useState(5)
  const [index, setIndex] = useState('none')

  const opts = { queryId, operator, k, index }
  const res = search(opts)
  const byId = Object.fromEntries(res.rows.map((r) => [r.id, r]))
  const rankOf = Object.fromEntries(res.results.map((id, i) => [id, i + 1]))
  const op = OPERATORS.find((o) => o.id === operator)
  const usingIndex = index !== 'none'
  const missed = res.exact.filter((id) => !res.results.includes(id))

  const readouts = [
    { label: 'query row', value: queryId },
    { label: 'operator', value: op.op },
    { label: 'LIMIT', value: k },
    { label: 'index', value: usingIndex ? `IVFFlat, ${res.lists.length} of ${LISTS} lists searched` : 'none' },
    { label: 'rows returned', value: `${res.results.length} of ${k}` },
    { label: 'recall vs exact scan', value: `${Math.round(res.recall * 100)}%` },
  ]

  const list = res.results.map((id) => `${id} ${fmtD(byId[id].distance)}`).join(', ')
  const short = res.results.length < k
  let status = `${queryId}'s nearest by ${op.label.slice(4)}, LIMIT ${k}: ${list}.`
  if (short) status += ` Only ${res.results.length} rows came back: the probed lists hold no more.`
  if (usingIndex) {
    status += missed.length
      ? ` The index searched only ${res.lists.length} of ${LISTS} lists and missed ${missed.join(', ')}, which an exact scan returns.`
      : ` The index searched ${res.lists.length} of ${LISTS} lists and found the same rows as an exact scan.`
  }

  const ppmiTop = PPMI.rankings[ROW_INDEX[queryId]].slice(0, 3)

  return (
    <Figure
      eyebrow="Vectors over tables"
      title="Nearest neighbours with pgvector"
      status={status}
      readouts={readouts}
      tryThis="Click a row to make it the query and watch the ranking re-sort by distance. Query C06 and switch the operator: under <-> the long vector C09 is too far away to make the list, under <=> it comes first, because cosine distance ignores length. Then add an IVFFlat index with probes = 1 and query C11: the search reaches only one list, and recall drops. Raise probes until it matches the exact scan."
    >
      <div className={styles.choices}>
        <ChoiceGroup label="operator" options={OPERATORS} value={operator} onChange={setOperator} testPrefix="vec-op" />
        <ChoiceGroup label="LIMIT" options={LIMITS.map((n) => ({ id: String(n), label: String(n) }))} value={String(k)} onChange={(v) => setK(Number(v))} testPrefix="vec-k" />
        <ChoiceGroup label="index" options={INDEXES} value={index} onChange={setIndex} testPrefix="vec-index" />
      </div>

      <div className={shared.scroll}>
        <table className={styles.table} data-testid="vec-table">
          <caption className={styles.tableCaption}>customers: click a row to query with its embedding</caption>
          <thead>
            <tr>
              <th>id</th>
              <th>contract</th>
              <th>tenure</th>
              <th>embedding vector(4)</th>
              {usingIndex && <th>list</th>}
              <th>{`distance ${op.op}`}</th>
              <th>rank</th>
            </tr>
          </thead>
          <tbody>
            {CUSTOMERS.map((c) => {
              const isQuery = c.id === queryId
              const r = byId[c.id]
              const rank = rankOf[c.id]
              const unreachable = r && !r.reachable
              let cls = ''
              if (isQuery) cls = styles.query
              else if (rank) cls = styles.hit
              else if (unreachable) cls = styles.unreached
              return (
                <tr key={c.id} className={cls} data-testid={`vec-row-${c.id}`} data-rank={rank || undefined} data-reachable={r ? String(r.reachable) : undefined}>
                  <td>
                    <button type="button" className={styles.rowBtn} aria-pressed={isQuery} onClick={() => setQueryId(c.id)} data-testid={`vec-pick-${c.id}`}>
                      {c.id}
                    </button>
                  </td>
                  <td>{c.contract}</td>
                  <td className={styles.num}>{c.tenure}</td>
                  <td className={styles.vec}>{fmtVec(c.embedding)}</td>
                  {usingIndex && <td className={styles.num}>{isQuery ? res.queryList + 1 : r.list + 1}</td>}
                  <td className={styles.num}>{isQuery ? 'query' : unreachable ? 'not searched' : fmtD(r.distance)}</td>
                  <td className={styles.num}>{rank ? `#${rank}` : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <pre className={styles.sql} data-testid="vec-sql">
        {sqlFor(opts)}
      </pre>

      <div className={styles.indexes}>
        <section className={styles.indexCard}>
          <div className={styles.indexHead}>IVFFlat (simulated above)</div>
          <p>
            Splits the vectors into lists with k-means when the index is built; a query searches only the
            {' '}<code>ivfflat.probes</code> lists nearest to it. Quick to build and small, but recall depends on
            probes, and the lists are only as good as the data present when it was built.
          </p>
        </section>
        <section className={styles.indexCard}>
          <div className={styles.indexHead}>HNSW (named, not simulated)</div>
          <p>
            Builds a layered graph linking each vector to near neighbours; a query walks the graph toward the
            target. A better speed and recall trade-off, with no training step, at the cost of slower builds and
            more memory.
          </p>
        </section>
      </div>

      <section className={styles.bridge} data-testid="vec-bridge">
        <div className={styles.indexHead}>How it worked before embeddings</div>
        <p>
          {`Without a model, ${queryId} becomes a bag of its own values (${bagOf(CUSTOMERS[ROW_INDEX[queryId]], [...MODEL_COLUMNS]).join(', ')}), counted against how often values share a row and weighted with PPMI. Its three nearest that way: ${ppmiTop.map((e) => `${e.id} (cosine ${e.cos.toFixed(3)})`).join(', ')}.`}
        </p>
      </section>

      <p className={shared.caption}>
        The embeddings are hand-set 4-number vectors standing in for an embedding model&apos;s output; every distance,
        ranking and IVFFlat list above is computed from the vectors shown. The SQL is the pgvector query the table
        answers. Real embeddings have hundreds of dimensions and real tables millions of rows, which is when an
        approximate index starts to pay.
      </p>
    </Figure>
  )
}
