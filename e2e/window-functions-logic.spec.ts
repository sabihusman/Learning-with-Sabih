import { test, expect } from '@playwright/test'
import { events } from '../app/components/sqlData'
import { FN_COLUMN, buildSql, compute } from '../app/components/windowFnData'

// Invariants for the Window functions figure. The headline ones: the table is the
// result of the SQL printed under it, and where that SQL leaves a value open
// (ROW_NUMBER, or a ROWS running total, over peers) the figure shows every value
// a database may return rather than inventing one.

type Opts = { order: string; frame: string; partition: boolean }
const ALL: Opts[] = []
for (const order of ['time', 'tiebreak']) for (const frame of ['ROWS', 'RANGE']) for (const partition of [false, true]) ALL.push({ order, frame, partition })
const COLS = Object.values(FN_COLUMN)
const col = (rows: any[], c: string) => rows.map((r) => r.cells[c].join('|'))

test.describe('window functions logic', () => {
  test('pinned results: tied events 2 and 3, all rows of sessions 1 and 2', () => {
    const base = compute({ order: 'time', frame: 'RANGE', partition: false })
    expect(base.map((r) => r.event_id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(base.map((r) => r.value)).toEqual([1, 1, 2, 2, 3, 3, 1, 1, 2, 2])
    expect(col(base, 'row_number')).toEqual(['1', '2|3', '2|3', '4', '5', '6', '7', '8', '9', '10'])
    expect(col(base, 'rank')).toEqual(['1', '2', '2', '4', '5', '6', '7', '8', '9', '10'])
    expect(col(base, 'dense_rank')).toEqual(['1', '2', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(col(base, 'running')).toEqual(['1', '4', '4', '6', '9', '12', '13', '14', '16', '18'])

    const rows = compute({ order: 'time', frame: 'ROWS', partition: false })
    expect(col(rows, 'running')).toEqual(['1', '2|4', '3|4', '6', '9', '12', '13', '14', '16', '18'])

    const fixed = compute({ order: 'tiebreak', frame: 'ROWS', partition: true })
    expect(col(fixed, 'row_number')).toEqual(['1', '2', '3', '4', '5', '6', '1', '2', '3', '4'])
    expect(col(fixed, 'running')).toEqual(['1', '2', '4', '6', '9', '12', '1', '2', '4', '6'])
  })

  test('only ROW_NUMBER and a ROWS running total can be left open, and only over peers', () => {
    for (const o of ALL) {
      for (const r of compute(o)) {
        for (const c of COLS) {
          const open = r.cells[c].length > 1
          const canBeOpen = r.tied && (c === 'row_number' || (c === 'running' && o.frame === 'ROWS'))
          if (open) expect(canBeOpen, JSON.stringify({ o, id: r.event_id, c })).toBe(true)
        }
      }
    }
  })

  test('the event_id tie-break fixes every value, and rank then equals row_number', () => {
    for (const o of ALL.filter((x) => x.order === 'tiebreak')) {
      for (const r of compute(o)) {
        expect(r.tied).toBe(false)
        for (const c of COLS) expect(r.cells[c]).toHaveLength(1)
        expect(r.cells.rank).toEqual(r.cells.row_number)
      }
    }
  })

  test('RANGE gives peers one total: the total ROWS reaches at the last peer', () => {
    for (const order of ['time', 'tiebreak']) {
      for (const partition of [false, true]) {
        const range = compute({ order, frame: 'RANGE', partition })
        const rows = compute({ order, frame: 'ROWS', partition })
        range.forEach((r, i) => {
          expect(r.cells.running).toHaveLength(1)
          expect(Math.max(...rows[i].cells.running)).toBe(r.cells.running[0])
        })
      }
    }
  })

  test('PARTITION BY restarts every column at the first row of each session', () => {
    for (const o of ALL.filter((x) => x.partition)) {
      const rows = compute(o)
      for (const sid of [1, 2]) {
        const first = rows.find((r) => r.session_id === sid)!
        expect(first.cells.row_number).toEqual([1])
        expect(first.cells.rank).toEqual([1])
        expect(first.cells.running).toEqual([first.value])
      }
    }
  })

  test('the printed SQL, run in SQLite, returns what the figure shows (all 8 query choices)', async () => {
    let sqlite: any
    try {
      sqlite = await import('node:sqlite')
    } catch {
      test.skip(true, 'node:sqlite is not available in this Node version')
    }
    const db = new sqlite.DatabaseSync(':memory:')
    db.exec('CREATE TABLE events (event_id INTEGER, session_id INTEGER, user_id INTEGER, event TEXT, occurred_at TEXT)')
    const ins = db.prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?)')
    for (const e of events) ins.run(e.event_id, e.session_id, e.user_id, e.event, e.occurred_at)
    for (const o of ALL) {
      const got = db.prepare(buildSql(o)).all()
      const fig = compute(o)
      expect(got.map((g: any) => g.event_id), JSON.stringify(o)).toEqual(fig.map((r) => r.event_id))
      got.forEach((g: any, i: number) => {
        for (const c of COLS) expect(fig[i].cells[c], JSON.stringify({ o, id: g.event_id, c })).toContain(g[c])
      })
    }
  })
})

test.describe('window functions figure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/topics/window-functions/')
    await expect(page.getByTestId('wf-table')).toBeVisible()
  })

  test('by default the tied pair shows ROW_NUMBER as not fixed, and RANGE gives both 4', async ({ page }) => {
    await expect(page.getByTestId('wf-cell-2-row_number')).toHaveAttribute('data-values', '2,3')
    await expect(page.getByTestId('wf-cell-3-row_number')).toHaveAttribute('data-values', '2,3')
    await expect(page.getByTestId('wf-cell-2-running')).toHaveAttribute('data-values', '4')
    await expect(page.getByTestId('wf-sql')).toContainText('RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW')
  })

  test('switching the frame to ROWS splits the running total on the peers, and the SQL says ROWS', async ({ page }) => {
    await page.getByTestId('wf-frame-ROWS').click()
    await expect(page.getByTestId('wf-cell-2-running')).toHaveAttribute('data-values', '2,4')
    await expect(page.getByTestId('wf-cell-3-running')).toHaveAttribute('data-values', '3,4')
    await expect(page.getByTestId('wf-sql')).toContainText('ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW')
  })

  test('adding the event_id tie-break fixes every value', async ({ page }) => {
    await page.getByTestId('wf-order-tiebreak').click()
    await expect(page.getByTestId('wf-sql')).toContainText('ORDER BY occurred_at, event_id)')
    await expect(page.getByTestId('wf-cell-2-row_number')).toHaveAttribute('data-values', '2')
    await expect(page.getByTestId('wf-cell-3-row_number')).toHaveAttribute('data-values', '3')
    await expect(page.getByTestId('wf-row-2')).toHaveAttribute('data-tied', 'false')
  })
})
