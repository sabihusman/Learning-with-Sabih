import { test, expect } from '@playwright/test'
import { DEFAULT_MIX, QUERIES, cheaperShape, costOf, framesCount, placesTouched, scoreWorkload } from '../app/components/sqlNoSqlData'

// Invariants for the SQL vs NoSQL figure: per-operation costs are computed from
// the data and agree with the traced highlights, and the workload score (not a
// per-query verdict) decides which shape is cheaper.

test.describe('sql vs nosql logic', () => {
  test('each operation cost computed from the data matches its traced highlights', () => {
    for (const q of QUERIES) {
      const traced = placesTouched(q.id, framesCount(q.id))
      const computed = costOf(q.id)
      expect({ relational: computed.relational, document: computed.document }, q.id).toEqual(traced)
    }
  })

  test('the costs as drawn: fetch 3 vs 1, price change 1 vs 2 (2 copies), cross-user query 1 vs 3', () => {
    expect(costOf('fetch-user')).toMatchObject({ relational: 3, document: 1 })
    expect(costOf('change-price')).toMatchObject({ relational: 1, document: 2, relationalWrites: 1, documentWrites: 2 })
    expect(costOf('orders-over-25')).toMatchObject({ relational: 1, document: 3, matches: 3 })
  })

  test('the default mix scores 2.2 vs 1.7 places per operation, document cheaper', () => {
    const s = scoreWorkload(DEFAULT_MIX)!
    expect(s.relational.places).toBeCloseTo(2.2, 10)
    expect(s.document.places).toBeCloseTo(1.7, 10)
    expect(cheaperShape(s)).toBe('document')
  })

  test('the winner depends on the mix: document is cheaper exactly when 2 x fetch > price + 2 x cross', () => {
    for (let f = 0; f <= 10; f++) {
      for (let u = 0; u <= 10; u++) {
        for (let c = 0; c <= 10; c++) {
          const s = scoreWorkload({ 'fetch-user': f, 'change-price': u, 'orders-over-25': c })
          if (f + u + c === 0) {
            expect(s).toBeNull()
            continue
          }
          const lhs = 2 * f
          const rhs = u + 2 * c
          const expected = lhs > rhs ? 'document' : lhs < rhs ? 'relational' : 'tie'
          expect(cheaperShape(s), JSON.stringify({ f, u, c })).toBe(expected)
        }
      }
    }
  })

  test('a single-operation workload reproduces each operation on its own', () => {
    expect(cheaperShape(scoreWorkload({ 'fetch-user': 1, 'change-price': 0, 'orders-over-25': 0 }))).toBe('document')
    expect(cheaperShape(scoreWorkload({ 'fetch-user': 0, 'change-price': 1, 'orders-over-25': 0 }))).toBe('relational')
    expect(cheaperShape(scoreWorkload({ 'fetch-user': 0, 'change-price': 0, 'orders-over-25': 1 }))).toBe('relational')
  })
})

test.describe('sql vs nosql figure', () => {
  test('moving the sliders changes which shape the workload favours', async ({ page }) => {
    await page.goto('/topics/sql-vs-nosql-modeling/')
    const verdict = page.getByTestId('workload-verdict')
    await expect(verdict).toContainText('document shape opens fewer places')

    // no single-user reads at all: the relational shape takes over
    await page.getByTestId('mix-fetch-user').focus()
    await page.keyboard.press('Home')
    await expect(verdict).toContainText('relational shape opens fewer places')

    // all operations at zero: the figure asks for a mix instead of scoring
    for (const id of ['change-price', 'orders-over-25']) {
      await page.getByTestId(`mix-${id}`).focus()
      await page.keyboard.press('Home')
    }
    await expect(verdict).toContainText('Raise at least one slider')
  })
})
