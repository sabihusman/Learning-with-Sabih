'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Figure from './Figure'
import { WORDS, nearestNeighbors } from './embeddingsData'

// three.js / R3F load ONLY here, client-side, on this route. ssr:false keeps the
// 3D scene out of the static export and out of every other page's bundle. The
// loading placeholder reserves the same height so the layout does not jump.
const EmbeddingsScene = dynamic(() => import('./EmbeddingsScene'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 440,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#9b9892',
      }}
    >
      Loading 3D scene…
    </div>
  ),
})

const labelOf = (id) => WORDS.find((w) => w.id === id)?.label ?? id

export default function EmbeddingsViz() {
  const [selected, setSelected] = useState(null)

  const neighbors = useMemo(() => (selected ? nearestNeighbors(selected, 3) : []), [selected])
  const neighborIds = neighbors.map((n) => n.id)

  const controls = [
    { label: 'Clear selection', onClick: () => setSelected(null), disabled: !selected },
  ]

  const readouts = [
    { label: 'words', value: WORDS.length },
    { label: 'selected', value: selected ? labelOf(selected) : '—' },
    { label: 'nearest 3', value: selected ? neighbors.map((n) => labelOf(n.id)).join(', ') : '—' },
  ]

  const status = selected ? `Nearest to "${labelOf(selected)}"` : 'Click a word to find its neighbors'

  return (
    <Figure
      eyebrow="Representation"
      title="Words as points in space"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Drag to orbit the cloud and scroll to zoom. Click any word to draw lines to its three nearest neighbors. Notice they are always its own cluster: king pulls in queen, prince, and princess, never car or banana. That is the whole idea of an embedding: closeness in space means closeness in meaning."
    >
      <EmbeddingsScene selected={selected} neighborIds={neighborIds} onSelect={setSelected} />
    </Figure>
  )
}
