// Hand-authored deterministic dataset for "Same data, two shapes". The SAME three
// users / two plans / five orders are modeled two ways: normalized relational tables,
// and one embedded document per user. This is its own small module; sqlData.js and the
// normalization module are NOT imported or modified. Naming follows sqlData.js
// conventions (integer user_id, plan values 'pro'/'free', ISO country codes).
//
// The figure is engine-neutral: it compares the two SHAPES as drawn, never a vendor.

// ── relational shape (three normalized tables) ────────────────────────────────────
export const USERS = [
  { user_id: 1, name: 'Ava', plan: 'pro', country: 'GB' },
  { user_id: 2, name: 'Ben', plan: 'pro', country: 'FR' },
  { user_id: 3, name: 'Cara', plan: 'free', country: 'GB' },
]
export const PLANS = [
  { plan: 'pro', plan_price: 20 },
  { plan: 'free', plan_price: 0 },
]
export const ORDERS = [
  { order_id: 101, user_id: 1, order_total: 40 },
  { order_id: 102, user_id: 1, order_total: 15 },
  { order_id: 103, user_id: 2, order_total: 60 },
  { order_id: 104, user_id: 2, order_total: 25 },
  { order_id: 105, user_id: 3, order_total: 30 },
]

// ── document shape (one embedded document per user) ───────────────────────────────
// Plan details are embedded (a copy per user) and orders are nested as an array.
export const DOCS = USERS.map((u) => ({
  docId: u.user_id,
  user_id: u.user_id,
  name: u.name,
  country: u.country,
  plan: { name: u.plan, price: PLANS.find((p) => p.plan === u.plan).plan_price },
  orders: ORDERS.filter((o) => o.user_id === u.user_id).map((o) => ({ order_id: o.order_id, total: o.order_total })),
}))

// ── the three canned queries ──────────────────────────────────────────────────────
// Each query is a sequence of frames. A frame ADDS highlights on one or both shapes;
// the state at step s is the union of frames[0..s-1]. A relational highlight names a
// table (and a matching row / optional cell); a document highlight names a docId and
// what inside it lights up. "Places touched" is then the number of DISTINCT containers
// (tables on the left, documents on the right) that hold any highlight, derived from
// these lists, never hand-typed.
export const QUERIES = [
  {
    id: 'fetch-user',
    label: 'Fetch everything about one user',
    frames: [
      { rel: [{ table: 'users', match: { user_id: 1 } }], doc: [{ docId: 1, kind: 'whole' }] },
      { rel: [{ table: 'plans', match: { plan: 'pro' } }], doc: [] },
      { rel: [{ table: 'orders', match: { order_id: 101 } }, { table: 'orders', match: { order_id: 102 } }], doc: [] },
    ],
    status:
      'Everything about one user is read together. The document holds it in one place, so it is one read; the relational shape must join across three tables. Data that is read together can be stored together.',
  },
  {
    id: 'change-price',
    label: 'Change the pro plan price',
    frames: [
      { rel: [{ table: 'plans', match: { plan: 'pro' }, cell: 'plan_price' }], doc: [{ docId: 1, kind: 'plan-price', tone: 'copy' }] },
      { rel: [], doc: [{ docId: 2, kind: 'plan-price', tone: 'copy' }] },
    ],
    status:
      'The price is one fact. Relational stores it once in the plans table, so the change is a single cell. This document layout embeds a copy in every pro user, so the same edit must repeat in each, the update anomaly from the Normalization topic.',
  },
  {
    id: 'orders-over-25',
    label: 'List all orders over 25',
    frames: [
      {
        rel: [
          { table: 'orders', match: { order_id: 101 } },
          { table: 'orders', match: { order_id: 103 } },
          { table: 'orders', match: { order_id: 105 } },
        ],
        doc: [{ docId: 1, kind: 'order', order_id: 101 }],
      },
      { rel: [], doc: [{ docId: 2, kind: 'order', order_id: 103 }] },
      { rel: [], doc: [{ docId: 3, kind: 'order', order_id: 105 }] },
    ],
    status:
      'A question that spans users. Relational scans one orders table. In this document layout the orders sit inside each user, so the query opens every document and digs into its array.',
  },
]

export const queryById = (id) => QUERIES.find((q) => q.id === id)
export const framesCount = (id) => queryById(id).frames.length

// Cumulative highlights up to (not including) the given step.
export function highlightsAt(id, step) {
  const q = queryById(id)
  const rel = []
  const doc = []
  for (let i = 0; i < step && i < q.frames.length; i += 1) {
    rel.push(...q.frames[i].rel)
    doc.push(...q.frames[i].doc)
  }
  return { rel, doc }
}

