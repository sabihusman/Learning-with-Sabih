'use client'

import { useEffect, useState } from 'react'
import Figure from './Figure'
import {
  CA_NAME,
  CERT_SCENARIOS,
  DEFAULT_MESSAGE,
  MAX_MESSAGE_LENGTH,
  byteLength,
  certificateFor,
  checkCertificate,
  fingerprint,
  flipOneBit,
  keyOwner,
  makeKeys,
  openEnvelope,
  sealEnvelope,
  sha256Hex,
  signMessage,
  tamperText,
  toHex,
  utf8Length,
  verifySignature,
  whoCanRead,
} from './encryptionData'
import shared from './vizShared.module.css'
import styles from './EncryptionViz.module.css'

// No timers: every control recomputes the pipeline with real WebCrypto calls,
// which resolve asynchronously. State is only set when those promises settle.

const MODES = [
  { id: 'envelope', label: 'Send a secret', title: 'Send a secret: envelope encryption' },
  { id: 'sign', label: 'Sign and verify', title: 'Sign a message, verify the signature' },
  { id: 'cert', label: 'Check the key', title: 'Check whose key it is: certificates' },
]

const NAMES = { bob: 'Bob', eve: 'Eve', mallory: 'Mallory', alice: 'Alice' }
const short = (hex, n = 24) => (hex.length > n ? `${hex.slice(0, n)}…` : hex)

async function computeEnvelope({ keys, message, receiver, tamper }) {
  const envelope = await sealEnvelope(message, keys.bob.publicKey)
  const sent = tamper ? { ...envelope, ciphertext: flipOneBit(envelope.ciphertext) } : envelope
  const opened = await openEnvelope(sent, keys[receiver].privateKey)
  return { envelope, sent, opened }
}

async function computeSign({ keys, message, signer, tamper }) {
  const signerKey = signer === 'alice' ? keys.aliceSign : keys.mallorySign
  const digest = await sha256Hex(message)
  const signature = await signMessage(message, signerKey.privateKey)
  const received = tamper ? tamperText(message) : message
  const receivedDigest = await sha256Hex(received)
  const valid = await verifySignature(received, signature, keys.aliceSign.publicKey)
  return { digest, signature, received, receivedDigest, valid }
}

async function computeCert({ keys, message, scenario }) {
  const cert = await certificateFor(scenario, keys)
  const [check, keyPrint, owner, readers] = await Promise.all([
    checkCertificate(cert, 'bob', keys.ca.publicKey),
    fingerprint(cert.publicKeySpki),
    keyOwner(cert.publicKeySpki, keys),
    whoCanRead(cert, message, keys),
  ])
  return { cert, check, keyPrint, owner, readers }
}

const COMPUTE = { envelope: computeEnvelope, sign: computeSign, cert: computeCert }

function Step({ n, label, children, testId }) {
  return (
    <li className={styles.step} data-testid={testId}>
      <div className={styles.stepLabel}>
        <span className={styles.stepNum}>{n}</span>
        {label}
      </div>
      {children}
    </li>
  )
}

function Value({ children, tone, testId }) {
  return (
    <div className={`${styles.value} ${tone ? styles[tone] : ''}`} data-testid={testId}>
      {children}
    </div>
  )
}

