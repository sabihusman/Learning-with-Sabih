import { test, expect } from '@playwright/test'

// The network stack topic: same-network delivery never touches the router,
// cross-network delivery rewrites the layer 2 header at the router while the
// layer 3 addresses stay unchanged.
test.describe('network-stack-and-routing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/topics/network-stack-and-routing/')
    await expect(page.locator('figure').first()).toBeVisible()
  })

  test('same-network delivery never reaches the router', async ({ page }) => {
    // A to B stays inside network 1
    await page.getByTestId('dst-b').click()
    const step = page.getByRole('button', { name: 'Step', exact: true })
    const routerHasPacket = () => page.getByTestId('device-router').getByTestId('packet').count()

    expect(await routerHasPacket()).toBe(0)
    await step.click() // switch 1
    expect(await routerHasPacket()).toBe(0)
    await expect(page.getByTestId('device-switch1').getByTestId('packet')).toBeVisible()
    await step.click() // host B, delivered
    expect(await routerHasPacket()).toBe(0)
    await expect(step).toBeDisabled()
  })

  test('cross-network delivery rewrites layer 2 at the router, layer 3 unchanged', async ({ page }) => {
    // default route is A to C, which crosses the router
    const step = page.getByRole('button', { name: 'Step', exact: true })
    const l3 = page.getByTestId('l3-header')
    const l3Before = (await l3.textContent()) ?? ''
    expect(l3Before).toContain('192.168.1.10 to 192.168.2.10')
    await expect(page.getByTestId('l2-header')).toContainText('L2:A to L2:R1')

    await step.click() // switch 1: reads layer 2, no rewrite yet
    await expect(page.getByTestId('rewrite-badge')).toHaveCount(0)

    await step.click() // router: the rewrite moment
    await expect(page.getByTestId('rewrite-badge')).toBeVisible()
    await expect(page.getByTestId('old-l2')).toContainText('L2:A to L2:R1')
    await expect(page.getByTestId('l2-header')).toContainText('L2:R2 to L2:C')
    expect((await l3.textContent()) ?? '').toContain('192.168.1.10 to 192.168.2.10')

    await step.click() // switch 2
    await expect(page.getByTestId('rewrite-badge')).toHaveCount(0)
    await step.click() // host C, delivered
    await expect(step).toBeDisabled()
    expect((await l3.textContent()) ?? '').toContain('192.168.1.10 to 192.168.2.10')
  })

  test('auto-play walks the packet to delivery and stops', async ({ page }) => {
    test.setTimeout(60_000)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    // A to C is 4 hops at ~1.4s accumulated per hop
    await expect(page.getByTestId('device-c').getByTestId('packet')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled()
  })
})
