'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import ChoiceGroup from './ChoiceGroup'
import { useAnimationSpeedRef } from './animationSpeed'
import { usePacedInterval } from './usePacedInterval'
import {
  CHOICES,
  CLUSTERS,
  clusterOf,
  majorityOf,
  initialState,
  step,
  setLink,
  setChoice,
  setCluster,
  reset,
  isDone,
  hasConflict,
  sideServes,
} from './capTheoremData'
import { INK, FADE, ACCENT, OK, OK_BG, ERR_BG, AMBER_BG, AMBER_STROKE, RULE, PANEL, MUTED_BG, MONO } from './vizPalette'
import shared from './vizShared.module.css'
import { prefersReducedMotion } from './motion'
import styles from './CapTheoremViz.module.css'

const PLAY_MS = 1300

// Palette: shared tokens. ACCENT marks a partition, a refusal, or two serving
// copies that disagree; OK an agreed or replicated write; AMBER a write that
// left the copies disagreeing; the muted dashed style a node that is behind but
// refusing, so its old value can never be read.

// ── SVG geometry ────────────────────────────────────────────────────────────────
const VB_W = 460
const VB_H = 232

const OP_W = 58
const OP_H = 20
const OP_GAP = 8
const OP_Y = 20

const NODE_H = 58
const NODE_Y = 74
const LINK_Y = NODE_Y + NODE_H / 2
const SIDE_Y = NODE_Y + NODE_H + 15 // side labels under the nodes while partitioned

const CLIENT_W = 80
const CLIENT_H = 34
const CLIENT_Y = 178

const LAYOUT = {
  2: { w: 110, xs: [55, 295] },
  3: { w: 104, xs: [18, 178, 338] },
}

const opLabel = (op) => `${op.client} ${op.op === 'write' ? `w${op.value}` : 'r'}`

