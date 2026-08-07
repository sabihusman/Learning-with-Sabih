import { test, expect } from '@playwright/test'
import {
  ROWS,
  MODEL_COLUMNS,
  BIN_COUNT,
  binBoundaries,
  tokenFor,
  bagOf,
  buildModel,
} from '../app/components/similarRowsData'

// Pure-logic correctness for the Finding Similar Rows figure. No page, no
// browser. Everything below is an INDEPENDENT resimulation from the raw ROWS
// literals: its own binning, its own tokenizer, its own co-occurrence counts,
// its own PPMI (log base 2), its own vectors and cosines. It asserts the data
// module's outputs match for the bin boundaries, the vocabulary, the full
// co-occurrence matrix, and the complete ranking of all 16 rows under all
// columns on plus each single column excluded (5 column sets, 80 rankings).

type Model = {
  vocab: string[]
  counts: number[][]
  rankings: Array<Array<{ id: string; cos: number }>>
}

function resimulate(includedCols: string[]): Model {
  // Independent tokenizer: quantile cuts at the quartile seam midpoints.
  const cutsFor = (key: string) => {
    const sorted = ROWS.map((r) => (r as never as Record<string, number>)[key]).sort((a, b) => a - b)
    const cuts: number[] = []
    for (let q = 1; q < BIN_COUNT; q += 1) {
      const i = (q * sorted.length) / BIN_COUNT
      cuts.push((sorted[i - 1] + sorted[i]) / 2)
    }
    return cuts
  }
  const labels = ['Q1', 'Q2', 'Q3', 'Q4']
  const tokenOf = (key: string, row: (typeof ROWS)[number]) => {
    const v = (row as never as Record<string, string | number>)[key]
    if (key === 'contract' || key === 'payment') return String(v)
    const cuts = cutsFor(key)
    let b = 0
    while (b < cuts.length && (v as number) > cuts[b]) b += 1
    return `${key} ${labels[b]}`
  }

  const bags = ROWS.map((r) => includedCols.map((k) => tokenOf(k, r)))

  const vocab: string[] = []
  for (const bag of bags) for (const t of bag) if (!vocab.includes(t)) vocab.push(t)
  const idx = (t: string) => vocab.indexOf(t)
  const V = vocab.length

  const counts: number[][] = Array.from({ length: V }, () => new Array(V).fill(0))
  for (const bag of bags) {
    for (let i = 0; i < bag.length; i += 1) {
      for (let j = i + 1; j < bag.length; j += 1) {
        counts[idx(bag[i])][idx(bag[j])] += 1
        counts[idx(bag[j])][idx(bag[i])] += 1
      }
    }
  }

  const rowSums = counts.map((row) => row.reduce((s, v) => s + v, 0))
  const total = rowSums.reduce((s, v) => s + v, 0)
  const ppmi = counts.map((row, a) =>
    row.map((c, b) => (c === 0 ? 0 : Math.max(0, Math.log2(c / total / ((rowSums[a] / total) * (rowSums[b] / total))))))
  )

  const rowVecs = bags.map((bag) => {
    const vec = new Array(V).fill(0)
    for (const t of bag) for (let d = 0; d < V; d += 1) vec[d] += ppmi[idx(t)][d]
    return vec.map((v) => v / bag.length)
  })

  const cos = (u: number[], v: number[]) => {
    let dot = 0
    let nu = 0
    let nv = 0
    for (let d = 0; d < u.length; d += 1) {
      dot += u[d] * v[d]
      nu += u[d] * u[d]
      nv += v[d] * v[d]
    }
    return nu === 0 || nv === 0 ? 0 : dot / (Math.sqrt(nu) * Math.sqrt(nv))
  }

  const rankings = ROWS.map((_, i) =>
    ROWS.map((r, j) => ({ j, id: r.id, cos: cos(rowVecs[i], rowVecs[j]) }))
      .filter((e) => e.j !== i)
      .sort((a, b) => b.cos - a.cos || a.j - b.j)
      .map((e) => ({ id: e.id, cos: e.cos })),
  )

  return { vocab, counts, rankings }
}

test('bin boundaries match an independent quantile computation', () => {
  for (const key of ['charge', 'tenure']) {
    const sorted = ROWS.map((r) => (r as never as Record<string, number>)[key]).sort((a, b) => a - b)
    const expected = [1, 2, 3].map((q) => (sorted[q * 4 - 1] + sorted[q * 4]) / 2)
    expect(binBoundaries(key), key).toEqual(expected)
    // Tie-free by construction: every bin holds exactly 4 rows.
    const binCounts = [0, 0, 0, 0]
    for (const r of ROWS) {
      const t = tokenFor(key, r)
      binCounts[Number(t.slice(-1)) - 1] += 1
    }
    expect(binCounts, key).toEqual([4, 4, 4, 4])
  }
})

const COLUMN_SETS: Array<{ name: string; cols: string[] }> = [
  { name: 'all four columns', cols: [...MODEL_COLUMNS] },
  ...MODEL_COLUMNS.map((excluded) => ({
    name: `without ${excluded}`,
    cols: MODEL_COLUMNS.filter((c) => c !== excluded),
  })),
]

for (const { name, cols } of COLUMN_SETS) {
  test(`vocabulary, co-occurrence, and all 16 rankings match: ${name}`, () => {
    const expected = resimulate(cols)
    const actual = buildModel(cols)

    expect(actual.vocab, 'vocabulary').toEqual(expected.vocab)
    expect(actual.counts, 'co-occurrence matrix').toEqual(expected.counts)

    ROWS.forEach((r, i) => {
      expect(bagOf(r, cols), `bag of ${r.id}`).toEqual(cols.map((k) => tokenFor(k, r)))
      const act = actual.rankings[i]
      const exp = expected.rankings[i]
      expect(act.length, `${r.id} ranking length`).toBe(15)
      act.forEach((e, k) => {
        expect(e.id, `${r.id} rank ${k + 1} (${name})`).toBe(exp[k].id)
        expect(e.cos, `${r.id} rank ${k + 1} cosine (${name})`).toBeCloseTo(exp[k].cos, 12)
      })
    })
  })
}
