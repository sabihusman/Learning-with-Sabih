// Data for the RAG topic. The knowledge base, similarity scores, and answers are all
// hand-authored and illustrative. They are NOT produced by a real embedding model or a
// real language model; the point is the pipeline (retrieve -> augment -> generate) and
// the contrast between answering from memory and answering from retrieved context.
//
// The knowledge base is about a fictional company so that, by construction, none of it
// could be in a model's training data: every answer below depends on retrieval.

export const COMPANY = 'Nimbus Robotics'
export const TOP_K = 2

export const KB = [
  { id: 'c1', text: 'Nimbus Robotics was founded in 2021 and is based in Lisbon, Portugal.' },
  { id: 'c2', text: 'The Nimbus R2 has a 5200 mAh battery and runs for 180 minutes on a full charge.' },
  { id: 'c3', text: 'Nimbus offers a 2-year warranty, and returns are accepted within 30 days of delivery.' },
  { id: 'c4', text: 'Voice control for the R2 was added in firmware 3.4, used through the Nimbus app.' },
  { id: 'c5', text: 'The R2 maps your home with lidar and can store up to 5 separate floor plans.' },
  { id: 'c6', text: 'Nimbus support is open 9am to 6pm WET, Monday to Friday.' },
]

export const KB_BY_ID = Object.fromEntries(KB.map((c) => [c.id, c]))

// Each query carries hand-authored similarity scores per chunk (closeness = relevance,
// the embeddings idea), the answer a bare model might give from memory (with its failure
// mode), and the answer grounded in the retrieved chunks.
export const QUERIES = [
  {
    id: 'voice',
    headline: true, // the payoff: bare model is confidently wrong, RAG is right
    text: 'Which firmware added voice control to the R2?',
    scores: { c4: 0.93, c5: 0.28, c2: 0.2, c6: 0.14, c1: 0.1, c3: 0.08 },
    bare: { text: 'Voice control has been built into the R2 since it launched.', mode: 'confident, but made up' },
    rag: 'Voice control was added in firmware 3.4, used through the Nimbus app.',
  },
  {
    id: 'battery',
    text: 'How long does the R2 run on one charge?',
    scores: { c2: 0.91, c5: 0.34, c4: 0.22, c1: 0.12, c3: 0.1, c6: 0.08 },
    bare: { text: 'Most robot vacuums run about 90 to 120 minutes per charge.', mode: 'generic guess' },
    rag: 'It runs for 180 minutes on a full charge (the R2 has a 5200 mAh battery).',
  },
  {
    id: 'returns',
    text: 'What is the return policy?',
    scores: { c3: 0.89, c6: 0.3, c1: 0.18, c2: 0.12, c5: 0.1, c4: 0.08 },
    bare: { text: 'Return windows are usually around 14 to 30 days, but it depends on the seller.', mode: 'vague' },
    rag: 'Returns are accepted within 30 days of delivery, and there is a 2-year warranty.',
  },
  {
    id: 'founded',
    text: 'When was Nimbus Robotics founded?',
    scores: { c1: 0.9, c6: 0.22, c3: 0.16, c2: 0.12, c5: 0.1, c4: 0.08 },
    bare: { text: 'I could not find reliable information about when Nimbus Robotics was founded.', mode: 'declines' },
    rag: 'In 2021. Nimbus Robotics is based in Lisbon, Portugal.',
  },
]

// chunks sorted by similarity for a query (highest first)
export function ranked(query) {
  return KB.map((c) => ({ ...c, score: query.scores[c.id] ?? 0 })).sort((a, b) => b.score - a.score)
}

// the TOP_K retrieved chunk ids for a query
export function retrievedIds(query) {
  return ranked(query).slice(0, TOP_K).map((c) => c.id)
}
