'use client'

import { useMemo, useState } from 'react'
import Figure from './Figure'
import { ACCENT, AMBER, BLUE, BLUE_BG, CARD, CONTROL_BG, FADE, INK, LINE } from './vizPalette'
import shared from './vizShared.module.css'
import styles from './EntropyCompressionViz.module.css'
import {
  SYMBOLS,
  DEFAULT_PROBS,
  MESSAGE_LENGTH,
  adjustProbability,
  shannonEntropy,
  buildHuffmanTree,
  codesFromTree,
  averageCodeLength,
  forestAfter,
  buildMessage,
  encodeMessage,
  decodeTrace,
} from './entropyCompressionData'

const fmtBits = (v) => v.toFixed(3)
const fmtPct = (p) => `${(p * 100).toFixed(1)}%`
const FIXED_BITS = Math.ceil(Math.log2(SYMBOLS.length)) // 2 bits names one of 4 symbols

// ── tree geometry: leaves on the bottom row, each merge one row above its taller child ──
const VB_W = 560
const ROW = 58
const TOP = 24
const LEAF_R = 17
const NODE_R = 15

function heightOf(tree, id) {
  const n = tree.nodes[id]
  if (n.label !== undefined) return 0
  return 1 + Math.max(heightOf(tree, n.left), heightOf(tree, n.right))
}

// Leaf order is the finished tree's left-to-right order, kept for every partial
// forest too: each partial tree is a subtree of the finished one, so nothing crosses
// and nothing jumps sideways as merges are added.
function treeLayout(tree) {
  if (tree.root === null) return { pos: {}, height: 0, vbH: TOP * 2 }
  const order = []
  const walk = (id) => {
    const n = tree.nodes[id]
    if (n.label !== undefined) order.push(id)
    else {
      walk(n.left)
      walk(n.right)
    }
  }
  walk(tree.root)
  const maxH = heightOf(tree, tree.root)
  const pitch = (VB_W - 120) / Math.max(1, order.length - 1)
  const pos = {}
  order.forEach((id, i) => {
    pos[id] = { x: order.length === 1 ? VB_W / 2 : 60 + i * pitch, y: TOP + maxH * ROW }
  })
  tree.merges.forEach((m) => {
    pos[m.id] = { x: (pos[m.left].x + pos[m.right].x) / 2, y: TOP + (maxH - heightOf(tree, m.id)) * ROW }
  })
  return { pos, height: maxH, vbH: TOP + maxH * ROW + LEAF_R + 26 }
}

// Ids on the path from the root to `id` (inclusive), for the decode highlight.
function pathTo(tree, id) {
  const parent = {}
  tree.merges.forEach((m) => {
    parent[m.left] = m.id
    parent[m.right] = m.id
  })
  const path = new Set([id])
  let at = id
  while (parent[at] !== undefined) {
    at = parent[at]
    path.add(at)
  }
  return path
}

function buildStage(tree, step, stepped) {
  const total = tree.merges.length
  if (total === 0) return 'One symbol left: nothing to merge, so it gets the 1-bit code 0.'
  if (!stepped) return `The finished tree: ${total} merges. Read each code from the root, 0 for left, 1 for right. Start from the leaves to build it one merge at a time.`
  if (step === 0) return `${tree.leaves.length} leaves, no merges yet. Each merge joins the two smallest weights.`
  const m = tree.merges[step - 1]
  const name = (id) => {
    const n = tree.nodes[id]
    return n.label === undefined ? fmtPct(n.prob) : `${n.label} (${fmtPct(n.prob)})`
  }
  const head = `Merge ${step} of ${total}: ${name(m.left)} + ${name(m.right)} = ${fmtPct(m.prob)}.`
  return step === total ? `${head} One tree left: read each code from the root, 0 for left, 1 for right.` : head
}

function decodeNote(trace, pos, tree) {
  if (pos === 0) return 'Start at the root. Each 0 goes left, each 1 goes right; a leaf emits its symbol and returns to the root.'
  const s = trace[pos - 1]
  const dir = s.bit === '0' ? 'left' : 'right'
  if (tree.leaves.length === 1) return `Bit ${pos} (${s.bit}): the only symbol, ${s.emitted}.`
  return s.emitted
    ? `Bit ${pos} is ${s.bit}: go ${dir}, reach leaf ${s.emitted}, emit it, back to the root.`
    : `Bit ${pos} is ${s.bit}: go ${dir}, not a leaf yet, keep reading.`
}

