// Real cryptography for the Encryption and public keys topic, through the
// WebCrypto API that browsers and Node (20+) both expose as
// globalThis.crypto.subtle. Nothing here is a toy cipher: AES-256-GCM carries
// the message, RSA-OAEP (2048-bit, SHA-256) wraps the session key, ECDSA P-256
// with SHA-256 signs, and SHA-256 hashes. Every key is generated fresh in the
// reader's browser on each page load; none is stored in this file.
//
// The one deliberate simplification is the certificate: a small JSON record
// (subject, issuer, public key) signed by a demo CA key, not an X.509 chain.

export const DEFAULT_MESSAGE = 'MEET AT NOON'
export const MAX_MESSAGE_LENGTH = 40
export const CA_NAME = 'Demo Root CA'

const subtle = () => globalThis.crypto.subtle
const utf8 = new TextEncoder()
const fromUtf8 = new TextDecoder()

const RSA_OAEP = { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }
const ECDSA_P256 = { name: 'ECDSA', namedCurve: 'P-256' }
const ECDSA_SIG = { name: 'ECDSA', hash: 'SHA-256' }

export const toHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
export const byteLength = (buf) => new Uint8Array(buf).length
export const utf8Length = (text) => utf8.encode(text).length

// A copy of the bytes with one bit flipped: what "tampered in transit" means.
export function flipOneBit(buf, index = 0) {
  const copy = new Uint8Array(buf).slice()
  copy[index] ^= 0x01
  return copy
}

const encryptionPair = () => subtle().generateKey(RSA_OAEP, true, ['wrapKey', 'unwrapKey'])
const signingPair = () => subtle().generateKey(ECDSA_P256, true, ['sign', 'verify'])

// Everyone's keys for one page load. Bob and Eve and Mallory can receive
// (encryption pairs); Alice, Mallory and the CA can sign (signing pairs).
export async function makeKeys() {
  const [bob, eve, mallory, aliceSign, mallorySign, ca] = await Promise.all([
    encryptionPair(),
    encryptionPair(),
    encryptionPair(),
    signingPair(),
    signingPair(),
    signingPair(),
  ])
  return { bob, eve, mallory, aliceSign, mallorySign, ca }
}

// ---------------------------------------------------------------------------
// Envelope (hybrid) encryption: a fresh symmetric session key encrypts the
// message; the recipient's public key encrypts only that small session key.

export async function sealEnvelope(message, recipientPublicKey) {
  const sessionKey = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, sessionKey, utf8.encode(message)))
  const wrappedKey = new Uint8Array(await subtle().wrapKey('raw', sessionKey, recipientPublicKey, { name: 'RSA-OAEP' }))
  const sessionKeyRaw = new Uint8Array(await subtle().exportKey('raw', sessionKey))
  return { sessionKeyRaw, iv, ciphertext, wrappedKey }
}

// Opening fails loudly at the step that is wrong. A private key that does not
// match cannot unwrap the session key at all; a ciphertext changed in transit
// fails the GCM authentication tag. Neither case produces garbage text.
export async function openEnvelope({ iv, ciphertext, wrappedKey }, recipientPrivateKey) {
  let sessionKey
  try {
    sessionKey = await subtle().unwrapKey('raw', wrappedKey, recipientPrivateKey, { name: 'RSA-OAEP' }, { name: 'AES-GCM' }, false, ['decrypt'])
  } catch (e) {
    return { ok: false, stage: 'unwrap', error: e.name }
  }
  try {
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv }, sessionKey, ciphertext)
    return { ok: true, message: fromUtf8.decode(plain) }
  } catch (e) {
    return { ok: false, stage: 'decrypt', error: e.name }
  }
}

// ---------------------------------------------------------------------------
// Signatures: hash the message, sign the digest, verify the signature against
// a fresh digest of what arrived. Verification answers yes or no; it never
// opens, decrypts or recovers anything.

export async function sha256Hex(message) {
  return toHex(await subtle().digest('SHA-256', utf8.encode(message)))
}

