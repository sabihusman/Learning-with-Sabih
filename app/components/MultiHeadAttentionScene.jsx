'use client'

// The ONLY module in this topic that imports three.js / R3F / drei. It is loaded via
// next/dynamic({ ssr: false }) from TransformersViz, so three.js is code-split into
// this route's client chunk: it never enters another page's bundle and never runs
// during the static export. (Same isolation as the attention and embeddings topics.)

import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text, Billboard, Line } from '@react-three/drei'
import { WORDS, weightsFor, INK, FADE, PAPER } from './transformerData'

const byId = (id) => WORDS.find((w) => w.id === id)

// interpolate from FADE toward a target rgb by t in [0,1]
const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const FADE_RGB = hexToRgb(FADE)
const lerpColor = (t, rgb) => {
  const c = FADE_RGB.map((a, i) => Math.round(a + (rgb[i] - a) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

// Sizing/coloring by selection state. The selected word is largest and in the head's
// colour; with a selection active, the others scale and tint by their weight.
function nodeRadius(selected, anySelected, weight) {
  if (selected) return 0.32
  if (anySelected) return 0.14 + weight * 0.16
  return 0.18
}

function nodeColor(selected, anySelected, weight, headRgb) {
  if (selected) return `rgb(${headRgb[0]},${headRgb[1]},${headRgb[2]})`
  if (anySelected) return lerpColor(weight, headRgb)
  return INK
}

function WordPoint({ word, selected, weight, anySelected, headRgb, onSelect }) {
  const [hovered, setHovered] = useState(false)
  const radius = nodeRadius(selected, anySelected, weight)
  const color = nodeColor(selected, anySelected, weight, headRgb)
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
          color={color}
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

export default function MultiHeadAttentionScene({ head, selected, onSelect }) {
  const sel = selected != null ? byId(selected) : null
  const weights = selected != null ? weightsFor(head, selected) : {}
  const headRgb = hexToRgb(head.color)

  return (
    <div style={{ height: 440, width: '100%' }}>
      <Canvas camera={{ position: [0, 2.2, 15], fov: 45 }} dpr={[1, 2]} onPointerMissed={() => onSelect(null)}>
        <color attach="background" args={[PAPER]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 9, 7]} intensity={0.7} />

        {/* links for the active head only, from the selected word */}
        {sel &&
          WORDS.filter((w) => w.id !== selected).map((w) => {
            const wt = weights[w.id] ?? 0
            if (wt < 0.05) return null
            return (
              <Line
                key={w.id}
                points={[sel.pos, w.pos]}
                color={lerpColor(wt, headRgb)}
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
            headRgb={headRgb}
            onSelect={onSelect}
          />
        ))}

        <OrbitControls makeDefault enablePan={false} enableZoom enableRotate minDistance={7} maxDistance={30} />
      </Canvas>
    </div>
  )
}
