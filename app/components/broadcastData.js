// Data and the real broadcasting computation for the Broadcasting figure.
//
// The rule is the standard NumPy-style broadcasting rule
// (https://numpy.org/doc/stable/user/basics.broadcasting.html), implemented exactly:
//   1. Compare the two shapes element-wise from the trailing (rightmost) dimension,
//      moving left.
//   2. Two dimensions are compatible when they are equal, OR when one of them is 1.
//   3. If the shapes have different ranks, the shorter is padded with 1s on the LEFT
//      (leading) side; a missing dimension is treated as size 1.
//   4. If any aligned pair is neither equal nor has a 1, the shapes do not broadcast.
//   5. The result takes, at each position, the larger of the two aligned sizes.
// Everything below is computed from this rule; nothing is hand-faked.

// A small fixed set of shapes so every doc-verified pair is reachable from the two
// selectors. Kept small and readable; the one large case (256,256,3) is only ever shown
// as a shape tuple, never drawn as cells, so it stays legible.
export const SHAPES = [
  { key: '3', dims: [3] },
  { key: '4', dims: [4] },
  { key: '4,1', dims: [4, 1] },
  { key: '4,3', dims: [4, 3] },
  { key: '7,1,5', dims: [7, 1, 5] },
  { key: '8,1,6,1', dims: [8, 1, 6, 1] },
  { key: '256,256,3', dims: [256, 256, 3] },
]

export function shapeString(dims) {
  if (dims.length === 0) return '()'
  if (dims.length === 1) return `(${dims[0]},)`
  return `(${dims.join(', ')})`
}

// Align two shapes from the right and classify each aligned pair. Returns one row per
// aligned position (leftmost first), whether the pair broadcasts, the index of the first
// failing position (or -1), and the result shape (or null on failure).
//
// Per row:
//   aIn / bIn : the original size at this position, or null if that shape was padded here
//   aEff / bEff : the effective size (a padded/missing dimension is treated as 1)
//   compatible : equal, or one side is 1
//   result : max(aEff, bEff) when compatible, else null
//   reason : 'equal' | 'a-stretch' | 'b-stretch' | 'mismatch'
//     'a-stretch' means A's size-1 dimension stretches up to B (and vice versa)
export function alignShapes(a, b) {
  const n = Math.max(a.length, b.length)
  const rows = []
  for (let k = 0; k < n; k++) {
    const ai = a.length - n + k // negative => A is padded (missing) at this position
    const bi = b.length - n + k
    const aIn = ai >= 0 ? a[ai] : null
    const bIn = bi >= 0 ? b[bi] : null
    const aEff = aIn === null ? 1 : aIn
    const bEff = bIn === null ? 1 : bIn
    const compatible = aEff === bEff || aEff === 1 || bEff === 1
    const result = compatible ? Math.max(aEff, bEff) : null
    let reason
    if (!compatible) reason = 'mismatch'
    else if (aEff === bEff) reason = 'equal'
    else if (aEff === 1) reason = 'a-stretch'
    else reason = 'b-stretch'
    rows.push({ pos: k, aIn, bIn, aEff, bEff, compatible, result, reason })
  }
  const failIndex = rows.findIndex((r) => !r.compatible)
  const ok = failIndex === -1
  const result = ok ? rows.map((r) => r.result) : null
  return { rows, ok, result, failIndex }
}
