import { test, expect } from '@playwright/test'
import {
  WEIGHTS,
  OUTLIER,
  BIT_WIDTHS,
  GROUP_COUNT,
  SCALE_BYTES,
  PARAMS_7B,
  activeWeights,
  groupRanges,
  quantize,
  bytesPerWeight,
  sevenBGb,
} from '../app/components/quantizationData'

// Pure-logic correctness for the Quantization figure. No page, no browser.
// The state space is finite: 4 bit widths x 2 outlier states x 2 grouping
// states = 16 states, enumerated exhaustively. For every state, this spec
// INDEPENDENTLY resimulates symmetric quantization from the raw weight
// literals (its own arithmetic below, not the module's functions) and asserts
// the module's computed scales, snapped values, errors, and size figures
// match. Same pattern that caught real bugs in R6 and Caching Layers.

type Resim = {
  scales: number[]
  wHats: number[]
  errs: number[]
  meanErr: number
  maxErr: number
}

// Independent implementation: plain loops, its own group splitting, its own
// clamp/round, summing in index order.
function resimulate(ws: number[], bits: number, grouped: boolean): Resim {
  const qmax = Math.pow(2, bits - 1) - 1
  const groups: Array<[number, number]> = []
  if (grouped) {
    const base = Math.floor(ws.length / GROUP_COUNT)
    for (let g = 0; g < GROUP_COUNT; g += 1) {
      groups.push([g * base, g === GROUP_COUNT - 1 ? ws.length : (g + 1) * base])
    }
  } else {
    groups.push([0, ws.length])
  }

  const scales = groups.map(([a, b]) => {
    let m = 0
    for (let i = a; i < b; i += 1) if (Math.abs(ws[i]) > m) m = Math.abs(ws[i])
    return m / qmax
  })

  const wHats: number[] = []
  const errs: number[] = []
  for (let i = 0; i < ws.length; i += 1) {
    const g = groups.findIndex(([a, b]) => i >= a && i < b)
    let q = Math.round(ws[i] / scales[g])
    if (q > qmax) q = qmax
    if (q < -qmax) q = -qmax
    const wHat = q * scales[g]
    wHats.push(wHat)
    errs.push(Math.abs(ws[i] - wHat))
  }

  let sum = 0
  let maxErr = 0
  for (const e of errs) {
    sum += e
    if (e > maxErr) maxErr = e
  }
  return { scales, wHats, errs, meanErr: sum / errs.length, maxErr }
}

test('the authored inputs are frozen: 120 weights at 4dp, outlier at 4x the max', () => {
  expect(WEIGHTS).toHaveLength(120)
  for (const w of WEIGHTS) {
    expect(Math.abs(w)).toBeLessThan(1)
    expect(w).toBe(Number(w.toFixed(4)))
  }
  const maxAbs = Math.max(...WEIGHTS.map(Math.abs))
  expect(OUTLIER).toBe(Number((4 * maxAbs).toFixed(4)))
})

test('all 16 states match an independent resimulation exactly', () => {
  for (const bits of BIT_WIDTHS) {
    for (const outlier of [false, true]) {
      for (const grouped of [false, true]) {
        const label = `INT${bits} outlier=${outlier} grouped=${grouped}`
        const ws = activeWeights(outlier)
        expect(ws, label).toHaveLength(outlier ? 121 : 120)

        const expected = resimulate(ws, bits, grouped)
        const actual = quantize(ws, bits, grouped)

        // Symmetric quantization: one level fewer than 2^b, zero kept exact.
        const qmax = Math.pow(2, bits - 1) - 1
        expect(actual.qmax, label).toBe(qmax)
        expect(actual.levels, label).toBe(Math.pow(2, bits) - 1)
        expect(actual.levels, label).toBe(2 * qmax + 1)

        expect(actual.scales.length, label).toBe(grouped ? GROUP_COUNT : 1)
        actual.scales.forEach((s, i) => expect(s, `${label} scale[${i}]`).toBeCloseTo(expected.scales[i], 12))

        expect(actual.perWeight, label).toHaveLength(ws.length)
        actual.perWeight.forEach((p, i) => {
          expect(p.w, `${label} w[${i}]`).toBe(ws[i])
          expect(p.wHat, `${label} wHat[${i}]`).toBeCloseTo(expected.wHats[i], 12)
          expect(p.err, `${label} err[${i}]`).toBeCloseTo(expected.errs[i], 12)
        })
        expect(actual.meanErr, label).toBeCloseTo(expected.meanErr, 12)
        expect(actual.maxErr, label).toBeCloseTo(expected.maxErr, 12)

        // Size figures: per-tensor is b/8 exactly; per-group charges one FP16
        // scale per group spread over the actual weight count.
        const bpw = bytesPerWeight(bits, grouped, ws.length)
        const expectedBpw = grouped ? bits / 8 + (GROUP_COUNT * SCALE_BYTES) / ws.length : bits / 8
        expect(bpw, label).toBeCloseTo(expectedBpw, 12)
        expect(sevenBGb(bits, grouped, ws.length), label).toBeCloseTo((PARAMS_7B * expectedBpw) / 1e9, 9)
      }
    }
  }
})

test('group splitting: 30/30/30/30 without the outlier, 30/30/30/31 with it', () => {
  expect(groupRanges(120, GROUP_COUNT).map(([a, b]) => b - a)).toEqual([30, 30, 30, 30])
  expect(groupRanges(121, GROUP_COUNT).map(([a, b]) => b - a)).toEqual([30, 30, 30, 31])
  // The outlier is the last weight, so it lands in the last group.
  const ws = activeWeights(true)
  expect(ws[ws.length - 1]).toBe(OUTLIER)
})

test('the payoff numbers the prose will quote hold', () => {
  // Outlier inflates INT4 per-tensor error; per-group recovers most of it.
  const clean = quantize(activeWeights(false), 4, false).meanErr
  const inflated = quantize(activeWeights(true), 4, false).meanErr
  const rescued = quantize(activeWeights(true), 4, true).meanErr
  expect(inflated).toBeGreaterThan(clean * 3)
  expect(rescued).toBeLessThan(inflated / 2)
  // Only the outlier's own group pays: the other three scales are identical
  // to the no-outlier grouped state.
  const gClean = quantize(activeWeights(false), 4, true).scales
  const gOut = quantize(activeWeights(true), 4, true).scales
  expect(gOut[0]).toBeCloseTo(gClean[0], 12)
  expect(gOut[1]).toBeCloseTo(gClean[1], 12)
  expect(gOut[2]).toBeCloseTo(gClean[2], 12)
  expect(gOut[3]).toBeGreaterThan(gClean[3] * 3)
})
