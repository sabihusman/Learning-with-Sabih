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

export const COHORTS = ['all', 'pro', 'free']

// Each session's plan, looked up through its owning user (a real join, not a stored field).
const planOfSession = new Map(sessions.map((s) => [s.session_id, users.find((u) => u.user_id === s.user_id)?.plan]))

// Sessions belonging to a cohort, or null for 'all' (no filter).
function sessionsInCohort(cohort) {
  if (cohort === 'all') return null
  return new Set(sessions.filter((s) => planOfSession.get(s.session_id) === cohort).map((s) => s.session_id))
}

// Recompute the whole funnel (steps, conversions, overall rate) for a cohort. This is
// the same COUNT(DISTINCT session_id)-per-step logic as before, just scoped to the
// sessions in the cohort first.
export function computeFunnel(cohort = 'all') {
  const allowed = sessionsInCohort(cohort)
  const cohortEvents = allowed ? events.filter((e) => allowed.has(e.session_id)) : events
  const distinctSessions = (ev) => new Set(cohortEvents.filter((e) => e.event === ev).map((e) => e.session_id)).size
  const totalSessions = allowed ? allowed.size : sessions.length

  const steps = STEP_EVENTS.map((event) => ({ event, count: distinctSessions(event) }))
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
  const overallRate = (steps[steps.length - 1].count / totalSessions) * 100

  return { cohort, totalSessions, steps, stepStats, overallRate }
}

// Unfiltered funnel, kept as the module's default export shape for the logic spec.
export const STEPS = computeFunnel('all').steps
export const STEP_STATS = computeFunnel('all').stepStats
export const TOTAL_SESSIONS = computeFunnel('all').totalSessions
export const OVERALL_RATE = computeFunnel('all').overallRate

export const fmtPct = (n) => `${n.toFixed(1)}%`

// The SQL behind the funnel: one CTE per step selecting that step's distinct
// sessions (joined to users and filtered by plan when a cohort is chosen), then a
// single row counting each.
export function buildSql(cohort = 'all') {
  const cohortJoin =
    cohort === 'all'
      ? ''
      : `\n  JOIN users u ON u.user_id = e.user_id\n  WHERE u.plan = '${cohort}' AND e.event = '{EVENT}'`
  const cte = (name, event) =>
    cohort === 'all'
      ? `${name} AS (\n  SELECT DISTINCT session_id FROM events WHERE event = '${event}'\n)`
      : `${name} AS (\n  SELECT DISTINCT e.session_id FROM events e${cohortJoin.replace('{EVENT}', event)}\n)`
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
