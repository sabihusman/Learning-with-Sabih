// Deterministic data and a transparent, simplified cost model for the Query planning
// topic. Nothing here is random or hand-tuned to look good: the numbers fall out of a
// small stated model, and the point is the DIRECTION of each tradeoff, not the exact
// magnitudes. A real planner is far more elaborate (statistics, many plan types); this
// shows two core decisions in the simplest honest form.

// ── Part 1: index vs sequential scan, driven by selectivity ───────────────────────
// A fixed users table with an indexed `score` column. The query is `WHERE score <= T`;
// the reader slides how many rows match. Cost model (teaching units, one unit ~ one
// row read):
//   seq scan  : reads every row once, so its cost is flat at N regardless of matches.
//   index scan: descends the B-tree once (about log2 N), then fetches each matching row
//               by a random access that costs more than a sequential read. So its cost
//               rises with the match count. Few matches -> index wins; many -> scan wins.
export const P1_N = 20
export const P1_SCORES = Array.from({ length: P1_N }, (_, i) => (i + 1) * 5) // 5,10,...,100 (sorted)
export const P1_RANDOM = 3.2 // per-matched-row random-access cost (> 1 sequential read)
export const P1_DESCENT = Math.ceil(Math.log2(P1_N)) // B-tree descent cost ~ log2 N = 5

export function p1Costs(m) {
  const index = P1_DESCENT + m * P1_RANDOM
  const scan = P1_N
  return { index, scan, chosen: index <= scan ? 'index' : 'scan' }
}
// widest bar across the whole slider range, so the flat scan bar stays a fixed length
// while the index bar visibly grows
export const P1_MAX_COST = P1_DESCENT + P1_N * P1_RANDOM // cost of index at m = N
export const p1ThresholdFor = (m) => m * 5 // the score threshold that yields m matches

// ── Part 2: join order ────────────────────────────────────────────────────────────
// A 3-table chain customers - orders - order_items. The final result is the same
// whatever the order, but the intermediate results are not: joining the small, filtered
// side first keeps intermediates small. Cost here = the total number of intermediate
// rows the order produces (a transparent proxy for work). The cardinalities are given
// estimates (what a planner reads from its statistics).
export const P2_TABLES = [
  { name: 'customers', size: 10, note: 'filtered to one country' },
  { name: 'orders', size: 1000, note: '' },
  { name: 'order_items', size: 5000, note: '' },
]

// join cardinality estimates, keyed by the sorted set of tables involved
const P2_CARD = {
  'customers|orders': 50, // the 10 customers have 50 orders between them
  'order_items|orders': 5000, // every order joins its items: all 5000 items
  'customers|order_items|orders': 250, // the final result: those 50 orders have 250 items
}
const setKey = (tables) => [...tables].sort().join('|')
export function p2StepRows(tables) {
  return P2_CARD[setKey(tables)]
}

export const P2_ORDERS = [
  {
    id: 'good',
    label: 'customers then orders then order_items',
    steps: [
      ['customers', 'orders'],
      ['customers', 'orders', 'order_items'],
    ],
  },
  {
    id: 'bad',
    label: 'orders then order_items then customers',
    steps: [
      ['orders', 'order_items'],
      ['customers', 'orders', 'order_items'],
    ],
  },
]

export function p2Cost(order) {
  return order.steps.reduce((sum, step) => sum + p2StepRows(step), 0)
}
export const p2OrderById = (id) => P2_ORDERS.find((o) => o.id === id)

// the join SQL shown above Part 2 (a JS string, so quotes do not hit JSX escaping)
export const P2_SQL = `SELECT *
FROM customers
JOIN orders USING (customer_id)
JOIN order_items USING (order_id)
WHERE customers.country = 'PT';`
