'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import Figure from './Figure'
import { COMPANY, KB, KB_BY_ID, QUERIES, TOP_K, ranked, retrievedIds } from './ragData'
import styles from './RagViz.module.css'

const STAGES = ['retrieve', 'augment', 'generate']

// the small SVG pipeline indicator: retrieve -> augment -> generate, current stage lit
function Pipeline({ stage }) {
  const nodes = [
    { key: 'retrieve', label: 'Retrieve' },
    { key: 'augment', label: 'Augment' },
    { key: 'generate', label: 'Generate' },
  ]
  return (
    <svg className={styles.pipeline} viewBox="0 0 420 44" role="img" aria-label={`RAG pipeline: retrieve, augment, generate. Current step: ${stage === 0 ? 'none' : STAGES[stage - 1]}.`}>
      {nodes.map((n, i) => {
        const x = 14 + i * 146
        const done = stage >= i + 1
        const active = stage === i + 1
        return (
          <g key={n.key}>
            {i < 2 && <line x1={x + 118} y1={22} x2={x + 146} y2={22} stroke={stage >= i + 2 ? '#c0392b' : '#d8d4cc'} strokeWidth="2" />}
            <rect x={x} y={6} width={118} height={32} rx={7} fill={done ? '#fbeeec' : '#ffffff'} stroke={active ? '#c0392b' : done ? '#e0b9b2' : '#d8d4cc'} strokeWidth={active ? 2 : 1.4} />
            <text x={x + 59} y={26} fontSize={12} fontFamily="ui-monospace, monospace" textAnchor="middle" fill={done ? '#c0392b' : '#9b9892'} fontWeight={active ? 700 : 400}>
              {i + 1}. {n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function RagViz() {
  const [queryId, setQueryId] = useState(QUERIES[0].id)
  const [stage, setStage] = useState(0) // 0 none, 1 retrieve, 2 augment, 3 generate

  const query = QUERIES.find((q) => q.id === queryId)
  const retrieved = retrievedIds(query)
  const rankedChunks = ranked(query)
  const contextRef = useRef(null)

  // anime: when the prompt is assembled (augment), slide the retrieved context in, so
  // "the chunks are inserted into the prompt" reads as a real move. Reveal is
  // state-driven; this only decorates, so it is fine if rAF is throttled.
  useEffect(() => {
    if (stage >= 2 && contextRef.current) {
      animate(contextRef.current, { opacity: [0.2, 1], translateY: [-8, 0], duration: 420, ease: 'outQuad' })
    }
  }, [stage, queryId])

  const pickQuery = (id) => {
    setQueryId(id)
    setStage(0)
  }

  const controls = [
    { label: stage === 0 ? 'Step: Retrieve' : stage === 1 ? 'Step: Augment' : stage === 2 ? 'Step: Generate' : 'Done', onClick: () => setStage((s) => Math.min(3, s + 1)), variant: 'primary', disabled: stage >= 3 },
    { label: 'Reset', onClick: () => setStage(0), disabled: stage === 0 },
  ]

  const status =
    stage === 0
      ? 'Pick a question, then step through retrieve, augment, generate'
      : stage === 1
        ? `Retrieved the ${TOP_K} most similar chunks`
        : stage === 2
          ? 'Inserted the retrieved chunks into the prompt as context'
          : 'Generated an answer grounded in the retrieved chunks'

  const readouts = [
    { label: 'knowledge base', value: `${KB.length} chunks` },
    { label: 'retrieved', value: stage >= 1 ? `top ${TOP_K}` : '—' },
    { label: 'grounded', value: stage >= 3 ? 'yes' : '—' },
  ]

  return (
    <Figure
      eyebrow="Retrieval"
      title="Retrieval-augmented generation, step by step"
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Pick a question about a fictional company, then step through the pipeline. Retrieve embeds the question and scores every chunk by similarity, lighting up the most relevant ones. Augment drops those chunks into the prompt as context. Generate answers from that context. Compare the two answers at the end: the bare model answers from memory and can be confidently wrong, while the RAG answer is grounded in the retrieved text. Try the voice-control question, whose answer is a made-up product detail no model could have memorized. The scores and answers here are hand-authored to show the behavior; the retrieve, augment, generate pipeline is the real architecture."
    >
      <div className={styles.queries}>
        {QUERIES.map((q) => (
          <button key={q.id} type="button" onClick={() => pickQuery(q.id)} className={`${styles.qBtn} ${q.id === queryId ? styles.qActive : ''}`} aria-pressed={q.id === queryId}>
            {q.text}
            {q.headline && <span className={styles.payoff}>not in training</span>}
          </button>
        ))}
      </div>

      <Pipeline stage={stage} />

      {/* STAGE 1: RETRIEVE — chunks scored by similarity, top-k highlighted */}
      <section className={styles.panel}>
        <header className={styles.panelHead}>
          <span className={styles.panelTitle}>Knowledge base</span>
          <span className={styles.panelSub}>{stage >= 1 ? 'scored by similarity to the question' : `${KB.length} document chunks about ${COMPANY}`}</span>
        </header>
        <ul className={styles.chunks}>
          {(stage >= 1 ? rankedChunks : KB.map((c) => ({ ...c, score: 0 }))).map((c) => {
            const isRetrieved = stage >= 1 && retrieved.includes(c.id)
            return (
              <li key={c.id} className={`${styles.chunk} ${isRetrieved ? styles.retrieved : ''} ${stage >= 1 && !isRetrieved ? styles.dimmed : ''}`}>
                <span className={styles.chunkText}>{c.text}</span>
                {stage >= 1 && (
                  <span className={styles.scoreWrap}>
                    <span className={styles.scoreBar}>
                      <span className={styles.scoreFill} style={{ width: `${Math.round(c.score * 100)}%`, background: isRetrieved ? 'var(--accent)' : 'var(--rule)' }} />
                    </span>
                    <span className={styles.scoreNum}>{c.score.toFixed(2)}</span>
                  </span>
                )}
                {isRetrieved && <span className={styles.retrievedBadge}>retrieved</span>}
              </li>
            )
          })}
        </ul>
      </section>

      {/* STAGE 2: AUGMENT — assembled prompt */}
      {stage >= 2 && (
        <section className={`${styles.panel} ${styles.promptPanel}`}>
          <header className={styles.panelHead}>
            <span className={styles.panelTitle}>Prompt sent to the model</span>
            <span className={styles.panelSub}>retrieved chunks + the question</span>
          </header>
          <div className={styles.prompt}>
            <div ref={contextRef}>
              <div className={styles.promptLabel}>context</div>
              {retrieved.map((id) => (
                <div key={id} className={styles.contextLine}>{KB_BY_ID[id].text}</div>
              ))}
            </div>
            <div className={styles.promptLabel}>question</div>
            <div className={styles.questionLine}>{query.text}</div>
          </div>
        </section>
      )}

      {/* STAGE 3: GENERATE — bare vs grounded */}
      {stage >= 3 && (
        <section className={styles.answers}>
          <div className={`${styles.answerCard} ${styles.bare}`}>
            <div className={styles.answerHead}>
              Without RAG <span className={styles.answerSub}>from memory</span>
            </div>
            <p className={styles.answerText}>{query.bare.text}</p>
            <span className={styles.bareBadge}>{query.bare.mode}</span>
          </div>
          <div className={`${styles.answerCard} ${styles.grounded}`}>
            <div className={styles.answerHead}>
              With RAG <span className={styles.answerSub}>grounded in retrieved context</span>
            </div>
            <p className={styles.answerText}>{query.rag}</p>
            <span className={styles.groundedBadge}>grounded</span>
          </div>
        </section>
      )}

      <p className={styles.caption}>
        Illustrative only: the similarity scores and both answers are hand-authored, not from a real embedding model or
        language model. The pipeline, retrieve then augment then generate, is the real architecture. Retrieval reuses
        the embeddings idea: the question and each chunk become vectors, and closeness means relevance.
      </p>
    </Figure>
  )
}
