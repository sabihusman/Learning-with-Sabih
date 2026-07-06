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

export const ORDER_THRESHOLD = 25 // "orders over 25"

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
      { rel: [{ table: 'users', order_id: null, match: { user_id: 1 } }], doc: [{ docId: 1, kind: 'whole' }] },
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

// The shape that reaches the data in fewer containers once the query is fully traced.
export function winnerOf(id) {
  const pt = placesTouched(id, framesCount(id))
  if (pt.relational < pt.document) return 'relational'
  if (pt.document < pt.relational) return 'document'
  return 'tie'
}
