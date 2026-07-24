// Topology and packet-walk logic for the network stack topic. Two switched
// networks joined by one router. Layer 3 addresses are RFC 1918 private IPv4
// (192.168.0.0/16 block, one /24 subnet per network, verified against
// rfc-editor.org/rfc/rfc1918); layer 2 addresses are deliberately short
// readable labels, not realistic MAC strings.

export const HOSTS = [
  { id: 'a', name: 'Host A', net: 1, ip: '192.168.1.10', l2: 'L2:A' },
  { id: 'b', name: 'Host B', net: 1, ip: '192.168.1.20', l2: 'L2:B' },
  { id: 'c', name: 'Host C', net: 2, ip: '192.168.2.10', l2: 'L2:C' },
  { id: 'd', name: 'Host D', net: 2, ip: '192.168.2.20', l2: 'L2:D' },
]

// The router has one interface (and one layer 2 identity) per network.
export const ROUTER = {
  if1: { ip: '192.168.1.1', l2: 'L2:R1' },
  if2: { ip: '192.168.2.1', l2: 'L2:R2' },
}

export const SWITCHES = { 1: 'Switch 1', 2: 'Switch 2' }

export const hostById = (id) => HOSTS.find((h) => h.id === id)

export const sameNetwork = (srcId, dstId) => hostById(srcId).net === hostById(dstId).net

// The ordered device path the packet walks. Same network: host, switch, host.
// Cross network: host, switch, router, other switch, host. The router only
// ever appears on cross-network paths.
export function pathFor(srcId, dstId) {
  const src = hostById(srcId)
  const dst = hostById(dstId)
  if (src.net === dst.net) {
    return [
      { kind: 'host', id: src.id, label: src.name },
      { kind: 'switch', net: src.net, label: SWITCHES[src.net] },
      { kind: 'host', id: dst.id, label: dst.name },
    ]
  }
  return [
    { kind: 'host', id: src.id, label: src.name },
    { kind: 'switch', net: src.net, label: SWITCHES[src.net] },
    { kind: 'router', label: 'Router' },
    { kind: 'switch', net: dst.net, label: SWITCHES[dst.net] },
    { kind: 'host', id: dst.id, label: dst.name },
  ]
}

// The headers wrapped around the payload at a given hop index. Layer 3 stays
// (src ip, dst ip) for the whole trip. Layer 2 is per-link: on the first leg it
// runs from the source host to either the destination (same network) or the
// router's near-side interface (cross network); the router strips it and
// writes a fresh one for the second leg. `rewritten` marks the hop where that
// replacement just happened (the router itself).
export function headersAt(srcId, dstId, hopIndex) {
  const src = hostById(srcId)
  const dst = hostById(dstId)
  const l3 = { src: src.ip, dst: dst.ip }
  if (src.net === dst.net) {
    return { l3, l2: { src: src.l2, dst: dst.l2 }, rewritten: false, oldL2: null }
  }
  const firstLeg = { src: src.l2, dst: src.net === 1 ? ROUTER.if1.l2 : ROUTER.if2.l2 }
  const secondLeg = { src: dst.net === 1 ? ROUTER.if1.l2 : ROUTER.if2.l2, dst: dst.l2 }
  // hops: 0 src host, 1 near switch, 2 router, 3 far switch, 4 dst host
  if (hopIndex < 2) return { l3, l2: firstLeg, rewritten: false, oldL2: null }
  if (hopIndex === 2) return { l3, l2: secondLeg, rewritten: true, oldL2: firstLeg }
  return { l3, l2: secondLeg, rewritten: false, oldL2: null }
}

// Which header the device at this hop reads to do its job. Hosts own the
// payload, switches forward on layer 2, the router forwards on layer 3.
export function readsAt(path, hopIndex) {
  const kind = path[hopIndex].kind
  if (kind === 'switch') return 'l2'
  if (kind === 'router') return 'l3'
  return 'payload'
}

export const DEFAULT_SRC = 'a'
export const DEFAULT_DST = 'c'
export const PAYLOAD = 'hello'
