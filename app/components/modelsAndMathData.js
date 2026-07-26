// Data for the "Why models struggle with math" topic.
//
// Two sides, deliberately asymmetric in honesty:
//  - The COMPUTE side is genuinely correct: real arithmetic / a real letter count
//    done in plain JS (computeSteps below). Nothing is hand-tuned here.
//  - The PREDICT side never runs the math either way. For the multiplication
//    problem (R7) it is generated procedurally from the true answer's digits by
//    a blur function tuned to demonstrate "larger numbers fail more often" (see
//    below); for the letter-counting problem it is still hand-authored,
//    illustrative next-token probabilities, fabricated so the most-likely-token
//    path lands on a plausible-but-wrong answer. Neither is sampled from a real
//    model.

// The multiplication problem is now user-supplied (R7): two operand inputs,
// clamped to this range so the compute side never risks floating-point
// precision loss and the demo stays walkable in a reasonable number of steps.
export const MULT_MIN = 1
export const MULT_MAX = 999
export const MULT_DEFAULT_A = 27
export const MULT_DEFAULT_B = 14

// Parse a raw operand string into a valid integer, or null if it should be
// rejected outright. Digits only: no sign, no decimal point, no exponent, no
// empty string. Nothing that fails this ever reaches computeSteps.
export function parseOperand(raw) {
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

// Clamp a parsed operand into the supported range.
export function clampOperand(n) {
  return Math.min(MULT_MAX, Math.max(MULT_MIN, n))
}

// The letter-counting problem stays a fixed, hand-authored preset (unchanged
// by R7): one answer token, and the model undercounts (says 3, the real
// answer is 4).
export const COUNT_PRESET = {
  id: 'count',
  kind: 'count',
  label: 'count "s"',
  prompt: 'How many "s" in "mississippi"?',
  word: 'mississippi',
  target: 's',
  predict: [{ candidates: [['3', 0.52], ['4', 0.31], ['2', 0.12], ['5', 0.05]] }],
}

// ── genuine computation (real, correct for any valid operands) ───────────────
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

// ── procedural prediction for the multiplication problem (R7) ────────────────
//
// Blur function, option b: each digit's confidence in the true digit starts
// from a high base and drops as blur grows. Blur has two independent terms:
// how far the digit is from the leading digit (later digits are blurrier),
// and how many digits the whole answer has (bigger answers are blurrier
// throughout). The leading digit (position 0) only ever picks up the
// answer-size term, so it always keeps the least blur, i.e. the best odds of
// being predicted correctly, regardless of answer size.
const BASE_CONFIDENCE = 0.85 // p(correct digit) at position 0 of a 1-digit answer
const MIN_CONFIDENCE = 0.15 // floor: a digit is never made near-impossible
const POSITION_BLUR = 0.12 // added blur per digit position away from the leading digit
const SIZE_BLUR = 0.05 // added blur per extra digit in the total answer length
// How the probability mass NOT on the correct digit splits across its three
// confusable alternates, closest (numerically adjacent) first. Sums to 1.
const ALT_SHARE = [0.55, 0.3, 0.15]
// Offsets tried, in priority order, to find plausible "confusable" neighbor
// digits for the true digit. Kept in-range (0-9) by skipping any offset that
// would fall outside it, so a digit near 0 or 9 still gets three alternates.
const CONFUSION_OFFSETS = [1, -1, 2, -2, 3, -3]

function confusableDigits(correctDigit) {
  const alts = []
  for (const off of CONFUSION_OFFSETS) {
    const d = correctDigit + off
    if (d >= 0 && d <= 9) alts.push(d)
    if (alts.length === 3) break
  }
  return alts
}

function digitDistribution(correctDigit, position, totalDigits) {
  const blur = POSITION_BLUR * position + SIZE_BLUR * (totalDigits - 1)
  const pCorrect = Math.min(BASE_CONFIDENCE, Math.max(MIN_CONFIDENCE, BASE_CONFIDENCE - blur))
  const remainder = 1 - pCorrect
  const candidates = [[String(correctDigit), pCorrect]]
  confusableDigits(correctDigit).forEach((d, i) => {
    candidates.push([String(d), remainder * ALT_SHARE[i]])
  })
  return candidates
}

// Generate the full per-digit predict array for a computed total, most
// significant digit first (matching the order computeSteps' running total is
// read left to right).
export function proceduralPredict(total) {
  const digits = String(total).split('').map(Number)
  return digits.map((d, i) => ({ candidates: digitDistribution(d, i, digits.length) }))
}

// The predict side for whichever problem is active: procedural for
// multiplication (from the just-computed total), fixed for letter-counting.
export function getPredict(preset, comp) {
  return preset.kind === 'mult' ? proceduralPredict(comp.total) : preset.predict
}

// ── shared: read off the model's committed answer ─────────────────────────────
const argmax = (candidates) => candidates.reduce((best, c) => (c[1] > best[1] ? c : best), candidates[0])[0]

export function modelPicks(predict) {
  return predict.map((step) => argmax(step.candidates))
}

export const modelAnswer = (predict) => modelPicks(predict).join('')
