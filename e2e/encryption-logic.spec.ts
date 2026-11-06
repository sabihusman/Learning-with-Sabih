import { test, expect } from '@playwright/test'
import {
  CERT_SCENARIOS,
  DEFAULT_MESSAGE,
  byteLength,
  certificateFor,
  checkCertificate,
  flipOneBit,
  makeKeys,
  openEnvelope,
  sealEnvelope,
  sha256Hex,
  signMessage,
  tamperText,
  utf8Length,
  verifySignature,
  whoCanRead,
} from '../app/components/encryptionData'

// Part 1, page-less: the real WebCrypto pipeline the figure renders. These run
// in Node's own WebCrypto, the same API the browser uses.

test.describe('encryption logic', () => {
  test('envelope: only the recipient opens it, and the public-key step only ever carries the session key', async () => {
    const keys = await makeKeys()
    for (const message of ['', DEFAULT_MESSAGE, 'x'.repeat(40)]) {
      const env = await sealEnvelope(message, keys.bob.publicKey)
      expect(byteLength(env.sessionKeyRaw)).toBe(32)
      expect(byteLength(env.wrappedKey)).toBe(256)
      expect(byteLength(env.ciphertext)).toBe(utf8Length(message) + 16)
      expect(await openEnvelope(env, keys.bob.privateKey)).toEqual({ ok: true, message })
    }
  })

  test('envelope: a wrong private key and a tampered ciphertext both fail with an error, never garbage', async () => {
    const keys = await makeKeys()
    const env = await sealEnvelope(DEFAULT_MESSAGE, keys.bob.publicKey)
    const wrongKey = await openEnvelope(env, keys.eve.privateKey)
    expect(wrongKey.ok).toBe(false)
    expect(wrongKey).toMatchObject({ stage: 'unwrap' })
    expect(wrongKey).not.toHaveProperty('message')
    const tampered = await openEnvelope({ ...env, ciphertext: flipOneBit(env.ciphertext) }, keys.bob.privateKey)
    expect(tampered).toMatchObject({ ok: false, stage: 'decrypt' })
    expect(tampered).not.toHaveProperty('message')
  })

  test('sha256 matches the standard test vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  test('signatures verify only for the signer and only for the exact message', async () => {
    const keys = await makeKeys()
    const alice = await signMessage(DEFAULT_MESSAGE, keys.aliceSign.privateKey)
    const mallory = await signMessage(DEFAULT_MESSAGE, keys.mallorySign.privateKey)
    expect(await verifySignature(DEFAULT_MESSAGE, alice, keys.aliceSign.publicKey)).toBe(true)
    expect(await verifySignature(DEFAULT_MESSAGE, mallory, keys.aliceSign.publicKey)).toBe(false)
    expect(await verifySignature(tamperText(DEFAULT_MESSAGE), alice, keys.aliceSign.publicKey)).toBe(false)
    expect(await verifySignature(DEFAULT_MESSAGE, flipOneBit(alice, 10), keys.aliceSign.publicKey)).toBe(false)
    expect(tamperText(DEFAULT_MESSAGE)).not.toBe(DEFAULT_MESSAGE)
  })

  test('certificates: the forgery fails the CA signature, the wrong name fails the name check, and both would leak to Mallory', async () => {
    const keys = await makeKeys()
    const expected = {
      genuine: { signedByTrustedCa: true, nameMatches: true, trusted: true, readers: { bob: true, mallory: false } },
      forged: { signedByTrustedCa: false, nameMatches: true, trusted: false, readers: { bob: false, mallory: true } },
      otherName: { signedByTrustedCa: true, nameMatches: false, trusted: false, readers: { bob: false, mallory: true } },
    }
    for (const { id } of CERT_SCENARIOS) {
      const cert = await certificateFor(id, keys)
      const check = await checkCertificate(cert, 'bob', keys.ca.publicKey)
      const { readers, ...rest } = expected[id]
      expect(check, id).toEqual(rest)
      expect(await whoCanRead(cert, DEFAULT_MESSAGE, keys), id).toEqual(readers)
    }
  })
})

// Part 2, the figure in the page.

test.describe('encryption-and-public-keys figure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/topics/encryption-and-public-keys/')
    await expect(page.getByTestId('envelope-result')).toBeVisible()
  })

  test('send a secret: Bob recovers it, Eve cannot unwrap, tampering fails the tag', async ({ page }) => {
    const result = page.getByTestId('envelope-result')
    await expect(result).toHaveText(`Recovered: ${DEFAULT_MESSAGE}`)
    await page.getByTestId('receiver-eve').click()
    await expect(result).toContainText('cannot unwrap the session key')
    await page.getByTestId('receiver-bob').click()
    await page.getByTestId('tamper').click()
    await expect(result).toContainText('authentication tag does not match')
  })

  test('sign and verify: valid by default, invalid for Mallory or a changed message', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign and verify', exact: true }).click()
    const verdict = page.getByTestId('sign-verdict')
    await expect(verdict).toContainText('Valid')
    await page.getByTestId('tamper-message').click()
    await expect(verdict).toContainText('the message changed')
    await page.getByTestId('tamper-message').click()
    await page.getByTestId('signer-mallory').click()
    await expect(verdict).toContainText("not made with Alice's private key")
  })

  test('check the key: the genuine certificate is trusted, both of Mallory\'s are rejected', async ({ page }) => {
    await page.getByRole('button', { name: 'Check the key', exact: true }).click()
    const verdict = page.getByTestId('cert-verdict')
    await expect(verdict).toContainText('Trusted')
    await page.getByTestId('cert-forged').click()
    await expect(page.getByTestId('check-ca')).toContainText('No')
    await expect(verdict).toContainText('Rejected')
    await expect(page.getByTestId('cert-readers')).toHaveText('Bob could read it: no. Mallory could read it: yes.')
    await page.getByTestId('cert-otherName').click()
    await expect(page.getByTestId('check-ca')).toContainText('Yes')
    await expect(page.getByTestId('check-name')).toContainText('issued to mallory')
    await expect(verdict).toContainText('Rejected')
  })

  test('the figure never teaches signing as locking with a private key', async ({ page }) => {
    const figure = page.locator('figure').first()
    for (const mode of ['Send a secret', 'Sign and verify', 'Check the key']) {
      await page.getByRole('button', { name: mode, exact: true }).click()
      await expect(figure).not.toContainText('Computing')
      const text = await figure.innerText()
      expect(text).not.toMatch(/lock(ed|s)?\s+(it\s+)?with\s+\S+\s+private key/i)
      expect(text).not.toMatch(/private key\s+(opens|unlocks)/i)
      expect(text).not.toMatch(/garbage/i)
    }
  })
})
