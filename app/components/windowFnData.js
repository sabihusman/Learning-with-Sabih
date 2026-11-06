// Logic for the Window functions topic. Kept separate from the React component so
// the window math can be checked in isolation, and against SQLite, by the tests.
//
// The figure's table is the literal result of the SQL that buildSql() prints:
// every event of sessions 1 and 2 from the shared events table, with an
// illustrative per-event `value` defined in the query itself by a CASE. Three
// choices change the query, and the table is recomputed from them:
// - ORDER BY occurred_at, or ORDER BY occurred_at, event_id (a tie-break).
//   Events 2 and 3 share an occurred_at, so without the tie-break they are
//   PEERS: SQL does not say which of them comes first.
// - The SUM frame: ROWS (one row at a time) or RANGE (whole peer groups at a
//   time; this is the frame you get when you write ORDER BY and no frame).
// - PARTITION BY session_id, or one window over all rows.
//
// Where the query does not fix an answer (ROW_NUMBER over peers, a ROWS running
// total over peers), the database may return any of several values. compute()
// does not pick one: it evaluates every order of the peers and reports, per
// cell, the full set of values the database could return.
import { events } from './sqlData'

export const SESSION_IDS = [1, 2]

// The illustrative weight, mirrored by the CASE in buildSql().
export const VALUE = { topic_opened: 1, interactive_used: 2, topic_completed: 3 }

export const ROWS = events
  .filter((e) => SESSION_IDS.includes(e.session_id))
  .map((e) => ({
    event_id: e.event_id,
    session_id: e.session_id,
    event: e.event,
    occurred_at: e.occurred_at,
    time: e.occurred_at.split(' ')[1], // HH:MM:SS for display
    value: VALUE[e.event],
  }))

export const ORDERS = [
  { id: 'time', label: 'occurred_at', sql: 'occurred_at' },
  { id: 'tiebreak', label: 'occurred_at, event_id', sql: 'occurred_at, event_id' },
]
export const FRAMES = [
  { id: 'ROWS', label: 'ROWS' },
  { id: 'RANGE', label: 'RANGE (the default)' },
]
export const FUNCTIONS = ['ROW_NUMBER', 'RANK', 'DENSE_RANK', 'SUM']
export const FN_COLUMN = { ROW_NUMBER: 'row_number', RANK: 'rank', DENSE_RANK: 'dense_rank', SUM: 'running' }

// The ORDER BY key: two rows with equal keys are peers.
const keyOf = (row, order) => (order === 'tiebreak' ? `${row.occurred_at}#${String(row.event_id).padStart(6, '0')}` : row.occurred_at)

// Every way to order an array (peer groups here have at most a few rows).
function permutations(arr) {
  if (arr.length <= 1) return [arr]
  return arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]))
}

// Peer groups of one partition, in ORDER BY order.
function peerGroups(rows, order) {
  const sorted = [...rows].sort((a, b) => (keyOf(a, order) < keyOf(b, order) ? -1 : keyOf(a, order) > keyOf(b, order) ? 1 : 0))
  const groups = []
  for (const r of sorted) {
    const last = groups[groups.length - 1]
    if (last && keyOf(last[0], order) === keyOf(r, order)) last.push(r)
    else groups.push([r])
  }
  return groups
}

// Evaluate one partition for ONE concrete order of its rows (peers included).
function evaluate(groups, sequence, frame) {
  const out = new Map()
  let position = 0
  let running = 0
  groups.forEach((group, gi) => {
    const groupStart = position + 1
    const groupTotal = running + group.reduce((s, r) => s + r.value, 0)
    for (const r of sequence[gi]) {
      position += 1
      running += r.value
      out.set(r.event_id, {
        row_number: position,
        rank: groupStart,
        dense_rank: gi + 1,
        // ROWS: up to this row. RANGE: up to the last peer of this row.
        running: frame === 'RANGE' ? groupTotal : running,
      })
    }
  })
  return out
}

// Cartesian product of the per-group permutations.
function allSequences(groups) {
  return groups.reduce((acc, g) => acc.flatMap((seq) => permutations(g).map((p) => [...seq, p])), [[]])
}

