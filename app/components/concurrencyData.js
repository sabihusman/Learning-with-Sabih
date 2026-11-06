// Deterministic engine for the Concurrency topic (Databases and SQL).
//
// Two transactions, T1 and T2, each add 50 to the same account balance. Each
// mode is a short SQL script per transaction, and the engine EXECUTES that
// script one statement per step, in whatever order the learner chooses with
// Step T1 / Step T2. Nothing is pre-scripted: the lost update, the wait, and the
// retry all fall out of running the statements.
//
// The rules modelled are PostgreSQL's at its default isolation level, READ
// COMMITTED, for one row:
// - A plain SELECT sees only committed data (never another transaction's
//   uncommitted write).
// - UPDATE and SELECT ... FOR UPDATE take the row lock and keep it until COMMIT
//   or ROLLBACK. If another transaction holds the lock, the statement waits.
// - An UPDATE re-checks its WHERE clause against the latest committed row once
//   it gets the lock, so a version check that no longer matches affects 0 rows.
// - COMMIT makes the transaction's write visible and releases the lock.

export const START = 100
export const INC = 50
export const CORRECT = START + 2 * INC
export const TXS = ['T1', 'T2']

// Each statement: what it does (kind) and the SQL shown. Defined once and
// shared by the modes that use it.
const SQL = {
  'select': 'SELECT balance FROM accounts WHERE id = 1;',
  'select-for-update': 'SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;',
  'select-versioned': 'SELECT balance, version FROM accounts WHERE id = 1;',
  'update-literal': 'UPDATE accounts SET balance = :balance + 50 WHERE id = 1;',
  'update-relative': 'UPDATE accounts SET balance = balance + 50 WHERE id = 1;',
  'update-versioned': 'UPDATE accounts SET balance = :balance + 50, version = :version + 1\n  WHERE id = 1 AND version = :version;',
  'commit': 'COMMIT;',
  'commit-or-retry': '-- 1 row: COMMIT;   0 rows: ROLLBACK; and start again',
}
const script = (...kinds) => kinds.map((kind) => ({ kind, sql: SQL[kind] }))

export const MODES = [
  { id: 'naive', label: 'read, then write', script: script('select', 'update-literal', 'commit') },
  { id: 'forupdate', label: 'SELECT ... FOR UPDATE', script: script('select-for-update', 'update-literal', 'commit') },
  { id: 'atomic', label: 'one UPDATE statement', script: script('update-relative', 'commit') },
  { id: 'optimistic', label: 'version check', script: script('select-versioned', 'update-versioned', 'commit-or-retry') },
]
export const modeOf = (id) => MODES.find((m) => m.id === id)

const freshTx = () => ({ pc: 0, vars: {}, pending: null, rows: null, done: false, retries: 0 })

export function initialState(mode = 'naive') {
  return {
    mode,
    committed: { balance: START, version: 1 },
    lock: null, // which transaction holds the row lock
    tx: { T1: freshTx(), T2: freshTx() },
    last: null, // { tx, kind, note } of the last attempted step
    steps: 0,
  }
}

const otherOf = (t) => (t === 'T1' ? 'T2' : 'T1')
const needsLock = (kind) => ['select-for-update', 'update-literal', 'update-relative', 'update-versioned'].includes(kind)

export const isDone = (s) => TXS.every((t) => s.tx[t].done)
export const currentStatement = (s, t) => (s.tx[t].done ? null : modeOf(s.mode).script[s.tx[t].pc])

// Is this transaction waiting on the other's row lock for its next statement?
export function isBlocked(s, t) {
  const st = currentStatement(s, t)
  return Boolean(st && needsLock(st.kind) && s.lock && s.lock !== t)
}

export const canStep = (s, t) => !s.tx[t].done && !isBlocked(s, t)

const cloneState = (s) => ({
  ...s,
  committed: { ...s.committed },
  tx: { T1: { ...s.tx.T1, vars: { ...s.tx.T1.vars } }, T2: { ...s.tx.T2, vars: { ...s.tx.T2.vars } } },
  last: null,
})

