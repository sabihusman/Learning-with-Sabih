import { test, expect } from '@playwright/test'

// The encryption topic's lock-and-key flow: lock with a public key, only the
// matching private key recovers the message, and signing flips the key roles.
const MESSAGE = 'MEET AT NOON'

test.describe('encryption-and-public-keys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/topics/encryption-and-public-keys/')
    await expect(page.locator('figure').first()).toBeVisible()
  })

  test('locking with a public key scrambles the message', async ({ page }) => {
    const cipher = page.getByTestId('ciphertext')
    await expect(cipher).toBeVisible()
    const text = (await cipher.textContent()) ?? ''
    expect(text.length).toBe(MESSAGE.length)
    expect(text).not.toBe(MESSAGE)
  })

  test('the matching private key recovers the message; the wrong one does not', async ({ page }) => {
    // locked with Bob's public key by default
    await page.getByTestId('open-bob').click()
    await expect(page.getByTestId('output')).toHaveText(MESSAGE)

    await page.getByTestId('open-alice').click()
    const wrong = (await page.getByTestId('output').textContent()) ?? ''
    expect(wrong).not.toBe(MESSAGE)
    expect(wrong).not.toBe('—')
  })

  test('signing mode flips the key roles and verifies with the matching public key', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign', exact: true }).click()
    // lock (sign) with Alice's private key
    await page.getByTestId('lock-alice').click()
    await page.getByTestId('open-alice').click()
    await expect(page.getByTestId('output')).toHaveText(MESSAGE)

    // Bob's public key must not verify Alice's signature
    await page.getByTestId('open-bob').click()
    const wrong = (await page.getByTestId('output').textContent()) ?? ''
    expect(wrong).not.toBe(MESSAGE)
  })
})