// The table for one choice of ORDER BY, frame and partitioning. Each row carries,
// for every window column, the sorted list of values the database could return.
export function compute({ order = 'time', frame = 'RANGE', partition = false } = {}) {
  const parts = partition ? SESSION_IDS.map((sid) => ROWS.filter((r) => r.session_id === sid)) : [ROWS]
  return parts.flatMap((rows) => {
    const groups = peerGroups(rows, order)
    const results = allSequences(groups).map((seq) => evaluate(groups, seq, frame))
    return groups.flat().map((r) => {
      const cells = {}
      for (const col of Object.values(FN_COLUMN)) {
        cells[col] = [...new Set(results.map((res) => res.get(r.event_id)[col]))].sort((a, b) => a - b)
      }
      const peers = groups.find((g) => g.includes(r)).length
      return { ...r, cells, tied: peers > 1 }
    })
  })
}

export const isAmbiguous = (row, col) => row.cells[col].length > 1
export const cellText = (row, col) => row.cells[col].join(' or ')

export function ambiguousCells(rows) {
  return rows.reduce((n, r) => n + Object.values(FN_COLUMN).filter((c) => isAmbiguous(r, c)).length, 0)
}

export function maxRunning(rows) {
  return rows.reduce((m, r) => Math.max(m, ...r.cells.running), 0)
}

// The SQL whose result the table shows, one line per selected column so the
// figure can highlight the active function's line. Lines are returned with an
// `fn` tag (the FUNCTIONS id they belong to, or null).
export function sqlLines({ order = 'time', frame = 'RANGE', partition = false } = {}) {
  const orderSql = ORDERS.find((o) => o.id === order).sql
  const over = `${partition ? 'PARTITION BY session_id ' : ''}ORDER BY ${orderSql}`
  const frameSql = `${frame} BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`
  return [
    { text: 'SELECT session_id, event_id, occurred_at, event, value,', fn: null },
    { text: `  ROW_NUMBER() OVER (${over}) AS row_number,`, fn: 'ROW_NUMBER' },
    { text: `  RANK()       OVER (${over}) AS rank,`, fn: 'RANK' },
    { text: `  DENSE_RANK() OVER (${over}) AS dense_rank,`, fn: 'DENSE_RANK' },
    { text: `  SUM(value)   OVER (${over}`, fn: 'SUM' },
    { text: `                     ${frameSql}) AS running`, fn: 'SUM' },
    { text: 'FROM (', fn: null },
    { text: "  SELECT *, CASE event WHEN 'topic_opened' THEN 1", fn: null },
    { text: "                       WHEN 'interactive_used' THEN 2", fn: null },
    { text: '                       ELSE 3 END AS value', fn: null },
    { text: '  FROM events', fn: null },
    { text: `  WHERE session_id IN (${SESSION_IDS.join(', ')})`, fn: null },
    { text: ') AS e', fn: null },
    { text: 'ORDER BY session_id, occurred_at, event_id;', fn: null },
  ]
}

export const buildSql = (opts) => sqlLines(opts).map((l) => l.text).join('\n')

// One status sentence describing what the current query does, computed.
export function statusFor(rows, { order, frame, partition }, activeFn) {
  const col = FN_COLUMN[activeFn]
  const tied = rows.filter((r) => r.tied)
  const scope = partition ? 'within each session' : 'over all rows'
  if (tied.length === 0) return `${activeFn} ${scope}. The ORDER BY ${order === 'tiebreak' ? 'tie-break leaves no two rows equal' : 'key has no ties here'}, so every value is fixed.`
  const ids = tied.map((r) => r.event_id).join(' and ')
  if (activeFn === 'SUM') {
    return frame === 'ROWS'
      ? `Events ${ids} tie on occurred_at. With ROWS, each running total stops at its own row, and SQL does not say which peer comes first, so those totals can come out either way.`
      : `Events ${ids} tie on occurred_at. With RANGE, the frame takes in every peer at once, so both rows get the same total, whatever their order.`
  }
  if (rows.some((r) => isAmbiguous(r, col))) {
    return `Events ${ids} tie on occurred_at. ROW_NUMBER must give them different numbers, but nothing says which gets which: the database may return either. Add event_id to ORDER BY to fix it.`
  }
  return `Events ${ids} tie on occurred_at. ${activeFn} gives peers the same number, so the tie is handled the same way every run.`
}
