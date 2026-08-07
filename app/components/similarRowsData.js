// Deterministic data for the Finding Similar Rows topic (Databases and SQL).
//
// The 16-row customer churn table below is authored once and frozen: no
// randomness at runtime, authored inputs, computed outputs. It is written so
// that real co-occurrence structure exists to be found (a short-tenure
// month-to-month electronic-check cluster, a long-tenure two-year
// bank-transfer cluster, a mid-everything one-year cluster, and a few
// deliberate in-between rows), but nothing in the data labels the clusters:
// they emerge, or fail to, from the computed similarity alone.
//
// Pipeline, all computed here:
//   1. raw table
//   2. columns classified: categorical / numeric / identifier (id excluded)
//   3. tokenized: categorical values are tokens as-is; each numeric column is
//      binned into 4 quantile buckets over its 16 values and the bucket is the
//      token (boundaries = midpoints between sorted values 4|5, 8|9, 12|13;
//      the authored values are tie-free so every bin holds exactly 4 rows)
//   4. each row is an unordered bag of its tokens
//   5. co-occurrence over the vocabulary -> PPMI -> token vectors -> row
//      vectors (mean of token vectors) -> cosine ranking against a selected
//      row, self excluded, ties broken by row order
//
// PPMI uses log base 2: ppmi(a,b) = max(0, log2( p(a,b) / (p(a)p(b)) )) with
// p taken from the symmetric co-occurrence matrix itself: p(a,b) = X[a][b] /
// total, p(a) = rowSum(a) / total, total = the full matrix sum. Real systems
// train a neural network to learn such vectors; counting co-occurrence and
// weighting with PPMI is a deliberately simple stand-in that reaches a
// similar shape of result by a cruder route (disclosed in the figure).

export const COLUMNS = [
  { key: 'id', label: 'customer id', kind: 'identifier' },
  { key: 'contract', label: 'contract type', kind: 'categorical' },
  { key: 'payment', label: 'payment method', kind: 'categorical' },
  { key: 'charge', label: 'monthly charge', kind: 'numeric' },
  { key: 'tenure', label: 'tenure months', kind: 'numeric' },
]

// The four model columns (identifier excluded); toggling happens over these.
export const MODEL_COLUMNS = ['contract', 'payment', 'charge', 'tenure']

export const ROWS = [
  { id: 'C01', contract: 'month-to-month', payment: 'electronic check', charge: 89.9, tenure: 2 },
  { id: 'C02', contract: 'month-to-month', payment: 'electronic check', charge: 94.2, tenure: 4 },
  { id: 'C03', contract: 'month-to-month', payment: 'electronic check', charge: 79.5, tenure: 6 },
  { id: 'C04', contract: 'month-to-month', payment: 'electronic check', charge: 85.1, tenure: 8 },
  { id: 'C05', contract: 'month-to-month', payment: 'electronic check', charge: 92.4, tenure: 3 },
  { id: 'C06', contract: 'two year', payment: 'bank transfer', charge: 19.9, tenure: 60 },
  { id: 'C07', contract: 'two year', payment: 'bank transfer', charge: 24.5, tenure: 66 },
  { id: 'C08', contract: 'two year', payment: 'credit card', charge: 29.9, tenure: 54 },
  { id: 'C09', contract: 'two year', payment: 'bank transfer', charge: 34.9, tenure: 70 },
  { id: 'C10', contract: 'two year', payment: 'credit card', charge: 25.7, tenure: 48 },
  { id: 'C11', contract: 'one year', payment: 'mailed check', charge: 49.9, tenure: 22 },
  { id: 'C12', contract: 'one year', payment: 'mailed check', charge: 55.4, tenure: 26 },
  { id: 'C13', contract: 'one year', payment: 'credit card', charge: 60.2, tenure: 30 },
  { id: 'C14', contract: 'month-to-month', payment: 'bank transfer', charge: 65.0, tenure: 12 },
  { id: 'C15', contract: 'one year', payment: 'electronic check', charge: 45.5, tenure: 36 },
  { id: 'C16', contract: 'two year', payment: 'electronic check', charge: 74.9, tenure: 42 },
]

export const BIN_COUNT = 4
const BIN_LABELS = ['Q1', 'Q2', 'Q3', 'Q4']

