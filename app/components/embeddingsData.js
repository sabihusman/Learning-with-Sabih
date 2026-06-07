// Hand-authored 3D coordinates for the embeddings demo. These are NOT computed
// by any dimensionality reduction. They are placed by hand so that meaning maps
// to distance: words with related meanings sit close together, unrelated groups
// sit far apart. Real embeddings live in hundreds of dimensions; this is the
// idea shown in 3 dimensions you can actually look at.
//
// Four clusters, four words each. Within a cluster the points are ~1 unit apart;
// the clusters are ~7+ units apart, so a word's nearest neighbours are always its
// own cluster-mates.

export const ACCENT = '#c0392b'
export const INK = '#1a1a1a'
export const FADE = '#9b9892'
export const PAPER = '#f7f6f2'

export const CLUSTERS = {
  royalty: '#1a1a1a',
  animals: '#2d6a4f',
  vehicles: '#1d3f72',
  fruit: '#b8860b',
}

export const WORDS = [
  // royalty
  { id: 'king', label: 'king', group: 'royalty', pos: [-4.0, 1.5, 0.0] },
  { id: 'queen', label: 'queen', group: 'royalty', pos: [-3.3, 1.8, 0.5] },
  { id: 'prince', label: 'prince', group: 'royalty', pos: [-4.5, 0.9, -0.4] },
  { id: 'princess', label: 'princess', group: 'royalty', pos: [-3.6, 1.0, 0.6] },

  // animals / pets
  { id: 'dog', label: 'dog', group: 'animals', pos: [4.0, 1.6, 1.0] },
  { id: 'cat', label: 'cat', group: 'animals', pos: [3.3, 1.9, 0.6] },
  { id: 'puppy', label: 'puppy', group: 'animals', pos: [4.6, 1.0, 1.3] },
  { id: 'pet', label: 'pet', group: 'animals', pos: [3.7, 1.0, 0.7] },

  // vehicles
  { id: 'car', label: 'car', group: 'vehicles', pos: [-3.5, -2.0, -1.5] },
  { id: 'truck', label: 'truck', group: 'vehicles', pos: [-2.9, -1.6, -1.0] },
  { id: 'bus', label: 'bus', group: 'vehicles', pos: [-4.1, -2.4, -1.9] },
  { id: 'van', label: 'van', group: 'vehicles', pos: [-3.2, -2.5, -1.2] },

  // fruit
  { id: 'apple', label: 'apple', group: 'fruit', pos: [3.5, -2.0, 1.5] },
  { id: 'banana', label: 'banana', group: 'fruit', pos: [4.1, -1.6, 1.9] },
  { id: 'orange', label: 'orange', group: 'fruit', pos: [2.9, -2.3, 1.1] },
  { id: 'grape', label: 'grape', group: 'fruit', pos: [3.7, -2.6, 1.7] },
]

export const dist = (a, b) => {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// nearest K word ids to the given word id, by Euclidean distance
export function nearestNeighbors(id, k = 3) {
  const self = WORDS.find((w) => w.id === id)
  if (!self) return []
  return WORDS.filter((w) => w.id !== id)
    .map((w) => ({ id: w.id, d: dist(self.pos, w.pos) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
}
