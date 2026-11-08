import { test, expect } from '@playwright/test'
import {
  MAX_KEYS,
  PRESETS,
  START_BUCKETS,
  allKeys,
  anagramGroups,
  bucketOf,
  finishRehash,
  initialState,
  insert,
  layout,
  rehashStep,
  stats,
  sumOf,
} from '../app/components/hashTableData'

// Invariants for the Hash Tables figure: placement is sum-of-character-codes mod
// the bucket count, the table doubles exactly when keys / buckets goes over 0.75,
// every key is rehashed into the new table, and anagrams never separate.

type State = ReturnType<typeof initialState>
const addAll = (keys: string[], s: State = initialState()) => keys.reduce((acc, k) => finishRehash(insert(acc, k)), s)

test.describe('hash table logic', () => {
  test('the teaching hash: owl, cod and jay all land in bucket 2 of 7', () => {
    expect([sumOf('owl'), sumOf('cod'), sumOf('jay')]).toEqual([338, 310, 324])
    let s = initialState()
    for (const k of ['owl', 'cod', 'jay']) s = insert(s, k)
    expect(s.table[2]).toEqual(['owl', 'cod', 'jay'])
    expect(stats(s)).toMatchObject({ count: 3, buckets: 7, longest: 3, collisions: 2 })
  })

  test('the table doubles exactly when the load factor goes over 0.75, and only then', () => {
    let s = initialState()
    let resizesSeen = 0
    for (const k of PRESETS) {
      const before = s.buckets
      s = insert(s, k)
      const count = allKeys(s).length
      if (count / before > 0.75) {
        resizesSeen++
        expect(s.buckets).toBe(before * 2)
        expect(s.resize?.waiting.length).toBe(count)
        s = finishRehash(s)
      } else {
        expect(s.buckets).toBe(before)
        expect(s.resize).toBeNull()
      }
      expect(stats(s).load).toBeLessThanOrEqual(0.75)
    }
    // presets in order: 6 / 7 = 0.86 doubles to 14, 11 / 14 = 0.79 doubles to 28
    expect(resizesSeen).toBe(2)
    expect(s.buckets).toBe(28)
    expect(stats(s)).toMatchObject({ count: 11, inserts: 11, rehashed: 6 + 11, placements: 28, resizes: 2 })
  })

  test('after a rehash every key sits in sum mod the new size, and bucket b only feeds b or b + old size', () => {
    let s = initialState()
    for (const k of PRESETS.slice(0, 5)) s = insert(s, k)
    const before = Object.fromEntries(allKeys(s).map((k) => [k, bucketOf(k, 7)]))
    s = insert(s, PRESETS[5])
    before[PRESETS[5]] = bucketOf(PRESETS[5], 7)
    expect(s.resize).toMatchObject({ from: 7, to: 14 })
    // step one key at a time: the count is conserved throughout
    while (s.resize) {
      s = rehashStep(s)
      expect(allKeys(s)).toHaveLength(6)
      const ev = s.event
      expect(ev.bucket).toBe(sumOf(ev.key) % 14)
      expect([before[ev.key], before[ev.key] + 7]).toContain(ev.bucket)
    }
    s.table.forEach((chain, b) => chain.forEach((k) => expect(bucketOf(k, 14)).toBe(b)))
    // presets: hen (315) and ram (320) move to 7 and 12; the other four keep their number
    expect(s.event.movedAll).toEqual(['hen', 'ram'])
  })

  test('anagrams share a bucket at every table size, and no resize separates them', () => {
    const s = addAll(PRESETS)
    expect(anagramGroups(allKeys(s))).toEqual([
      ['cat', 'act'],
      ['dog', 'god'],
    ])
    for (const n of [7, 14, 28, 56]) {
      expect(bucketOf('dog', n)).toBe(bucketOf('god', n))
      expect(bucketOf('cat', n)).toBe(bucketOf('act', n))
    }
    const cells = layout(s).map((c) => c.map((x) => x.key))
    expect(cells[6]).toEqual(['dog', 'god'])
    expect(cells[4]).toEqual(['cat', 'act'])
  })

  test('inserts are refused while resizing, for duplicates, and past the figure cap', () => {
    let s = initialState()
    for (const k of PRESETS.slice(0, 6)) s = insert(s, k)
    expect(insert(s, 'fox')).toBe(s) // resizing
    s = finishRehash(s)
    expect(insert(s, 'cat')).toBe(s) // duplicate
    const words = Array.from({ length: 40 }, (_, i) => `k${i}`)
    const full = addAll(words)
    expect(allKeys(full)).toHaveLength(MAX_KEYS)
    expect(full.buckets).toBe(28)
    expect(START_BUCKETS).toBe(7)
  })
})

test.describe('hash table figure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/topics/hash-tables/')
    await expect(page.getByTestId('hash-svg')).toBeVisible()
  })

  test('the sixth preset doubles the table and stepping the rehash moves keys visibly', async ({ page }) => {
    for (const k of PRESETS.slice(0, 5)) await page.getByTestId(`hash-add-${k}`).click()
    await expect(page.getByTestId('hash-svg')).toHaveAttribute('data-buckets', '7')
    await page.getByTestId('hash-add-ram').click()
    await expect(page.getByTestId('hash-svg')).toHaveAttribute('data-buckets', '14')
    await expect(page.locator('figure')).toContainText('6 keys / 7 buckets = 0.86, over 0.75')
    await expect(page.locator('[data-waiting="true"]')).toHaveCount(6)
    await expect(page.getByTestId('hash-add-fox')).toBeDisabled()

    // old bucket order: hen (0), ant (1), owl (2), cat (4), ram (5), dog (6)
    await page.getByRole('button', { name: 'Rehash next key' }).click()
    await expect(page.getByTestId('hash-compute')).toContainText('315 mod 14 = 7 (was 315 mod 7 = 0)')
    await expect(page.getByTestId('hash-bucket-7')).toHaveAttribute('data-keys', 'hen')
    await expect(page.locator('[data-waiting="true"]')).toHaveCount(5)

    await page.getByRole('button', { name: 'Finish rehash' }).click()
    await expect(page.locator('[data-waiting="true"]')).toHaveCount(0)
    await expect(page.getByTestId('hash-compute')).toHaveCount(0) // Finish sums up in the status line instead
    await expect(page.locator('figure')).toContainText('Rehash finished: 6 keys / 14 buckets = 0.43. 2 of 6 keys moved')
    await expect(page.getByTestId('hash-bucket-12')).toHaveAttribute('data-keys', 'ram')
    await expect(page.getByTestId('hash-add-fox')).toBeEnabled()
  })

  test('adding an anagram says why it collides', async ({ page }) => {
    await page.getByTestId('hash-add-dog').click()
    await page.getByTestId('hash-add-god').click()
    await expect(page.getByTestId('hash-bucket-6')).toHaveAttribute('data-keys', 'dog god')
    await expect(page.locator('figure')).toContainText('Same letters as "dog", so the same sum (314)')
  })
})
