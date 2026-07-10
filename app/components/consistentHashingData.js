// Deterministic data for the Consistent Hashing topic (Systems and Networking).
//
// 14 hand-authored, realistic-looking cache keys. NODES_BASE is 3 nodes; the UI
// lets the user add a 4th (NODE_D) and remove it again. Every key and node is
// placed on a ring by hashing its name; ownership walks clockwise from a key's
// ring position to the next node, wrapping to the lowest-positioned node past
// the end. This is real consistent hashing, not choreographed: adding a node
// only remaps the keys that fall between it and its new predecessor, unlike
// plain hash-mod-N, which reshuffles almost everything (see remapOnChange vs
// modNRemapOnChange below).
//
// The hash is a real FNV-1a (32-bit), the same one used by the Sharding topic:
// offset basis 2166136261, prime 16777619, XOR each byte then multiply.

export const RING_SIZE = 1024

// FNV-1a, 32-bit.
export function fnv1a(str) {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function ringPos(value) {
  return fnv1a(String(value)) % RING_SIZE
}

export const KEYS = [
  'session:alice',
  'session:bob',
  'session:carol',
  'session:dave',
  'user:1001',
  'user:1002',
  'user:1003',
  'user:1004',
  'cart:5001',
  'cart:5002',
  'cart:5003',
  'asset:logo.png',
  'asset:banner.jpg',
  'page:home',
]

export const NODES_BASE = ['node-A', 'node-B', 'node-C']
export const NODE_D = 'node-D'

// The node that owns a key: the first node whose ring position is at or past
// the key's position, walking clockwise, wrapping to the lowest-positioned
// node if the key falls past every node.
export function ownerOf(key, nodeList) {
  const keyPos = ringPos(key)
  const sorted = [...nodeList].sort((a, b) => ringPos(a) - ringPos(b))
  const next = sorted.find((node) => ringPos(node) >= keyPos)
  return next ?? sorted[0]
}

// key -> owning node, derived purely from ownerOf.
export function assignments(keyList, nodeList) {
  const result = {}
  keyList.forEach((key) => {
    result[key] = ownerOf(key, nodeList)
  })
  return result
}

// How many keys change owner between two node sets.
export function remapOnChange(keyList, nodesBefore, nodesAfter) {
  return keyList.filter((key) => ownerOf(key, nodesBefore) !== ownerOf(key, nodesAfter)).length
}

// Which specific keys change owner between two node sets.
export function movedKeys(keyList, nodesBefore, nodesAfter) {
  return keyList.filter((key) => ownerOf(key, nodesBefore) !== ownerOf(key, nodesAfter))
}

// The comparison baseline: plain hash mod n, no ring. How many keys' fnv1a(key)
// mod n assignment changes between two node counts.
export function modNRemapOnChange(keyList, nBefore, nAfter) {
  return keyList.filter((key) => fnv1a(key) % nBefore !== fnv1a(key) % nAfter).length
}
