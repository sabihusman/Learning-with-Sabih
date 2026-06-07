import { type Page, type Locator } from '@playwright/test'

// Collect real errors (console.error + uncaught page errors). Deprecation
// warnings and info logs are intentionally ignored.
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  return errors
}

// The <dd> value of a Figure readout, located by its <dt> label text.
export function readoutValue(page: Page, label: string): Locator {
  return page
    .locator('figure dl > div')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('dd')
}

// Project a 3D world point to canvas-relative pixels using the embeddings scene's
// camera (position [7, 4.5, 12], target origin, fov 45). Used only to aim a click
// at a word; we never assert on the pixel values themselves.
type V3 = [number, number, number]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}

export function projectEmbeddings(P: V3, cw: number, ch: number): [number, number] {
  const eye: V3 = [7, 4.5, 12]
  const tgt: V3 = [0, 0, 0]
  const up: V3 = [0, 1, 0]
  const fov = (45 * Math.PI) / 180
  const z = norm(sub(eye, tgt))
  const x = norm(cross(up, z))
  const y = cross(z, x)
  const f = 1 / Math.tan(fov / 2)
  const d = sub(P, eye)
  const vz = dot(z, d)
  const ndcX = ((f / (cw / ch)) * dot(x, d)) / -vz
  const ndcY = (f * dot(y, d)) / -vz
  return [(ndcX * 0.5 + 0.5) * cw, (0.5 - ndcY * 0.5) * ch]
}

// Cluster representatives in the embeddings scene (hand-authored positions).
export const EMBEDDING_REPS: V3[] = [
  [-4.0, 1.5, 0.0], // king
  [4.0, 1.6, 1.0], // dog
  [-3.5, -2.0, -1.5], // car
  [3.5, -2.0, 1.5], // apple
]
