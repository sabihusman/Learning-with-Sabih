// Deterministic data/logic for the Race Conditions and Locks topic (Systems and
// Networking). This is the direct sequel to Concurrency (Databases and SQL): the same
// lost-update bug, modeled at the thread level instead of the transaction level.
//
// Two threads, A and B, each run three steps against one shared balance: READ (copy
// the shared balance into the thread's own register), ADD (add 1 to the register),
// WRITE (copy the register back to the shared balance). Every result below is
// computed by actually folding these steps over real state in the order given, never
// hand-typed: CLEAN (A finishes, then B) and INTERLEAVED (steps alternate) are just
// two step orders fed to the same engine, and the 102 vs 101 they produce falls out
// of the arithmetic, not a script.

export const START = 100
export const STEPS = ['READ', 'ADD', 'WRITE']
export const CORRECT = START + 2 // both threads add 1, so the right answer is 102

export function initialState() {
  return {
    balance: START,
    threads: {
      A: { pc: 0, register: null },
      B: { pc: 0, register: null },
    },
    lock: null,
  }
}

export function isDone(state) {
  return state.threads.A.pc >= STEPS.length && state.threads.B.pc >= STEPS.length
}

// Advance one thread by exactly one of its three steps. Pure: never mutates state. A
// thread that has already finished all three steps is returned unchanged.
export function applyStep(state, threadId) {
  const thread = state.threads[threadId]
  if (thread.pc >= STEPS.length) return state

  const step = STEPS[thread.pc]
  let register = thread.register
  let balance = state.balance

  if (step === 'READ') {
    register = state.balance
  } else if (step === 'ADD') {
    register = thread.register + 1
  } else {
    balance = thread.register
  }

  return {
    ...state,
    balance,
    threads: {
      ...state.threads,
      [threadId]: { pc: thread.pc + 1, register },
    },
  }
}

// Fold applyStep over an ordered list of thread ids, starting from a fresh state.
// Returns the final state and the state after every step, for the UI's script view.
export function runSequence(steps) {
  let state = initialState()
  const history = [state]
  for (const threadId of steps) {
    state = applyStep(state, threadId)
    history.push(state)
  }
  return { finalState: state, history }
}

// Two named orderings, fed to runSequence. Neither hardcodes 101 or 102; the logic
// spec asserts both by actually running the sequence through the engine above.
export const CLEAN = ['A', 'A', 'A', 'B', 'B', 'B']
export const INTERLEAVED = ['A', 'B', 'A', 'B', 'A', 'B']

// Lock model -------------------------------------------------------------------
//
// A thread acquires the lock on its first step (READ) and holds it through ADD and
// WRITE; the lock releases the instant the thread finishes its WRITE. While a thread
// holds the lock, the other thread cannot take any step, so the read-before-the-
// other-writes race that loses an update can never happen: whichever thread reads
// first runs all three of its steps before the other can take even one.

// Whether threadId is allowed to take its next step under the lock.
export function canStep(state, threadId) {
  const thread = state.threads[threadId]
  if (thread.pc >= STEPS.length) return false
  return state.lock === null || state.lock === threadId
}

// applyStep, gated by the lock: a disallowed attempt is a no-op (same state back).
export function applyLockedStep(state, threadId) {
  if (!canStep(state, threadId)) return state
  const next = applyStep(state, threadId)
  const thread = next.threads[threadId]
  const lock = thread.pc >= STEPS.length ? null : threadId
  return { ...next, lock }
}

// Cycle through threadOrder, applying applyLockedStep, until both threads finish.
// A blocked attempt is a no-op that simply consumes a turn, so this always converges.
// Used to check that no ordering the lock allows can lose an update.
export function runLockedUntilDone(threadOrder) {
  let state = initialState()
  let i = 0
  let guard = 0
  while (!isDone(state) && guard < 100) {
    state = applyLockedStep(state, threadOrder[i % threadOrder.length])
    i += 1
    guard += 1
  }
  return state
}
