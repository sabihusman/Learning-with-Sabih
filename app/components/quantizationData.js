// Deterministic data for the Quantization topic (AI and ML).
//
// The 120 weights below are authored once (seeded normal-ish draw, sigma 0.25,
// clipped, 4 decimal places) and frozen as a literal so the figure renders
// identically every time: authored inputs, computed outputs, the same
// convention as the Algorithms section. No randomness at runtime.
//
// The quantization itself is real symmetric integer quantization:
//   scale = max(|w|) / (2^(b-1) - 1)                over the tensor or group
//   q     = clamp(round(w / scale), -qmax, +qmax)   with qmax = 2^(b-1) - 1
//   wHat  = q * scale
//   error = |w - wHat|
// Symmetric quantization keeps the grid symmetric around an exact zero, which
// costs one level: 2*qmax + 1 = 2^b - 1 representable values, not 2^b. INT2
// therefore means three levels: negative, zero, positive.

export const WEIGHTS = [
  0.3529, 0.045, 0.3453, 0.2333, 0.1298, -0.1409, 0.1517, 0.2139, 0.4714, 0.0761,
  0.1155, -0.0154, 0.0372, 0.2308, 0.2864, -0.67, 0.0861, -0.1605, -0.0855, -0.0404,
  -0.0332, 0.1934, 0.2214, -0.1508, -0.1266, -0.0605, -0.123, 0.2744, 0.0265, -0.1141,
  -0.1451, 0.5016, 0.4696, -0.15, -0.0721, -0.5154, 0.021, -0.0808, 0.0748, -0.1476,
  0.0512, 0.1132, 0.193, -0.4927, 0.2307, -0.0061, 0.3115, 0.2591, 0.0159, -0.3569,
  -0.3963, 0.1261, -0.1815, -0.0249, 0.3356, -0.1558, -0.0093, -0.0778, -0.2166, -0.3113,
  0.3037, 0.3737, -0.0722, 0.0976, -0.3995, 0.2803, -0.0133, -0.0576, -0.1056, -0.3258,
  0.032, 0.0575, -0.0862, -0.1154, -0.0093, -0.202, 0.3632, 0.1629, -0.1894, 0.0208,
  0.053, -0.5804, 0.0007, 0.1887, -0.083, -0.3213, 0.2598, -0.2833, 0.3665, -0.0212,
  -0.3691, 0.3207, -0.1826, -0.1093, 0.3441, -0.1178, -0.0022, -0.0442, 0.0509, -0.2922,
  0.0567, 0.1095, -0.1385, -0.1988, -0.196, -0.0753, 0.1311, 0.02, 0.0661, -0.2562,
  0.2119, 0.3042, 0.0216, 0.34, -0.1764, -0.5162, 0.2385, 0.28, 0.156, 0.1336,
]

// One tail value at 4x the largest ordinary |weight| (0.67), appended when the
// outlier toggle is on. It joins the LAST index group under per-group mode.
export const OUTLIER = 2.68

export const BIT_WIDTHS = [8, 4, 3, 2]
export const GROUP_COUNT = 4
// Storage assumption, also disclosed in the figure: each scale is stored as
// FP16, 2 bytes. Per-tensor mode reports the spec'd b/8 exactly (the single
// tensor-wide scale is not charged); per-group mode charges all group scales,
// because a scale per group is real overhead the format has to carry.
export const SCALE_BYTES = 2
export const PARAMS_7B = 7e9

export const activeWeights = (outlier) => (outlier ? [...WEIGHTS, OUTLIER] : WEIGHTS)

// Index ranges of the 4 groups: equal splits, the last group takes the
// remainder (30/30/30/31 when the outlier is on).
export function groupRanges(count, groups) {
  const base = Math.floor(count / groups)
  const ranges = []
  let start = 0
  for (let g = 0; g < groups; g += 1) {
    const end = g === groups - 1 ? count : start + base
    ranges.push([start, end])
    start = end
  }
  return ranges
}

// Run the real symmetric quantizer over the active weights. Returns everything
// the figure draws and every readout, computed, never typed in.
export function quantize(weights, bits, grouped) {
  const qmax = 2 ** (bits - 1) - 1
  const ranges = grouped ? groupRanges(weights.length, GROUP_COUNT) : [[0, weights.length]]

  const scales = ranges.map(([a, b]) => {
    let maxAbs = 0
    for (let i = a; i < b; i += 1) maxAbs = Math.max(maxAbs, Math.abs(weights[i]))
    return maxAbs / qmax
  })

  const perWeight = weights.map((w, i) => {
    const group = ranges.findIndex(([a, b]) => i >= a && i < b)
    const scale = scales[group]
    const q = Math.max(-qmax, Math.min(qmax, Math.round(w / scale)))
    const wHat = q * scale
    return { w, q, wHat, err: Math.abs(w - wHat), group }
  })

  const meanErr = perWeight.reduce((s, p) => s + p.err, 0) / perWeight.length
  const maxErr = perWeight.reduce((m, p) => Math.max(m, p.err), 0)

  return { qmax, levels: 2 * qmax + 1, scales, perWeight, meanErr, maxErr }
}

// Bytes per weight. Per-tensor: b/8 (the spec'd figure). Per-group: b/8 plus
// the FP16 scale each group carries, spread over that group's weights - exact
// even when the outlier makes the last group one weight larger.
export function bytesPerWeight(bits, grouped, count) {
  if (!grouped) return bits / 8
  return bits / 8 + (GROUP_COUNT * SCALE_BYTES) / count
}

// Weights-only size of a 7B-parameter model at this format, in decimal GB,
// applying the figure's own per-group overhead ratio (group size ~30).
export function sevenBGb(bits, grouped, count) {
  return (PARAMS_7B * bytesPerWeight(bits, grouped, count)) / 1e9
}
