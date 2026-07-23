'use client'

import { useState } from 'react'
import Figure from './Figure'
import {
  PARTIES,
  partyById,
  encryptWithPublic,
  decryptWithPrivate,
  signWithPrivate,
  verifyWithPublic,
  keysMatch,
  DEFAULT_MESSAGE,
  MAX_MESSAGE_LENGTH,
} from './encryptionData'
import styles from './EncryptionViz.module.css'

// No animation in this figure: every transformation is applied instantly and
// deterministically, so there are no timers and nothing rAF-driven.

export default function EncryptionViz() {
  const [mode, setMode] = useState('encrypt') // 'encrypt' | 'sign'
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [lockParty, setLockParty] = useState('bob') // whose key locks the message
  const [openParty, setOpenParty] = useState(null) // whose key tries to open it

  const switchMode = (m) => {
    setMode(m)
    setOpenParty(null)
  }

  // The locked text. Encrypt mode locks with lockParty's PUBLIC key; sign mode
  // locks with lockParty's PRIVATE key. (Same toy substitution either way; the
  // story is in which key is shareable.)
  const locked = mode === 'encrypt' ? encryptWithPublic(message, lockParty) : signWithPrivate(message, lockParty)

  // The attempted unlock, if a key has been applied.
  const opened =
    openParty == null ? null : mode === 'encrypt' ? decryptWithPrivate(locked, openParty) : verifyWithPublic(locked, openParty)
  const matched = openParty != null && keysMatch(lockParty, openParty)

  const lockName = partyById(lockParty).name
  const openName = openParty ? partyById(openParty).name : null

  const lockKeyKind = mode === 'encrypt' ? 'public' : 'private'
  const openKeyKind = mode === 'encrypt' ? 'private' : 'public'

  let status
  if (openParty == null) {
    status =
      mode === 'encrypt'
        ? `Locked with ${lockName}'s public key. Apply a private key to try to open it.`
        : `Signed with ${lockName}'s private key. Apply a public key to verify who locked it.`
  } else if (matched) {
    status =
      mode === 'encrypt'
        ? `${openName}'s private key matches ${lockName}'s public key: message recovered.`
        : `${openName}'s public key opened it: this was really signed by ${openName}'s private key.`
  } else {
    status =
      mode === 'encrypt'
        ? `${openName}'s private key does not match ${lockName}'s public key: still garbage.`
        : `${openName}'s public key does not open it: not signed by ${openName}.`
  }

  const controls = [
    { label: 'Encrypt', onClick: () => switchMode('encrypt'), active: mode === 'encrypt' },
    { label: 'Sign', onClick: () => switchMode('sign'), active: mode === 'sign' },
  ]

  const readouts = [
    { label: 'mode', value: mode === 'encrypt' ? `lock: public, open: private` : `lock: private, open: public` },
    { label: 'result', value: openParty == null ? '—' : matched ? 'recovered' : 'garbage' },
  ]

  return (
    <Figure
      eyebrow="Security"
      title={mode === 'encrypt' ? 'Encrypt: lock with a public key' : 'Sign: lock with a private key'}
      controls={controls}
      status={status}
      readouts={readouts}
      tryThis={
        "Type a short message and lock it with Bob's public key, then try both private keys on the result: only Bob's opens it, Alice's just produces different garbage. Switch to Sign and the key roles flip: lock with Alice's private key and anyone holding her public key can open it, which is what proves the message came from her."
      }
    >
      <div className={styles.wrap}>
        {/* message input */}
        <label className={styles.msgLabel} htmlFor="enc-message">
          <span>Message</span>
          <input
            id="enc-message"
            className={styles.msgInput}
            type="text"
            maxLength={MAX_MESSAGE_LENGTH}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              setOpenParty(null)
            }}
            aria-label="Message to lock"
          />
        </label>

        {/* the two parties and their keys */}
        <div className={styles.parties}>
          {PARTIES.map((p) => (
            <div key={p.id} className={styles.party}>
              <div className={styles.partyName}>{p.name}</div>
              <div className={styles.keyRow}>
                <span className={`${styles.key} ${styles.publicKey}`}>public key</span>
                <span className={styles.keyNote}>shareable</span>
              </div>
              <div className={styles.keyRow}>
                <span className={`${styles.key} ${styles.privateKey}`}>private key</span>
                <span className={styles.keyNote}>never shared</span>
              </div>
            </div>
          ))}
        </div>

        {/* step 1: choose the locking key */}
        <div className={styles.stepLabel}>
          1. Lock with a {lockKeyKind} key
        </div>
        <div className={styles.btnRow}>
          {PARTIES.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`lock-${p.id}`}
              className={`${styles.keyBtn} ${lockParty === p.id ? styles.keyBtnActive : ''}`}
              onClick={() => {
                setLockParty(p.id)
                setOpenParty(null)
              }}
            >
              {p.name}&apos;s {lockKeyKind} key
            </button>
          ))}
        </div>

        {/* the ciphertext */}
        <div className={styles.stage}>
          <div className={styles.stageLabel}>{mode === 'encrypt' ? 'ciphertext' : 'signed message'}</div>
          <div className={styles.cipher} data-testid="ciphertext">
            {locked}
          </div>
        </div>

        {/* step 2: try a key on it */}
        <div className={styles.stepLabel}>
          2. Apply a {openKeyKind} key
        </div>
        <div className={styles.btnRow}>
          {PARTIES.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`open-${p.id}`}
              className={`${styles.keyBtn} ${openParty === p.id ? styles.keyBtnActive : ''}`}
              onClick={() => setOpenParty(p.id)}
            >
              {p.name}&apos;s {openKeyKind} key
            </button>
          ))}
        </div>

        {/* the outcome */}
        <div className={styles.stage}>
          <div className={styles.stageLabel}>output</div>
          <div
            className={`${styles.cipher} ${opened == null ? '' : matched ? styles.recovered : styles.garbage}`}
            data-testid="output"
          >
            {opened == null ? '—' : opened}
          </div>
        </div>
      </div>

      <p className={styles.note}>
        The scrambling here is an illustrative keyed substitution, built only so the lock-and-key story is visible: it
        is not real encryption, and a real system could not work this way (here the &quot;public&quot; key&apos;s
        scramble is trivially reversible). Real public-key cryptography uses entirely different mathematics, where
        knowing the public key and the ciphertext genuinely does not let you recover the message or the private key.
      </p>
    </Figure>
  )
}
