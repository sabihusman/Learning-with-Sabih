'use client'

import { useEffect, useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './BinarySearchTreeViz.module.css'

const BALANCED = [4, 2, 6, 1, 3, 5, 7] // insert order that fills both sides evenly -> short tree
const DEGENERATE = [1, 2, 3, 4, 5, 6, 7] // already sorted -> every node is a right child, a straight line
const WALK_MS = 480

// ── real BST operations (immutable, deterministic) ───────────────────────────────────
function contains(node, v) {
  let n = node
  while (n) {
    if (v === n.value) return true
    n = v < n.value ? n.left : n.right
  }
  return false
}
// returns { root, path } where path is the existing nodes compared on the way down
function insert(root, v) {
  const path = []
  function rec(node) {
    if (!node) return { value: v, left: null, right: null }
    path.push(node.value)
    if (v < node.value) return { ...node, left: rec(node.left) }
    if (v > node.value) return { ...node, right: rec(node.right) }
    return node // duplicate (guarded against by the caller)
  }
  return { root: rec(root), path }
}
function search(root, v) {
  const path = []
  let n = root
  while (n) {
    path.push(n.value)
    if (v === n.value) return { path, found: true }
    n = v < n.value ? n.left : n.right
  }
  return { path, found: false }
}
function heightOf(node) {
  return node ? 1 + Math.max(heightOf(node.left), heightOf(node.right)) : 0
}
function countOf(node) {
  return node ? 1 + countOf(node.left) + countOf(node.right) : 0
}
function buildTree(values) {
  return values.reduce((root, v) => insert(root, v).root, null)
}

// in-order x-index + depth layout: each node's column is its in-order rank, so a parent
// sits horizontally between its two subtrees and a sorted insert order draws a diagonal
function layoutTree(root) {
  const pos = new Map()
  let xi = 0
  ;(function inorder(node, depth) {
    if (!node) return
    inorder(node.left, depth + 1)
    pos.set(node.value, { x: xi++, depth })
    inorder(node.right, depth + 1)
  })(root, 0)
  const edges = []
  ;(function walk(node) {
    if (!node) return
    for (const child of [node.left, node.right]) {
      if (child) {
        edges.push([node.value, child.value])
        walk(child)
      }
    }
  })(root)
  return { pos, edges }
}

// ── geometry ───────────────────────────────────────────────────────────────────────
const COL_W = 52
const ROW_H = 62
const R = 17
const PAD_X = 28
const PAD_TOP = 26

const NODE_FILL = { base: '#fffefb', visited: '#fcf3f1', current: '#c0392b', found: '#2f8f63', inserted: '#2f8f63' }
const NODE_STROKE = { base: '#7d96b8', visited: '#d98c84', current: '#c0392b', found: '#2f8f63', inserted: '#2f8f63' }
const NODE_TEXT = { base: '#1a1a1a', visited: '#1a1a1a', current: '#ffffff', found: '#ffffff', inserted: '#ffffff' }

export default function BinarySearchTreeViz() {
  const [tree, setTree] = useState(null)
  const [anim, setAnim] = useState(null) // { kind:'insert'|'search', path:[values], step, resultValue, found }
  const [input, setInput] = useState('')

  const walking = !!anim && anim.step < anim.path.length - 1

  // Auto-advance the walk with setInterval (never requestAnimationFrame) so it keeps
  // progressing in a backgrounded tab. Keyed on `walking` so it tears down when the
  // walk reaches its last node; no setState in the effect body, only interval cleanup.
  useEffect(() => {
    if (!walking) return undefined
    const id = setInterval(() => setAnim((a) => (a && a.step < a.path.length - 1 ? { ...a, step: a.step + 1 } : a)), WALK_MS)
    return () => clearInterval(id)
  }, [walking])

  const { pos, edges } = useMemo(() => layoutTree(tree), [tree])
  const height = heightOf(tree)
  const count = countOf(tree)
  const cols = Math.max(1, count)
  const VB_W = PAD_X * 2 + (cols - 1) * COL_W
  const VB_H = PAD_TOP * 2 + Math.max(0, height - 1) * ROW_H + 4
  const cx = (x) => PAD_X + x * COL_W
  const cy = (depth) => PAD_TOP + depth * ROW_H

  const parseValue = () => {
    const v = Number(input)
    return Number.isInteger(v) ? v : null
  }
  const v = parseValue()
  const validInsert = v !== null && !walking && !contains(tree, v)
  const validSearch = v !== null && !walking && tree !== null

  const doInsert = () => {
    if (!validInsert) return
    const { root, path } = insert(tree, v)
    setTree(root)
    setAnim({ kind: 'insert', path, step: 0, resultValue: v, found: true })
  }
  const doSearch = () => {
    if (!validSearch) return
    const { path, found } = search(tree, v)
    setAnim({ kind: 'search', path, step: 0, resultValue: found ? v : null, found })
  }
  const loadPreset = (values) => {
    setAnim(null)
    setTree(buildTree(values))
    setInput('')
  }
  const reset = () => {
    setAnim(null)
    setTree(null)
    setInput('')
  }

  const done = !!anim && anim.step >= anim.path.length - 1
  const comparisons = anim ? anim.path.length : null

  const nodeState = (value) => {
    if (!anim) return 'base'
    if (anim.kind === 'insert' && value === anim.resultValue) return done ? 'inserted' : 'pending'
    if (done && anim.kind === 'search' && anim.found && value === anim.resultValue) return 'found'
    const i = anim.path.indexOf(value)
    if (i >= 0 && i <= anim.step) return i === anim.step ? 'current' : 'visited'
    return 'base'
  }

  const controls = [{ label: 'Reset', onClick: reset, disabled: tree === null && anim === null }]

  let status
  if (anim) {
    if (!done) status = `${anim.kind === 'search' ? 'Searching for' : 'Inserting'} ${anim.path.length ? anim.path[anim.step] : anim.resultValue}...`
    else if (anim.kind === 'insert') status = `Inserted ${anim.resultValue} after ${comparisons} ${comparisons === 1 ? 'comparison' : 'comparisons'}`
    else if (anim.found) status = `Found ${anim.resultValue} in ${comparisons} ${comparisons === 1 ? 'comparison' : 'comparisons'}`
    else status = `${Number(input) || anim.path[anim.path.length - 1]} is not in the tree (${comparisons} ${comparisons === 1 ? 'comparison' : 'comparisons'})`
  } else if (count === 0) {
    status = 'Empty tree. Load a preset, or insert a value.'
  } else {
    status = `Tree has ${count} ${count === 1 ? 'node' : 'nodes'}, height ${height}.`
  }

  const readouts = [
    { label: 'tree height', value: height },
    { label: 'node count', value: count },
    { label: 'comparisons', value: comparisons === null ? '-' : comparisons },
  ]

  return (
    <Figure
      eyebrow="Trees"
      title="Binary search trees"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Load the balanced preset, then the degenerate one: both hold the same seven values, but the sorted insert order collapses the tree into a straight line. Search a value in each and compare the comparison counts. A short tree finds a value in a few steps; the collapsed line has to walk almost every node, the worst case that ties back to Big-O."
    >
      <div className={styles.presets} role="group" aria-label="Populate the tree">
        <button type="button" className={styles.presetBtn} disabled={walking} onClick={() => loadPreset(BALANCED)}>
          Balanced preset
        </button>
        <button type="button" className={styles.presetBtn} disabled={walking} onClick={() => loadPreset(DEGENERATE)}>
          Degenerate preset
        </button>
      </div>

      <div className={styles.inputRow}>
        <input
          className={styles.input}
          type="number"
          value={input}
          placeholder="value"
          aria-label="Value to insert or search"
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="button" className={styles.actBtn} disabled={!validInsert} onClick={doInsert}>
          Insert
        </button>
        <button type="button" className={styles.actBtn} disabled={!validSearch} onClick={doSearch}>
          Search
        </button>
      </div>

      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={styles.svg} role="img" aria-label={`Binary search tree with ${count} nodes and height ${height}`}>
        {count === 0 ? (
          <text x={VB_W / 2} y={VB_H / 2} className={styles.empty} textAnchor="middle">empty tree</text>
        ) : (
          <>
            {edges.map(([p, c], i) => {
              const a = pos.get(p)
              const b = pos.get(c)
              return <line key={i} x1={cx(a.x)} y1={cy(a.depth)} x2={cx(b.x)} y2={cy(b.depth)} stroke="#cfcbc2" strokeWidth={1.5} />
            })}
            {[...pos.entries()].map(([value, p]) => {
              const st = nodeState(value)
              const pending = st === 'pending'
              return (
                <g key={value} className={styles.node} opacity={pending ? 0.4 : 1}>
                  <circle cx={cx(p.x)} cy={cy(p.depth)} r={R} fill={NODE_FILL[pending ? 'base' : st]} stroke={pending ? '#2f8f63' : NODE_STROKE[st]} strokeWidth={st === 'base' ? 1.5 : 2} strokeDasharray={pending ? '3 2' : undefined} />
                  <text x={cx(p.x)} y={cy(p.depth) + 4} className={styles.nodeText} fill={NODE_TEXT[pending ? 'base' : st]} textAnchor="middle">{value}</text>
                </g>
              )
            })}
          </>
        )}
      </svg>

      <p className={styles.caption}>
        The tree, the insert and search walks, and all three readouts are computed live from the real structure. The
        tree is kept small for clarity; real trees hold far more, and real systems often use self-balancing trees to
        avoid the degenerate line shown by the sorted preset.
      </p>
    </Figure>
  )
}
