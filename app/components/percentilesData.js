// Deterministic data for the Percentiles and Tail Latency topic (Systems and
// Networking).
//
// SAMPLE is a fixed, hand-authored set of 60 request durations in milliseconds,
// shaped to be instructive: a dense main cluster (20-80 ms), a short mid tail
// (150-300 ms), and two slow outliers (880 and 1080 ms). It is tuned so the mean
// sits in the 70-90 ms range while p99 lands near 1000 ms, which is the whole
// point of the figure: the average is dragged up by a tail that most requests
// never see. Real latency distributions vary; this one is arranged so every kind
// of statistic (mean, median, the percentiles) is visibly different.
//
// Every statistic the figure shows is computed from SAMPLE at runtime by the
// functions below, never hand-typed, so the markers and readouts cannot drift
// from the data.

export const SAMPLE = [
  20, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
  21, 26, 29, 33, 37, 42, 48, 52, 55, 58,
  24, 28, 32, 36, 44, 53, 61, 68, 75, 80,
  27, 35, 46, 63, 72,
  160, 220, 290,
  880, 1080,
]

export const N = SAMPLE.length // 60
const SORTED = [...SAMPLE].sort((a, b) => a - b)

// The arithmetic mean, the statistic the tail distorts.
export const MEAN = SAMPLE.reduce((a, b) => a + b, 0) / N

// Nearest-rank percentile: for p in 1..100, take the value at rank ceil(p/100 * N)
// in the sorted sample (1-indexed). This is one common definition; monitoring
// tools that interpolate between ranks may report a slightly different number.
export function percentileValue(p) {
  const clamped = Math.min(100, Math.max(1, p))
  const rank = Math.ceil((clamped / 100) * N)
  return SORTED[rank - 1]
}

// How many requests were strictly slower than a given latency.
export function countSlowerThan(ms) {
  return SAMPLE.filter((x) => x > ms).length
}

// The fixed marker set drawn on the strip, each derived from the sample.
export const MARKERS = [
  { key: 'mean', label: 'mean', value: Math.round(MEAN) },
  { key: 'p50', label: 'p50', value: percentileValue(50) },
  { key: 'p95', label: 'p95', value: percentileValue(95) },
  { key: 'p99', label: 'p99', value: percentileValue(99) },
]