// ECDSA with SHA-256 signs the SHA-256 digest of the message.
export async function signMessage(message, signingPrivateKey) {
  return new Uint8Array(await subtle().sign(ECDSA_SIG, signingPrivateKey, utf8.encode(message)))
}

export async function verifySignature(message, signature, signingPublicKey) {
  return subtle().verify(ECDSA_SIG, signingPublicKey, signature, utf8.encode(message))
}

// ---------------------------------------------------------------------------
// Certificates (simplified): an issuer signs "this name owns this public key".

const certBody = ({ subject, issuer, publicKeySpki }) => utf8.encode(JSON.stringify({ subject, issuer, publicKeySpki }))

export async function issueCertificate(subject, publicKey, issuer, issuerSigningPrivateKey) {
  const publicKeySpki = toHex(await subtle().exportKey('spki', publicKey))
  const body = { subject, issuer, publicKeySpki }
  const signature = new Uint8Array(await subtle().sign(ECDSA_SIG, issuerSigningPrivateKey, certBody(body)))
  return { ...body, signature }
}

export async function fingerprint(spkiHex) {
  const bytes = Uint8Array.from(spkiHex.match(/../g), (h) => Number.parseInt(h, 16))
  return toHex(await subtle().digest('SHA-256', bytes))
}

export async function importCertificateKey(cert) {
  const bytes = Uint8Array.from(cert.publicKeySpki.match(/../g), (h) => Number.parseInt(h, 16))
  return subtle().importKey('spki', bytes, RSA_OAEP, true, ['wrapKey'])
}

// The two checks a sender makes before trusting a key: is the certificate
// really signed by a CA they already trust (the math, not the issuer label),
// and is it issued to the person they meant to reach?
export async function checkCertificate(cert, expectedSubject, trustedCaPublicKey) {
  const signedByTrustedCa = await subtle().verify(ECDSA_SIG, trustedCaPublicKey, cert.signature, certBody(cert))
  const nameMatches = cert.subject === expectedSubject
  return { signedByTrustedCa, nameMatches, trusted: signedByTrustedCa && nameMatches }
}

export const CERT_SCENARIOS = [
  { id: 'genuine', label: "Bob's real certificate" },
  { id: 'forged', label: "Mallory's forgery" },
  { id: 'otherName', label: "Mallory's own certificate" },
]

// The certificate that arrives in each scenario. The forgery claims the
// trusted issuer's name but is signed with Mallory's own key; the other is a
// genuine CA certificate, just issued to Mallory instead of Bob.
export async function certificateFor(scenario, keys) {
  if (scenario === 'genuine') return issueCertificate('bob', keys.bob.publicKey, CA_NAME, keys.ca.privateKey)
  if (scenario === 'forged') return issueCertificate('bob', keys.mallory.publicKey, CA_NAME, keys.mallorySign.privateKey)
  return issueCertificate('mallory', keys.mallory.publicKey, CA_NAME, keys.ca.privateKey)
}

// Whose key is inside a certificate. Alice cannot know this; the figure shows
// it so the consequence of trusting a bad certificate is visible.
export async function keyOwner(spkiHex, keys) {
  for (const name of ['bob', 'mallory', 'eve']) {
    if (toHex(await subtle().exportKey('spki', keys[name].publicKey)) === spkiHex) return name
  }
  return 'unknown'
}

// The text that arrives when a message is changed in transit: one character
// differs, which is all it takes.
export function tamperText(message) {
  if (!message) return '!'
  const last = message.at(-1)
  return message.slice(0, -1) + (last === '!' ? '?' : '!')
}

// What happens if Alice uses the key inside the certificate anyway: who can
// actually open the envelope she would send?
export async function whoCanRead(cert, message, keys) {
  const recipientKey = await importCertificateKey(cert)
  const envelope = await sealEnvelope(message, recipientKey)
  const [bob, mallory] = await Promise.all([
    openEnvelope(envelope, keys.bob.privateKey),
    openEnvelope(envelope, keys.mallory.privateKey),
  ])
  return { bob: bob.ok, mallory: mallory.ok }
}
