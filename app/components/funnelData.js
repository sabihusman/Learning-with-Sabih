// Logic for the Funnel analysis topic. Kept separate from the React component so
// the counts and conversion rates can be unit-checked against the verified figures.
//
// The learning-app funnel is three ordered events:
//   topic_opened -> interactive_used -> topic_completed
// A session counts at a step if it ever fired that event, so each step's size is the
// number of DISTINCT session_id values for that event. Everything here is derived
// from sqlData.js; nothing is hardcoded.
import { sessions, events } from './sqlData'

export const STEP_EVENTS = ['topic_opened', 'interactive_used', 'topic_completed']

const distinctSessions = (ev) => new Set(events.filter((e) => e.event === ev).map((e) => e.session_id)).size

export const TOTAL_SESSIONS = sessions.length

// Each step: its event name and distinct-session count.
export const STEPS = STEP_EVENTS.map((event) => ({ event, count: distinctSessions(event) }))

// Step-to-step conversion (this step's count over the previous step's count) and the
// sessions dropped between them. The first step has no previous, so conv is null.
export const STEP_STATS = STEPS.map((s, i) => {
  const prev = i === 0 ? null : STEPS[i - 1].count
  return {
    ...s,
    prevCount: prev,
    conversion: prev == null ? null : (s.count / prev) * 100,
    dropped: prev == null ? null : prev - s.count,
    dropRate: prev == null ? null : ((prev - s.count) / prev) * 100,
  }
})

// Overall completion: final step over all sessions (not just those who entered).
export const OVERALL_RATE = (STEPS[STEPS.length - 1].count / TOTAL_SESSIONS) * 100

export const fmtPct = (n) => `${n.toFixed(1)}%`

// The SQL behind the funnel: one CTE per step selecting that step's distinct
// sessions, then a single row counting each.
export function buildSql() {
  const cte = (name, event) =>
    `${name} AS (\n  SELECT DISTINCT session_id FROM events WHERE event = '${event}'\n)`
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
