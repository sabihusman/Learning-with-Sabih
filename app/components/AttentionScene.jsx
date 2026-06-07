'use client'

// The ONLY module that imports three.js / R3F / drei. It is loaded via
// next/dynamic({ ssr: false }) from AttentionViz, so three.js is code-split into
// this route's client chunk: it never enters another page's bundle and never runs
// during the static export. (Same isolation as the embeddings topic.)

import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text, Billboard, Line } from '@react-three/drei'
import { WORDS, weightsFrom, ACCENT, INK, FADE, PAPER } from './attentionData'

const byId = (id) => WORDS.find((w) => w.id === id)

// interpolate between two hex colors by t in [0,1]
const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const FADE_RGB = hexToRgb(FADE)
const ACCENT_RGB = hexToRgb(ACCENT)
const lerpColor = (t) => {
  const c = FADE_RGB.map((a, i) => Math.round(a + (ACCENT_RGB[i] - a) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

// Sizing/coloring by selection state, pulled out of WordPoint so the styling is
// readable if/else instead of nested ternaries. The selected word is largest and
// accent; with a selection active, the others scale and tint by their weight.
function nodeRadius(selected, anySelected, weight) {
  if (selected) return 0.32
  if (anySelected) return 0.14 + weight * 0.16
  return 0.18
}

function nodeColor(selected, anySelected, weight) {
  if (selected) return ACCENT
  if (anySelected) return lerpColor(weight)
  return INK
}

function WordPoint({ word, selected, weight, anySelected, onSelect }) {
  const [hovered, setHovered] = useState(false)
  // when a word is selected, every other word is styled by how strongly the
  // selected word attends to it (weight). With nothing selected, all are neutral.
  const radius = nodeRadius(selected, anySelected, weight)
  const color = nodeColor(selected, anySelected, weight)
  const labelColor = nodeColor(selected, anySelected, weight)
  const labelOpacity = selected || !anySelected ? 1 : 0.35 + weight * 0.65

  return (
    <group position={word.pos}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onSelect(word.id)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <sphereGeometry args={[hovered && !selected ? radius * 1.25 : radius, 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
      </mesh>

      <Billboard position={[0, radius + 0.34, 0]}>
        <Text
          fontSize={0.46}
          color={labelColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor={PAPER}
          fillOpacity={labelOpacity}
        >
          {word.label}
        </Text>
      </Billboard>
    </group>
  )
}

export default function AttentionScene({ selected, onSelect }) {
  const sel = selected != null ? byId(selected) : null
  const weights = selected != null ? weightsFrom(selected) : {}

  return (
    <div style={{ height: 440, width: '100%' }}>
      <Canvas camera={{ position: [0, 2.2, 15], fov: 45 }} dpr={[1, 2]} onPointerMissed={() => onSelect(null)}>
        <color attach="background" args={[PAPER]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 9, 7]} intensity={0.7} />

        {/* attention links from the selected word; thicker + brighter = stronger */}
        {sel &&
          WORDS.filter((w) => w.id !== selected).map((w) => {
            const wt = weights[w.id] ?? 0
            if (wt < 0.05) return null
            return (
              <Line
                key={w.id}
                points={[sel.pos, w.pos]}
                color={lerpColor(wt)}
                lineWidth={1 + wt * 5}
                transparent
                opacity={0.3 + wt * 0.7}
              />
            )
          })}

        {WORDS.map((w) => (
          <WordPoint
            key={w.id}
            word={w}
            selected={selected === w.id}
            weight={weights[w.id] ?? 0}
            anySelected={selected != null}
            onSelect={onSelect}
          />
        ))}

        <OrbitControls makeDefault enablePan={false} enableZoom enableRotate minDistance={7} maxDistance={30} />
      </Canvas>
    </div>
  )
}
