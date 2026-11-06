// Logic for the Funnel analysis topic. Kept separate from the component so the
// counts can be checked against an independent re-simulation and against the
// SQL the figure shows.
//
// The learning-app funnel is three ordered steps:
//   topic_opened -> interactive_used -> topic_completed
// An ORDERED, WINDOWED funnel counts a session at step n only if it completed
// steps 1..n-1 first, in that order, and every step happened within the window
// measured from its first topic_opened. One unit throughout: sessions. One
// denominator throughout: sessions that reached step 1.
//
// The figure can also count each step independently (the common mistake), and
// can add a few hand-authored messy sessions so the difference is visible: the
// shared dataset from sqlData.js happens to be perfectly ordered.
import { events as baseEvents, users } from './sqlData'

export const STEP_EVENTS = ['topic_opened', 'interactive_used', 'topic_completed']

export const WINDOWS = [
  { id: '1', label: '1 min', minutes: 1 },
  { id: '2', label: '2 min', minutes: 2 },
  { id: '30', label: '30 min', minutes: 30 },
  { id: 'none', label: 'no limit', minutes: null },
]

export const MODES = [
  { id: 'ordered', label: 'Ordered funnel' },
  { id: 'independent', label: 'Old way (incorrect): each step alone' },
]

// A single cohort dimension at a time: all users, plan, or signup month.
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

const cohortUserIds = (cohortId) => new Set(users.filter((u) => inCohort(u, cohortId)).map((u) => u.user_id))

// Five hand-authored sessions, each one a way real event data goes wrong. They
// are added only inside this figure, never to the shared tables.
export const MESSY_SESSIONS = [
  { session_id: 9001, user_id: 5, story: 'deep link: used the interactive and completed without ever opening the topic', events: [['interactive_used', '2025-03-03 10:00:00'], ['topic_completed', '2025-03-03 10:02:00']] },
  { session_id: 9002, user_id: 14, story: 'used the interactive before opening the topic', events: [['interactive_used', '2025-03-04 10:00:00'], ['topic_opened', '2025-03-04 10:01:00'], ['topic_completed', '2025-03-04 10:03:00']] },
  { session_id: 9003, user_id: 20, story: 'completed before using the interactive', events: [['topic_opened', '2025-03-05 09:00:00'], ['topic_completed', '2025-03-05 09:01:00'], ['interactive_used', '2025-03-05 09:02:00']] },
  { session_id: 9004, user_id: 31, story: 'completed three hours after opening', events: [['topic_opened', '2025-03-06 08:00:00'], ['interactive_used', '2025-03-06 08:01:00'], ['topic_completed', '2025-03-06 11:00:00']] },
  { session_id: 9005, user_id: 3, story: 'a completion with nothing before it', events: [['topic_completed', '2025-03-07 12:00:00']] },
]

const messyEvents = MESSY_SESSIONS.flatMap((s) =>
  s.events.map(([event, occurred_at]) => ({ session_id: s.session_id, user_id: s.user_id, event, occurred_at })),
)

export const eventsFor = (messy) => (messy ? [...baseEvents, ...messyEvents] : baseEvents)

const ms = (ts) => Date.parse(`${ts.replace(' ', 'T')}Z`)

// Sessions (as Sets of ids) reaching each step.
export function stepSessions({ cohortId = 'all', mode = 'ordered', windowMinutes = 30, messy = false } = {}) {
  const userIds = cohortUserIds(cohortId)
  const evs = eventsFor(messy).filter((e) => userIds.has(e.user_id))
  if (mode === 'independent') {
    return STEP_EVENTS.map((step) => new Set(evs.filter((e) => e.event === step).map((e) => e.session_id)))
  }
  const bySession = new Map()
  for (const e of evs) {
    if (!bySession.has(e.session_id)) bySession.set(e.session_id, [])
    bySession.get(e.session_id).push(e)
  }
  const reached = STEP_EVENTS.map(() => new Set())
  for (const [id, list] of bySession) {
    const times = (step) => list.filter((e) => e.event === step).map((e) => ms(e.occurred_at))
    const opens = times('topic_opened')
    if (opens.length === 0) continue
    const t1 = Math.min(...opens)
    reached[0].add(id)
    const limit = windowMinutes == null ? Infinity : t1 + windowMinutes * 60000
    const uses = times('interactive_used').filter((t) => t >= t1 && t <= limit)
    if (uses.length === 0) continue
    const t2 = Math.min(...uses)
    reached[1].add(id)
    if (times('topic_completed').some((t) => t >= t2 && t <= limit)) reached[2].add(id)
  }
  return reached
}

