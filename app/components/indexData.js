// Fixed, deterministic dataset and the real step-by-step "how the engine finds rows"
// frames for the Indexes topic. No randomness: ROWS is a literal in physical (insert)
// order, INDEX is the same rows sorted by the searched column, and every "rows
// examined" count below is produced by actually running the strategy, not authored.
//
// Two strategies:
//   - full scan (no index): walk every row in physical order, checking each. The engine
//     reads the whole table, so it examines all N rows.
//   - B-tree index scan: binary-search a sorted copy of the searched column to land on
//     the first matching key (the same halving idea as the Binary search topic), then,
//     for a range, walk forward in sorted order. It examines only a handful of entries.

// physical order (as inserted); `score` is the searched column and is deliberately
// unsorted here, so the sorted index below is genuinely a different order.
export const ROWS = [
  { id: 1, score: 37 },
  { id: 2, score: 19 },
  { id: 3, score: 52 },
  { id: 4, score: 8 },
  { id: 5, score: 44 },
  { id: 6, score: 29 },
  { id: 7, score: 61 },
  { id: 8, score: 15 },
  { id: 9, score: 48 },
  { id: 10, score: 33 },
  { id: 11, score: 23 },
  { id: 12, score: 56 },
  { id: 13, score: 41 },
  { id: 14, score: 12 },
]

export const N = ROWS.length

// the B-tree index: the searched column sorted ascending, each entry still pointing
// back to its row id. This is the simplified teaching model of a B-tree (a sorted
// structure); a real B-tree is a multi-level balanced tree but resolves a lookup by the
// same sorted-jump principle.
export const INDEX = [...ROWS].sort((a, b) => a.score - b.score).map((r) => ({ score: r.score, id: r.id }))

// preset queries the reader can pick; clicking a table row also builds an eq query
export const QUERIES = [
  { id: 'eq44', type: 'eq', value: 44, label: 'score = 44' },
  { id: 'eq8', type: 'eq', value: 8, label: 'score = 8' },
  { id: 'eq50', type: 'eq', value: 50, label: 'score = 50 (no match)' },
  { id: 'r30_50', type: 'range', lo: 30, hi: 50, label: 'score between 30 and 50' },
  { id: 'r10_25', type: 'range', lo: 10, hi: 25, label: 'score between 10 and 25' },
]

export const queryLabel = (q) => (q.type === 'eq' ? `score = ${q.value}` : `score between ${q.lo} and ${q.hi}`)
export const querySql = (q) =>
  q.type === 'eq' ? `SELECT * FROM users WHERE score = ${q.value};` : `SELECT * FROM users WHERE score BETWEEN ${q.lo} AND ${q.hi};`

const matches = (row, q) => (q.type === 'eq' ? row.score === q.value : row.score >= q.lo && row.score <= q.hi)

// ── full scan: examine every row in physical order ────────────────────────────────
function scanFrames(q) {
  const frames = []
  const matched = []
  for (let i = 0; i < ROWS.length; i += 1) {
    if (matches(ROWS[i], q)) matched.push(ROWS[i].id)
    frames.push({
      mode: 'scan',
      cursor: i,
      examined: i + 1,
      matched: [...matched],
      done: i === ROWS.length - 1,
      status: `Full scan: checked row ${i + 1} of ${ROWS.length}`,
    })
  }
  const last = frames[frames.length - 1]
  last.status = `Full scan examined all ${ROWS.length} rows, found ${matched.length} match${matched.length === 1 ? '' : 'es'}`
  return frames
}

// ── B-tree index scan: binary-search to the first matching key, then walk for a range ─
function indexFrames(q) {
  const frames = []
  const matched = []
  let examined = 0
  const targetLo = q.type === 'eq' ? q.value : q.lo

  // lower_bound: leftmost index entry whose score >= targetLo, counting each probe
  let lo = 0
  let hi = INDEX.length - 1
  let lb = INDEX.length
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    examined += 1
    frames.push({
      mode: 'index',
      phase: 'search',
      bsLo: lo,
      bsHi: hi,
      bsMid: mid,
      examined,
      matched: [...matched],
      status: `Index scan: comparing ${INDEX[mid].score} at the middle of the remaining range`,
    })
    if (INDEX[mid].score >= targetLo) {
      lb = mid
      hi = mid - 1
    } else {
      lo = mid + 1
    }
  }

  if (q.type === 'eq') {
    const hit = lb < INDEX.length && INDEX[lb].score === q.value
    if (hit) matched.push(INDEX[lb].id)
    frames.push({
      mode: 'index',
      phase: hit ? 'found' : 'notfound',
      located: hit ? lb : -1,
      examined,
      matched: [...matched],
      done: true,
      status: hit
        ? `Found ${q.value} in the index after ${examined} compares, jumped straight to row ${INDEX[lb].id}`
        : `${q.value} is not in the index (${examined} compares); no rows match`,
    })
    return frames
  }

  // range: walk forward in sorted order from the lower bound while still in range
  let k = lb
  let walked = 0
  while (k < INDEX.length && INDEX[k].score <= q.hi) {
    examined += 1
    matched.push(INDEX[k].id)
    walked += 1
    frames.push({
      mode: 'index',
      phase: 'walk',
      walk: k,
      examined,
      matched: [...matched],
      status: `Walking the sorted index: ${INDEX[k].score} is in range (row ${INDEX[k].id})`,
    })
    k += 1
  }
  if (frames.length) {
    const last = frames[frames.length - 1]
    last.done = true
    last.status = `Index found the range start, then walked ${walked} entr${walked === 1 ? 'y' : 'ies'} in sorted order (${examined} examined)`
  }
  return frames
}

// Build the full deterministic frame list for a (query, indexed) pair. The animation
// just advances an index into this array; every count in it is real.
export function buildFrames(q, indexed) {
  return indexed ? indexFrames(q) : scanFrames(q)
}

export const matchedIds = (q) => ROWS.filter((r) => matches(r, q)).map((r) => r.id)
