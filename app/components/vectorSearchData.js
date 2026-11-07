// Deterministic data and search engine for the Finding Similar Rows topic,
// framed around pgvector.
//
// The same 16 customers as before (similarRowsData.js), each now carrying an
// `embedding vector(4)` column. The vectors are hand-set for readability,
// standing in for the output of an embedding model run elsewhere; they are
// shaped so the short-tenure month-to-month customers, the two-year customers
// and the one-year customers sit near each other, with a few in-between rows.
// C09 deliberately points the same way as the two-year group but is longer,
// so the two pgvector operators disagree about it:
//   <->  L2 (Euclidean) distance: length matters
//   <=>  cosine distance (1 - cosine similarity): only direction matters
//
// Everything a reader sees is computed here from the vectors shown: every
// distance, every ranking, the IVFFlat lists (a k-means over the vectors) and
// which rows a probe-limited search can reach. Nothing is typed in per query.
import { ROWS } from './similarRowsData'

export const EMBEDDINGS = {
  C01: [0.91, 0.12, 0.2, 0.84],
  C02: [0.88, 0.08, 0.15, 0.9],
  C03: [0.84, 0.18, 0.28, 0.76],
  C04: [0.86, 0.15, 0.24, 0.8],
  C05: [0.93, 0.1, 0.18, 0.88],
  C06: [0.1, 0.92, 0.74, 0.12],
  C07: [0.08, 0.95, 0.7, 0.08],
  C08: [0.16, 0.84, 0.78, 0.2],
  C09: [0.18, 1.45, 1.08, 0.2],
  C10: [0.2, 0.8, 0.76, 0.22],
  C11: [0.42, 0.48, 0.9, 0.3],
  C12: [0.38, 0.52, 0.94, 0.26],
  C13: [0.34, 0.6, 0.88, 0.28],
  C14: [0.7, 0.3, 0.5, 0.62],
  C15: [0.58, 0.4, 0.72, 0.5],
  C16: [0.5, 0.62, 0.42, 0.52],
}

export const CUSTOMERS = ROWS.map((r) => ({ ...r, embedding: EMBEDDINGS[r.id] }))
export const DIM = 4

export const OPERATORS = [
  { id: 'l2', label: '<-> L2 distance', op: '<->', opclass: 'vector_l2_ops' },
  { id: 'cosine', label: '<=> cosine distance', op: '<=>', opclass: 'vector_cosine_ops' },
]
export const LIMITS = [3, 5]
export const LISTS = 4
export const INDEXES = [
  { id: 'none', label: 'no index (exact scan)', probes: null },
  { id: 'ivf1', label: 'IVFFlat, probes = 1', probes: 1 },
  { id: 'ivf2', label: 'IVFFlat, probes = 2', probes: 2 },
  { id: 'ivf4', label: 'IVFFlat, probes = 4', probes: 4 },
]

// ── vector maths ────────────────────────────────────────────────────────────
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const norm = (a) => Math.sqrt(dot(a, a))
export const l2 = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0))
export const cosineDistance = (a, b) => 1 - dot(a, b) / (norm(a) * norm(b))
export const distanceFn = (operator) => (operator === 'cosine' ? cosineDistance : l2)

// ── IVFFlat: k-means into LISTS lists ───────────────────────────────────────
// pgvector builds an IVFFlat index by running k-means over the table's
// vectors; each vector is stored in the list of its nearest centre. With
// vector_cosine_ops the vectors are normalised first. Here the k-means is
// seeded deterministically (the first row of each authored group: C01, C06,
// C11, C14) and run to convergence, so the lists are reproducible.
const SEEDS = ['C01', 'C06', 'C11', 'C14']
const unit = (v) => v.map((x) => x / norm(v))

export function buildIvf(operator) {
  const prep = (v) => (operator === 'cosine' ? unit(v) : v)
  const pts = CUSTOMERS.map((c) => ({ id: c.id, v: prep(c.embedding) }))
  let centres = SEEDS.map((id) => pts.find((p) => p.id === id).v)
  let assign = {}
  for (let iter = 0; iter < 100; iter += 1) {
    const next = {}
    for (const p of pts) {
      let best = 0
      for (let k = 1; k < centres.length; k += 1) if (l2(p.v, centres[k]) < l2(p.v, centres[best])) best = k
      next[p.id] = best
    }
    const same = pts.every((p) => next[p.id] === assign[p.id])
    assign = next
    centres = centres.map((c, k) => {
      const members = pts.filter((p) => assign[p.id] === k)
      if (members.length === 0) return c
      return c.map((_, d) => members.reduce((s, m) => s + m.v[d], 0) / members.length)
    })
    if (same) break
  }
  return { centres, assign, prep }
}

// The lists a probe-limited search visits: the `probes` lists whose centres
// are nearest the query vector.
export function probedLists(ivf, queryVec, probes) {
  const q = ivf.prep(queryVec)
  return ivf.centres
    .map((c, k) => ({ k, d: l2(q, c) }))
    .sort((a, b) => a.d - b.d || a.k - b.k)
    .slice(0, probes)
    .map((x) => x.k)
}

// ── the search: ORDER BY embedding <op> query LIMIT k ───────────────────────
// Returns every other row with its distance (computed from the vectors) and,
// for an index run, whether the search could reach it; `results` is the top k
// among the reachable rows, ties broken by row order.
export function search({ queryId, operator = 'l2', k = 5, index = 'none' }) {
  const dist = distanceFn(operator)
  const q = EMBEDDINGS[queryId]
  const probes = INDEXES.find((i) => i.id === index).probes
  let lists = null
  let assign = null
  if (probes) {
    const ivf = buildIvf(operator)
    assign = ivf.assign
    lists = probedLists(ivf, q, probes)
  }
  // with no index every row is reachable; with one, only rows in a probed list
  const isReachable = (id) => lists === null || lists.includes(assign[id])
  const rows = CUSTOMERS.filter((c) => c.id !== queryId).map((c) => ({
    id: c.id,
    distance: dist(q, c.embedding),
    reachable: isReachable(c.id),
    list: assign ? assign[c.id] : null,
  }))
  const order = (a, b) => a.distance - b.distance || a.id.localeCompare(b.id)
  const exact = [...rows].sort(order).slice(0, k).map((r) => r.id)
  const results = rows.filter((r) => r.reachable).sort(order).slice(0, k).map((r) => r.id)
  const found = results.filter((id) => exact.includes(id)).length
  return { rows, results, exact, recall: found / k, lists, queryList: assign ? assign[queryId] : null }
}

// ── the SQL the figure is running ───────────────────────────────────────────
export function sqlFor({ queryId, operator = 'l2', k = 5, index = 'none' }) {
  const o = OPERATORS.find((x) => x.id === operator)
  const probes = INDEXES.find((i) => i.id === index).probes
  const q = `(SELECT embedding FROM customers WHERE id = '${queryId}')`
  const setup = probes
    ? [`CREATE INDEX ON customers USING ivfflat (embedding ${o.opclass}) WITH (lists = ${LISTS});`, `SET ivfflat.probes = ${probes};`, '']
    : []
  const query = [
    `SELECT id, embedding ${o.op} ${q} AS distance`,
    'FROM customers',
    `WHERE id <> '${queryId}'`,
    `ORDER BY embedding ${o.op} ${q}`,
    `LIMIT ${k};`,
  ]
  return [...setup, ...query].join('\n')
}

export const fmtVec = (v) => `[${v.map((x) => x.toFixed(2)).join(', ')}]`
