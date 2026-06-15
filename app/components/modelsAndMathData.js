// Data for the "Why models struggle with math" topic.
//
// Two sides, deliberately asymmetric in honesty:
//  - The COMPUTE side is genuinely correct: real arithmetic / a real letter count
//    done in plain JS (computeSteps below). Nothing is hand-tuned here.
//  - The PREDICT side is hand-authored, illustrative next-token probabilities. They
//    are NOT from a real model; they are fabricated so the most-likely-token path
//    lands on a plausible-but-wrong answer, to show pattern-matching vs computing.

export const PRESETS = [
  {
    id: 'mult',
    kind: 'mult',
    label: '27 × 14',
    prompt: '27 × 14 = ?',
    a: 27,
    b: 14,
    // illustrative per-token distributions over digit tokens; argmax path -> "368".
    // Note token 2 is nearly a coin flip (6 vs 7): the model picks 6, the wrong one.
    predict: [
      { candidates: [['3', 0.71], ['4', 0.14], ['2', 0.09], ['5', 0.06]] },
      { candidates: [['6', 0.46], ['7', 0.41], ['8', 0.08], ['2', 0.05]] },
      { candidates: [['8', 0.55], ['0', 0.21], ['5', 0.14], ['3', 0.1]] },
    ],
  },
  {
    id: 'count',
    kind: 'count',
    label: 'count "s"',
    prompt: 'How many "s" in "mississippi"?',
    word: 'mississippi',
    target: 's',
    // one answer token; the model undercounts (says 3, the real answer is 4).
    predict: [{ candidates: [['3', 0.52], ['4', 0.31], ['2', 0.12], ['5', 0.05]] }],
  },
]

export const getPreset = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0]

// ── genuine computation (real, correct) ──────────────────────────────────────
export function computeSteps(preset) {
  if (preset.kind === 'mult') {
    const { a, b } = preset
    const digits = String(b).split('').reverse() // ones, tens, ...
    let running = 0
    const steps = []
    digits.forEach((dch, i) => {
      const d = Number(dch)
      if (d === 0) return
      const place = 10 ** i
      const value = a * d * place
      running += value
      steps.push({
        text: place > 1 ? `${a} × ${d} (×${place}) = ${value}` : `${a} × ${d} = ${value}`,
        running,
      })
    })
    return { steps, total: a * b }
  }
  // count: scan every letter, record each hit (this is the whole point: it looks)
  const { word, target } = preset
  const steps = []
  let count = 0
  word.split('').forEach((ch, i) => {
    if (ch === target) {
      count += 1
      steps.push({ text: `found "${target}" at position ${i + 1}`, running: count, pos: i })
    }
  })
  return { steps, total: count }
}

// ── illustrative prediction (fabricated, plausibly wrong) ─────────────────────
const argmax = (candidates) => candidates.reduce((best, c) => (c[1] > best[1] ? c : best), candidates[0])[0]

export function modelPicks(preset) {
  return preset.predict.map((step) => argmax(step.candidates))
}

export const modelAnswer = (preset) => modelPicks(preset).join('')