function Choice({ label, options, value, onChange, testPrefix }) {
  return (
    <div className={shared.group} role="group" aria-label={label}>
      <span className={shared.groupLabel}>{label}</span>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={shared.btn}
          aria-pressed={value === o.id}
          data-testid={`${testPrefix}-${o.id}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ label, on, onChange, testId }) {
  return (
    <div className={shared.group}>
      <button type="button" className={shared.btn} aria-pressed={on} data-testid={testId} onClick={() => onChange(!on)}>
        {label}: {on ? 'on' : 'off'}
      </button>
    </div>
  )
}

function EnvelopeView({ v, message, receiver, setReceiver, tamper, setTamper, reseal }) {
  const { envelope, opened } = v
  return (
    <ol className={styles.pipeline}>
      <Step n={1} label="Alice's message">
        <Value>{message || ' '}</Value>
      </Step>
      <Step n={2} label="A new random session key (AES-256), made for this message only">
        <Value testId="session-key">{short(toHex(envelope.sessionKeyRaw))}</Value>
        <button type="button" className={shared.btn} onClick={reseal}>
          New session key
        </button>
      </Step>
      <Step n={3} label="The message encrypted with the session key (AES-GCM, with an authentication tag)">
        <Value testId="ciphertext">{short(toHex(v.sent.ciphertext))}</Value>
      </Step>
      <Step n={4} label="Only the session key encrypted with Bob's public key (RSA-OAEP)">
        <Value testId="wrapped-key">{short(toHex(envelope.wrappedKey))}</Value>
      </Step>
      <Step n={5} label="Both travel over the open network">
        <Toggle label="Tamper with the ciphertext in transit" on={tamper} onChange={setTamper} testId="tamper" />
      </Step>
      <Step n={6} label="The receiver tries to open it">
        <Choice
          label="private key used"
          options={[
            { id: 'bob', label: "Bob's private key" },
            { id: 'eve', label: "Eve's private key" },
          ]}
          value={receiver}
          onChange={setReceiver}
          testPrefix="receiver"
        />
        {opened.ok ? (
          <Value tone="good" testId="envelope-result">
            Recovered: {opened.message}
          </Value>
        ) : opened.stage === 'unwrap' ? (
          <Value tone="bad" testId="envelope-result">
            Rejected: this private key cannot unwrap the session key, so nothing comes out.
          </Value>
        ) : (
          <Value tone="bad" testId="envelope-result">
            Rejected: the authentication tag does not match, so decryption refuses to return anything.
          </Value>
        )}
      </Step>
    </ol>
  )
}

function SignView({ v, message, signer, setSigner, tamper, setTamper }) {
  const digestChanged = v.receivedDigest !== v.digest
  return (
    <ol className={styles.pipeline}>
      <Step n={1} label="Alice's message, sent in the clear: signing hides nothing">
        <Value>{message || ' '}</Value>
      </Step>
      <Step n={2} label="Its SHA-256 digest">
        <Value testId="digest">{v.digest}</Value>
      </Step>
      <Step n={3} label="A signature over that digest">
        <Choice
          label="signed with"
          options={[
            { id: 'alice', label: "Alice's private key" },
            { id: 'mallory', label: "Mallory's private key" },
          ]}
          value={signer}
          onChange={setSigner}
          testPrefix="signer"
        />
        <Value testId="signature">{short(toHex(v.signature))}</Value>
      </Step>
      <Step n={4} label="Message and signature arrive">
        <Toggle label="Change the message in transit" on={tamper} onChange={setTamper} testId="tamper-message" />
        <Value testId="received">{v.received || ' '}</Value>
      </Step>
      <Step n={5} label="The verifier hashes what arrived">
        <Value tone={digestChanged ? 'bad' : undefined} testId="received-digest">
          {v.receivedDigest}
        </Value>
      </Step>
      <Step n={6} label="and checks the signature against Alice's public key">
        {v.valid ? (
          <Value tone="good" testId="sign-verdict">
            Valid: made with Alice&apos;s private key over exactly this message.
          </Value>
        ) : (
          <Value tone="bad" testId="sign-verdict">
            {digestChanged
              ? 'Invalid: the message changed, so its digest no longer matches the one that was signed.'
              : "Invalid: this signature was not made with Alice's private key."}
          </Value>
        )}
      </Step>
    </ol>
  )
}

function CertView({ v, scenario, setScenario }) {
  const { cert, check, readers } = v
  const mark = (ok) => (ok ? 'yes' : 'no')
  return (
    <ol className={styles.pipeline}>
      <Step n={1} label="Alice wants to send to Bob, so she needs Bob's public key">
        <Choice label="what arrives" options={CERT_SCENARIOS} value={scenario} onChange={setScenario} testPrefix="cert" />
      </Step>
      <Step n={2} label="The certificate it comes in">
        <Value testId="certificate">
          <span className={styles.field}>issued to</span> {cert.subject}
          <br />
          <span className={styles.field}>issued by</span> {cert.issuer}
          <br />
          <span className={styles.field}>key</span> {short(v.keyPrint, 16)}{' '}
          <span className={styles.aside}>(really {NAMES[v.owner]}&apos;s key)</span>
        </Value>
      </Step>
      <Step n={3} label={`Check 1: signed by ${CA_NAME}, whose public key Alice already trusts?`}>
        <Value tone={check.signedByTrustedCa ? 'good' : 'bad'} testId="check-ca">
          {check.signedByTrustedCa ? 'Yes: the signature verifies.' : 'No: the signature does not verify, whatever the issuer line says.'}
        </Value>
      </Step>
      <Step n={4} label="Check 2: issued to bob?">
        <Value tone={check.nameMatches ? 'good' : 'bad'} testId="check-name">
          {check.nameMatches ? 'Yes.' : `No: it is issued to ${cert.subject}.`}
        </Value>
      </Step>
      <Step n={5} label="Alice's decision">
        <Value tone={check.trusted ? 'good' : 'bad'} testId="cert-verdict">
          {check.trusted ? "Trusted: Alice encrypts to this key." : 'Rejected: Alice does not send.'}
        </Value>
      </Step>
      <Step n={6} label="If Alice skipped both checks and used this key anyway">
        <Value tone={readers.mallory ? 'bad' : 'good'} testId="cert-readers">
          Bob could read it: {mark(readers.bob)}. Mallory could read it: {mark(readers.mallory)}.
        </Value>
      </Step>
    </ol>
  )
}

export default function EncryptionViz() {
  const [keys, setKeys] = useState(null)
  const [mode, setMode] = useState('envelope')
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [receiver, setReceiver] = useState('bob')
  const [tamper, setTamper] = useState(false)
  const [signer, setSigner] = useState('alice')
  const [tamperMessage, setTamperMessage] = useState(false)
  const [scenario, setScenario] = useState('genuine')
  const [nonce, setNonce] = useState(0)
  const [view, setView] = useState(null)

  useEffect(() => {
    let live = true
    makeKeys().then((k) => {
      if (live) setKeys(k)
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!keys) return undefined
    let live = true
    const inputs = { keys, message, receiver, tamper, signer, scenario }
    if (mode === 'sign') inputs.tamper = tamperMessage
    COMPUTE[mode](inputs).then((result) => {
      if (live) setView({ mode, ...result })
    })
    return () => {
      live = false
    }
  }, [keys, mode, message, receiver, tamper, signer, tamperMessage, scenario, nonce])

  const v = view && view.mode === mode ? view : null
  const current = MODES.find((m) => m.id === mode)

  const controls = MODES.map((m) => ({ label: m.label, onClick: () => setMode(m.id), active: mode === m.id }))

  let status = 'Generating fresh keys in your browser…'
  let readouts = []
  if (v && mode === 'envelope') {
    const result = v.opened.ok ? 'recovered' : v.opened.stage === 'unwrap' ? 'rejected: wrong key' : 'rejected: tampered'
    status = v.opened.ok
      ? "Bob's private key unwrapped the session key and the tag checked out."
      : v.opened.stage === 'unwrap'
        ? "Only Bob's private key can unwrap a key wrapped with Bob's public key."
        : 'Changing even one bit in transit makes the authentication tag fail.'
    readouts = [
      { label: 'message', value: `${utf8Length(message)} bytes` },
      { label: 'ciphertext', value: `${byteLength(v.sent.ciphertext)} bytes` },
      { label: 'wrapped key', value: `${byteLength(v.envelope.wrappedKey)} bytes` },
      { label: 'result', value: result },
    ]
  } else if (v && mode === 'sign') {
    status = v.valid
      ? "Verifying never opens anything: it answers yes or no about Alice's key and this exact message."
      : 'Verification failed, and that failure is the point: it catches forgery and tampering.'
    readouts = [
      { label: 'signed by', value: NAMES[signer] },
      { label: 'digest matches', value: v.receivedDigest === v.digest ? 'yes' : 'no' },
      { label: 'verdict', value: v.valid ? 'valid' : 'invalid' },
    ]
  } else if (v && mode === 'cert') {
    status = v.check.trusted
      ? 'A trusted CA vouches that this key belongs to bob.'
      : 'The certificate fails a check, so a swapped key never gets used.'
    readouts = [
      { label: 'CA signature', value: v.check.signedByTrustedCa ? 'valid' : 'invalid' },
      { label: 'name', value: v.check.nameMatches ? 'bob' : v.cert.subject },
      { label: 'verdict', value: v.check.trusted ? 'trusted' : 'rejected' },
    ]
  }

  return (
    <Figure
      eyebrow="Security"
      title={current.title}
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis="Send a secret: switch the receiver to Eve and the session key will not unwrap at all; turn on tampering and the authentication tag refuses the ciphertext. Sign and verify: change one letter of the message and almost every digit of the digest changes; switch the signer to Mallory and the check fails, because only Alice's private key makes signatures her public key accepts. Check the key: send Mallory's forgery, then Mallory's own certificate, and see which check catches each."
    >
      <div className={styles.wrap}>
        <label className={styles.msgLabel} htmlFor="enc-message">
          <span>Message</span>
          <input
            id="enc-message"
            className={`${shared.input} ${styles.msgInput}`}
            type="text"
            maxLength={MAX_MESSAGE_LENGTH}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-label="Message"
          />
        </label>

        {!v && <div className={styles.pending}>{keys ? 'Computing…' : 'Generating fresh keys in your browser…'}</div>}
        {v && mode === 'envelope' && (
          <EnvelopeView
            v={v}
            message={message}
            receiver={receiver}
            setReceiver={setReceiver}
            tamper={tamper}
            setTamper={setTamper}
            reseal={() => setNonce((n) => n + 1)}
          />
        )}
        {v && mode === 'sign' && (
          <SignView v={v} message={message} signer={signer} setSigner={setSigner} tamper={tamperMessage} setTamper={setTamperMessage} />
        )}
        {v && mode === 'cert' && <CertView v={v} scenario={scenario} setScenario={setScenario} />}
      </div>

      <p className={shared.caption}>
        Everything here is real cryptography running in your browser: AES-256-GCM, RSA-OAEP (2048-bit, SHA-256),
        ECDSA P-256 with SHA-256, and SHA-256, with fresh keys made each time the page loads. The certificate is
        simplified: a real one is an X.509 document checked against a chain that ends at a root your browser already
        ships with. These keys exist only for this demo.
      </p>
    </Figure>
  )
}