// Counts, the single denominator (sessions that reached step 1), and the share
// of that denominator at every step.
export function computeFunnel(options = {}) {
  const reached = stepSessions(options)
  const base = reached[0].size
  const steps = STEP_EVENTS.map((event, i) => ({
    event,
    count: reached[i].size,
    shareOfBase: base === 0 ? 0 : (reached[i].size / base) * 100,
    dropped: i === 0 ? null : reached[i - 1].size - reached[i].size,
  }))
  // Sessions counted at a later step that never reached step 1: possible only
  // when steps are counted independently, and the reason that method is wrong.
  const outsideBase = new Set([...reached[1], ...reached[2]].filter((id) => !reached[0].has(id))).size
  return { steps, base, completion: steps[2].shareOfBase, outsideBase }
}

export const fmtPct = (n) => `${n.toFixed(1)}%`

const COHORT_SQL_WHERE = {
  free: "u.plan = 'free'",
  pro: "u.plan = 'pro'",
  jan: "u.signup_date >= '2025-01-01' AND u.signup_date < '2025-02-01'",
  feb: "u.signup_date >= '2025-02-01' AND u.signup_date < '2025-03-01'",
  mar: "u.signup_date >= '2025-03-01' AND u.signup_date < '2025-04-01'",
}

const COUNTS = `SELECT
  (SELECT COUNT(*) FROM opened)    AS opened,
  (SELECT COUNT(*) FROM used)      AS used,
  (SELECT COUNT(*) FROM completed) AS completed;`

function independentSql(where) {
  const cte = (name, event) =>
    where
      ? `${name} AS (\n  SELECT DISTINCT e.session_id\n  FROM events e\n  JOIN users u ON u.user_id = e.user_id\n  WHERE e.event = '${event}' AND ${where}\n)`
      : `${name} AS (\n  SELECT DISTINCT session_id FROM events WHERE event = '${event}'\n)`
  return `WITH ${[cte('opened', 'topic_opened'), cte('used', 'interactive_used'), cte('completed', 'topic_completed')].join(',\n')}\n${COUNTS}`
}

function orderedSql(where, windowMinutes) {
  const within = (col) => (windowMinutes == null ? '' : `\n   AND e.occurred_at <= ${col} + INTERVAL '${windowMinutes} minutes'`)
  const opened = where
    ? `opened AS (\n  SELECT e.session_id, MIN(e.occurred_at) AS t1\n  FROM events e\n  JOIN users u ON u.user_id = e.user_id\n  WHERE e.event = 'topic_opened' AND ${where}\n  GROUP BY e.session_id\n)`
    : `opened AS (\n  SELECT session_id, MIN(occurred_at) AS t1\n  FROM events\n  WHERE event = 'topic_opened'\n  GROUP BY session_id\n)`
  const used = `used AS (\n  SELECT o.session_id, o.t1, MIN(e.occurred_at) AS t2\n  FROM opened o\n  JOIN events e ON e.session_id = o.session_id\n   AND e.event = 'interactive_used'\n   AND e.occurred_at >= o.t1${within('o.t1')}\n  GROUP BY o.session_id, o.t1\n)`
  const completed = `completed AS (\n  SELECT DISTINCT u.session_id\n  FROM used u\n  JOIN events e ON e.session_id = u.session_id\n   AND e.event = 'topic_completed'\n   AND e.occurred_at >= u.t2${within('u.t1')}\n)`
  return `WITH ${[opened, used, completed].join(',\n')}\n${COUNTS}`
}

// The SQL the figure is computing, for the current controls.
export function buildSql({ cohortId = 'all', mode = 'ordered', windowMinutes = 30 } = {}) {
  const where = COHORT_SQL_WHERE[cohortId]
  return mode === 'independent' ? independentSql(where) : orderedSql(where, windowMinutes)
}
