import { test, expect } from '@playwright/test'
import { CORRECT, MODES, START, allOutcomes, canStep, initialState, isBlocked, isDone, runOrder, step } from '../app/components/concurrencyData'

// Invariants for the Concurrency figure: the SQL in each lane is executed one
// statement per step under READ COMMITTED rules, in any order the learner picks.

const run = (mode: string, order: string[]) => order.reduce((s, t) => step(s, t), initialState(mode))

test.describe('concurrency logic', () => {
  test('read, then write: the interleaved order loses an update; some order always does', () => {
    expect(runOrder('naive', 'interleaved').committed.balance).toBe(START + 50)
    expect(runOrder('naive', 'serial').committed.balance).toBe(CORRECT)
    expect(allOutcomes('naive').finals).toEqual([START + 50, CORRECT])
  })

  test('FOR UPDATE, one UPDATE statement, and the version check: every possible order ends correct', () => {
    for (const mode of ['forupdate', 'atomic', 'optimistic']) {
      expect(allOutcomes(mode).finals, mode).toEqual([CORRECT])
    }
  })

  test('the version check retries exactly when the transactions overlap', () => {
    expect(runOrder('optimistic', 'serial').tx.T2.retries).toBe(0)
    const s = runOrder('optimistic', 'interleaved')
    expect(s.tx.T1.retries + s.tx.T2.retries).toBe(1)
    expect(s.committed).toEqual({ balance: CORRECT, version: 3 })
    expect(allOutcomes('optimistic').maxRetries).toBe(1)
  })

  test('a plain SELECT never sees an uncommitted write', () => {
    // T1 writes 150 but has not committed; T2's SELECT must still see 100.
    const s = run('naive', ['T1', 'T1', 'T2'])
    expect(s.tx.T1.pending.balance).toBe(START + 50)
    expect(s.tx.T2.vars.balance).toBe(START)
  })

  test('the row lock: a locking statement waits while the other transaction holds it, and COMMIT releases it', () => {
    const s = run('forupdate', ['T1'])
    expect(s.lock).toBe('T1')
    expect(isBlocked(s, 'T2')).toBe(true)
    expect(canStep(s, 'T2')).toBe(false)
    expect(step(s, 'T2').tx.T2).toEqual(s.tx.T2) // a blocked step changes nothing
    const committed = run('forupdate', ['T1', 'T1', 'T1'])
    expect(committed.lock).toBeNull()
    expect(canStep(committed, 'T2')).toBe(true)
    // after T1 commits, T2's FOR UPDATE reads the committed 150, not the 100 it would have seen before
    expect(step(committed, 'T2').tx.T2.vars.balance).toBe(START + 50)
  })

  test('one UPDATE statement reads and writes under the lock, so it always adds to the latest committed value', () => {
    const s = run('atomic', ['T1', 'T2', 'T1', 'T2', 'T2'])
    expect(isDone(s)).toBe(true)
    expect(s.committed.balance).toBe(CORRECT)
  })

  test('every mode lists real SQL for every step', () => {
    for (const m of MODES) for (const st of m.script) expect(st.sql.length).toBeGreaterThan(5)
  })
})

test.describe('concurrency figure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/topics/concurrency/')
    await expect(page.getByTestId('cc-row')).toBeVisible()
  })

  const press = async (page, labels: string[]) => {
    for (const l of labels) await page.getByRole('button', { name: l, exact: true }).click()
  }

  test('stepping T1, T2 alternately in read-then-write loses an update; T2 waits on the lock first', async ({ page }) => {
    await press(page, ['Step T1', 'Step T2', 'Step T1'])
    await expect(page.getByTestId('cc-lane-T2')).toHaveAttribute('data-state', 'wait')
    await expect(page.getByRole('button', { name: 'Step T2', exact: true })).toBeDisabled()
    await press(page, ['Step T1', 'Step T2', 'Step T2'])
    await expect(page.getByTestId('cc-balance')).toHaveText(String(START + 50))
    await expect(page.getByTestId('cc-verdict')).toContainText('An update was lost')
  })

  test('the version check: T2 updates 0 rows, retries, and the balance ends correct', async ({ page }) => {
    await page.getByTestId('cc-mode-optimistic').click()
    await press(page, ['Step T1', 'Step T2', 'Step T1', 'Step T1', 'Step T2'])
    await expect(page.getByTestId('cc-lane-T2')).toContainText('rows affected: 0')
    await press(page, ['Step T2', 'Step T2', 'Step T2', 'Step T2'])
    await expect(page.getByTestId('cc-lane-T2')).toContainText('retries: 1')
    await expect(page.getByTestId('cc-balance')).toHaveText(String(CORRECT))
  })
})