// Run transaction t's next statement. Pure. A finished transaction is returned
// unchanged; a blocked one records that it waited and changes nothing else.
export function step(state, t) {
  if (state.tx[t].done) return state
  if (isBlocked(state, t)) {
    return { ...state, last: { tx: t, kind: 'wait', note: `${t} waits: ${otherOf(t)} holds the row lock until it commits.` } }
  }
  const s = cloneState(state)
  const x = s.tx[t]
  const st = modeOf(s.mode).script[x.pc]
  let note = ''
  let next = x.pc + 1

  switch (st.kind) {
    case 'select':
      x.vars.balance = s.committed.balance
      note = `${t} reads the committed balance: ${x.vars.balance}.`
      break
    case 'select-for-update':
      s.lock = t
      x.vars.balance = s.committed.balance
      note = `${t} locks the row and reads the balance: ${x.vars.balance}.`
      break
    case 'select-versioned':
      x.vars.balance = s.committed.balance
      x.vars.version = s.committed.version
      note = `${t} reads balance ${x.vars.balance} at version ${x.vars.version}.`
      break
    case 'update-literal':
      s.lock = t
      x.pending = { balance: x.vars.balance + INC, version: s.committed.version }
      x.rows = 1
      note = `${t} writes ${x.vars.balance} + ${INC} = ${x.pending.balance}, computed from the balance it read. Not visible to others until it commits.`
      break
    case 'update-relative': {
      s.lock = t
      const base = s.committed.balance
      x.pending = { balance: base + INC, version: s.committed.version }
      x.rows = 1
      note = `${t} locks the row and sets balance = ${base} + ${INC} = ${x.pending.balance}. The read and the write happen inside this one statement.`
      break
    }
    case 'update-versioned':
      if (s.committed.version === x.vars.version) {
        s.lock = t
        x.pending = { balance: x.vars.balance + INC, version: x.vars.version + 1 }
        x.rows = 1
        note = `${t}'s version check matches (${x.vars.version}): 1 row updated to ${x.pending.balance}, version ${x.pending.version}.`
      } else {
        x.rows = 0
        note = `${t}'s version check fails: it read version ${x.vars.version}, the row is now at version ${s.committed.version}. 0 rows updated.`
      }
      break
    case 'commit':
    case 'commit-or-retry':
      if (x.rows === 0) {
        // optimistic conflict: roll back and run the script again from the top
        x.vars = {}
        x.rows = null
        x.retries += 1
        next = 0
        note = `${t} saw 0 rows, rolls back and starts again from the SELECT.`
      } else {
        if (x.pending) s.committed = { ...x.pending }
        x.pending = null
        if (s.lock === t) s.lock = null
        x.done = true
        note = `${t} commits. The committed balance is now ${s.committed.balance}.`
      }
      break
    default:
      break
  }
  x.pc = next
  s.last = { tx: t, kind: st.kind, note }
  s.steps += 1
  return s
}

// Preset orders for Play. A turn whose transaction has finished goes to the other;
// a turn whose transaction is blocked is a wait (it consumes the turn).
export const ORDERS = [
  { id: 'interleaved', label: 'interleaved', pattern: ['T1', 'T2'] },
  { id: 'serial', label: 'T1 first, then T2', pattern: ['T1'] },
]

export function scheduledTx(state, orderId, tick) {
  const order = ORDERS.find((o) => o.id === orderId)
  let t = order.pattern[tick % order.pattern.length]
  if (state.tx[t].done) t = otherOf(t)
  return t
}

export function runOrder(mode, orderId, guard = 60) {
  let s = initialState(mode)
  let tick = 0
  while (!isDone(s) && tick < guard) {
    s = step(s, scheduledTx(s, orderId, tick))
    tick += 1
  }
  return s
}

// Every order of statements the scheduler allows, explored exhaustively (each
// state branches on which runnable transaction goes next). Returns the set of
// final committed balances and the largest retry count seen. Used by the tests.
export function allOutcomes(mode) {
  const finals = new Set()
  let maxRetries = 0
  const seen = new Set()
  const walk = (s) => {
    const key = JSON.stringify([s.committed, s.lock, s.tx])
    if (seen.has(key)) return
    seen.add(key)
    if (isDone(s)) {
      finals.add(s.committed.balance)
      maxRetries = Math.max(maxRetries, s.tx.T1.retries + s.tx.T2.retries)
      return
    }
    for (const t of TXS) if (canStep(s, t)) walk(step(s, t))
  }
  walk(initialState(mode))
  return { finals: [...finals].sort((a, b) => a - b), maxRetries }
}
