// Deterministic data/logic for the Deadlock topic (Systems and Networking). This is
// the direct sequel to Race Conditions and Locks: instead of one lock, two threads
// each need two locks, and the order they acquire them in decides whether they can
// ever get permanently stuck waiting on each other.
//
// Two locks (1 and 2), each either free or held by a thread. Two threads (A and B),
// each with a fixed sequence of four actions: acquire lock 1, acquire lock 2, release
// lock 1, release lock 2. The MODE decides the acquire order:
//   - OPPOSITE: A acquires 1 then 2; B acquires 2 then 1.
//   - SAME (the fix): both acquire 1 then 2.
// Every result below is computed by actually folding these actions over real lock and
// thread state, never hand-typed: deadlock is DETECTED as a circular wait from that
// state, not a flag anyone sets.

export const LOCK_IDS = [1, 2]

export const ACTIONS = {
  OPPOSITE: {
    A: [
      { type: 'acquire', lock: 1 },
      { type: 'acquire', lock: 2 },
      { type: 'release', lock: 1 },
      { type: 'release', lock: 2 },
    ],
    B: [
      { type: 'acquire', lock: 2 },
      { type: 'acquire', lock: 1 },
      { type: 'release', lock: 2 },
      { type: 'release', lock: 1 },
    ],
  },
  SAME: {
    A: [
      { type: 'acquire', lock: 1 },
      { type: 'acquire', lock: 2 },
      { type: 'release', lock: 1 },
      { type: 'release', lock: 2 },
    ],
    B: [
      { type: 'acquire', lock: 1 },
      { type: 'acquire', lock: 2 },
      { type: 'release', lock: 1 },
      { type: 'release', lock: 2 },
    ],
  },
}

export function actionsFor(mode, threadId) {
  return ACTIONS[mode][threadId]
}

export function initialState(mode) {
  return {
    mode,
    locks: { 1: null, 2: null },
    threads: {
      A: { pc: 0, waitingFor: null },
      B: { pc: 0, waitingFor: null },
    },
  }
}

export function isDone(state) {
  const a = state.threads.A
  const b = state.threads.B
  return a.pc >= actionsFor(state.mode, 'A').length && b.pc >= actionsFor(state.mode, 'B').length
}

// Whether the two threads are deadlocked: a circular wait, detected purely from lock
// ownership and each thread's waiting status. A is waiting for a lock B holds, AND B
// is waiting for a lock A holds. With only two threads and two locks this two-edge
// cycle is the only possible circular wait, but it is still computed, never flagged.
export function isDeadlocked(state) {
  const a = state.threads.A
  const b = state.threads.B
  if (a.waitingFor === null || b.waitingFor === null) return false
  return state.locks[a.waitingFor] === 'B' && state.locks[b.waitingFor] === 'A'
}

const OTHER = { A: 'B', B: 'A' }

// Advance one thread by exactly one of its four actions. Pure: never mutates state.
// A thread already past its last action is returned unchanged (same reference). A
// thread whose next action is "acquire" a lock the other thread holds does not
// advance: it is marked waiting for that lock, and stays there until a later attempt
// finds the lock free.
export function applyStep(state, threadId) {
  const thread = state.threads[threadId]
  const actions = actionsFor(state.mode, threadId)
  if (thread.pc >= actions.length) return state

  const action = actions[thread.pc]

  if (action.type === 'acquire') {
    const holder = state.locks[action.lock]
    if (holder !== null && holder !== threadId) {
      // blocked: stays at the same action, marked waiting for this lock
      return {
        ...state,
        threads: {
          ...state.threads,
          [threadId]: { pc: thread.pc, waitingFor: action.lock },
        },
      }
    }
    return {
      ...state,
      locks: { ...state.locks, [action.lock]: threadId },
      threads: {
        ...state.threads,
        [threadId]: { pc: thread.pc + 1, waitingFor: null },
      },
    }
  }

  // release: the thread already owns this lock, since it can only reach a release
  // action after successfully acquiring the matching lock earlier in its own sequence
  return {
    ...state,
    locks: { ...state.locks, [action.lock]: null },
    threads: {
      ...state.threads,
      [threadId]: { pc: thread.pc + 1, waitingFor: null },
    },
  }
}

// Fold applyStep over an ordered list of thread ids, starting from a fresh state for
// the given mode. Returns the final state and the state after every step.
export function runSequence(mode, steps) {
  let state = initialState(mode)
  const history = [state]
  for (const threadId of steps) {
    state = applyStep(state, threadId)
    history.push(state)
  }
  return { finalState: state, history }
}

// The auto-play pattern: alternate turns between A and B. Fed to the same engine in
// both modes, this single ordering is the whole demonstration: under OPPOSITE it
// reaches a genuine deadlock (A takes lock 1, B takes lock 2, A blocks wanting lock 2,
// B blocks wanting lock 1: a closed circular wait); under SAME the exact same turn
// order completes both threads, because the shared acquire order means the second
// thread to arrive always blocks on a lock the first thread will release, never on a
// lock the first thread is itself waiting for.
export const AUTO_PATTERN = ['A', 'B', 'A', 'B']

// Cycle through threadOrder, applying applyStep, until both threads finish or a
// deadlock is detected (further turns would be pointless: both threads are
// permanently stuck once the circular wait forms). A blocked attempt is a no-op that
// simply consumes a turn, so this always terminates one way or the other.
export function runUntilDoneOrDeadlock(mode, threadOrder) {
  let state = initialState(mode)
  let i = 0
  let guard = 0
  while (!isDone(state) && !isDeadlocked(state) && guard < 100) {
    state = applyStep(state, threadOrder[i % threadOrder.length])
    i += 1
    guard += 1
  }
  return state
}
