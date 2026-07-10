'use client'

import { useState } from 'react'
import Figure from './Figure'
import {
  RING_SIZE,
  ringPos,
  KEYS,
  NODES_BASE,
  NODE_D,
  assignments,
  remapOnChange,
  movedKeys,
  modNRemapOnChange,
} from './consistentHashingData'
import styles from './ConsistentHashingViz.module.css'

const NODE_COLORS = {
  'node-A': '#c0392b',
  'node-B': '#2f6f7e',
  'node-C': '#9a6b1f',
  'node-D': '#4a5db0',
}

const VB = 400
const CENTER = VB / 2
const R_NODE = 150
const R_KEY = 108

function pointAt(pos, r) {
  const angle = -Math.PI / 2 + (pos / RING_SIZE) * 2 * Math.PI
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) }
}

export default function ConsistentHashingViz() {
  const [hasFourthNode, setHasFourthNode] = useState(false)

  const nodesCurrent = hasFourthNode ? [...NODES_BASE, NODE_D] : NODES_BASE
  const assign = assignments(KEYS, nodesCurrent)
  const ringRemap = hasFourthNode ? remapOnChange(KEYS, NODES_BASE, nodesCurrent) : 0
  const modRemap = hasFourthNode ? modNRemapOnChange(KEYS, NODES_BASE.length, nodesCurrent.length) : 0
  const moved = hasFourthNode ? new Set(movedKeys(KEYS, NODES_BASE, nodesCurrent)) : new Set()

  const controls = [
    {
      label: hasFourthNode ? 'Remove node-D' : 'Add node-D',
      onClick: () => setHasFourthNode((v) => !v),
      variant: 'primary',
    },
  ]

  const status = hasFourthNode
    ? `node-D joined. The ring remapped ${ringRemap} of ${KEYS.length} keys; hash mod n would have remapped ${modRemap}.`
    : `${nodesCurrent.length} nodes hold ${KEYS.length} keys. Add node-D to see how few keys actually move.`

  const readouts = [
    { label: 'nodes', value: nodesCurrent.length },
    { label: 'keys', value: KEYS.length },
    { label: 'keys remapped (ring)', value: ringRemap },
    { label: 'keys remapped (hash mod n)', value: modRemap },
  ]

  return (
    <Figure
      eyebrow="Consistent Hashing"
      title="A ring, not a modulus"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Look at which node owns each key with three nodes. Add the fourth node and watch the two remap counts: the ring moves only the keys nearest the new node, while hash mod n would move almost all of them. Remove the node again and the ring returns to where it was."
    >
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        className={styles.svg}
        role="img"
        aria-label={`${nodesCurrent.length} nodes on a hash ring holding ${KEYS.length} keys. ${status}`}
      >
        <circle cx={CENTER} cy={CENTER} r={R_NODE} fill="none" stroke="#e2e0d8" strokeWidth={1} />
        <circle cx={CENTER} cy={CENTER} r={R_KEY} fill="none" stroke="#e2e0d8" strokeWidth={1} strokeDasharray="2 3" />

        {KEYS.map((key) => {
          const owner = assign[key]
          const color = NODE_COLORS[owner]
          const keyPoint = pointAt(ringPos(key), R_KEY)
          const nodePoint = pointAt(ringPos(owner), R_NODE)
          const isMoved = moved.has(key)
          return (
            <g key={key}>
              <line
                x1={keyPoint.x}
                y1={keyPoint.y}
                x2={nodePoint.x}
                y2={nodePoint.y}
                stroke={color}
                strokeWidth={isMoved ? 1.6 : 0.6}
                strokeOpacity={isMoved ? 0.85 : 0.35}
              />
              <circle
                cx={keyPoint.x}
                cy={keyPoint.y}
                r={isMoved ? 5.5 : 4}
                fill={color}
                stroke="#ffffff"
                strokeWidth={isMoved ? 1.6 : 1}
              />
            </g>
          )
        })}

        {nodesCurrent.map((node) => {
          const p = pointAt(ringPos(node), R_NODE)
          const color = NODE_COLORS[node]
          const labelR = R_NODE + 22
          const labelPoint = pointAt(ringPos(node), labelR)
          return (
            <g key={node}>
              <circle cx={p.x} cy={p.y} r={9} fill={color} stroke="#ffffff" strokeWidth={2} />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                fontSize={11}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                fontWeight={700}
                fill={color}
                textAnchor="middle"
              >
                {node}
              </text>
            </g>
          )
        })}
      </svg>

      <p className={styles.caption}>
        Every key and node position is the real FNV-1a hash of its name, taken mod
        {` ${RING_SIZE}`}. Ownership walks clockwise from a key to the next node,
        wrapping to the lowest-positioned node past the end. Highlighted keys are
        the ones that actually changed owner when node-D joined.
      </p>
    </Figure>
  )
}
