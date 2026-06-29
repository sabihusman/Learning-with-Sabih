'use client'

import { useEffect, useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './GraphTraversalViz.module.css'
import { NODES, EDGES, NODE_IDS, nodePos, buildAdjacency, GRAPH_VIEWBOX } from './graphData'

const PLAY_MS = 700
const ADJ = buildAdjacency()

// Real, deterministic BFS/DFS over the shared graph. Both use the SAME loop and differ
// only in the frontier data structure: BFS dequeues the front (FIFO queue), DFS pops the
// top (LIFO stack). Nodes are discovered (added to the frontier) once, in the fixed
// alphabetical neighbour order, so the visit order is reproducible. Returns one frame per
// step: frame 0 has just the start in the frontier; frame k is the state after k visits.
function buildTrace(algo, start) {
  const discovered = new Set([start])
  const frontier = [start]
  const order = new Map()
  const frames = [{ order: new Map(), current: null, frontier: [...frontier] }]
  while (frontier.length) {
    const node = algo === 'bfs' ? frontier.shift() : frontier.pop()
    order.set(node, order.size + 1)
    const neighbours = algo === 'bfs' ? ADJ[node] : [...ADJ[node]].reverse()
    for (const nb of neighbours) {
      if (!discovered.has(nb)) {
        discovered.add(nb)
        frontier.push(nb)
      }
    }
    frames.push({ order: new Map(order), current: node, frontier: [...frontier] })
  }
  return frames
}

const NODE_FILL = { plain: '#fffefb', frontier: '#f0d49a', visited: '#3f7d68', current: '#c0392b' }
const NODE_STROKE = { plain: '#9b9892', frontier: '#c8922e', visited: '#3f7d68', current: '#c0392b' }
const R = 17

export default function GraphTraversalViz() {
  const [algo, setAlgo] = useState('bfs')
  const [start, setStart] = useState('A')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const frames = useMemo(() => buildTrace(algo, start), [algo, start])
  const total = frames.length - 1 // number of visits
  const f = frames[step]
  const done = step >= total
  const isPlaying = playing && !done

  // Auto-advance with setInterval (never requestAnimationFrame) so it keeps progressing
  // in a backgrounded tab. Keyed on `done` so it tears down at the end and on `total` so
  // it rebinds when the algorithm or start node changes; no setState in the effect body.
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
  const selectAlgo = (a) => {
    if (a === algo) return
    setPlaying(false)
    setStep(0)
    setAlgo(a)
  }
  const selectStart = (id) => {
    setPlaying(false)
    setStep(0)
    setStart(id)
  }

  const order = f.order
  const visitedCount = order.size
  const frontier = f.frontier
  const sequence = [...order.entries()].sort((a, b) => a[1] - b[1]).map((e) => e[0])

  const nodeState = (id) => {
    if (f.current === id) return 'current'
    if (order.has(id)) return 'visited'
    if (frontier.includes(id)) return 'frontier'
    return 'plain'
  }

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 },
  ]

  const readouts = [
    { label: 'algorithm', value: algo === 'bfs' ? 'BFS (queue)' : 'DFS (stack)' },
    { label: 'step', value: `${visitedCount} / ${total}` },
    { label: 'frontier', value: frontier.length },
  ]

  const status =
    visitedCount === 0
      ? `Start at ${start}. Step to run ${algo === 'bfs' ? 'breadth-first' : 'depth-first'} search.`
      : `Visited: ${sequence.join(', ')}${done ? ' (done)' : ''}`

  const isStack = algo === 'dfs'
  // for the panel: queue shows front-first; stack shows top-first (top = last pushed)
  const panelItems = isStack ? [...frontier].reverse() : [...frontier]

  return (
    <Figure
      eyebrow="Graphs"
      title="Graph traversal"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Pick BFS or DFS, click a node to start, and step. Watch the side panel: BFS drives the visits with a queue (first in, first out), DFS with a stack (last in, first out). That single choice is the whole difference. Run both from the same start and compare the visit-order numbers filling the nodes: BFS fans out level by level, DFS dives down one path before backtracking."
    >
      <div className={styles.algoToggle} role="group" aria-label="Traversal algorithm">
        {[['bfs', 'BFS'], ['dfs', 'DFS']].map(([k, label]) => (
          <button key={k} type="button" className={`${styles.algoBtn} ${k === algo ? styles.algoActive : ''}`} aria-pressed={k === algo} onClick={() => selectAlgo(k)}>
            {label}
          </button>
        ))}
        <span className={styles.startHint}>start: click a node</span>
      </div>

      <div className={styles.layout}>
        <div className={styles.graphWrap}>
          <svg viewBox={`0 0 ${GRAPH_VIEWBOX.width} ${GRAPH_VIEWBOX.height}`} className={styles.svg} role="img" aria-label={`Graph of ${NODES.length} nodes; ${algo === 'bfs' ? 'breadth' : 'depth'}-first traversal from ${start}`}>
            {EDGES.map(({ from, to }, i) => {
              const a = nodePos(from)
              const b = nodePos(to)
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d8d4cc" strokeWidth={1.5} />
            })}
            {NODES.map((n) => {
              const st = nodeState(n.id)
              const visitNum = order.get(n.id)
              return (
                <g key={n.id} className={styles.node} onClick={() => selectStart(n.id)} style={{ cursor: 'pointer' }}>
                  <circle cx={n.x} cy={n.y} r={R} fill={NODE_FILL[st]} stroke={st === 'plain' && n.id === start ? '#c0392b' : NODE_STROKE[st]} strokeWidth={st === 'plain' && n.id === start ? 2.5 : st === 'plain' ? 1.5 : 2.5} />
                  <text x={n.x} y={n.y + 4} className={styles.nodeLabel} fill={st === 'visited' || st === 'current' ? '#ffffff' : '#1a1a1a'} textAnchor="middle">
                    {visitNum != null ? visitNum : n.id}
                  </text>
                  {visitNum != null && (
                    <text x={n.x + R - 1} y={n.y - R + 3} className={styles.nodeTag} textAnchor="middle">{n.id}</text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelLabel}>{isStack ? 'Stack (LIFO)' : 'Queue (FIFO)'}</div>
          <div className={`${styles.frontier} ${isStack ? styles.stack : styles.queue}`}>
            {panelItems.length === 0 ? (
              <div className={styles.frontierEmpty}>empty</div>
            ) : (
              panelItems.map((id, i) => (
                <div key={id} className={`${styles.frontierItem} ${i === 0 ? styles.frontierHead : ''}`}>
                  {id}
                  {i === 0 && <span className={styles.headTag}>{isStack ? 'top' : 'front'}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <p className={styles.caption}>
        Both traversals are real and deterministic, run on one shared graph with a fixed neighbour order, and the panel
        shows the actual queue or stack contents. The graph is kept small for clarity; real graphs are far larger.
      </p>
    </Figure>
  )
}
