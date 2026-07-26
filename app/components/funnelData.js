// Logic for the Funnel analysis topic. Kept separate from the React component so
// the counts and conversion rates can be unit-checked against the verified figures.
//
// The learning-app funnel is three ordered events:
//   topic_opened -> interactive_used -> topic_completed
// A session counts at a step if it ever fired that event, so each step's size is the
// number of DISTINCT session_id values for that event. Everything here is derived
// from sqlData.js; nothing is hardcoded.
import { sessions, events, users } from './sqlData'

export const STEP_EVENTS = ['topic_opened', 'interactive_used', 'topic_completed']

// A single cohort dimension at a time (R2): all users, plan, or signup month.
// 'all' has no predicate (every user matches); the rest check one field on the
// user row. Months are checked as a 'YYYY-MM' prefix of signup_date.
export const COHORTS = [
  { id: 'all', label: 'All users' },
  { id: 'free', label: 'Free' },
  { id: 'pro', label: 'Pro' },
  { id: 'jan', label: 'Jan 2025' },
  { id: 'feb', label: 'Feb 2025' },
  { id: 'mar', label: 'Mar 2025' },
]

const COHORT_MONTH = { jan: '2025-01', feb: '2025-02', mar: '2025-03' }

function inCohort(user, cohortId) {
  if (cohortId === 'all') return true
  if (cohortId === 'free' || cohortId === 'pro') return user.plan === cohortId
  const month = COHORT_MONTH[cohortId]
  return month != null && user.signup_date.slice(0, 7) === month
}

// user_id -> user row, built once per call from the committed users table
// (never mutated, not cached across calls: the dataset is tiny so recomputing
// is effectively free and there is nothing to keep in sync).
function cohortUserIds(cohortId) {
  return new Set(users.filter((u) => inCohort(u, cohortId)).map((u) => u.user_id))
}

// events already carry a denormalized user_id (see data/README.md), so a
// cohort filter on events needs no join through sessions.
const distinctSessionsForEvent = (event, userIds) =>
  new Set(events.filter((e) => e.event === event && userIds.has(e.user_id)).map((e) => e.session_id)).size

// Every field below is derived fresh from the cohort's user_id set: the step
// counts (numerators) and the total-sessions denominator both come from the
// same cohort, so a plan or signup-month slice changes both consistently.
export function computeFunnel(cohortId) {
  const userIds = cohortUserIds(cohortId)
  const totalSessions = sessions.filter((s) => userIds.has(s.user_id)).length
  const steps = STEP_EVENTS.map((event) => ({ event, count: distinctSessionsForEvent(event, userIds) }))
  const stepStats = steps.map((s, i) => {
    const prev = i === 0 ? null : steps[i - 1].count
    return {
      ...s,
      prevCount: prev,
      conversion: prev == null ? null : (s.count / prev) * 100,
      dropped: prev == null ? null : prev - s.count,
      dropRate: prev == null ? null : ((prev - s.count) / prev) * 100,
    }
  })
  const overallRate = totalSessions === 0 ? 0 : (steps[steps.length - 1].count / totalSessions) * 100
  return {
    cohortId,
    cohortSize: userIds.size,
    totalSessions,
    steps,
    stepStats,
    overallRate,
  }
}

export const fmtPct = (n) => `${n.toFixed(1)}%`

// SQL date-range filters for the month cohorts, half-open so they read
// cleanly and stay correct regardless of month length.
const COHORT_SQL_WHERE = {
  free: "u.plan = 'free'",
  pro: "u.plan = 'pro'",
  jan: "u.signup_date >= '2025-01-01' AND u.signup_date < '2025-02-01'",
  feb: "u.signup_date >= '2025-02-01' AND u.signup_date < '2025-03-01'",
  mar: "u.signup_date >= '2025-03-01' AND u.signup_date < '2025-04-01'",
}

// The SQL behind the funnel: one CTE per step selecting that step's distinct
// sessions, then a single row counting each. Picking a cohort other than "all
// users" adds a JOIN to users and a WHERE filter to every CTE, the CTE-with-
// filters point the prose exercises.
export function buildSql(cohortId) {
  const where = COHORT_SQL_WHERE[cohortId]
  const cte = (name, event) => {
    if (!where) {
      return `${name} AS (\n  SELECT DISTINCT session_id FROM events WHERE event = '${event}'\n)`
    }
    return (
      `${name} AS (\n` +
      '  SELECT DISTINCT e.session_id\n' +
      '  FROM events e\n' +
      '  JOIN users u ON u.user_id = e.user_id\n' +
      `  WHERE e.event = '${event}' AND ${where}\n` +
      ')'
    )
  }
  return (
    'WITH ' +
    [
      cte('opened', 'topic_opened'),
      cte('used', 'interactive_used'),
      cte('completed', 'topic_completed'),
    ].join(',\n') +
    '\n' +
    'SELECT\n' +
    '  (SELECT COUNT(*) FROM opened)    AS opened,\n' +
    '  (SELECT COUNT(*) FROM used)      AS used,\n' +
    '  (SELECT COUNT(*) FROM completed) AS completed;'
  )
}
