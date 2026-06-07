'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Figure from './Figure'
import { WORDS, SENTENCE, topLinks } from './attentionData'

// three.js / R3F load ONLY here, client-side, on this route. ssr:false keeps the
// 3D scene out of the static export and out of every other page's bundle. The
// loading placeholder reserves the same height so the layout does not jump.
const AttentionScene = dynamic(() => import('./AttentionScene'), {
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

export default function AttentionViz() {
  const [selected, setSelected] = useState(null)

  const links = selected != null ? topLinks(selected, 3) : []

  const controls = [{ label: 'Clear selection', onClick: () => setSelected(null), disabled: selected == null }]

  const readouts = [
    { label: 'words', value: WORDS.length },
    { label: 'selected', value: selected != null ? labelOf(selected) : '—' },
    {
      label: 'top links',
      value: selected != null ? links.map((l) => `${labelOf(l.id)} ${l.weight.toFixed(2)}`).join(', ') : '—',
    },
  ]

  const status = selected != null ? `Attention from "${labelOf(selected)}"` : 'Click a word to see what it attends to'

  return (
    <Figure
      eyebrow="Transformers"
      title={`Attention in "${SENTENCE.join(' ')}"`}
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis={
        'Drag to orbit the sentence and scroll to zoom. Click a word to draw its attention links to the rest; thicker and brighter links mean stronger attention. Click "it" and watch the strongest link reach back to "animal", the thing "it" refers to. These weights are hand-set to show the idea, not computed.'
      }
    >
      <AttentionScene selected={selected} onSelect={setSelected} />
    </Figure>
  )
}
