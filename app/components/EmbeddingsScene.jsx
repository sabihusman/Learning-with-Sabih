'use client'

// The ONLY module that imports three.js / R3F / drei. It is loaded via
// next/dynamic({ ssr: false }) from EmbeddingsViz, so three.js is code-split into
// this route's client chunk: it never enters another page's bundle and never runs
// during the static export.

import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text, Billboard, Line } from '@react-three/drei'
import { WORDS, ACCENT, INK, FADE, PAPER } from './embeddingsData'

const byId = (id) => WORDS.find((w) => w.id === id)

function WordPoint({ word, state, onSelect }) {
  const [hovered, setHovered] = useState(false)
  // state: 'selected' | 'neighbor' | 'dim' | 'normal'
  const radius = state === 'selected' ? 0.3 : state === 'neighbor' ? 0.22 : 0.16
  const color = state === 'selected' || state === 'neighbor' ? ACCENT : INK
  const opacity = state === 'dim' ? 0.25 : 1
  const labelColor = state === 'dim' ? FADE : state === 'selected' || state === 'neighbor' ? ACCENT : INK

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
        <sphereGeometry args={[hovered && state !== 'selected' ? radius * 1.25 : radius, 24, 24]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} roughness={0.5} metalness={0.05} />
      </mesh>

      <Billboard position={[0, radius + 0.32, 0]}>
        <Text
          fontSize={0.42}
          color={labelColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor={PAPER}
          fillOpacity={opacity}
        >
          {word.label}
        </Text>
      </Billboard>
    </group>
  )
}

export default function EmbeddingsScene({ selected, neighborIds, onSelect }) {
  const neighborSet = new Set(neighborIds)
  const sel = selected ? byId(selected) : null

  const stateFor = (id) => {
    if (!selected) return 'normal'
    if (id === selected) return 'selected'
    if (neighborSet.has(id)) return 'neighbor'
    return 'dim'
  }

  return (
    <div style={{ height: 440, width: '100%' }}>
      <Canvas
        camera={{ position: [7, 4.5, 12], fov: 45 }}
        dpr={[1, 2]}
        onPointerMissed={() => onSelect(null)}
      >
        <color attach="background" args={[PAPER]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[6, 9, 7]} intensity={0.7} />

        {/* neighbour links from the selected word to its nearest points */}
        {sel &&
          neighborIds.map((nid) => {
            const n = byId(nid)
            return n ? <Line key={nid} points={[sel.pos, n.pos]} color={ACCENT} lineWidth={2} /> : null
          })}

        {WORDS.map((w) => (
          <WordPoint key={w.id} word={w} state={stateFor(w.id)} onSelect={onSelect} />
        ))}

        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom
          enableRotate
          minDistance={6}
          maxDistance={28}
        />
      </Canvas>
    </div>
  )
}
