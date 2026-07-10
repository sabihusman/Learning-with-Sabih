import { test, expect } from '@playwright/test'
import {
  initialState,
  isDone,
  isDeadlocked,
  applyStep,
  runSequence,
  runUntilDoneOrDeadlock,
  AUTO_PATTERN,
} from '../app/components/deadlockData'

// Pure-function correctness for the Deadlock figure. No page, no browser: these
// assert directly on the same functions the component renders, so a change that
// breaks the figure's central claims (opposite order can deadlock; same order cannot)
// fails here.

test('applyStep is pure: it never mutates the input state', () => {
  const before = initialState('OPPOSITE')
  const snapshot = JSON.parse(JSON.stringify(before))
  applyStep(before, 'A')
  expect(before).toEqual(snapshot)
})

test('a thread past its four actions is returned unchanged by a further step', () => {
  let state = initialState('SAME')
  state = applyStep(state, 'A') // acquire lock 1
  state = applyStep(state, 'A') // acquire lock 2
  state = applyStep(state, 'A') // release lock 1
  state = applyStep(state, 'A') // release lock 2
  expect(state.threads.A.pc).toBe(4)
  const again = applyStep(state, 'A')
  expect(again).toBe(state)
})

test('a blocked thread does not advance while its wanted lock is held, and proceeds once it frees', () => {
  let state = initialState('SAME')
  state = applyStep(state, 'A') // A takes lock 1
  state = applyStep(state, 'B') // B wants lock 1, held by A: blocks
  expect(state.threads.B.pc).toBe(0)
  expect(state.threads.B.waitingFor).toBe(1)

  // retrying while still held does not advance it
  const retried = applyStep(state, 'B')
  expect(retried.threads.B.pc).toBe(0)
  expect(retried.threads.B.waitingFor).toBe(1)

  // once A releases lock 1, B's next attempt succeeds
  state = applyStep(state, 'A') // A acquires lock 2
  state = applyStep(state, 'A') // A releases lock 1
  state = applyStep(state, 'B') // B retries: lock 1 is free now
  expect(state.threads.B.pc).toBe(1)
  expect(state.threads.B.waitingFor).toBe(null)
})

test('isDeadlocked is false for the initial state and for a one-sided wait', () => {
  expect(isDeadlocked(initialState('SAME'))).toBe(false)

  let state = initialState('SAME')
  state = applyStep(state, 'A') // A takes lock 1
  state = applyStep(state, 'B') // B waits on lock 1, held by A; A waits on nothing
  expect(isDeadlocked(state)).toBe(false)
})

test('OPPOSITE mode: the classic interleaving reaches a genuine deadlock', () => {
  const { finalState } = runSequence('OPPOSITE', AUTO_PATTERN)
  expect(isDeadlocked(finalState)).toBe(true)
  // the circular wait itself: A holds lock 1 and wants lock 2, B holds lock 2 and
  // wants lock 1 - computed from real lock ownership and waiting status, not asserted
  // in the abstract
  expect(finalState.locks[1]).toBe('A')
  expect(finalState.locks[2]).toBe('B')
  expect(finalState.threads.A.waitingFor).toBe(2)
  expect(finalState.threads.B.waitingFor).toBe(1)
})

// Every valid interleaving of thread A's 4 actions with thread B's 4 actions: choose
// which 4 of the 8 turns belong to A (8 choose 4 = 70 ways), fill the rest with B.
// Each token just gives that thread its next turn at its own current action, so this
// is the same "give a thread a turn" model the race-conditions spec used, generalized
// from 3+3 actions to 4+4.
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

const ALL_SAME_INTERLEAVINGS: string[][] = chooseIndices(8, 4).map((aSlots) => {
  const order = Array(8).fill('B')
  aSlots.forEach((slot) => {
    order[slot] = 'A'
  })
  return order
})

test('there are exactly 70 valid interleavings of the two threads four-action sequences', () => {
  expect(ALL_SAME_INTERLEAVINGS.length).toBe(70)
  for (const order of ALL_SAME_INTERLEAVINGS) {
    expect(order.filter((t) => t === 'A').length).toBe(4)
    expect(order.filter((t) => t === 'B').length).toBe(4)
  }
  const unique = new Set(ALL_SAME_INTERLEAVINGS.map((order) => order.join('')))
  expect(unique.size).toBe(70)
})

test('SAME mode: none of the 70 interleavings ever reaches deadlock, at any point in the run', () => {
  for (const order of ALL_SAME_INTERLEAVINGS) {
    const { history } = runSequence('SAME', order)
    for (const state of history) {
      expect(isDeadlocked(state)).toBe(false)
    }
  }
})

test('runUntilDoneOrDeadlock converges: OPPOSITE deadlocks, SAME completes with no deadlock', () => {
  const opposite = runUntilDoneOrDeadlock('OPPOSITE', AUTO_PATTERN)
  expect(isDeadlocked(opposite)).toBe(true)

  const same = runUntilDoneOrDeadlock('SAME', AUTO_PATTERN)
  expect(isDone(same)).toBe(true)
  expect(isDeadlocked(same)).toBe(false)
})
