// Hand-authored denormalized excerpt for "One table becomes three". This is its own
// small module (sqlData.js is NOT imported or modified), but the naming follows the
// shared SQL dataset: integer user_id, plan values 'pro'/'free', ISO-style country
// codes. The numbers are deterministic and chosen to exhibit the two smells the figure
// teaches: a repeated plan_price (update-anomaly fuel) and a comma-separated order list
// (the 1NF violation).

export const PRO_PLAN = 'pro'
export const PRO_PRICE = 20 // the price that repeats across every pro row
export const NEW_PRICE = 25 // the value the simulated update writes
export const ANOMALY_ORDER = 102 // the single 1NF row whose price the update changes

// The eight source users. plan_price is stored ON the user row here (the denormalized
// mistake): pro users all carry 20, so the price lives in several places at once.
export const USERS = [
  { user_id: 1, name: 'Ava', plan: 'pro', country: 'GB', order_ids: [101] },
  { user_id: 2, name: 'Ben', plan: 'pro', country: 'FR', order_ids: [102, 103] },
  { user_id: 3, name: 'Cara', plan: 'free', country: 'GB', order_ids: [104] },
  { user_id: 4, name: 'Dan', plan: 'free', country: 'US', order_ids: [105, 106] },
  { user_id: 5, name: 'Eve', plan: 'pro', country: 'US', order_ids: [107] },
  { user_id: 6, name: 'Finn', plan: 'free', country: 'ES', order_ids: [108] },
  { user_id: 7, name: 'Gina', plan: 'free', country: 'CA', order_ids: [109] },
  { user_id: 8, name: 'Hugo', plan: 'free', country: 'JP', order_ids: [110] },
]

// plan -> price. The single source of truth once the tables are split.
export const PLAN_PRICE = { pro: PRO_PRICE, free: 0 }

// order_id -> total. Small round numbers; only need to be plausible.
export const ORDER_TOTAL = {
  101: 40, 102: 25, 103: 60, 104: 15, 105: 30,
  106: 45, 107: 50, 108: 20, 109: 35, 110: 55,
}

const planPriceOf = (plan) => PLAN_PRICE[plan]

// The flat, wide table (step 0-1): one row per user, plan_price copied onto the row,
// and the whole order list crammed into one cell.
export function flatRows() {
  return USERS.map((u) => ({
    user_id: u.user_id,
    name: u.name,
    plan: u.plan,
    plan_price: planPriceOf(u.plan),
    country: u.country,
    order_ids: u.order_ids.join(', '), // e.g. "102, 103" -> the 1NF smell
    multi: u.order_ids.length > 1,
  }))
}

// First normal form (step 2-3): the order list splits into one atomic row per order.
// When `anomaly` is set, the single ANOMALY_ORDER row carries the mismatched price.
export function oneNFRows(anomaly = false) {
  const rows = []
  for (const u of USERS) {
    for (const oid of u.order_ids) {
      const price =
        anomaly && oid === ANOMALY_ORDER ? NEW_PRICE : planPriceOf(u.plan)
      rows.push({
        user_id: u.user_id,
        name: u.name,
        plan: u.plan,
        plan_price: price,
        country: u.country,
        order_id: oid,
      })
    }
  }
  return rows
}

// The three tables after the split (step 4-5). `updated` writes NEW_PRICE into the one
// plans row for the pro plan, the payoff replay of the same update.
export function splitTables(updated = false) {
  const users = USERS.map((u) => ({
    user_id: u.user_id,
    name: u.name,
    plan: u.plan,
    country: u.country,
  }))
  const plans = Object.keys(PLAN_PRICE).map((plan) => ({
    plan,
    plan_price: updated && plan === PRO_PLAN ? NEW_PRICE : PLAN_PRICE[plan],
  }))
  const orders = []
  for (const u of USERS) {
    for (const oid of u.order_ids) {
      orders.push({ order_id: oid, user_id: u.user_id, order_total: ORDER_TOTAL[oid] })
    }
  }
  return { users, plans, orders }
}

export const LAST_STEP = 5

// ── derived readouts (never hand-typed per step) ──────────────────────────────────
// How many distinct tables the data lives in at this step.
export function tableCount(step) {
  return step >= 4 ? 3 : 1
}

// How many cells currently hold the pro plan's price. Counted from the live shape at
// this step, so it falls to 1 exactly when the split removes the redundancy.
export function placesPriceLives(step) {
  if (step >= 4) return splitTables().plans.filter((p) => p.plan === PRO_PLAN).length
  if (step >= 2) return oneNFRows().filter((r) => r.plan === PRO_PLAN).length
  return flatRows().filter((r) => r.plan === PRO_PLAN).length
}
