import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const headSha = 'a'.repeat(40)
function snapshot(privateRepo = true, ready = true) {
  return {
    org: 'SyntheticOrg', refreshedAt: new Date().toISOString(),
    repositories: [{
      name: privateRepo ? 'synthetic-private' : 'synthetic-public', private: privateRepo,
      htmlUrl: 'https://example.invalid/repository', workflows: [], metrics: null, deploys: [], packages: [],
      pullRequests: [{ headSha, number: 101, title: 'Synthetic change', author: 'fixture',
        htmlUrl: 'https://example.invalid/pull/101', isDraft: false,
        createdAt: '2026-10-01T12:00:00Z', readyToMerge: ready, reviewSignals: [] }],
    }],
    summary: [{ key: 'open-prs', count: 1 }, { key: 'no-ci', count: 1 }],
    lastMergedPr: null, ciTrend: [],
  }
}

async function openConsumer(page: Page) {
  // Requests stay inside the fixture origin, including links accidentally opened.
  await page.route('https://example.invalid/**', route => route.abort())
  await page.route('**/api/dashboard/snapshot', route => route.fulfill({ json: snapshot(false) }))
  await page.goto('http://127.0.0.1:5365')
}

test('removes private data and merge controls on a host role change', async ({ page }) => {
  await page.route('**/fixture/admin-snapshot', route => route.fulfill({ json: snapshot() }))
  await openConsumer(page)
  await expect(page.getByRole('button', { name: 'synthetic-private', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rebase-merge PR #101', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to guest' }).click()
  await expect(page.getByRole('button', { name: 'synthetic-public', exact: true })).toBeVisible()
  await expect(page.getByText('synthetic-private', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Rebase-merge PR #101', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Switch to admin' }).click()
  await expect(page.getByRole('button', { name: 'synthetic-private', exact: true })).toBeVisible()
})

for (const status of [403, 409]) {
  test(`surfaces merge ${status} and refreshes the stale verdict`, async ({ page }) => {
    let ready = true
    let snapshots = 0
    await page.route('**/fixture/admin-snapshot', route => {
      snapshots++
      return route.fulfill({ json: snapshot(true, ready) })
    })
    await page.route('**/fixture/merge', async route => {
      expect(route.request().postDataJSON()).toEqual({ repo: 'synthetic-private', pullNumber: 101, headSha })
      ready = false
      await route.fulfill({ status, body: status === 403 ? 'Not authorised to merge' : 'Head changed; refresh and review' })
    })
    await openConsumer(page)
    await page.getByRole('button', { name: 'Rebase-merge PR #101', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(status === 403 ? 'Not authorised to merge' : 'Head changed')
    await expect(page.getByRole('button', { name: 'Rebase-merge PR #101', exact: true })).toHaveCount(0)
    expect(snapshots).toBeGreaterThanOrEqual(2)
  })
}

test('submits one merge, displays its receipt and refreshes the snapshot', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-03T12:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-04T12:00:00Z'))
  let calls = 0
  let snapshots = 0
  await page.route('**/fixture/admin-snapshot', route => {
    snapshots++
    return route.fulfill({ json: snapshot() })
  })
  let release!: () => void
  const completion = new Promise<void>(resolve => { release = resolve })
  await page.route('**/fixture/merge', async route => {
    calls++
    expect(route.request().postDataJSON()).toEqual({ repo: 'synthetic-private', pullNumber: 101, headSha })
    await completion
    await route.fulfill({ json: { sha: 'b'.repeat(40) } })
  })
  await openConsumer(page)
  await page.getByRole('button', { name: 'Rebase-merge PR #101', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Merging PR #101', exact: true })).toBeDisabled()
  release()
  await expect(page.getByRole('button', { name: 'Merged PR #101', exact: true })).toBeVisible()
  await page.clock.runFor(900)
  await expect(page.getByRole('button', { name: 'Merged PR #101', exact: true })).toHaveCount(0)
  expect(calls).toBe(1)
  expect(snapshots).toBeGreaterThanOrEqual(2)
})

test('recovers an initial outage and retains cached data through a later outage', async ({ page }) => {
  let unavailable = true
  await page.route('**/fixture/admin-snapshot', route => route.fulfill({
    status: unavailable ? 503 : 200, json: unavailable ? { error: 'Synthetic outage' } : snapshot(),
  }))
  await openConsumer(page)
  await expect(page.getByText('Dashboard unavailable.', { exact: false })).toBeVisible()
  unavailable = false
  await page.getByRole('button', { name: 'Retry now' }).click()
  await expect(page.getByRole('button', { name: 'synthetic-private', exact: true })).toBeVisible()
  unavailable = true
  await page.getByRole('button', { name: 'Refresh fixture' }).click()
  await expect(page.getByRole('status')).toContainText('refresh failed')
  await expect(page.getByRole('button', { name: 'synthetic-private', exact: true })).toBeVisible()
  unavailable = false
  await page.getByRole('button', { name: 'Refresh fixture' }).click()
  await expect(page.getByText('refresh failed · retrying')).toHaveCount(0)
})

test('supports keyboard search and phone layout while recording interaction timing', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    const durations: number[] = []
    Object.assign(window, { fixtureInteractions: durations })
    window.fixtureInteractionObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const event = entry as PerformanceEventTiming
        if (event.interactionId > 0) durations.push(event.duration)
      }
    })
    window.fixtureInteractionObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
  })
  await page.route('**/fixture/admin-snapshot', route => route.fulfill({ json: snapshot() }))
  await openConsumer(page)
  const search = page.getByRole('searchbox')
  await search.focus()
  await page.keyboard.type('absent')
  await expect(page.getByText('synthetic-private', { exact: true })).toHaveCount(0)
  await search.fill('')
  await expect(page.getByRole('button', { name: 'synthetic-private', exact: true })).toBeVisible()
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  const measurements = await page.evaluate(() => {
    for (const entry of window.fixtureInteractionObserver.takeRecords()) {
      const event = entry as PerformanceEventTiming
      if (event.interactionId > 0) window.fixtureInteractions.push(event.duration)
    }
    return {
      client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
      durations: window.fixtureInteractions,
      supported: PerformanceObserver.supportedEntryTypes.includes('event'),
    }
  })
  expect(measurements.scroll).toBeLessThanOrEqual(measurements.client)
  expect(measurements.supported).toBe(true)
  // Empty means no events above the browser's 16ms reporting floor, not INP=0.
  await testInfo.attach('interaction-sample.json', { body: JSON.stringify(measurements), contentType: 'application/json' })
})
