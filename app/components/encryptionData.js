// Toy keyed scrambling for the encryption topic. This is ILLUSTRATIVE ONLY:
// a deterministic keyed substitution over printable ASCII, chosen so the figure
// behaves like the public-key story it tells (lock with a public key, open with
// the matching private key; wrong key yields garbage) while being visibly a toy.
// It is NOT real cryptography, does not imitate any real algorithm, and real
// public-key systems use entirely different mathematics.

// Two parties, each with a matched key pair. The pairId is what makes a public
// and private key "match"; the seeds drive the substitution so each pair
// scrambles differently.
export const PARTIES = [
  { id: 'alice', name: 'Alice', seed: 47 },
  { id: 'bob', name: 'Bob', seed: 113 },
]

export const partyById = (id) => PARTIES.find((p) => p.id === id)

// Printable ASCII range the substitution permutes over.
const LO = 32 // space
const HI = 126 // ~
const SPAN = HI - LO + 1

// Small deterministic PRNG (mulberry32, same family the other data files use)
// so the per-position offsets are reproducible for a given key seed.
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Per-position offsets for a key seed. Recomputed on demand; deterministic.
function offsets(seed, length) {
  const rng = mulberry32(seed)
  return Array.from({ length }, () => 1 + Math.floor(rng() * (SPAN - 1)))
}

// Shift every printable character by its keyed per-position offset (wrapping
// within the printable range). direction +1 scrambles, -1 unscrambles.
function shift(text, seed, direction) {
  const offs = offsets(seed, text.length)
  return Array.from(text, (ch, i) => {
    const code = ch.charCodeAt(0)
    if (code < LO || code > HI) return ch
    const moved = (((code - LO + direction * offs[i]) % SPAN) + SPAN) % SPAN
    return String.fromCharCode(LO + moved)
  }).join('')
}

// ── the four operations the figure exposes ────────────────────────────────────
// Encrypt mode: lock with a party's PUBLIC key, open with a party's PRIVATE key.
// The pair matches when it is the same party's pair. A wrong private key applies
// the wrong inverse, so the output stays scrambled garbage.
export const encryptWithPublic = (message, partyId) => shift(message, partyById(partyId).seed, +1)
export const decryptWithPrivate = (ciphertext, partyId) => shift(ciphertext, partyById(partyId).seed, -1)

// Sign mode: the keys swap roles. Lock (sign) with a PRIVATE key; anyone can
// apply the matching PUBLIC key to recover the message, which proves it was
// locked by the holder of that private key.
export const signWithPrivate = (message, partyId) => shift(message, partyById(partyId).seed, +1)
export const verifyWithPublic = (signed, partyId) => shift(signed, partyById(partyId).seed, -1)

// Whether applying party B's key to something locked by party A recovers the
// message: true only when it is the same pair.
export const keysMatch = (lockPartyId, openPartyId) => lockPartyId === openPartyId

export const DEFAULT_MESSAGE = 'MEET AT NOON'
export const MAX_MESSAGE_LENGTH = 24
