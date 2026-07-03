// Logic for the Isolation levels topic. Kept separate from the React component so the
// outcome table and the scripted timelines can be checked in isolation.
//
// The outcomes below are transcribed VERBATIM from the official current PostgreSQL docs,
// Table 13.1 "Transaction Isolation Levels"
// (https://www.postgresql.org/docs/current/transaction-iso.html). They are PostgreSQL's
// real behavior, not computed or inferred here. Two cells are stricter than the SQL
// standard (the standard permits the phenomenon, PostgreSQL prevents it); those are marked
// in DEVIATION. The timeline steps and numbers are hand-authored for clarity.

export const LEVELS = ['Read Uncommitted', 'Read Committed', 'Repeatable Read', 'Serializable']

export const PHENOMENA = [
  { key: 'dirty', label: 'Dirty read' },
  { key: 'nonrepeatable', label: 'Non-repeatable read' },
  { key: 'phantom', label: 'Phantom read' },
  { key: 'anomaly', label: 'Serialization anomaly' },
]

// Index order matches LEVELS: [Read Uncommitted, Read Committed, Repeatable Read, Serializable].
// 'occurs' = the phenomenon can happen at that level in PostgreSQL; 'prevented' = it cannot.
export const OUTCOME = {
  dirty: ['prevented', 'prevented', 'prevented', 'prevented'],
  nonrepeatable: ['occurs', 'occurs', 'prevented', 'prevented'],
  phantom: ['occurs', 'occurs', 'prevented', 'prevented'],
  anomaly: ['occurs', 'occurs', 'occurs', 'prevented'],
}

// The two cells where PostgreSQL is stricter than the SQL standard: the standard permits
// the phenomenon at this level, but PG prevents it. Value = the level index of the deviation.
export const DEVIATION = {
  dirty: 0, // Read Uncommitted: the standard allows a dirty read; PostgreSQL prevents it.
  phantom: 2, // Repeatable Read: the standard allows a phantom; PostgreSQL prevents it.
}

// Each frame carries the acting transaction, the SQL-ish line, an explanation, a short
// database-state summary, and a one-word status for each transaction lane. The numbers are
// fixed and hand-authored; stepping just reads the next frame.

function dirtyFrames(deviation) {
  // Dirty read is prevented at every level in PostgreSQL; only the Read Uncommitted cell
  // deviates from the standard (which would allow it).
  const readNote = deviation
    ? 'At Read Uncommitted the SQL standard would let T1 see the uncommitted 200. PostgreSQL does not: T1 reads 100, the last committed value.'
    : 'T1 reads 100, the last committed value. The uncommitted change in T2 is invisible to it.'
  return [
    { actor: 't2', line: "T2: BEGIN;", note: 'T2 begins a transaction of its own.', db: 'Alice = 100 (committed)', t1: 'idle', t2: 'running' },
    { actor: 't2', line: "T2: UPDATE accounts SET balance = 200 WHERE name = 'Alice';", note: 'T2 sets Alice to 200 but has not committed. The value is uncommitted and could still be rolled back.', db: 'Alice = 100 committed / 200 uncommitted', t1: 'idle', t2: 'uncommitted write' },
    { actor: 't1', line: "T1: SELECT balance FROM accounts WHERE name = 'Alice';", note: readNote, db: 'Alice = 100 committed / 200 uncommitted', t1: 'read 100', t2: 'uncommitted write' },
    { actor: 't2', line: "T2: ROLLBACK;", note: 'T2 rolls back. Its uncommitted 200 disappears, so 100 was the right value to have read.', db: 'Alice = 100 (committed)', t1: 'read 100', t2: 'rolled back' },
  ]
}

function nonrepeatableFrames(occurs) {
  const secondNote = occurs
    ? 'T1 reads Alice = 200. The same query returned a different value inside one transaction: the read was not repeatable.'
    : 'T1 reads Alice = 100 again. Its snapshot is fixed for the whole transaction, so the committed change in T2 stays invisible.'
  const second = occurs ? 'read 200' : 'read 100'
  return [
    { actor: 't1', line: 'T1: BEGIN;', note: 'T1 begins.', db: 'Alice = 100 (committed)', t1: 'running', t2: 'idle' },
    { actor: 't1', line: "T1: SELECT balance FROM accounts WHERE name = 'Alice';  -- first read", note: 'T1 reads Alice = 100.', db: 'Alice = 100 (committed)', t1: 'read 100', t2: 'idle' },
    { actor: 't2', line: "T2: UPDATE accounts SET balance = 200 WHERE name = 'Alice'; COMMIT;", note: 'T2 sets Alice to 200 and commits. 200 is now the latest committed value.', db: 'Alice = 200 (committed)', t1: 'read 100', t2: 'committed' },
    { actor: 't1', line: "T1: SELECT balance FROM accounts WHERE name = 'Alice';  -- second read", note: secondNote, db: 'Alice = 200 (committed)', t1: second, t2: 'committed' },
  ]
}

