'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Figure from './Figure'
import { WORDS, SENTENCE, HEADS, topLinks } from './transformerData'

// three.js / R3F load ONLY here, client-side, on this route. ssr:false keeps the
// 3D scene out of the static export and out of every other page's bundle. The
// loading placeholder reserves the same height so the layout does not jump.
const MultiHeadAttentionScene = dynamic(() => import('./MultiHeadAttentionScene'), {
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

export default function TransformersViz() {
  const [headId, setHeadId] = useState(0)
  const [selected, setSelected] = useState(null)

  const head = HEADS[headId]
  const links = selected != null ? topLinks(head, selected, 3) : []

  const controls = [
    ...HEADS.map((h) => ({ label: h.name, onClick: () => setHeadId(h.id), active: headId === h.id })),
    { label: 'Clear selection', onClick: () => setSelected(null), disabled: selected == null },
  ]

  const readouts = [
    { label: 'head', value: `${head.name} (${headId + 1}/${HEADS.length})` },
    { label: 'watches', value: head.blurb },
    { label: 'selected', value: selected != null ? labelOf(selected) : '—' },
    {
      label: 'top links',
      value: selected != null ? links.map((l) => `${labelOf(l.id)} ${l.weight.toFixed(2)}`).join(', ') : '—',
    },
  ]

  const status =
    selected != null
      ? `${head.name} head: attention from "${labelOf(selected)}"`
      : `${head.name} head, click a word to see its links`

  return (
    <Figure
      eyebrow="Transformers"
      title={`Multi-head attention over "${SENTENCE.join(' ')}"`}
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis={
        'This is the same sentence as the attention topic, but now there are several heads. Switch heads to see each one draw a different pattern over the same words: Coreference links "it" back to "animal", Previous word links each token to the one before it, and Verb to arguments links a verb like "cross" to its subject and object. Click a word to draw the current head\'s links from it, and drag to orbit. A transformer runs many heads like these in parallel and stacks them in layers; these weights are hand-set to show the idea, not computed.'
      }
    >
      <MultiHeadAttentionScene head={head} selected={selected} onSelect={setSelected} />
    </Figure>
  )
}