export default function EntropyCompressionViz() {
  const [probs, setProbs] = useState(DEFAULT_PROBS)
  const [step, setStep] = useState(null) // merges shown; null = the finished tree
  const [decodePos, setDecodePos] = useState(0) // bits decoded so far

  const entropy = useMemo(() => shannonEntropy(probs), [probs])
  const tree = useMemo(() => buildHuffmanTree(SYMBOLS, probs), [probs])
  const codes = useMemo(() => codesFromTree(tree), [tree])
  const avgLength = useMemo(() => averageCodeLength(SYMBOLS, probs, codes), [probs, codes])
  const gap = avgLength - entropy
  const nonzeroCount = probs.filter((p) => p > 1e-9).length

  const message = useMemo(() => buildMessage(SYMBOLS, probs), [probs])
  const encoded = useMemo(() => encodeMessage(message, codes), [message, codes])
  const trace = useMemo(() => decodeTrace(encoded.bits, tree), [encoded, tree])

  const total = tree.merges.length
  const shown = step === null ? total : Math.min(step, total)
  const built = shown === total
  const standing = forestAfter(tree, shown)
  const layout = treeLayout(tree)
  const pos = Math.min(decodePos, encoded.bits.length)
  const decoded = trace.slice(0, pos).filter((s) => s.emitted).map((s) => s.emitted)
  const atNode = pos > 0 && !trace[pos - 1].emitted ? trace[pos - 1].node : tree.root
  const decodePath = built && pos > 0 && tree.root !== null ? pathTo(tree, trace[pos - 1].node) : new Set()
  // the two smallest standing trees: what the next merge will join
  const nextPair = built ? [] : [tree.merges[shown].left, tree.merges[shown].right]

  const onSlide = (index, rawPercent) => {
    setProbs((prev) => adjustProbability(prev, index, rawPercent / 100))
    setDecodePos(0)
  }
  const setShown = (k) => {
    setStep(k)
    setDecodePos(0)
  }
  const nextSymbolEnd = () => {
    let i = pos
    while (i < trace.length && !trace[i].emitted) i++
    return Math.min(i + 1, trace.length)
  }

  const status = `Entropy ${fmtBits(entropy)} bits/symbol; Huffman averages ${fmtBits(avgLength)} bits/symbol, a gap of ${fmtBits(gap)}.`

  const readouts = [
    { label: 'entropy', value: `${fmtBits(entropy)} bits` },
    { label: 'Huffman average', value: `${fmtBits(avgLength)} bits` },
    { label: 'gap', value: `${fmtBits(gap)} bits` },
    { label: 'nonzero symbols', value: nonzeroCount },
    {
      label: `${MESSAGE_LENGTH}-symbol message`,
      value: `${encoded.bits.length} bits (fixed ${FIXED_BITS}-bit code: ${MESSAGE_LENGTH * FIXED_BITS}; entropy floor: ${(entropy * MESSAGE_LENGTH).toFixed(1)})`,
    },
  ]

  const nodeFill = (n, isLeaf) => {
    if (decodePath.has(n.id)) return ACCENT
    if (isLeaf) return BLUE_BG
    return CONTROL_BG
  }

  return (
    <Figure
      eyebrow="Compression"
      title="Entropy and a live Huffman code over four symbols"
      status={status}
      readouts={readouts}
      tryThis="Drag toward powers of one-half, like 0.5/0.25/0.125/0.125, and the gap closes to zero: Huffman meets entropy exactly. Drag all four to 25% and both settle at 2.000 bits. Skew hard toward one symbol, like 0.7/0.15/0.10/0.05, and entropy drops well below 2 while the gap widens past 0.1. Then press Start from the leaves and merge the two smallest until one tree stands, and decode the message one bit at a time: no separators are needed, because no code is the start of another."
    >
      <div className={styles.rows}>
        {SYMBOLS.map((label, i) => {
          const p = probs[i]
          const code = codes[label] ?? ''
          return (
            <div key={label} className={styles.row}>
              <div className={styles.rowHead}>
                <span className={styles.symbol}>{label}</span>
                <span className={styles.prob}>{fmtPct(p)}</span>
                <span className={styles.code}>{code || '-'}</span>
                <span className={styles.codeLen}>{code ? `${code.length} bit${code.length === 1 ? '' : 's'}` : ''}</span>
              </div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: fmtPct(p) }} />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={0.5}
                value={p * 100}
                onChange={(e) => onSlide(i, Number(e.target.value))}
                className={`${shared.slider} ${styles.slider}`}
                aria-label={`Probability of symbol ${label}`}
              />
            </div>
          )
        })}
      </div>

      <section className={styles.panel} data-testid="huff-build">
        <div className={styles.panelHead}>Build the tree</div>
        <div className={shared.group}>
          <button type="button" className={shared.btn} disabled={shown === 0 || total === 0} onClick={() => setShown(0)}>
            Start from the leaves
          </button>
          <button type="button" className={shared.btn} data-variant="primary" disabled={built} onClick={() => setShown(shown + 1)}>
            Merge the two smallest
          </button>
          <button type="button" className={shared.btn} disabled={built} onClick={() => setShown(null)}>
            Finish the tree
          </button>
        </div>
        <p className={styles.stage} data-testid="huff-stage">
          {buildStage(tree, shown, step !== null)}
        </p>
        <svg
          viewBox={`0 0 ${VB_W} ${layout.vbH}`}
          className={styles.treeSvg}
          role="img"
          aria-label={`Huffman tree, ${shown} of ${total} merges, ${standing.length} ${standing.length === 1 ? 'tree' : 'trees'} standing`}
          data-testid="huff-tree"
          data-merges={shown}
          data-standing={standing.length}
        >
          {tree.merges.slice(0, shown).map((m) =>
            [m.left, m.right].map((kid, side) => {
              const a = layout.pos[m.id]
              const b = layout.pos[kid]
              const onPath = decodePath.has(m.id) && decodePath.has(kid)
              return (
                <g key={`${m.id}-${kid}`}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={onPath ? ACCENT : LINE} strokeWidth={onPath ? 3 : 2} />
                  <text x={(a.x + b.x) / 2 + (side === 0 ? -9 : 9)} y={(a.y + b.y) / 2} className={styles.edgeBit} textAnchor="middle">
                    {side}
                  </text>
                </g>
              )
            }),
          )}
          {tree.nodes
            .filter((n) => n.label !== undefined || n.id < tree.leaves.length + shown)
            .map((n) => {
              const isLeaf = n.label !== undefined
              const p = layout.pos[n.id]
              const fill = nodeFill(n, isLeaf)
              const onPath = decodePath.has(n.id)
              const isNew = !built && shown > 0 && n.id === tree.merges[shown - 1].id
              let stroke = isLeaf ? BLUE : FADE
              if (nextPair.includes(n.id)) stroke = AMBER
              if (isNew) stroke = ACCENT
              return (
                <g key={n.id} data-testid={`huff-node-${isLeaf ? n.label : n.id}`} data-on-path={onPath || undefined}>
                  <circle cx={p.x} cy={p.y} r={isLeaf ? LEAF_R : NODE_R} fill={fill} stroke={stroke} strokeWidth={nextPair.includes(n.id) || isNew ? 3 : 1.5} />
                  <text x={p.x} y={p.y + 4} className={styles.nodeText} fill={onPath ? CARD : INK} textAnchor="middle">
                    {isLeaf ? n.label : fmtPct(n.prob).replace('.0%', '%')}
                  </text>
                  {isLeaf && (
                    <text x={p.x} y={p.y + LEAF_R + 14} className={styles.leafProb} textAnchor="middle">
                      {fmtPct(n.prob)}
                      {built ? `  ${codes[n.label]}` : ''}
                    </text>
                  )}
                </g>
              )
            })}
        </svg>
      </section>

      <section className={styles.panel} data-testid="huff-stream">
        <div className={styles.panelHead}>{`Encode and decode a ${MESSAGE_LENGTH}-symbol message`}</div>
        <div className={styles.message} aria-label="Message and its code">
          {encoded.segments.map((seg, i) => {
            const done = seg.start + seg.code.length <= pos
            return (
              <span key={i} className={styles.seg} data-alt={i % 2 === 1} data-done={done}>
                <span className={styles.segSym}>{seg.label}</span>
                <span className={styles.segBits}>
                  {[...seg.code].map((bit, j) => (
                    <span key={j} className={styles.bit} data-read={seg.start + j < pos} data-next={seg.start + j === pos}>
                      {bit}
                    </span>
                  ))}
                </span>
              </span>
            )
          })}
        </div>
        <div className={shared.group}>
          <button type="button" className={shared.btn} data-variant="primary" disabled={!built || pos >= trace.length} onClick={() => setDecodePos(pos + 1)}>
            Decode next bit
          </button>
          <button type="button" className={shared.btn} disabled={!built || pos >= trace.length} onClick={() => setDecodePos(nextSymbolEnd())}>
            Decode next symbol
          </button>
          <button type="button" className={shared.btn} disabled={!built || pos >= trace.length} onClick={() => setDecodePos(trace.length)}>
            Decode all
          </button>
          <button type="button" className={shared.btn} disabled={pos === 0} onClick={() => setDecodePos(0)}>
            Restart decode
          </button>
        </div>
        <p className={styles.stage} data-testid="huff-decode-note">
          {built ? decodeNote(trace, pos, tree) : 'Finish the tree to decode: the decoder walks the finished tree.'}
        </p>
        <p className={styles.decoded} data-testid="huff-decoded" data-at-node={atNode ?? undefined}>
          <span className={styles.decodedLabel}>decoded</span> {decoded.length ? decoded.join(' ') : '…'}
          <span className={styles.decodedCount}>{` ${decoded.length} of ${message.length} symbols, ${pos} of ${encoded.bits.length} bits`}</span>
        </p>
      </section>

      <p className={shared.caption}>
        Moving one slider renormalizes the other three proportionally, so the table always sums to 100%. Entropy,
        the Huffman code for every symbol, and the average code length are all recomputed live from the current
        probabilities, not scripted. The tree is the same build that produces the codes, shown one merge at a time;
        on a tie, the node that was waiting longer is merged first. The {MESSAGE_LENGTH}-symbol message is made
        from the current probabilities (each symbol appears in proportion, rounded to whole symbols and spread out),
        so its bit count can differ slightly from {MESSAGE_LENGTH} times the Huffman average.
      </p>
    </Figure>
  )
}
