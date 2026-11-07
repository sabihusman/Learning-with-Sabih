import { test, expect } from '@playwright/test'
import { CUSTOMERS, EMBEDDINGS, INDEXES, LIMITS, buildIvf, search, sqlFor } from '../app/components/vectorSearchData'

// Invariants for the pgvector Finding Similar Rows figure: every distance and
// ranking is computed from the vectors shown, and an IVFFlat search can only
// return rows from the lists it probes.

// Independent re-implementations of pgvector's two operators.
const L2 = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) * (x - b[i]), 0))
const COS = (a: number[], b: number[]) => {
  let d = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return 1 - d / Math.sqrt(na * nb)
}
const IDS = CUSTOMERS.map((c) => c.id)

test.describe('vector search logic', () => {
  test('every distance matches an independent <-> and <=>, for every query row', () => {
    for (const q of IDS) {
      for (const [operator, f] of [['l2', L2], ['cosine', COS]] as const) {
        const { rows } = search({ queryId: q, operator, k: 5 })
        expect(rows.map((r) => r.id)).not.toContain(q)
        for (const r of rows) expect(r.distance, `${q}->${r.id} ${operator}`).toBeCloseTo(f(EMBEDDINGS[q], EMBEDDINGS[r.id]), 12)
      }
    }
  })

  test('with no index, results are the k smallest distances, ascending (ORDER BY ... LIMIT k)', () => {
    for (const q of IDS) {
      for (const operator of ['l2', 'cosine']) {
        for (const k of LIMITS) {
          const s = search({ queryId: q, operator, k })
          const f = operator === 'l2' ? L2 : COS
          const expected = IDS.filter((id) => id !== q)
            .sort((a, b) => f(EMBEDDINGS[q], EMBEDDINGS[a]) - f(EMBEDDINGS[q], EMBEDDINGS[b]) || a.localeCompare(b))
            .slice(0, k)
          expect(s.results, `${q} ${operator} ${k}`).toEqual(expected)
          expect(s.recall).toBe(1)
        }
      }
    }
  })

  test('the two operators disagree when lengths differ: C06 ranks the long C09 first under <=>, not at all under <->', () => {
    expect(search({ queryId: 'C06', operator: 'cosine', k: 5 }).results[0]).toBe('C09')
    expect(search({ queryId: 'C06', operator: 'l2', k: 5 }).results).not.toContain('C09')
  })

  test('IVFFlat lists are a converged k-means: every vector sits in its nearest list', () => {
    for (const operator of ['l2', 'cosine']) {
      const ivf = buildIvf(operator)
      for (const c of CUSTOMERS) {
        const v = ivf.prep(c.embedding)
        const d = ivf.centres.map((ctr) => L2(v, ctr))
        expect(d[ivf.assign[c.id]], `${operator} ${c.id}`).toBeCloseTo(Math.min(...d), 12)
      }
    }
  })

  test('an IVFFlat search returns only rows in the lists it probes; recall rises with probes and reaches 1 at probes = lists', () => {
    for (const q of IDS) {
      let prev = 0
      for (const idx of INDEXES.filter((i) => i.probes)) {
        const s = search({ queryId: q, operator: 'l2', k: 5, index: idx.id })
        const reachable = new Set(s.rows.filter((r) => r.reachable).map((r) => r.id))
        for (const id of s.results) expect(reachable.has(id), `${q} ${idx.id} ${id}`).toBe(true)
        expect(s.lists.length).toBe(idx.probes)
        expect(s.recall).toBe(s.results.filter((id) => s.exact.includes(id)).length / 5)
        expect(s.recall).toBeGreaterThanOrEqual(prev)
        prev = s.recall
      }
      expect(prev).toBe(1)
    }
    // at probes = 1 the approximate search really does miss neighbours somewhere
    expect(IDS.some((q) => search({ queryId: q, operator: 'l2', k: 5, index: 'ivf1' }).recall < 1)).toBe(true)
  })

  test('the SQL shown is the query the table answers', () => {
    const exact = sqlFor({ queryId: 'C04', operator: 'l2', k: 5, index: 'none' })
    expect(exact).toContain("ORDER BY embedding <-> (SELECT embedding FROM customers WHERE id = 'C04')")
    expect(exact).toContain("WHERE id <> 'C04'")
    expect(exact).toContain('LIMIT 5;')
    expect(exact).not.toContain('ivfflat')
    const ivf = sqlFor({ queryId: 'C11', operator: 'cosine', k: 3, index: 'ivf2' })
    expect(ivf).toContain('CREATE INDEX ON customers USING ivfflat (embedding vector_cosine_ops) WITH (lists = 4);')
    expect(ivf).toContain('SET ivfflat.probes = 2;')
    expect(ivf).toContain('ORDER BY embedding <=> ')
    expect(ivf).toContain('LIMIT 3;')
  })
})

test.describe('vector search figure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/topics/finding-similar-rows/')
    await expect(page.getByTestId('vec-table')).toBeVisible()
  })

  test('picking a query row and switching the operator re-ranks the table', async ({ page }) => {
    await page.getByTestId('vec-pick-C06').click()
    await expect(page.getByTestId('vec-sql')).toContainText("WHERE id = 'C06'")
    await expect(page.getByTestId('vec-row-C09')).not.toHaveAttribute('data-rank', /.+/)
    await page.getByTestId('vec-op-cosine').click()
    await expect(page.getByTestId('vec-row-C09')).toHaveAttribute('data-rank', '1')
    await expect(page.getByTestId('vec-sql')).toContainText('ORDER BY embedding <=>')
  })

  test('an IVFFlat index with probes = 1 leaves rows unsearched and lowers recall', async ({ page }) => {
    await page.getByTestId('vec-pick-C11').click()
    await page.getByTestId('vec-index-ivf1').click()
    await expect(page.getByTestId('vec-sql')).toContainText('SET ivfflat.probes = 1;')
    await expect(page.locator('[data-reachable="false"]').first()).toBeVisible()
    await expect(page.locator('figure')).toContainText('missed')
    // C11's list holds only C12 and C13, so LIMIT 5 returns 2 rows, as pgvector does
    await expect(page.locator('figure')).toContainText('Only 2 rows came back')
    await page.getByTestId('vec-index-ivf4').click()
    await expect(page.locator('figure')).toContainText('found the same rows as an exact scan')
  })

  test('the bridge panel shows the pre-embedding method for the query row', async ({ page }) => {
    await page.getByTestId('vec-pick-C16').click()
    await expect(page.getByTestId('vec-bridge')).toContainText('Without a model, C16 becomes a bag of its own values')
  })
})