// Derived readouts: distinct containers touched on each shape at this step.
export function placesTouched(id, step) {
  const { rel, doc } = highlightsAt(id, step)
  return {
    relational: new Set(rel.map((r) => r.table)).size,
    document: new Set(doc.map((d) => d.docId)).size,
  }
}

// ── operation costs, computed by running each operation over both shapes ─────────
// A "place" is a container one operation has to open: a table on the relational
// side, one document on the document side. Each function below works the answer
// out from the data itself; the tests check the results against the traced
// highlight frames above, so the trace and the scores cannot disagree.
const FETCH_USER = 1
const PRICE_PLAN = 'pro'
const ORDER_THRESHOLD = 25

function fetchUserCost() {
  const user = USERS.find((u) => u.user_id === FETCH_USER)
  const tables = new Set(['users'])
  if (PLANS.some((p) => p.plan === user.plan)) tables.add('plans')
  if (ORDERS.some((o) => o.user_id === FETCH_USER)) tables.add('orders')
  const docs = DOCS.filter((d) => d.user_id === FETCH_USER)
  return { relational: tables.size, document: docs.length, relationalWrites: 0, documentWrites: 0 }
}

function changePriceCost() {
  // relational: the price lives once, in one plans row
  const rows = PLANS.filter((p) => p.plan === PRICE_PLAN).length
  // document: a copy lives in every document whose plan is embedded
  const copies = DOCS.filter((d) => d.plan.name === PRICE_PLAN).length
  return { relational: 1, document: copies, relationalWrites: rows, documentWrites: copies }
}

function ordersOverCost() {
  // relational: every order is in the one orders table
  // document: orders are nested per user, so every document must be opened to check
  const matches = ORDERS.filter((o) => o.order_total > ORDER_THRESHOLD).length
  return { relational: 1, document: DOCS.length, relationalWrites: 0, documentWrites: 0, matches }
}

const COST_FNS = { 'fetch-user': fetchUserCost, 'change-price': changePriceCost, 'orders-over-25': ordersOverCost }
export const costOf = (id) => COST_FNS[id]()

// Workload mix: a relative weight per operation (any non-negative numbers).
export const DEFAULT_MIX = { 'fetch-user': 6, 'change-price': 1, 'orders-over-25': 3 }

// Score both shapes for a mix: average places opened per operation, and copies
// written per operation (the update anomaly's price: every copy must be kept in step).
export function scoreWorkload(mix) {
  const total = QUERIES.reduce((s, q) => s + (mix[q.id] || 0), 0)
  if (total === 0) return null
  const share = Object.fromEntries(QUERIES.map((q) => [q.id, (mix[q.id] || 0) / total]))
  const sum = (key) => QUERIES.reduce((s, q) => s + share[q.id] * costOf(q.id)[key], 0)
  return {
    share,
    relational: { places: sum('relational'), writes: sum('relationalWrites') },
    document: { places: sum('document'), writes: sum('documentWrites') },
  }
}

export function cheaperShape(score) {
  if (!score) return null
  const d = score.relational.places - score.document.places
  if (Math.abs(d) < 1e-9) return 'tie'
  return d > 0 ? 'document' : 'relational'
}

// The share of one operation as the sliders display it (whole percent).
export const sharePercent = (score, id) => Math.round(score.share[id] * 100)

const MIX_NAMES = { 'fetch-user': 'fetch one user', 'change-price': 'change the plan price', 'orders-over-25': 'query orders across users' }
const avg = (n) => n.toFixed(2)

// The verdict sentence: always names the mix and both averages, never a bare winner.
export function verdictFor(mix) {
  const score = scoreWorkload(mix)
  if (!score) return 'Every operation is at zero. Raise at least one slider.'
  const mixText = QUERIES.map((q) => `${sharePercent(score, q.id)}% ${MIX_NAMES[q.id]}`).join(', ')
  const r = avg(score.relational.places)
  const d = avg(score.document.places)
  const cheaper = cheaperShape(score)
  if (cheaper === 'document') return `At this mix (${mixText}), the document shape opens fewer places per operation: document ${d}, relational ${r}.`
  if (cheaper === 'relational') return `At this mix (${mixText}), the relational shape opens fewer places per operation: relational ${r}, document ${d}.`
  return `At this mix (${mixText}), the two shapes tie on places opened per operation: ${r} each. Watch the copies count.`
}
