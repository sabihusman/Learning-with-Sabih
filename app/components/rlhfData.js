// A SIMPLIFIED, illustrative stand-in for RLHF. There is NO language model here.
// Each candidate response is generated from a hidden "trait" vector, and the
// user's pick nudges a small preference model (weights over those traits) with a
// fixed, seeded rule. Over rounds the weights drift toward what the user keeps
// choosing, and candidate generation is biased toward high-weight traits, so the
// shown responses trend that way. A real system trains a reward model on many
// human comparisons and then fine-tunes the language model against it.

export const INK = '#1a1a1a'
export const FADE = '#9b9892'
export const ACCENT = '#c0392b'
export const POS = '#2f6f8f' // positive preference (blue)
export const NEG = '#c98a3b' // negative preference (amber)

export const TRAITS = [
  { key: 'helpful', label: 'Helpful' },
  { key: 'honest', label: 'Honest' },
  { key: 'concise', label: 'Concise' },
  { key: 'enthusiastic', label: 'Enthusiastic' },
]

// reward-update tuning
const SEED = 12345
const LR = 0.25 // how much one pick moves the weights
const BIAS = 1.2 // how strongly current weights steer later generation
const HIGH = 0.85 // dominant-trait score in a candidate
const LOW = 0.2 // non-dominant trait score
const NOISE = 0.08

function mulberry32(a) {
  return function () {
    a = Math.trunc(a)
    a = Math.trunc(a + 0x6d2b79f5)
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// one response snippet per (prompt, dominant trait)
export const PROMPTS = [
  {
    text: 'How do I fix a flat bike tire?',
    responses: {
      helpful:
        'Remove the wheel, pry off one side of the tire, pull out the tube, patch or replace it, then reseat the tire and inflate.',
      honest: 'I can outline the steps, but if the rim itself is bent this will not hold. A bike shop is the safer call.',
      concise: 'Pull the tube, patch the hole, reinflate.',
      enthusiastic: 'Easy fix! Pop the tube out, patch it up, pump it back up, and you are rolling again in no time!',
    },
  },
  {
    text: 'Is it going to rain tomorrow?',
    responses: {
      helpful: 'I cannot see live forecasts, but a weather app for your area will show the hourly chance of rain.',
      honest: 'I do not have real-time weather data, so I genuinely cannot tell you.',
      concise: 'Check a weather app.',
      enthusiastic: 'Ooh, weather watching! I cannot peek at the forecast myself, but your weather app has the scoop!',
    },
  },
  {
    text: 'Explain what a black hole is.',
    responses: {
      helpful:
        'A black hole is a region where gravity is so strong that nothing, not even light, can escape past its edge, the event horizon.',
      honest: 'Here is the simplified gist; the full picture needs general relativity, which I am glossing over.',
      concise: 'A region whose gravity traps even light.',
      enthusiastic: 'Black holes are wild! Gravity gets so intense that not even light escapes. Space is amazing!',
    },
  },
  {
    text: 'Write a short birthday message.',
    responses: {
      helpful: 'Happy birthday! Wishing you a wonderful year ahead, full of good things and good people.',
      honest: 'Happy birthday. (This is generic; adding a shared memory would make it land far better.)',
      concise: 'Happy birthday!',
      enthusiastic: 'Happiest of birthdays!! Hope today is absolutely amazing and the year is even better!!',
    },
  },
]

export const initWeights = () => Object.fromEntries(TRAITS.map((t) => [t.key, 0]))

// Generate the round's prompt + candidates. Dominant traits are the top-scoring
// traits, where score = seeded base + BIAS * current weight, so as the weights
// grow, preferred traits show up more often (generation trends toward them).
export function makeRound(round, weights) {
  const prompt = PROMPTS[round % PROMPTS.length]
  const rng = mulberry32(SEED + round * 101 + 7)
  const scored = TRAITS.map((t) => ({ key: t.key, score: rng() + BIAS * weights[t.key] }))
  scored.sort((a, b) => b.score - a.score)
  const dominants = scored.slice(0, 3).map((s) => s.key)

  const candidates = dominants.map((dom, i) => {
    const traits = {}
    for (const t of TRAITS) {
      const base = t.key === dom ? HIGH : LOW
      traits[t.key] = clamp(base + (rng() - 0.5) * 2 * NOISE, 0, 1)
    }
    return { id: `${round}-${i}`, dominant: dom, traits, text: prompt.responses[dom] }
  })
  return { prompt: prompt.text, candidates }
}

// Preference update: push weights toward traits where the chosen response beat
// the average of the rejected ones. Clamped to [-1, 1] for a stable meter.
export function updateWeights(weights, chosen, rejected) {
  const next = { ...weights }
  for (const t of TRAITS) {
    const rejMean = rejected.length
      ? rejected.reduce((s, r) => s + r.traits[t.key], 0) / rejected.length
      : 0
    next[t.key] = clamp(weights[t.key] + LR * (chosen.traits[t.key] - rejMean), -1, 1)
  }
  return next
}

export const topTrait = (weights) =>
  TRAITS.reduce((best, t) => (weights[t.key] > weights[best.key] ? t : best), TRAITS[0])
