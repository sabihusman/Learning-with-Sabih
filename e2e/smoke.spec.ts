import { test, expect, type Page } from '@playwright/test'
import { trackConsoleErrors } from './util'

// The contents page is an accordion: sections start collapsed, so topic links are in
// the DOM (and discoverable by querySelector) but inert until their section is
// expanded. Open every section so the links become interactive.
async function expandAllSections(page: Page) {
  for (;;) {
    const collapsed = page.locator('main button[aria-expanded="false"]')
    if ((await collapsed.count()) === 0) break
    await collapsed.first().click()
  }
}

// Every topic that ships in the contents page. Each must load its Figure cleanly.
const TOPICS = [
  { slug: 'gradient-descent', name: 'Gradient Descent' },
  { slug: 'confusion-matrix', name: 'Confusion Matrix' },
  { slug: 'tokenization', name: 'Tokenization' },
  { slug: 'why-models-struggle-with-math', name: 'Why Models Struggle with Math' },
  { slug: 'embeddings', name: 'Embeddings' },
  { slug: 'attention', name: 'Attention' },
  { slug: 'tensors', name: 'Tensors' },
  { slug: 'broadcasting', name: 'Broadcasting' },
  { slug: 'transformers', name: 'Transformers and Multi-Head Attention' },
  { slug: 'neural-networks', name: 'Neural Networks' },
  { slug: 'activation-functions', name: 'Why Activations Matter' },
  { slug: 'overfitting', name: 'Overfitting and Generalization' },
  { slug: 'rlhf', name: 'RLHF' },
  { slug: 'temperature', name: 'Temperature and Sampling' },
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
  { slug: 'classes-and-objects', name: 'Classes and Objects' },
  { slug: 'constructors-and-the-heap', name: 'Constructors and the Heap' },
  { slug: 'encapsulation', name: 'Encapsulation' },
  { slug: 'inheritance', name: 'Inheritance' },
  { slug: 'polymorphism', name: 'Polymorphism' },
  { slug: 'abstract-classes-and-interfaces', name: 'Abstract Classes and Interfaces' },
  { slug: 'composition-vs-inheritance', name: 'Composition vs Inheritance' },
]

test('home page loads with the contents list and no console errors', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const topicLinks = page.locator('main a[href^="/topics/"]')
  expect(await topicLinks.count()).toBeGreaterThanOrEqual(TOPICS.length)
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

test('contents page links to every topic', async ({ page }) => {
  await page.goto('/')
  const hrefs = await page.locator('main a[href^="/topics/"]').evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).getAttribute('href') as string)
  )
  expect(hrefs.length).toBeGreaterThanOrEqual(TOPICS.length)
  // each advertised slug has a link
  for (const topic of TOPICS) {
    expect(hrefs.some((h) => h.includes(`/topics/${topic.slug}/`))).toBeTruthy()
  }
})

// Clicking each contents link must navigate to that topic and render its figure.
// Split per-topic (rather than one 38-iteration loop) so every navigation gets its
// own test timeout instead of sharing a single budget that overflows under parallel
// load as the topic count grows.
for (const topic of TOPICS) {
  test(`clicking the "${topic.slug}" contents link navigates and renders its figure`, async ({ page }) => {
    await page.goto('/')
    await expandAllSections(page)
    const href = `/topics/${topic.slug}/`
    await page.locator(`main a[href="${href}"]`).first().click()
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[/]/g, '\\/')}$`))
    await expect(page.locator('figure').first()).toBeVisible()
  })
}
