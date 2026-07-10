import { test, expect } from '@playwright/test'
import {
  START,
  CORRECT,
  STEPS,
  initialState,
  isDone,
  applyStep,
  canStep,
  applyLockedStep,
  runSequence,
  runLockedUntilDone,
  CLEAN,
  INTERLEAVED,
} from '../app/components/raceConditionsData'

// Pure-function correctness for the Race Conditions figure. No page, no browser: these
// assert directly on the same functions the component renders, so a change that breaks
// the figure's central claims (interleaving can lose an update; the lock prevents it)
// fails here.

test('applyStep is pure: it never mutates the input state', () => {
  const before = initialState()
  const snapshot = JSON.parse(JSON.stringify(before))
  applyStep(before, 'A')
  expect(before).toEqual(snapshot)
})

test('a thread past its three steps is returned unchanged by a further step', () => {
  let state = initialState()
  state = applyStep(state, 'A')
  state = applyStep(state, 'A')
  state = applyStep(state, 'A')
  expect(state.threads.A.pc).toBe(STEPS.length)
  const again = applyStep(state, 'A')
  expect(again).toBe(state)
})

test('CLEAN (A finishes, then B) yields the correct balance, 102', () => {
  const { finalState } = runSequence(CLEAN)
  expect(finalState.balance).toBe(102)
  expect(finalState.balance).toBe(CORRECT)
  expect(isDone(finalState)).toBe(true)
})

test('INTERLEAVED (steps alternate) loses an update and yields 101', () => {
  const { finalState } = runSequence(INTERLEAVED)
  expect(finalState.balance).toBe(101)
  expect(finalState.balance).toBe(CORRECT - 1)
  expect(isDone(finalState)).toBe(true)
})

test('a fully sequential order in either thread order yields 102', () => {
  expect(runSequence(['A', 'A', 'A', 'B', 'B', 'B']).finalState.balance).toBe(CORRECT)
  expect(runSequence(['B', 'B', 'B', 'A', 'A', 'A']).finalState.balance).toBe(CORRECT)
})

test('the lock makes 101 impossible: representative interleavings all settle at 102', () => {
  const orderings = [
    ['A', 'B'],
    ['B', 'A'],
    ['A', 'A', 'B'],
    ['B', 'B', 'A'],
    ['A', 'B', 'B', 'A'],
    ['B', 'A', 'A', 'B'],
    ['A', 'B', 'A', 'B'],
    ['B', 'A', 'B', 'A'],
  ]
  for (const order of orderings) {
    const finalState = runLockedUntilDone(order)
    expect(isDone(finalState)).toBe(true)
    expect(finalState.balance).toBe(CORRECT)
    expect(finalState.balance).not.toBe(101)
  }
})

test('canStep blocks the non-holding thread while the lock is held', () => {
  let state = initialState()
  state = applyLockedStep(state, 'A') // A reads, acquires the lock
  expect(state.lock).toBe('A')
  expect(canStep(state, 'B')).toBe(false)
  expect(canStep(state, 'A')).toBe(true)

  // a blocked attempt is a genuine no-op
  const blocked = applyLockedStep(state, 'B')
  expect(blocked).toBe(state)
  expect(blocked.threads.B.pc).toBe(0)
})

test('the lock releases the instant the holder finishes its write', () => {
  let state = initialState()
  state = applyLockedStep(state, 'A') // READ
  state = applyLockedStep(state, 'A') // ADD
  expect(state.lock).toBe('A')
  state = applyLockedStep(state, 'A') // WRITE
  expect(state.lock).toBeNull()
  expect(canStep(state, 'B')).toBe(true)
  expect(state.balance).toBe(START + 1)
})
