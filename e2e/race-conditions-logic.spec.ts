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

// Every valid interleaving of thread A's 3 steps with thread B's 3 steps: choose which
// 3 of the 6 slots belong to A (6 choose 3 = 20 ways), fill the rest with B. Each is
// automatically order-preserving per thread, since a thread's own steps are identical
// tokens whose order is just "which slots got picked for it" - there is no way to
// permute a thread's own three slots out of order.
function chooseIndices(n: number, k: number): number[][] {
  const result: number[][] = []
  function pick(start: number, combo: number[]) {
    if (combo.length === k) {
      result.push([...combo])
      return
    }
    for (let i = start; i < n; i++) {
      combo.push(i)
      pick(i + 1, combo)
      combo.pop()
    }
  }
  pick(0, [])
  return result
}

const ALL_INTERLEAVINGS: string[][] = chooseIndices(6, 3).map((aSlots) => {
  const order = Array(6).fill('B')
  aSlots.forEach((slot) => {
    order[slot] = 'A'
  })
  return order
})

test('there are exactly 20 valid interleavings of three A steps and three B steps', () => {
  expect(ALL_INTERLEAVINGS.length).toBe(20)
  for (const order of ALL_INTERLEAVINGS) {
    expect(order.filter((t) => t === 'A').length).toBe(3)
    expect(order.filter((t) => t === 'B').length).toBe(3)
  }
  // no duplicate orderings
  const unique = new Set(ALL_INTERLEAVINGS.map((order) => order.join('')))
  expect(unique.size).toBe(20)
})

test('without the lock, the lost update (101) is genuinely reachable among all 20 interleavings', () => {
  const balances = ALL_INTERLEAVINGS.map((order) => runSequence(order).finalState.balance)
  expect(balances).toContain(101)
})

test('without the lock, the two fully sequential interleavings yield 102', () => {
  const cleanAFirst = ALL_INTERLEAVINGS.find((order) => order.join('') === 'AAABBB')
  const cleanBFirst = ALL_INTERLEAVINGS.find((order) => order.join('') === 'BBBAAA')
  expect(cleanAFirst).toBeDefined()
  expect(cleanBFirst).toBeDefined()
  expect(runSequence(cleanAFirst!).finalState.balance).toBe(CORRECT)
  expect(runSequence(cleanBFirst!).finalState.balance).toBe(CORRECT)
})

test('the lock makes 101 impossible: ALL 20 interleavings settle at 102, none at 101', () => {
  for (const order of ALL_INTERLEAVINGS) {
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
