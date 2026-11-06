import { test, expect } from '@playwright/test'
import { SECTIONS, TOPICS } from '../app/topicList'

// The Phase 0 sequencing and retitle decisions, locked so a later insert cannot
// silently undo them. Relative order is asserted, not numbers, so inserting new
// topics (Phase 3) keeps these green.

const slugs = (section: string) => SECTIONS.find((s) => s.name === section)!.topics.map((t) => t.slug)
const before = (list: string[], a: string, b: string) => {
  expect(list.indexOf(a), `${a} missing`).toBeGreaterThan(-1)
  expect(list.indexOf(b), `${b} missing`).toBeGreaterThan(-1)
  expect(list.indexOf(a), `${a} should come before ${b}`).toBeLessThan(list.indexOf(b))
}

test('Tensors and Broadcasting come before Embeddings and Attention', () => {
  const ai = slugs('AI and ML')
  for (const early of ['tensors', 'broadcasting']) for (const late of ['embeddings', 'attention']) before(ai, early, late)
})

test('Heaps come before Dijkstra', () => {
  before(slugs('Algorithms and Data Structures'), 'heaps-and-priority-queues', 'dijkstra')
})

test('Databases run Normalization, Indexes, Query Planning, then Funnel', () => {
  const db = slugs('Databases and SQL')
  before(db, 'window-functions', 'normalization')
  before(db, 'normalization', 'indexes')
  before(db, 'indexes', 'query-planning')
  before(db, 'query-planning', 'funnel-analysis')
  before(db, 'funnel-analysis', 'sql-vs-nosql-modeling')
})

test('Network Stack and Replication open Systems and Networking', () => {
  expect(slugs('Systems and Networking').slice(0, 2)).toEqual(['network-stack-and-routing', 'replication'])
})

test('the two retitled topics keep their slugs', () => {
  const title = (slug: string) => TOPICS.find((t) => t.slug === slug)!.title
  expect(title('caching-layers')).toBe('Where Caches Live: Browser to Database')
  expect(title('constructors-and-the-heap')).toBe('References, the Heap, and Aliasing')
})

test('Graph Traversal leads to Heaps, and Heaps to Dijkstra', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Topic navigation' })
  await page.goto('/topics/graph-traversal/')
  await expect(nav.getByRole('link').filter({ hasText: 'Next' })).toHaveAttribute('href', /\/topics\/heaps-and-priority-queues\/?$/)
  await page.goto('/topics/dijkstra/')
  await expect(nav.getByRole('link').filter({ hasText: 'Previous' })).toHaveAttribute('href', /\/topics\/heaps-and-priority-queues\/?$/)
})

const CROSS_LINKS: Array<[string, string, string]> = [
  ['finding-similar-rows', 'Embeddings', '/topics/embeddings/'],
  ['consistent-hashing', 'Hash Tables', '/topics/hash-tables/'],
  ['concurrency', 'Race Conditions and Locks', '/topics/race-conditions/'],
  ['race-conditions', 'Concurrency', '/topics/concurrency/'],
  ['atomicity', 'Isolation Levels', '/topics/isolation-levels/'],
]
for (const [from, name, href] of CROSS_LINKS) {
  test(`${from} links to ${name}`, async ({ page }) => {
    await page.goto(`/topics/${from}/`)
    await expect(page.locator('article').getByRole('link', { name, exact: true })).toHaveAttribute('href', href)
  })
}
