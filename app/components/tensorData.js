// The dimensionality ladder for the Tensors figure. Each rung is a real tensor
// shape; the dimension sizes are kept small so the array stays readable, but the
// shapes, element counts, and per-cell index paths are all computed for real from
// the shape below (nothing here is decorative).
//
// A tensor is an n-dimensional array. The rank is the number of dimensions (the
// length of the shape tuple). The element count is the product of the dimension
// sizes; the empty product for a rank-0 tensor is 1, so a scalar holds one value.

export const LADDER = [
  {
    rank: 0,
    shape: [],
    kind: 'scalar',
    label: 'a scalar',
    example: 'one loss value',
  },
  {
    rank: 1,
    shape: [4],
    kind: 'vector',
    label: 'a vector',
    example: 'a word embedding',
  },
  {
    rank: 2,
    shape: [3, 4],
    kind: 'matrix',
    label: 'a matrix',
    example: 'a grayscale image, or one weight layer',
  },
  {
    rank: 3,
    shape: [2, 3, 4],
    kind: '3D tensor',
    label: 'a 3D tensor',
    example: 'an RGB-style image (channels, height, width)',
  },
  {
    rank: 4,
    shape: [2, 3, 4, 3],
    kind: '4D tensor',
    label: 'a 4D tensor',
    example: 'a batch of images (batch, channels, height, width)',
  },
]

export const MAX_RANK = LADDER.length - 1

// Product of the dimension sizes. The empty product (rank 0) is 1.
export function elementCount(shape) {
  return shape.reduce((n, d) => n * d, 1)
}

// The shape tuple, written the way Python/NumPy prints it: () , (4,) , (3, 4) ...
export function shapeString(shape) {
  if (shape.length === 0) return '()'
  if (shape.length === 1) return `(${shape[0]},)`
  return `(${shape.join(', ')})`
}

// A concrete index path formatted as [i][j][k]. For a scalar (rank 0) there is no
// index, so this returns the empty string and the caller labels it as the whole value.
export function indexString(path) {
  return path.map((i) => `[${i}]`).join('')
}
