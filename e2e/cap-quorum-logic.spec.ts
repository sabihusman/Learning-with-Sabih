import { test, expect } from '@playwright/test'
import { CLUSTERS, clusterOf, initialState, isDone, majorityOf, runAll, setChoice, setLink, sideServes, step } from '../app/components/capTheoremData'

// Invariants for the CAP figure. The headline: preferring consistency is a
// majority rule, so in a 3-node cluster the majority side keeps serving while the
// minority refuses, and in a 2-node cluster no side has a majority.

test.describe('cap quorum logic', () => {
  test('two nodes: the audit-verified numbers are unchanged', () => {
    const healthy = runAll({ clusterId: 2, partitioned: false, choice: 'C' })
    expect([healthy.refused, healthy.diverged, healthy.values]).toEqual([0, 0, { A: 3, B: 3 }])
    const cp = runAll({ clusterId: 2, partitioned: true, choice: 'C' })
    expect([cp.refused, cp.diverged, cp.values]).toEqual([6, 0, { A: 1, B: 1 }])
    const ap = runAll({ clusterId: 2, partitioned: true, choice: 'A' })
    expect([ap.refused, ap.diverged, ap.values]).toEqual([0, 6, { A: 2, B: 3 }])
    expect(setLink(ap, true).lastHeal.outcome).toBe('conflict')
  })

  test('three nodes, consistency: the majority side serves, the minority refuses, healing catches up', () => {
    let s = setChoice(setLink(initialState(3), false), 'C')
    const served: string[] = []
    const refused: string[] = []
    while (!isDone(s)) {
      s = step(s)
      ;(s.lastOp.outcome === 'refused' ? refused : served).push(s.lastOp.client)
    }
    expect(new Set(served)).toEqual(new Set(['A', 'B']))
    expect(refused).toEqual(['C', 'C', 'C'])
    expect([s.refused, s.diverged, s.values]).toEqual([3, 0, { A: 4, B: 4, C: 1 }])
    const healed = setLink(s, true)
    expect(healed.lastHeal).toEqual({ outcome: 'caught-up', value: 4 })
    expect(healed.values).toEqual({ A: 4, B: 4, C: 4 })
  })

  test('three nodes, availability: nothing refused, the sides diverge, healing leaves a conflict', () => {
    const ap = runAll({ clusterId: 3, partitioned: true, choice: 'A' })
    expect([ap.refused, ap.diverged, ap.values]).toEqual([0, 6, { A: 4, B: 4, C: 3 }])
    expect(setLink(ap, true).lastHeal.outcome).toBe('conflict')
  })

  test('preferring consistency, at most one side ever serves, and every served read returns the latest acknowledged write', () => {
    for (const c of CLUSTERS) {
      let s = setChoice(setLink(initialState(c.id), false), 'C')
      const serving = c.sides.filter((_, i) => sideServes(s, i))
      expect(serving.length).toBeLessThanOrEqual(1)
      expect(serving.every((side) => side.length >= majorityOf(clusterOf(c.id)))).toBe(true)
      let latest = 1
      while (!isDone(s)) {
        s = step(s)
        if (s.lastOp.outcome === 'refused') continue
        if (s.lastOp.op === 'write') latest = s.lastOp.value
        else expect(s.lastOp.returned, `${c.id} nodes`).toBe(latest)
      }
      expect(s.diverged).toBe(0)
    }
  })

  test('a healthy network never refuses and every node agrees after every step', () => {
    for (const c of CLUSTERS) {
      for (const choice of ['C', 'A']) {
        let s = setChoice(initialState(c.id), choice)
        while (!isDone(s)) {
          s = step(s)
          expect(s.lastOp.outcome).not.toBe('refused')
          expect(new Set(Object.values(s.values)).size).toBe(1)
        }
      }
    }
  })
})

test.describe('cap quorum figure', () => {
  test('3 nodes, partitioned, consistency: A and B serve, C refuses, and healing leaves no conflict', async ({ page }) => {
    await page.goto('/topics/cap-theorem/')
    await page.getByTestId('cap-cluster-3').click()
    await expect(page.getByTestId('cap-rule')).toContainText('2 of 3 nodes')
    await page.getByRole('button', { name: /^Network:/ }).click()
    await expect(page.getByTestId('cap-node-A')).toHaveAttribute('data-serves', 'true')
    await expect(page.getByTestId('cap-node-C')).toHaveAttribute('data-serves', 'false')
    await expect(page.locator('figure svg')).toContainText('2 of 3: a majority')
    await expect(page.locator('figure svg')).toContainText('1 of 3: no majority')

    const stepBtn = page.getByRole('button', { name: 'Step', exact: true })
    for (let i = 0; i < 6; i++) await stepBtn.click()
    await expect(page.locator('figure')).toContainText('refused')
    await expect(page.getByTestId('cap-node-C')).toHaveAttribute('data-behind', 'true')

    await page.getByRole('button', { name: /^Network:/ }).click()
    await expect(page.locator('figure')).toContainText('every node now has x=4. No conflict.')
    await expect(page.getByTestId('cap-node-C')).toContainText('x = 4')
  })

  test('2 nodes, partitioned, consistency: no side has a majority', async ({ page }) => {
    await page.goto('/topics/cap-theorem/')
    await page.getByRole('button', { name: /^Network:/ }).click()
    await expect(page.locator('figure svg')).not.toContainText('a majority')
    await expect(page.getByTestId('cap-node-A')).toHaveAttribute('data-serves', 'false')
    await expect(page.getByTestId('cap-node-B')).toHaveAttribute('data-serves', 'false')
  })
})
