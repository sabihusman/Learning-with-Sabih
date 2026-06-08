// Logic for the "SELECT, WHERE and CASE" topic. Kept separate from the component so
// the SQL builder and row filtering can be checked in isolation. A small, readable
// slice of the users table gives enough variety in country and plan to filter and
// bucket.
import { users } from './sqlData'

const IDS = [1, 2, 3, 4, 5, 6, 7, 8]

export const ROWS = IDS.map((id) => {
  const u = users.find((x) => x.user_id === id)
  return { user_id: u.user_id, country: u.country, plan: u.plan, signup_date: u.signup_date }
})

// user_id is always selected (the row's identity); the rest can be toggled.
export const ID_COL = { key: 'user_id', label: 'user_id', w: 64 }
export const TOGGLE_COLS = [
  { key: 'country', label: 'country', w: 70 },
  { key: 'plan', label: 'plan', w: 58 },
  { key: 'signup_date', label: 'signup_date', w: 104 },
]
export const TIER_COL = { key: 'tier', label: 'tier', w: 70 }

// CASE: bucket each row into a paid/free tier by plan.
export const CASE_SQL = "CASE WHEN plan = 'pro' THEN 'paid' ELSE 'free' END AS tier"
export const tierOf = (row) => (row.plan === 'pro' ? 'paid' : 'free')

// WHERE conditions offered in the dropdown. Each carries a row test and its SQL text.
export const WHERE_OPTS = [
  { id: 'none', label: 'no filter', sql: null, test: () => true },
  { id: 'plan_pro', label: "plan = 'pro'", sql: "plan = 'pro'", test: (r) => r.plan === 'pro' },
  { id: 'plan_free', label: "plan = 'free'", sql: "plan = 'free'", test: (r) => r.plan === 'free' },
  { id: 'country_gb', label: "country = 'GB'", sql: "country = 'GB'", test: (r) => r.country === 'GB' },
  { id: 'country_fr', label: "country = 'FR'", sql: "country = 'FR'", test: (r) => r.country === 'FR' },
  { id: 'country_us', label: "country = 'US'", sql: "country = 'US'", test: (r) => r.country === 'US' },
]

export const whereById = (id) => WHERE_OPTS.find((w) => w.id === id) || WHERE_OPTS[0]

// Build the SQL for the chosen columns, CASE toggle, and WHERE condition.
export function buildSql(selectedKeys, caseOn, whereSql) {
  const cols = caseOn ? [...selectedKeys, CASE_SQL] : [...selectedKeys]
  let sql = `SELECT ${cols.join(', ')}\nFROM users`
  if (whereSql) sql += `\nWHERE ${whereSql}`
  return `${sql};`
}