export default function CapTheoremViz() {
  const [state, setState] = useState(() => initialState())
  const [playing, setPlaying] = useState(false)
  const svgRef = useRef(null)

  const cluster = clusterOf(state.clusterId)
  const majority = majorityOf(cluster)
  const { w: NODE_W, xs } = LAYOUT[state.clusterId]
  const nodes = cluster.nodes.map((id, i) => {
    const x = xs[i]
    const sideIndex = cluster.sides.findIndex((s) => s.includes(id))
    return { id, x, cx: x + NODE_W / 2, sideIndex, serves: sideServes(state, sideIndex) }
  })
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const ops = cluster.ops
  const opX0 = (VB_W - (ops.length * OP_W + (ops.length - 1) * OP_GAP)) / 2
  const opX = (i) => opX0 + i * (OP_W + OP_GAP)

  const done = isDone(state)
  const isPlaying = playing && !done
  const conflict = hasConflict(state)
  const servingValues = new Set(nodes.filter((n) => n.serves).map((n) => state.values[n.id]))
  const servingDisagree = !state.linkHealthy && servingValues.size > 1

  const speedRef = useAnimationSpeedRef()
  usePacedInterval(isPlaying, PLAY_MS, () => setState((s) => (isDone(s) ? s : step(s))))

  // Cosmetic flourish only: pulse the elements marked data-pulse. No state change.
  useEffect(() => {
    if (!state.lastOp || !svgRef.current) return
    if (prefersReducedMotion()) return
    const els = Array.from(svgRef.current.querySelectorAll('[data-pulse]'))
    if (els.length === 0) return
    animate(els, { opacity: [0.4, 1], duration: 500 / speedRef.current, ease: 'outQuad' })
  }, [state.opIndex, state.lastOp, speedRef])

  const onStep = () => setState((s) => (isDone(s) ? s : step(s)))
  const doReset = () => {
    setPlaying(false)
    setState((s) => reset(s))
  }
  const toggleLink = () => setState((s) => setLink(s, !s.linkHealthy))
  const pickChoice = (c) => setState((s) => setChoice(s, c))
  const pickCluster = (id) => {
    setPlaying(false)
    setState((s) => setCluster(s, Number(id)))
  }

  const controls = [
    { label: 'Step', onClick: onStep, variant: 'primary', disabled: done },
    { label: isPlaying ? 'Pause' : 'Play', onClick: () => setPlaying((p) => !p), disabled: done },
    { label: 'Reset', onClick: doReset, disabled: state.opIndex === 0 && state.refused === 0 && state.diverged === 0 },
  ]

  const readouts = [
    ...cluster.nodes.map((id) => ({ label: `Node ${id} x`, value: state.values[id] })),
    { label: 'refused', value: state.refused },
    { label: 'divergences', value: state.diverged },
    { label: 'majority', value: `${majority} of ${cluster.nodes.length}` },
    { label: 'link', value: state.linkHealthy ? 'healthy' : 'partitioned' },
  ]

  const acting = state.lastOp ? state.lastOp.client : null

  // Links: every pair of nodes. Adjacent pairs are straight; in the three-node
  // cluster, A and C are joined by an arc over B.
  const links = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const cut = !state.linkHealthy && a.sideIndex !== b.sideIndex
      links.push({ a, b, cut, arc: j - i > 1 })
    }
  }
  const cutX = (() => {
    if (state.linkHealthy) return null
    const first = cluster.sides[0]
    const lastOfFirst = byId[first[first.length - 1]]
    const firstOfNext = byId[cluster.sides[1][0]]
    return (lastOfFirst.x + NODE_W + firstOfNext.x) / 2
  })()

  return (
    <Figure
      eyebrow="CAP theorem"
      title="Copies of one value, and a network that can fail"
      controls={controls}
      speedControl
      status={statusFor(state, conflict)}
      readouts={readouts}
      tryThis="Start with 2 nodes. Partition the network, prefer consistency and step: every operation is refused, because a majority of 2 is 2 and each side has only 1. Now switch to 3 nodes and run it again: Node C is cut off alone, but A and B are 2 of 3, a majority, so they keep serving while C refuses. Heal the network and C simply catches up. Then rerun with availability preferred: nothing is refused, C drifts to its own value, and healing leaves a conflict."
    >
      <ChoiceGroup
        label="cluster"
        options={CLUSTERS.map((c) => ({ id: String(c.id), label: c.label }))}
        value={String(state.clusterId)}
        onChange={pickCluster}
        testPrefix="cap-cluster"
      />

      {/* network toggle + partition-behaviour choice: real buttons, keyboard reachable */}
      <div className={shared.group}>
        <span className={shared.groupLabel}>network</span>
        <button type="button" className={shared.btn} aria-pressed={!state.linkHealthy} onClick={toggleLink}>
          {state.linkHealthy ? 'Network: healthy' : 'Network: partitioned'}
        </button>
        <span className={shared.groupLabel} style={{ marginLeft: 8 }}>
          when partitioned
        </span>
        {CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={shared.btn}
            aria-pressed={state.choice === c.id}
            disabled={state.linkHealthy}
            onClick={() => pickChoice(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className={styles.rule} data-testid="cap-rule">
        {`Consistency rule: an operation succeeds only on a side holding a majority, ${majority} of ${cluster.nodes.length} nodes.`}
      </p>

      <div className={shared.scroll}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={styles.svg}
          role="img"
          aria-label={`CAP theorem, ${cluster.nodes.length} nodes, ${state.linkHealthy ? 'healthy network' : `partitioned, preferring ${state.choice === 'C' ? 'consistency' : 'availability'}`}. ${cluster.nodes.map((id) => `Node ${id} has x=${state.values[id]}`).join(', ')}. ${state.refused} refused, ${state.diverged} divergences.`}
        >
          {/* ── OPERATION SEQUENCE ─────────────────────────────────────────── */}
          <text x={opX0} y={10} fontSize={8.5} fill={FADE} fontFamily={MONO} letterSpacing="0.12em">
            OPERATIONS (w = write, r = read)
          </text>
          {ops.map((op, i) => {
            const executed = i < state.opIndex
            const current = i === state.opIndex - 1
            let bg = '#ffffff'
            let stroke = RULE
            if (current && state.lastOp) {
              if (state.lastOp.outcome === 'refused') {
                bg = ERR_BG
                stroke = ACCENT
              } else if (state.lastOp.diverged) {
                bg = AMBER_BG
                stroke = AMBER_STROKE
              } else {
                bg = OK_BG
                stroke = OK
              }
            }
            return (
              <g key={`op-${i}`} opacity={executed && !current ? 0.35 : 1}>
                <rect x={opX(i)} y={OP_Y} width={OP_W} height={OP_H} rx={5} fill={bg} stroke={stroke} strokeWidth={current ? 1.8 : 1} />
                <text x={opX(i) + OP_W / 2} y={OP_Y + OP_H / 2 + 3.5} fontSize={11} fill={INK} fontFamily={MONO} fontWeight={op.op === 'write' ? 700 : 400} textAnchor="middle">
                  {opLabel(op)}
                </text>
              </g>
            )
          })}

          {/* ── LINKS ──────────────────────────────────────────────────────── */}
          {links.map(({ a, b, cut, arc }) => {
            const stroke = cut ? ACCENT : FADE
            const dash = cut ? '4 3' : undefined
            const carried = state.lastOp && state.lastOp.wroteTo.includes(a.id) && state.lastOp.wroteTo.includes(b.id)
            if (arc) {
              const peak = NODE_Y - 16
              return (
                <g key={`link-${a.id}${b.id}`}>
                  <path d={`M ${a.cx} ${NODE_Y} Q ${(a.cx + b.cx) / 2} ${peak - 16} ${b.cx} ${NODE_Y}`} fill="none" stroke={stroke} strokeWidth={1.2} strokeDasharray={dash} />
                  {carried && <Token x={(a.cx + b.cx) / 2} y={peak - 1} value={state.lastOp.value} />}
                </g>
              )
            }
            const x1 = a.x + NODE_W
            const x2 = b.x
            const mx = (x1 + x2) / 2
            return (
              <g key={`link-${a.id}${b.id}`}>
                <line x1={x1} y1={LINK_Y} x2={x2} y2={LINK_Y} stroke={stroke} strokeWidth={1.4} strokeDasharray={dash} />
                {carried && <Token x={mx} y={LINK_Y} value={state.lastOp.value} />}
              </g>
            )
          })}

          {/* the partition itself: one cut between the two sides */}
          {cutX !== null && (
            <g data-testid="cap-cut">
              <line x1={cutX} y1={OP_Y + OP_H + 6} x2={cutX} y2={SIDE_Y + 4} stroke={ACCENT} strokeWidth={1.4} strokeDasharray="2 3" />
              <text x={cutX} y={LINK_Y + 4} fontSize={13} fill={ACCENT} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                &#215;
              </text>
            </g>
          )}

          {/* ── NODES ──────────────────────────────────────────────────────── */}
          {nodes.map((n) => {
            const v = state.values[n.id]
            const behind = !state.linkHealthy && !n.serves && servingValues.size > 0 && !servingValues.has(v)
            const hot = (conflict && new Set(Object.values(state.values)).size > 1) || (servingDisagree && n.serves)
            let fill = PANEL
            let stroke = RULE
            let dash
            if (hot) {
              fill = ERR_BG
              stroke = ACCENT
            } else if (behind) {
              fill = MUTED_BG
              stroke = FADE
              dash = '3 2'
            }
            let tag = null
            if (!state.linkHealthy) tag = n.serves ? 'serving' : 'refusing'
            return (
              <g key={`node-${n.id}`} data-testid={`cap-node-${n.id}`} data-serves={n.serves ? 'true' : 'false'} data-behind={behind ? 'true' : 'false'}>
                <rect data-pulse={acting === n.id || undefined} x={n.x} y={NODE_Y} width={NODE_W} height={NODE_H} rx={8} fill={fill} stroke={stroke} strokeWidth={hot ? 1.5 : 1} strokeDasharray={dash} />
                <text x={n.x + 10} y={NODE_Y + 15} fontSize={9.5} fill={INK} fontFamily={MONO} fontWeight={700}>
                  {`NODE ${n.id}`}
                </text>
                {tag && (
                  <text x={n.x + NODE_W - 8} y={NODE_Y + 15} fontSize={8} fill={n.serves ? OK : ACCENT} fontFamily={MONO} textAnchor="end">
                    {tag}
                  </text>
                )}
                <text x={n.cx} y={NODE_Y + 42} fontSize={20} fill={hot ? ACCENT : behind ? FADE : INK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                  {`x = ${v}`}
                </text>
                {behind && (
                  <text x={n.cx} y={NODE_Y + 53} fontSize={8} fill={FADE} fontFamily={MONO} textAnchor="middle">
                    behind, never read
                  </text>
                )}
              </g>
            )
          })}

          {/* side labels while partitioned: how many nodes each side holds */}
          {!state.linkHealthy &&
            cluster.sides.map((side, si) => {
              const left = byId[side[0]].x
              const right = byId[side[side.length - 1]].x + NODE_W
              const hasMajority = side.length >= majority
              return (
                <text key={`side-${si}`} x={(left + right) / 2} y={SIDE_Y} fontSize={8.5} fill={hasMajority ? OK : FADE} fontFamily={MONO} textAnchor="middle">
                  {`${side.length} of ${cluster.nodes.length}: ${hasMajority ? 'a majority' : 'no majority'}`}
                </text>
              )
            })}

          {/* ── CLIENTS ────────────────────────────────────────────────────── */}
          {nodes.map((n) => {
            const isActing = acting === n.id
            const refused = isActing && state.lastOp.outcome === 'refused'
            const cx = n.cx
            return (
              <g key={`client-${n.id}`}>
                <line x1={cx} y1={CLIENT_Y} x2={cx} y2={NODE_Y + NODE_H} stroke={RULE} strokeWidth={1} />
                <rect
                  data-pulse={isActing || undefined}
                  x={cx - CLIENT_W / 2}
                  y={CLIENT_Y}
                  width={CLIENT_W}
                  height={CLIENT_H}
                  rx={6}
                  fill={refused ? ERR_BG : '#ffffff'}
                  stroke={refused ? ACCENT : isActing ? INK : RULE}
                  strokeWidth={isActing ? 1.6 : 1}
                />
                <text x={cx} y={CLIENT_Y + 14} fontSize={9} fill={INK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
                  {`CLIENT ${n.id}`}
                </text>
                <text x={cx} y={CLIENT_Y + 26} fontSize={8.5} fill={refused ? ACCENT : FADE} fontFamily={MONO} textAnchor="middle">
                  {isActing ? clientLine(state.lastOp) : 'idle'}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <p className={shared.caption}>
        A small model: one key x, copied on every node, and a write reaches every node it can while the network allows.
        Preferring consistency here means a majority rule: only a side holding more than half the nodes may serve, so at
        most one side ever does. Real systems add asynchronous replication, leader election and finer consistency
        levels, and must resolve the conflict two serving sides leave behind. Every count above is read from the
        simulation, not typed in.
      </p>
    </Figure>
  )
}

function Token({ x, y, value }) {
  return (
    <g data-pulse>
      <rect x={x - 13} y={y - 9} width={26} height={18} rx={4} fill={OK_BG} stroke={OK} strokeWidth={1.3} />
      <text x={x} y={y + 3.5} fontSize={9.5} fill={OK} fontFamily={MONO} fontWeight={700} textAnchor="middle">
        {`x=${value}`}
      </text>
    </g>
  )
}

function clientLine(lastOp) {
  if (!lastOp) return 'idle'
  if (lastOp.op === 'write') return lastOp.outcome === 'refused' ? 'write refused' : `wrote x=${lastOp.value}`
  return lastOp.outcome === 'refused' ? 'read refused' : `read x=${lastOp.returned}`
}

const list = (ids) => (ids.length <= 1 ? ids.join('') : `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`)

function statusFor(state, conflict) {
  const cluster = clusterOf(state.clusterId)
  const n = cluster.nodes.length
  const majority = majorityOf(cluster)
  const { lastOp, lastHeal } = state

  if (conflict) {
    const vals = cluster.nodes.map((id) => `Node ${id} has x=${state.values[id]}`).join(', ')
    return `Network restored, but ${vals}: two sides both accepted writes while cut off. The system must now reconcile them; resolving that conflict is out of scope here.`
  }
  if (lastHeal && !lastOp) {
    if (lastHeal.outcome === 'caught-up') {
      return `Network restored. Only one side accepted writes while cut off, so the others simply catch up: every node now has x=${lastHeal.value}. No conflict.`
    }
    return `Network restored. No two sides accepted different writes, so every node agrees (x=${lastHeal.value}).`
  }
  if (!lastOp) {
    if (state.linkHealthy) {
      return 'Healthy network. Step through the sequence: with every node reachable you get both consistency and availability. The theorem is about what happens when the network breaks.'
    }
    if (state.choice === 'A') return 'Partitioned, preferring availability: every side serves on its own. Step to see the price.'
    const majoritySide = cluster.sides.find((s) => s.length >= majority)
    if (!majoritySide) {
      return `Partitioned, preferring consistency. A majority of ${n} nodes is ${majority}, and each side has only 1, so no side may serve: everything will be refused.`
    }
    const minority = cluster.sides.filter((s) => s !== majoritySide).flat()
    return `Partitioned, preferring consistency. Nodes ${list(majoritySide)} still reach each other: ${majoritySide.length} of ${n}, a majority, so they keep serving. Node ${list(minority)} is alone and refuses.`
  }

  const who = `Client ${lastOp.client}`
  switch (lastOp.outcome) {
    case 'replicated':
      return `${who} wrote x=${lastOp.value}. It reached every node, so they all agree.`
    case 'agree':
      return `${who} read x=${lastOp.returned}. Every node agrees.`
    case 'refused': {
      const side = cluster.sides.find((s) => s.includes(lastOp.client))
      return `${who}'s ${lastOp.op} was refused: Node ${lastOp.client} is on a side with ${side.length} of ${n} nodes, short of the ${majority} a majority needs.`
    }
    case 'served': {
      const side = cluster.sides.find((s) => s.includes(lastOp.client))
      const inMajority = state.choice === 'C'
      if (lastOp.op === 'write') {
        const where = side.length > 1 ? `Nodes ${list(side)}` : `Node ${lastOp.client} only`
        if (inMajority) {
          return `${who} wrote x=${lastOp.value} to ${where}, a majority (${side.length} of ${n}). The cut-off node falls behind, but it is refusing, so its old value is never read.`
        }
        return lastOp.diverged
          ? `${who} wrote x=${lastOp.value} to ${where}. The other side cannot hear about it: the two sides now hold different values.`
          : `${who} wrote x=${lastOp.value} to ${where}. For now the serving sides happen to agree.`
      }
      if (inMajority) return `${who} read x=${lastOp.returned} from the majority side: the latest acknowledged write.`
      return lastOp.diverged
        ? `${who} read x=${lastOp.returned} from Node ${lastOp.client}. The other side holds a different value, so the two sides give different answers.`
        : `${who} read x=${lastOp.returned} from Node ${lastOp.client}. The serving sides happen to agree right now.`
    }
    default:
      return ''
  }
}
