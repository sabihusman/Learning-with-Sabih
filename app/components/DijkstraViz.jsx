'use client'

import { useEffect, useMemo, useState } from 'react'
import Figure from './Figure'
import styles from './DijkstraViz.module.css'
import { NODES, EDGES, NODE_IDS, nodePos, GRAPH_VIEWBOX } from './graphData'

const PLAY_MS = 650
const R = 18

// Weighted adjacency built from the shared graph's edges (graphData.js is untouched).
// Neighbours are kept in a fixed alphabetical order so relaxation, and therefore the
// whole run, is deterministic.
const ADJ = (() => {
  const a = {}
  NODE_IDS.forEach((id) => {
    a[id] = []
  })
  for (const { from, to, weight } of EDGES) {
    a[from].push({ to, w: weight })
    a[to].push({ to: from, w: weight })
  }
  NODE_IDS.forEach((id) => a[id].sort((x, y) => (x.to < y.to ? -1 : 1)))
  return a
})()

const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`)
const fmt = (d) => (d === Infinity ? '∞' : String(d))

// Real, deterministic Dijkstra, run to completion from `source`. Emits one frame per
// action: finalize the nearest unfinalized node (alphabetical tie-break), then relax
// each of its unfinalized edges one at a time. The predecessor map is computed for the
// final path highlight but never shown on screen as raw data.
function buildDijkstra(source) {
  const dist = new Map(NODE_IDS.map((id) => [id, id === source ? 0 : Infinity]))
  const pred = new Map()
  const finalized = new Set()
  const snap = (current, relaxEdge, relaxResult, note) => ({
    dist: new Map(dist),
    finalized: new Set(finalized),
    current,
    relaxEdge,
    relaxResult,
    note,
  })
  const frames = [snap(null, null, null, `Source ${source} is 0, every other node is infinity. Step to run.`)]
  while (finalized.size < NODE_IDS.length) {
    let u = null
    let best = Infinity
    for (const id of NODE_IDS) {
      if (!finalized.has(id) && dist.get(id) < best) {
        best = dist.get(id)
        u = id
      }
    }
    if (u === null) break // remaining nodes unreachable (the shared graph is connected, so this will not happen)
    finalized.add(u)
    frames.push(snap(u, null, null, `Finalize ${u} at distance ${fmt(dist.get(u))} (the nearest unfinalized node).`))
    for (const { to, w } of ADJ[u]) {
      if (finalized.has(to)) continue
      const nd = dist.get(u) + w
      const prev = dist.get(to)
      if (nd < prev) {
        dist.set(to, nd)
        pred.set(to, u)
        frames.push(snap(u, [u, to], 'updated', `Relax ${u}-${to}: ${fmt(prev)} to ${nd}, a cheaper route through ${u}.`))
      } else {
        frames.push(snap(u, [u, to], 'nochange', `Relax ${u}-${to}: ${nd} is not cheaper, ${to} stays ${fmt(prev)}.`))
      }
    }
  }
  frames.push(snap(null, null, null, 'All nodes finalized. Click any node to trace its shortest path from the source.'))
  return { frames, dist, pred }
}

export default function DijkstraViz() {
  const [source, setSource] = useState('A')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [target, setTarget] = useState(null)

  const { frames, dist: finalDist, pred } = useMemo(() => buildDijkstra(source), [source])
  const total = frames.length - 1
  const f = frames[step]
  const done = step >= total
  const isPlaying = playing && !done

  // Auto-advance with setInterval (never requestAnimationFrame) so it keeps progressing
  // in a backgrounded tab. Keyed on `done` so it tears down at the end and on `total` so
  // it rebinds when the source changes; no setState in the effect body.
  useEffect(() => {
    if (!playing || done) return undefined
    const id = setInterval(() => setStep((s) => Math.min(total, s + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, done, total])

  const onStep = () => setStep((s) => Math.min(total, s + 1))
  const reset = () => {
    setPlaying(false)
    setStep(0)
    setTarget(null)
  }
  const selectSource = (id) => {
    setPlaying(false)
    setStep(0)
    setTarget(null)
    setSource(id)
  }
  const onNodeClick = (id) => {
    if (done) setTarget(id)
    else selectSource(id)
  }

  // shortest-path highlight (only once the run is complete and a target is chosen)
  const pathNodes = []
  const pathEdges = new Set()
  if (done && target) {
    let cur = target
    pathNodes.unshift(cur)
    while (cur !== source && pred.has(cur)) {
      const p = pred.get(cur)
      pathEdges.add(edgeKey(p, cur))
      pathNodes.unshift(p)
      cur = p
    }
  }
  const pathNodeSet = new Set(pathNodes)

  const nodeFill = (id) => {
    if (pathNodeSet.has(id)) return '#2f8f63'
    if (f.current === id) return '#c0392b'
    if (f.finalized.has(id)) return '#3f7d68'
    if (f.dist.get(id) !== Infinity) return '#f0d49a'
    return '#fffefb'
  }
  const nodeText = (id) => (pathNodeSet.has(id) || f.current === id || f.finalized.has(id) ? '#ffffff' : '#1a1a1a')

  const edgeStroke = (a, b) => {
    if (pathEdges.has(edgeKey(a, b))) return { stroke: '#2f8f63', width: 3.5 }
    if (f.relaxEdge && edgeKey(f.relaxEdge[0], f.relaxEdge[1]) === edgeKey(a, b)) return { stroke: '#c0392b', width: 3 }
    return { stroke: '#d8d4cc', width: 1.5 }
  }

  const finalizedCount = f.finalized.size
  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: reset, disabled: step === 0 && target === null },
  ]
  const readouts = [
    { label: 'source', value: source },
    { label: 'finalized', value: `${finalizedCount} / ${NODE_IDS.length}` },
    { label: 'path cost', value: done && target ? fmt(finalDist.get(target)) : '-' },
  ]
  const status = done && target ? `Shortest path ${source} to ${target}: ${pathNodes.join(' → ')} (cost ${fmt(finalDist.get(target))})` : f.note

  return (
    <Figure
      eyebrow="Graphs"
      title="Dijkstra's shortest path"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Pick a source, then step. Each step finalizes the nearest unfinalized node and relaxes its edges, lowering a neighbour's tentative distance only when a cheaper route is found. The finalized set grows from the source outward. When every node is finalized, click any node to trace its shortest path back to the source and read its total cost."
    >
      <div className={styles.sourceRow}>
        <span className={styles.sourceLabel}>source</span>
        {NODE_IDS.map((id) => (
          <button key={id} type="button" className={`${styles.sourceBtn} ${id === source ? styles.sourceActive : ''}`} aria-pressed={id === source} onClick={() => selectSource(id)}>
            {id}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${GRAPH_VIEWBOX.width} ${GRAPH_VIEWBOX.height}`} className={styles.svg} role="img" aria-label={`Weighted graph; Dijkstra from ${source}`}>
        {EDGES.map(({ from, to }, i) => {
          const a = nodePos(from)
          const b = nodePos(to)
          const s = edgeStroke(from, to)
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={s.stroke} strokeWidth={s.width} className={styles.edge} />
        })}
        {EDGES.map(({ from, to, weight }, i) => {
          const a = nodePos(from)
          const b = nodePos(to)
          const mx = (a.x + b.x) / 2
          const my = (a.y + b.y) / 2
          return (
            <g key={`w${i}`}>
              <rect x={mx - 8} y={my - 8} width={16} height={15} rx={2} fill="#f7f6f2" opacity={0.92} />
              <text x={mx} y={my + 3} className={styles.weight} textAnchor="middle">{weight}</text>
            </g>
          )
        })}
        {NODES.map((n) => (
          <g key={n.id} onClick={() => onNodeClick(n.id)} style={{ cursor: 'pointer' }} className={styles.node}>
            <circle cx={n.x} cy={n.y} r={R} fill={nodeFill(n.id)} stroke={n.id === source ? '#c0392b' : '#9b9892'} strokeWidth={n.id === source ? 2.5 : 1.5} />
            <text x={n.x} y={n.y + 4} className={styles.dist} fill={nodeText(n.id)} textAnchor="middle">{fmt(f.dist.get(n.id))}</text>
            <text x={n.x} y={n.y - R - 3} className={styles.nodeTag} textAnchor="middle">{n.id}</text>
          </g>
        ))}
      </svg>

      <p className={styles.caption}>
        Every tentative distance, the growing finalized set, and the final path are computed for real by Dijkstra on the
        same graph from the previous topic, now using its edge weights. The graph is kept small for clarity; real graphs,
        like road networks, are far larger.
      </p>
    </Figure>
  )
}
