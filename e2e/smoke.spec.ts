import { test, expect } from '@playwright/test'
import { trackConsoleErrors } from './util'

// Every topic that ships in the site. Each must load its Figure cleanly, navigated to
// directly (not via the homepage, which now links to six chapters, not 60 topics - see
// e2e/homepage.spec.ts for the homepage's own links and e2e/chapter-routes.spec.ts for
// every topic's link from its chapter page).
const TOPICS = [
  { slug: 'gradient-descent', name: 'Gradient Descent' },
  { slug: 'confusion-matrix', name: 'Confusion Matrix' },
  { slug: 'tokenization', name: 'Tokenization' },
  { slug: 'why-models-struggle-with-math', name: 'Why Models Struggle with Math' },
  { slug: 'embeddings', name: 'Embeddings' },
  { slug: 'attention', name: 'Attention' },
  { slug: 'tensors', name: 'Tensors' },
  { slug: 'broadcasting', name: 'Broadcasting' },
  { slug: 'positional-encoding', name: 'Positional Encoding' },
  { slug: 'transformers', name: 'Transformers and Multi-Head Attention' },
  { slug: 'encoders-and-decoders', name: 'Encoders and Decoders' },
  { slug: 'neural-networks', name: 'Neural Networks' },
  { slug: 'activation-functions', name: 'Why Activations Matter' },
  { slug: 'overfitting', name: 'Overfitting and Generalization' },
  { slug: 'decision-boundary', name: 'Decision Boundary' },
  { slug: 'rlhf', name: 'RLHF' },
  { slug: 'temperature', name: 'Temperature and Sampling' },
  { slug: 'beam-search', name: 'Beam Search vs Greedy Decoding' },
  { slug: 'rag', name: 'RAG (Retrieval-Augmented Generation)' },
  { slug: 'big-o', name: 'Big-O and Time Complexity' },
  { slug: 'binary-search', name: 'Binary Search' },
  { slug: 'recursion', name: 'Recursion and the Call Stack' },
  { slug: 'sorting', name: 'Sorting' },
  { slug: 'linked-list-vs-array', name: 'Linked List vs Array' },
  { slug: 'hash-tables', name: 'Hash Tables' },
  { slug: 'binary-search-trees', name: 'Binary Search Trees' },
  { slug: 'graph-traversal', name: 'Graph Traversal (BFS and DFS)' },
  { slug: 'dijkstra', name: "Dijkstra's Shortest Path" },
  { slug: 'dynamic-programming', name: 'Dynamic Programming' },
  { slug: 'relational-model', name: 'Tables and the Relational Model' },
  { slug: 'select-where-case', name: 'SELECT, WHERE and CASE' },
  { slug: 'joins', name: 'Joins' },
  { slug: 'group-by', name: 'GROUP BY and Aggregation' },
  { slug: 'window-functions', name: 'Window Functions' },
  { slug: 'funnel-analysis', name: 'Funnel Analysis' },
  { slug: 'indexes', name: 'Indexes' },
  { slug: 'query-planning', name: 'Query Planning' },
  { slug: 'normalization', name: 'Normalization' },
  { slug: 'sql-vs-nosql-modeling', name: 'SQL vs NoSQL Modeling' },
  { slug: 'atomicity', name: 'Atomicity' },
  { slug: 'concurrency', name: 'Concurrency' },
  { slug: 'isolation-levels', name: 'Isolation Levels' },
  { slug: 'caching', name: 'Caching' },
  { slug: 'percentiles-and-tail-latency', name: 'Percentiles and Tail Latency' },
  { slug: 'load-balancing', name: 'Load Balancing' },
  { slug: 'cap-theorem', name: 'CAP Theorem' },
  { slug: 'sharding', name: 'Sharding' },
  { slug: 'consistent-hashing', name: 'Consistent Hashing' },
  { slug: 'race-conditions', name: 'Race Conditions and Locks' },
  { slug: 'deadlock', name: 'Deadlock' },
  { slug: 'tcp-and-udp', name: 'TCP and UDP' },
  { slug: 'dns', name: 'DNS' },
  { slug: 'classes-and-objects', name: 'Classes and Objects' },
  { slug: 'constructors-and-the-heap', name: 'Constructors and the Heap' },
  { slug: 'encapsulation', name: 'Encapsulation' },
  { slug: 'inheritance', name: 'Inheritance' },
  { slug: 'polymorphism', name: 'Polymorphism' },
  { slug: 'abstract-classes-and-interfaces', name: 'Abstract Classes and Interfaces' },
  { slug: 'composition-vs-inheritance', name: 'Composition vs Inheritance' },
  { slug: 'entropy-and-compression', name: 'Entropy and Compression' },
]

test('home page loads with its chapter cards and no console errors', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const chapterLinks = page.locator('main a[href^="/chapters/"]')
  expect(await chapterLinks.count()).toBe(6)
  await page.waitForLoadState('networkidle')
  expect(errors, `console errors on home: ${errors.join(' | ')}`).toEqual([])
})

for (const topic of TOPICS) {
  test(`topic "${topic.slug}" loads its figure with no console errors`, async ({ page }) => {
    const errors = trackConsoleErrors(page)
    await page.goto(`/topics/${topic.slug}/`)
    // every topic renders at least one interaction inside the Figure shell (a few
    // topics, like Attention, embed more than one figure)
    await expect(page.locator('figure').first()).toBeVisible()
    // the figure title is rendered inside the shell
    await expect(page.locator('figure h3').first()).toBeVisible()
    // allow the lazily-imported 3D scenes to mount, then assert no errors surfaced
    await page.waitForTimeout(800)
    expect(errors, `console errors on ${topic.slug}: ${errors.join(' | ')}`).toEqual([])
  })
}
