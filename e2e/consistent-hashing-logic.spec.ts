import { test, expect } from '@playwright/test'
import {
  RING_SIZE,
  ringPos,
  KEYS,
  NODES_BASE,
  NODE_D,
  ownerOf,
  assignments,
  remapOnChange,
  modNRemapOnChange,
} from '../app/components/consistentHashingData'

// Pure-function correctness for the consistent-hashing figure. No page, no
// browser: these assert directly on the same functions the component renders,
// so a change that breaks the figure's central claim (the ring remaps far
// fewer keys than plain hash mod n) fails here.

const NODES_AFTER = [...NODES_BASE, NODE_D]

test('ownerOf is deterministic', () => {
  for (const key of KEYS) {
    expect(ownerOf(key, NODES_BASE)).toBe(ownerOf(key, NODES_BASE))
    expect(ownerOf(key, NODES_AFTER)).toBe(ownerOf(key, NODES_AFTER))
  }
})

test('ownerOf wraps to the lowest-positioned node past the last node', () => {
  // user:1001 sits at ring position 1014, past every node's position at 4
  // nodes (the highest is node-A at 1011), so it must wrap to whichever node
  // has the lowest ring position rather than falling off the ring.
  const positions = NODES_AFTER.map((n) => ({ n, p: ringPos(n) }))
  const maxNodePos = Math.max(...positions.map((p) => p.p))
  const lowestNode = positions.reduce((a, b) => (a.p < b.p ? a : b)).n
  expect(ringPos('user:1001')).toBeGreaterThan(maxNodePos)
  expect(ownerOf('user:1001', NODES_AFTER)).toBe(lowestNode)
})

test('assignments covers every key exactly once, for 3 and 4 nodes', () => {
  for (const nodes of [NODES_BASE, NODES_AFTER]) {
    const assigned = assignments(KEYS, nodes)
    expect(Object.keys(assigned)).toHaveLength(KEYS.length)
    for (const key of KEYS) {
      expect(nodes).toContain(assigned[key])
    }
  }
})

test('base 3-node split leaves no node empty', () => {
  const assigned = assignments(KEYS, NODES_BASE)
  const counts = { 'node-A': 0, 'node-B': 0, 'node-C': 0 }
  Object.values(assigned).forEach((n) => {
    counts[n] += 1
  })
  expect(counts).toEqual({ 'node-A': 4, 'node-B': 6, 'node-C': 4 })
})

test('measured remap counts for adding node-D (3 -> 4 nodes)', () => {
  expect(remapOnChange(KEYS, NODES_BASE, NODES_AFTER)).toBe(2)
  expect(modNRemapOnChange(KEYS, NODES_BASE.length, NODES_AFTER.length)).toBe(12)
})

test('the ring remaps strictly fewer keys than plain hash mod n', () => {
  const ring = remapOnChange(KEYS, NODES_BASE, NODES_AFTER)
  const modN = modNRemapOnChange(KEYS, NODES_BASE.length, NODES_AFTER.length)
  expect(ring).toBeLessThan(modN)
})

test('RING_SIZE is the documented constant', () => {
  expect(RING_SIZE).toBe(1024)
})
