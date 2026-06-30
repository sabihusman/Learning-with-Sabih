'use client'

import { useEffect, useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './DynamicProgrammingViz.module.css'

const MIN_N = 4
const MAX_N = 7 // n=8 already needs 34 leaves; cap where the naive tree still reads
const DEFAULT_N = 6
const PLAY_MS = 320

// Real, deterministic Fibonacci call trees. Naive: every fib(k) for k>=2 expands into
// fib(k-1) and fib(k-2), so the same subproblem reappears all over the tree. Memoized:
// the first time a value is reached it is computed (expands); every later appearance is
// a cache hit drawn as a leaf, never re-expanded. The node count of each tree IS the real
// number of fib() calls that implementation makes.
function buildNaive(k) {
  if (k <= 1) return { k, type: 'base', children: [] }
  return { k, type: 'compute', children: [buildNaive(k - 1), buildNaive(k - 2)] }
}
function buildMemo(k) {
  const computed = new Set()
  const rec = (j) => {
    if (j <= 1) return { k: j, type: 'base', children: [] }
    if (computed.has(j)) return { k: j, type: 'cached', children: [] }
    computed.add(j)
    return { k: j, type: 'compute', children: [rec(j - 1), rec(j - 2)] }
  }
  return rec(k)
}
const fibValue = (n) => {
  let a = 0
  let b = 1
  for (let i = 0; i < n; i += 1) [a, b] = [b, a + b]
  return a
}

// ── layout ──────────────────────────────────────────────────────────────────────────
const NODE_W = 30
const NODE_H = 22
const LEAF_SPACING = 38
const LEVEL_H = 52
const PAD_X = 22
const PAD_TOP = 16

// assign each leaf an x slot, each parent the midpoint of its children; flatten to a
// pre-order list (the order the calls actually happen in)
function layoutTree(root) {
  let leaf = 0
  let maxDepth = 0
  const assign = (node, depth) => {
    node.depth = depth
    maxDepth = Math.max(maxDepth, depth)
    if (node.children.length === 0) {
      node.slot = leaf
      leaf += 1
    } else {
      node.children.forEach((c) => assign(c, depth + 1))
      node.slot = (node.children[0].slot + node.children[node.children.length - 1].slot) / 2
    }
  }
  assign(root, 0)
  const nodes = []
  const edges = []
  const flatten = (node, parent) => {
    node.id = nodes.length
    node.x = PAD_X + node.slot * LEAF_SPACING + NODE_W / 2
    node.y = PAD_TOP + node.depth * LEVEL_H + NODE_H / 2
    nodes.push(node)
    if (parent) edges.push({ from: parent, to: node })
    node.children.forEach((c) => flatten(c, node))
  }
  flatten(root, null)
  const width = PAD_X * 2 + (leaf - 1) * LEAF_SPACING + NODE_W
  const height = PAD_TOP * 2 + maxDepth * LEVEL_H + NODE_H
  return { nodes, edges, width, height, count: nodes.length }
}

// one pastel per subproblem value k, so equal subproblems share a colour and the
// repetition is visible at a glance
const KCOLORS = ['#dfe7f2', '#f4e3c8', '#dceee0', '#f1dde6', '#e6e0ef', '#d9ece9', '#f3e7d2', '#e3e9d6']
const colorForK = (k) => KCOLORS[k % KCOLORS.length]

export default function DynamicProgrammingViz() {
  const [n, setN] = useState(DEFAULT_N)
  const [mode, setMode] = useState('naive')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const { naive, memo } = useMemo(() => ({ naive: layoutTree(buildNaive(n)), memo: layoutTree(buildMemo(n)) }), [n])
  const tree = mode === 'naive' ? naive : memo
  const total = tree.count
  const done = step >= total
  const isPlaying = playing && !done

  // Auto-advance with setInterval (never requestAnimationFrame) so it keeps progressing
  // in a backgrounded tab. Keyed on `done` so it tears down at the end and on the tree
  // identity so it rebinds when n or the mode changes; no setState in the effect body.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(total, s + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done, total])

  const onStep = () => setStep((s) => Math.min(total, s + 1))
  const reset = () => {
    setPlaying(false)
    setStep(0)
  }
  const selectMode = (m) => {
    if (m === mode) return
    setPlaying(false)
    setStep(0)
    setMode(m)
  }
  const selectN = (value) => {
    setPlaying(false)
    setStep(0)
    setN(value)
  }

  const current = step > 0 ? tree.nodes[step - 1] : null
  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]
  const readouts = [
    { label: 'naive calls', value: naive.count },
    { label: 'memoized calls', value: memo.count },
    { label: `fib(${n})`, value: fibValue(n) },
  ]
  const status =
    step === 0
      ? `${mode === 'naive' ? 'Naive' : 'Memoized'} fib(${n}) makes ${total} calls. Step or play to trace them in order.`
      : current
        ? `Call ${step} of ${total}: fib(${current.k})${current.type === 'cached' ? ' is a cache hit, not expanded' : current.type === 'base' ? ' is a base case' : ''}.`
        : ''

  // svg never upscales past its natural size, so the lean memoized tree stays visibly
  // smaller than the sprawling naive one instead of both filling the width
  const svgMaxW = Math.min(tree.width, 660)

  return (
    <Figure
      eyebrow="Optimization"
      title="Dynamic programming"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Compute the same Fibonacci number both ways. Naive recursion rebuilds the same subproblems again and again, so equal-coloured nodes repeat all over the tree. Switch to Memoized: each subproblem is computed once and every later appearance becomes a cache hit, not a whole subtree. Compare the two call counts, the lean tree does the same job with a fraction of the work."
    >
      <div className={styles.toggle} role="group" aria-label="Strategy">
        {[['naive', 'Naive'], ['memo', 'Memoized']].map(([k, label]) => (
          <button key={k} type="button" className={`${styles.toggleBtn} ${k === mode ? styles.toggleActive : ''}`} aria-pressed={k === mode} onClick={() => selectMode(k)}>
            {label}
          </button>
        ))}
        <span className={styles.nControl}>
          <label htmlFor="dp-n" className={styles.nLabel}>n</label>
          <input id="dp-n" className={styles.slider} type="range" min={MIN_N} max={MAX_N} step={1} value={n} onChange={(e) => selectN(Number(e.target.value))} />
          <span className={styles.nValue}>{n}</span>
        </span>
      </div>

      <div className={styles.treeWrap}>
        <svg viewBox={`0 0 ${tree.width} ${tree.height}`} className={styles.svg} style={{ maxWidth: `${svgMaxW}px` }} role="img" aria-label={`${mode} Fibonacci call tree for fib(${n})`}>
          {tree.edges.map((e, i) => {
            const made = e.to.id < step
            return <line key={i} x1={e.from.x} y1={e.from.y + NODE_H / 2} x2={e.to.x} y2={e.to.y - NODE_H / 2} stroke="#cfcbc2" strokeWidth={1.25} opacity={made ? 1 : 0.3} />
          })}
          {tree.nodes.map((node) => {
            const made = node.id < step
            const isCurrent = node.id === step - 1
            const cached = node.type === 'cached'
            return (
              <g key={node.id} className={styles.node} opacity={made ? 1 : 0.28}>
                <rect
                  x={node.x - NODE_W / 2}
                  y={node.y - NODE_H / 2}
                  width={NODE_W}
                  height={NODE_H}
                  rx={4}
                  fill={cached ? '#efece4' : colorForK(node.k)}
                  stroke={isCurrent ? '#c0392b' : cached ? '#b9b6ae' : '#9b9892'}
                  strokeWidth={isCurrent ? 2.5 : 1}
                  strokeDasharray={cached ? '3 2' : undefined}
                />
                <text x={node.x} y={node.y + 4} className={styles.nodeText} fill={cached ? '#9b9892' : '#1a1a1a'} textAnchor="middle">{node.k}</text>
              </g>
            )
          })}
        </svg>
      </div>

      <p className={styles.caption}>
        Each node is one call to fib(k); the call counts and the tree are computed for real from the recursion. The same
        subproblem in naive mode is recomputed every time it appears, while memoized mode computes each one once and
        reuses it. n is kept small so the naive tree stays readable; the blow-up is real and gets far worse for larger n.
      </p>
    </Figure>
  )
}
