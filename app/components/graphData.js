// Shared graph: the single source of truth for the node layout and edges used by the
// Graph traversal topic and reusable by the upcoming Dijkstra topic. Nodes carry fixed
// x/y positions (in the SVG viewBox below) so every topic draws the identical graph;
// edges carry an optional weight that BFS and DFS ignore and Dijkstra will read.
//
// The graph is small (8 nodes), connected, and deliberately NOT a tree: it has cycles
// (for example A-B-E-D-A and E-F-H), so depth-first and breadth-first order visibly
// differ.

export const GRAPH_VIEWBOX = { width: 360, height: 300 }

export const NODES = [
  { id: 'A', x: 50, y: 60 },
  { id: 'B', x: 162, y: 40 },
  { id: 'C', x: 300, y: 70 },
  { id: 'D', x: 50, y: 172 },
  { id: 'E', x: 176, y: 164 },
  { id: 'F', x: 310, y: 182 },
  { id: 'G', x: 112, y: 268 },
  { id: 'H', x: 262, y: 264 },
]

// Undirected edges. `weight` is unused by traversal (BFS/DFS) and read by Dijkstra.
export const EDGES = [
  { from: 'A', to: 'B', weight: 4 },
  { from: 'A', to: 'D', weight: 3 },
  { from: 'B', to: 'C', weight: 5 },
  { from: 'B', to: 'E', weight: 2 },
  { from: 'C', to: 'F', weight: 6 },
  { from: 'D', to: 'E', weight: 1 },
  { from: 'D', to: 'G', weight: 7 },
  { from: 'E', to: 'F', weight: 3 },
  { from: 'E', to: 'H', weight: 8 },
  { from: 'F', to: 'H', weight: 2 },
  { from: 'G', to: 'H', weight: 4 },
]

export const NODE_IDS = NODES.map((n) => n.id)
export const nodePos = (id) => NODES.find((n) => n.id === id)

// Adjacency map with neighbors in a fixed (alphabetical) order, so any traversal over
// this graph is deterministic and reproducible.
export function buildAdjacency() {
  const adj = {}
  NODE_IDS.forEach((id) => {
    adj[id] = []
  })
  for (const { from, to } of EDGES) {
    adj[from].push(to)
    adj[to].push(from)
  }
  NODE_IDS.forEach((id) => adj[id].sort())
  return adj
}
