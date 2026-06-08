// Logic for the GROUP BY and aggregation topic. Kept separate from the React
// component so the grouping, aggregates, and HAVING filter can be unit-checked.
//
// The base is a derived per-session view, session_stats: one row per session,
// carrying the user's country and plan (joined from users) and the number of
// events recorded in that session (counted from events). We take a readable slice
// of sessions whose user is in one of four countries, so grouping by country gives
// a small, legible set of groups. Several users appear in more than one session,
// which is what makes COUNT(*) and COUNT(DISTINCT user_id) differ within a group.
import { users, sessions, events } from './sqlData'

// 16 sessions across US, GB, FR, JP (the first sessions whose user is in that set).
const SLICE_IDS = [1, 2, 3, 4, 5, 6, 7, 10, 14, 17, 18, 19, 20, 21, 23, 24]

const eventCount = (sessionId) => events.filter((e) => e.session_id === sessionId).length

// session_stats: the enriched per-session rows the figure groups over.
export const ROWS = SLICE_IDS.map((id) => {
  const s = sessions.find((x) => x.session_id === id)
  const u = users.find((x) => x.user_id === s.user_id)
  return { session_id: s.session_id, user_id: s.user_id, country: u.country, plan: u.plan, events: eventCount(id) }
})

export const GROUP_COLUMNS = ['country', 'plan']
export const AGGREGATES = ['COUNT', 'SUM', 'AVG', 'DISTINCT']

export const AGG_LABEL = {
  COUNT: 'COUNT(*)',
  SUM: 'SUM(events)',
  AVG: 'AVG(events)',
  DISTINCT: 'COUNT(DISTINCT user_id)',
}
const AGG_ALIAS = { COUNT: 'n', SUM: 'total_events', AVG: 'avg_events', DISTINCT: 'users' }

// The largest HAVING threshold worth offering: just below the biggest group's
// COUNT(*), so the slider can empty the result entirely at the top end.
export const MAX_COUNT = Math.max(
  ...GROUP_COLUMNS.map((col) => {
    const counts = new Map()
    ROWS.forEach((r) => counts.set(r[col], (counts.get(r[col]) || 0) + 1))
    return Math.max(...counts.values())
  })
)

// Round to at most one decimal place, dropping a trailing .0 so COUNT/SUM stay
// integer-looking while AVG shows e.g. 1.8.
const round1 = (n) => Math.round(n * 10) / 10

// Build the ordered groups for a grouping column. Within each group, rows keep
// slice order, and each row is flagged as a duplicate when its user_id already
// appeared earlier in that group (these are the rows COUNT(DISTINCT) folds away).
export function computeGroups(groupCol) {
  const byKey = new Map()
  ROWS.forEach((r) => {
    if (!byKey.has(r[groupCol])) byKey.set(r[groupCol], [])
    byKey.get(r[groupCol]).push(r)
  })

  const groups = [...byKey.entries()].map(([key, rawRows]) => {
    const seenUsers = new Set()
    const rows = rawRows.map((r) => {
      const isDup = seenUsers.has(r.user_id)
      seenUsers.add(r.user_id)
      return { ...r, isDup }
    })
    const count = rows.length
    const distinct = seenUsers.size
    const sum = rows.reduce((a, r) => a + r.events, 0)
    return { key, rows, count, distinct, sum, avg: round1(sum / count) }
  })

  // Stable order: biggest group first, then by key. Depends only on the grouping
  // column, so switching the aggregate never reshuffles the layout.
  groups.sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1))
  return groups
}

export function aggValue(group, agg) {
  if (agg === 'COUNT') return group.count
  if (agg === 'SUM') return group.sum
  if (agg === 'AVG') return group.avg
  return group.distinct // DISTINCT
}

// HAVING filters whole groups (after aggregation) by COUNT(*) > n.
export function passesHaving(group, havingN) {
  return group.count > havingN
}

export function buildSql(groupCol, agg, havingN) {
  let sql =
    `SELECT ${groupCol},\n` +
    `       ${AGG_LABEL[agg]} AS ${AGG_ALIAS[agg]}\n` +
    `FROM session_stats\n` +
    `GROUP BY ${groupCol}`
  if (havingN > 0) sql += `\nHAVING COUNT(*) > ${havingN}`
  return sql + ';'
}