function phantomFrames(occurs, deviation) {
  let secondNote
  if (occurs) secondNote = 'T1 counts 3. A row that did not exist during the first count has appeared: a phantom.'
  else if (deviation) secondNote = 'T1 counts 2 again. The SQL standard allows a phantom here at Repeatable Read; PostgreSQL prevents it, so the new row stays invisible to T1.'
  else secondNote = 'T1 counts 2 again. The new row falls outside T1 snapshot, so no phantom appears.'
  const second = occurs ? 'count 3' : 'count 2'
  return [
    { actor: 't1', line: 'T1: BEGIN;', note: 'T1 begins.', db: 'Alice 100, Bob 100  (2 rows over 50)', t1: 'running', t2: 'idle' },
    { actor: 't1', line: 'T1: SELECT count(*) FROM accounts WHERE balance > 50;  -- first count', note: 'T1 counts accounts over 50 and gets 2: Alice and Bob.', db: 'Alice 100, Bob 100  (2 rows over 50)', t1: 'count 2', t2: 'idle' },
    { actor: 't2', line: "T2: INSERT INTO accounts VALUES ('Carol', 80); COMMIT;", note: 'T2 inserts Carol with 80 and commits. A third row now matches the filter.', db: 'Alice 100, Bob 100, Carol 80  (3 rows over 50)', t1: 'count 2', t2: 'committed' },
    { actor: 't1', line: 'T1: SELECT count(*) FROM accounts WHERE balance > 50;  -- second count', note: secondNote, db: 'Alice 100, Bob 100, Carol 80  (3 rows over 50)', t1: second, t2: 'committed' },
  ]
}

function anomalyFrames(occurs) {
  const last = occurs
    ? { actor: 't2', line: 'T2: COMMIT;', note: 'T2 commits too. Alice = -50 and Bob = -50, so the total is -100. Each transaction was fine on its own, but together they broke the rule: a serialization anomaly (write skew).', db: 'Alice = -50, Bob = -50, total = -100', t1: 'committed', t2: 'committed' }
    : { actor: 't2', line: 'T2: COMMIT;  -- ERROR: could not serialize access', note: 'PostgreSQL detects that these two transactions could not have run one after the other, and aborts T2 with a serialization error. Bob stays 100, so the total is 50 and the rule holds.', db: 'Alice = -50, Bob = 100, total = 50  (T2 aborted)', t1: 'committed', t2: 'aborted' }
  return [
    { actor: 't1', line: 'T1: BEGIN; SELECT sum(balance) FROM accounts;', note: 'T1 reads the total: 200. The rule it enforces is that the combined balance must stay at or above 0.', db: 'Alice = 100, Bob = 100, total = 200', t1: 'sum 200', t2: 'idle' },
    { actor: 't2', line: 'T2: BEGIN; SELECT sum(balance) FROM accounts;', note: 'T2 reads the total under its own snapshot: also 200.', db: 'Alice = 100, Bob = 100, total = 200', t1: 'sum 200', t2: 'sum 200' },
    { actor: 't1', line: "T1: UPDATE accounts SET balance = balance - 150 WHERE name = 'Alice';", note: 'T1 withdraws 150 from Alice. It checked 200 - 150 = 50, at or above 0, so the withdrawal looks safe.', db: 'Alice = -50 (in T1), Bob = 100', t1: 'wrote Alice', t2: 'sum 200' },
    { actor: 't2', line: "T2: UPDATE accounts SET balance = balance - 150 WHERE name = 'Bob';", note: 'T2 withdraws 150 from Bob. It also saw 200, so 200 - 150 = 50 looked safe to it too.', db: 'Alice = -50 (in T1), Bob = -50 (in T2)', t1: 'wrote Alice', t2: 'wrote Bob' },
    { actor: 't1', line: 'T1: COMMIT;', note: 'T1 commits. Alice is now -50.', db: 'Alice = -50, Bob = 100', t1: 'committed', t2: 'wrote Bob' },
    last,
  ]
}

// Build the interleaved timeline for one (phenomenon, level) cell. Returns the ordered
// frames plus the outcome read straight from OUTCOME and whether this cell deviates from
// the SQL standard.
export function buildTimeline(phenKey, level) {
  const outcome = OUTCOME[phenKey][level]
  const occurs = outcome === 'occurs'
  const deviation = DEVIATION[phenKey] === level
  let frames
  switch (phenKey) {
    case 'dirty':
      frames = dirtyFrames(deviation)
      break
    case 'nonrepeatable':
      frames = nonrepeatableFrames(occurs)
      break
    case 'phantom':
      frames = phantomFrames(occurs, deviation)
      break
    case 'anomaly':
      frames = anomalyFrames(occurs)
      break
    default:
      frames = []
  }
  return { frames, outcome, occurs, deviation }
}
