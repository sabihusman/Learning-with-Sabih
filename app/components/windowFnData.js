// Logic for the Window functions topic. Kept separate from the React component so
// the ranking and running-total math can be unit-checked in isolation.
//
// We take a small, readable slice of the shared events table: session 1 (which
// contains a tied pair of events at the same occurred_at) and session 2. Ordering
// by occurred_at puts the tie at positions 2 and 3, which is exactly what makes
// ROW_NUMBER, RANK, and DENSE_RANK diverge:
//   ROW_NUMBER -> 2, 3   (always distinct)
//   RANK       -> 2, 2   then the next row is 4   (gap after the tie)
//   DENSE_RANK -> 2, 2   then the next row is 3   (no gap)
import { events } from './sqlData'

// An illustrative per-event weight, so the running total accumulates by a varying
// amount (not just +1 per row, which would duplicate ROW_NUMBER). This "value"
// column is a teaching aid layered on top of the real rows.
export const VALUE = { topic_opened: 1, interactive_used: 2, topic_completed: 3 }

// session 1 events 1-4 (includes the tied pair 2 & 3), then session 2 events 7-9.
const SLICE_IDS = [1, 2, 3, 4, 7, 8, 9]

export const ROWS = SLICE_IDS.map((id) => {
  const e = events.find((x) => x.event_id === id)
  return {
    event_id: e.event_id,
    session_id: e.session_id,
    event: e.event,
    occurred_at: e.occurred_at,
    time: e.occurred_at.split(' ')[1], // HH:MM:SS for display
    value: VALUE[e.event],
  }
})

// Deterministic order: by occurred_at, then event_id as a stable tiebreak so the
// running total and ROW_NUMBER are well defined even across the tied pair.
const byOrder = (a, b) =>
  a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : a.event_id - b.event_id

// Annotate one ordered group of rows with the four window values. Ranking ties are
// decided by occurred_at only (the ORDER BY key); ROW_NUMBER and the running total
// advance by row.
function annotate(groupRows) {
  const sorted = [...groupRows].sort(byOrder)
  const timeCounts = sorted.reduce((m, r) => m.set(r.occurred_at, (m.get(r.occurred_at) || 0) + 1), new Map())
  let prevTime = null
  let rank = 0
  let dense = 0
  let run = 0
  return sorted.map((r, i) => {
    if (r.occurred_at !== prevTime) {
      rank = i + 1 // position-based: leaves a gap after a tie
      dense = dense + 1 // step by one: no gap
      prevTime = r.occurred_at
    }
    run += r.value
    return {
      ...r,
      row_number: i + 1,
      rank,
      dense_rank: dense,
      running: run,
      tied: timeCounts.get(r.occurred_at) > 1,
    }
  })
}

// Compute the full view. When partition is true, the calculation restarts within
// each session_id group; otherwise it runs once across all rows in time order.
export function computeView(partition) {
  if (!partition) return annotate(ROWS)
  const sids = [...new Set(ROWS.map((r) => r.session_id))]
  return sids.flatMap((sid) => annotate(ROWS.filter((r) => r.session_id === sid)))
}

// The maximum running total in a view, used to scale the running-sum bars.
export function maxRunning(rows) {
  return rows.reduce((m, r) => Math.max(m, r.running), 0)
}

// The SQL for the active function, reflecting the PARTITION BY toggle.
export function buildSql(fn, partition) {
  const over = partition ? 'PARTITION BY session_id ORDER BY occurred_at' : 'ORDER BY occurred_at'
  const expr = {
    ROW_NUMBER: 'ROW_NUMBER() OVER (%) AS rn',
    RANK: 'RANK() OVER (%) AS rnk',
    DENSE_RANK: 'DENSE_RANK() OVER (%) AS dr',
    SUM: 'SUM(value) OVER (%) AS running_total',
  }[fn].replace('%', over)
  return `SELECT session_id, occurred_at, event,\n  ${expr}\nFROM events;`
}