// Quantile bin boundaries for a numeric column: the three cut points at the
// quartile seams of the 16 sorted values (midpoint of sorted[3]|[4], [7]|[8],
// [11]|[12]). Values are authored tie-free, so bins hold exactly 4 rows each.
export function binBoundaries(key) {
  const sorted = ROWS.map((r) => r[key]).sort((a, b) => a - b)
  const cuts = []
  for (let q = 1; q < BIN_COUNT; q += 1) {
    const i = q * (sorted.length / BIN_COUNT)
    cuts.push((sorted[i - 1] + sorted[i]) / 2)
  }
  return cuts
}

export function binOf(key, value) {
  const cuts = binBoundaries(key)
  let b = 0
  while (b < cuts.length && value > cuts[b]) b += 1
  return b
}

// The token a column contributes for a row. Numeric tokens carry the column
// name so charge Q1 and tenure Q1 stay distinct tokens.
export function tokenFor(key, row) {
  const col = COLUMNS.find((c) => c.key === key)
  if (col.kind === 'categorical') return row[key]
  return `${key} ${BIN_LABELS[binOf(key, row[key])]}`
}

// A row's unordered bag of tokens over the included columns.
export function bagOf(row, included) {
  return MODEL_COLUMNS.filter((k) => included.includes(k)).map((k) => tokenFor(k, row))
}

// The whole model for a given set of included columns: vocabulary (in first-
// appearance order), symmetric co-occurrence counts, PPMI matrix, per-token
// vectors (their PPMI rows), per-row vectors (mean of token vectors), and the
// cosine ranking for every row.
export function buildModel(included) {
  const bags = ROWS.map((r) => bagOf(r, included))

  const vocab = []
  for (const bag of bags) for (const t of bag) if (!vocab.includes(t)) vocab.push(t)
  const index = new Map(vocab.map((t, i) => [t, i]))
  const V = vocab.length

  // Symmetric co-occurrence: every unordered pair of distinct tokens sharing a
  // row increments both mirror cells.
  const counts = Array.from({ length: V }, () => new Array(V).fill(0))
  for (const bag of bags) {
    for (let i = 0; i < bag.length; i += 1) {
      for (let j = i + 1; j < bag.length; j += 1) {
        const a = index.get(bag[i])
        const b = index.get(bag[j])
        counts[a][b] += 1
        counts[b][a] += 1
      }
    }
  }

  const rowSums = counts.map((row) => row.reduce((s, v) => s + v, 0))
  const total = rowSums.reduce((s, v) => s + v, 0)

  // PPMI in log base 2 over the matrix's own probabilities.
  const ppmi = counts.map((row, a) =>
    row.map((c, b) => {
      if (c === 0) return 0
      const val = Math.log2((c / total) / ((rowSums[a] / total) * (rowSums[b] / total)))
      return Math.max(0, val)
    }),
  )

  // Row vector = mean of its tokens' PPMI rows.
  const rowVectors = bags.map((bag) => {
    const vec = new Array(V).fill(0)
    for (const t of bag) {
      const ti = index.get(t)
      for (let d = 0; d < V; d += 1) vec[d] += ppmi[ti][d]
    }
    return vec.map((v) => v / bag.length)
  })

  const cosine = (u, v) => {
    let dot = 0
    let nu = 0
    let nv = 0
    for (let d = 0; d < u.length; d += 1) {
      dot += u[d] * v[d]
      nu += u[d] * u[d]
      nv += v[d] * v[d]
    }
    if (nu === 0 || nv === 0) return 0
    return dot / (Math.sqrt(nu) * Math.sqrt(nv))
  }

  // Ranking for each row: every other row by descending cosine, ties broken
  // by row order (stable sort over index-ordered input).
  const rankings = ROWS.map((_, i) =>
    ROWS.map((r, j) => ({ j, id: r.id, cos: cosine(rowVectors[i], rowVectors[j]) }))
      .filter((e) => e.j !== i)
      .sort((a, b) => b.cos - a.cos || a.j - b.j),
  )

  const vocabCounts = vocab.map((t, i) => ({
    token: t,
    rows: bags.filter((bag) => bag.includes(t)).length,
    pairSum: rowSums[i],
  }))

  return { vocab, vocabCounts, counts, ppmi, bags, rowVectors, rankings, total }
}
